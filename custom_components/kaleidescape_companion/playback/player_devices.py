"""Remove retired player devices and report action references for migration."""

import json
import logging
import re
from urllib.parse import quote

from homeassistant.components import automation, persistent_notification, script
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.setup import async_when_setup

from ..const import DOMAIN
from .ha_controls import FIXED_ACTIONS

_LOGGER = logging.getLogger(__name__)

MIGRATION_ISSUE = "player_action_device_migration"
MIGRATION_TITLE = "Update Kaleidescape Companion player actions"
MIGRATION_GUIDE = (
    "https://github.com/raven42/ha-kaleidescape-companion/blob/main/"
    "docs/guides/player-controls.md#migrate-player-actions-from-060-alpha"
)


def reference_lines(hass, references):
    """Link registry-backed entities to HA's editors; retain plain IDs otherwise."""
    registry = er.async_get(hass) if er.DATA_REGISTRY in hass.data else None
    lines = []
    for entity_id in sorted(references)[:40]:
        entity = registry.async_get(entity_id) if registry else None
        unique_id = entity.unique_id if entity else None
        if isinstance(unique_id, str) and re.fullmatch(
            r"[A-Za-z0-9_-]{1,255}", unique_id
        ):
            domain = entity_id.split(".", 1)[0]
            lines.append(
                f"- [{entity_id}](/config/{domain}/edit/{quote(unique_id, safe='')})"
            )
        else:
            lines.append(f"- `{entity_id}`")
    if len(references) > 40:
        lines.append(f"- {len(references) - 40} additional references omitted.")
    return "\n".join(lines)


def scan_migration_references(hass, device_ids):
    """Return static HA references and whether both components were checked."""
    references = set()
    complete = True
    for component, finder in (
        ("automation", automation.automations_with_device),
        ("script", script.scripts_with_device),
    ):
        if component not in hass.config.components:
            complete = False
            continue
        for device_id in device_ids:
            try:
                found = finder(hass, device_id)
            except Exception:
                _LOGGER.warning(
                    "Could not inspect %s player-action references", component
                )
                complete = False
                continue
            references.update(
                entity_id
                for entity_id in found
                if isinstance(entity_id, str)
                and re.fullmatch(r"(?:automation|script)\.[a-z0-9_]{1,255}", entity_id)
            )
    return references, complete


def _migration_message(hass, references):
    lines = [
        "Companion player actions now use the built-in Kaleidescape player device. "
        "Update automations, scripts, button helpers and other configurations "
        "that use the old Companion player device.",
    ]
    if references:
        lines.append(
            "Home Assistant found these related automations and scripts:\n\n"
            + reference_lines(hass, references)
        )
    lines.append(
        "Home Assistant may not identify templated, invalid or unloaded "
        "configurations, dashboards or external clients. "
        f"[Migration instructions]({MIGRATION_GUIDE})."
    )
    return "\n\n".join(lines)


def _warn_player_migration(hass, entry, device_ids):
    """Publish a durable repair and collect loaded HA references when available."""
    runtime = entry.runtime_data
    references = set()

    def publish():
        message = _migration_message(hass, references)
        persistent_notification.async_create(
            hass, message, MIGRATION_TITLE, MIGRATION_ISSUE
        )
        ir.async_create_issue(
            hass,
            DOMAIN,
            MIGRATION_ISSUE,
            config_entry_id=entry.entry_id,
            is_fixable=True,
            is_persistent=True,
            data={"device_ids": json.dumps(device_ids)},
            severity=ir.IssueSeverity.WARNING,
            translation_key=MIGRATION_ISSUE,
            translation_placeholders={
                "references": reference_lines(hass, references)
                or "No loaded automation or script references identified yet."
            },
            learn_more_url=MIGRATION_GUIDE,
        )

    def collect(component):
        finder = (
            automation.automations_with_device
            if component == "automation"
            else script.scripts_with_device
        )
        before = len(references)
        for device_id in device_ids:
            try:
                found = finder(hass, device_id)
            except Exception:
                _LOGGER.warning(
                    "Could not inspect %s player-action references", component
                )
                continue
            references.update(
                entity_id
                for entity_id in found
                if isinstance(entity_id, str)
                and re.fullmatch(r"(?:automation|script)\.[a-z0-9_]{1,255}", entity_id)
            )
        return len(references) != before

    for component in ("automation", "script"):
        if component in hass.config.components:
            collect(component)
    publish()

    async def when_ready(_hass, component):
        issue = ir.async_get(hass).async_get_issue(DOMAIN, MIGRATION_ISSUE)
        if (
            not runtime.ready
            or getattr(entry, "runtime_data", None) is not runtime
            or issue is None
            or issue.dismissed_version is not None
        ):
            return
        if collect(component):
            publish()

    for component in ("automation", "script"):
        if component not in hass.config.components:
            async_when_setup(hass, component, when_ready)


def remove_obsolete_control_entities(hass, entry):
    """Remove only player-control buttons created by the earlier implementation."""
    if er.DATA_REGISTRY not in hass.data:
        return
    registry = er.async_get(hass)
    prefix = f"{entry.runtime_data.dataset_id}_"
    for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
        if entity.platform != DOMAIN or not entity.entity_id.startswith("button."):
            continue
        if not entity.unique_id.startswith(prefix):
            continue
        serial, separator, operation = entity.unique_id[len(prefix) :].partition("_")
        if (
            separator
            and re.fullmatch(r"[0-9A-F]{1,16}", serial)
            and operation in FIXED_ACTIONS
        ):
            registry.async_remove(entity.entity_id)


def remove_obsolete_player_devices(hass, entry):
    """Remove this dataset's old Companion player devices, never the service device."""
    remove_obsolete_control_entities(hass, entry)
    if dr.DATA_REGISTRY not in hass.data:
        return
    registry = dr.async_get(hass)
    prefix = f"{entry.runtime_data.dataset_id}:player:"
    obsolete = []
    for device in dr.async_entries_for_config_entry(registry, entry.entry_id):
        if len(device.identifiers) != 1:
            continue
        domain, identifier = next(iter(device.identifiers))
        if (
            domain == DOMAIN
            and identifier.startswith(prefix)
            and re.fullmatch(r"[0-9A-F]{1,16}", identifier[len(prefix) :])
        ):
            obsolete.append(device.id)
    if obsolete:
        _warn_player_migration(hass, entry, obsolete)
        for device_id in obsolete:
            registry.async_remove_device(device_id)

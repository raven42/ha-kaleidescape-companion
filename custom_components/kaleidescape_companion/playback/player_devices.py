"""Keep discovered players selectable in HA actions without creating entities."""

import re

from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from ..const import DOMAIN, NAME
from .ha_controls import FIXED_ACTIONS, player_identifier


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


def register_player_devices(hass, entry):
    """Register cached and newly discovered movie players with Home Assistant."""

    @callback
    def update_players():
        runtime = entry.runtime_data
        controls = runtime.controls
        if not runtime.ready or controls is None or not controls.devices:
            return
        # Home Assistant sets up this registry before integrations; isolated tests
        # can run the integration without a registry.
        if dr.DATA_REGISTRY not in hass.data:
            return
        registry = dr.async_get(hass)
        parent = registry.async_get_or_create(
            config_entry_id=entry.entry_id,
            identifiers={(DOMAIN, runtime.dataset_id)},
            name=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )
        for player in controls.devices:
            if not player["is_player"]:
                continue
            registry.async_get_or_create(
                config_entry_id=entry.entry_id,
                identifiers={
                    (DOMAIN, player_identifier(runtime.dataset_id, player["serial"]))
                },
                name=player["name"] or player["model"] or "Movie player",
                manufacturer="Kaleidescape",
                model=player["model"] or None,
                via_device_id=parent.id,
            )

    remove_obsolete_control_entities(hass, entry)
    update_players()
    entry.async_on_unload(
        async_dispatcher_connect(hass, f"{DOMAIN}_control_players", update_players)
    )

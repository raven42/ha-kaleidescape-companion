"""Interactive review of retired player-action device references."""

import json
import re

import probatio
from homeassistant.components import persistent_notification
from homeassistant.components.repairs import RepairsFlow, RepairsFlowResult
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN
from .playback.player_devices import (
    MIGRATION_ISSUE,
    MIGRATION_TITLE,
    _migration_message,
    reference_lines,
    scan_migration_references,
)


class PlayerActionMigrationFlow(RepairsFlow):
    """Recheck references without assuming uninspectable configurations are safe."""

    def __init__(self):
        self.references = "No recheck has been run."
        self.scan_status = (
            "Choose Check again to inspect loaded automations and scripts."
        )

    async def async_step_init(self, user_input=None) -> RepairsFlowResult:
        issue = ir.async_get(self.hass).async_get_issue(DOMAIN, MIGRATION_ISSUE)
        if (
            issue
            and issue.translation_placeholders
            and self.references == "No recheck has been run."
        ):
            self.references = issue.translation_placeholders.get(
                "references", self.references
            )
        return self.async_show_menu(
            step_id="init",
            menu_options=["check_again", "dismiss"],
            description_placeholders={
                "references": self.references,
                "scan_status": self.scan_status,
            },
        )

    async def async_step_check_again(self, user_input=None) -> RepairsFlowResult:
        issue = ir.async_get(self.hass).async_get_issue(DOMAIN, MIGRATION_ISSUE)
        try:
            ids = json.loads((self.data or {}).get("device_ids", ""))
            if (
                not isinstance(ids, list)
                or not ids
                or not all(
                    isinstance(item, str) and re.fullmatch(r"[0-9a-f]{32}", item)
                    for item in ids
                )
            ):
                raise ValueError("Invalid stored device IDs")
        except ValueError, TypeError:
            self.scan_status = (
                "The old device IDs are unavailable, so this check cannot run. "
                "Review your configurations manually."
            )
            return await self.async_step_init()
        references, complete = scan_migration_references(self.hass, ids)
        self.references = (
            reference_lines(self.hass, references)
            or "No references found in loaded automations and scripts."
        )
        self.scan_status = (
            "Checked loaded automations and scripts."
            if complete
            else (
                "The check is incomplete because an automation or script "
                "component is unavailable."
            )
        )
        if issue:
            ir.async_create_issue(
                self.hass,
                DOMAIN,
                MIGRATION_ISSUE,
                config_entry_id=issue.config_entry_id,
                is_fixable=True,
                is_persistent=True,
                severity=ir.IssueSeverity.WARNING,
                translation_key=MIGRATION_ISSUE,
                translation_placeholders={"references": self.references},
                learn_more_url=issue.learn_more_url,
                data=issue.data,
            )
            persistent_notification.async_create(
                self.hass,
                _migration_message(self.hass, references),
                MIGRATION_TITLE,
                MIGRATION_ISSUE,
            )
        return await self.async_step_init()

    async def async_step_dismiss(self, user_input=None) -> RepairsFlowResult:
        if user_input is not None:
            persistent_notification.async_dismiss(self.hass, MIGRATION_ISSUE)
            return self.async_create_entry(data={})
        return self.async_show_form(step_id="dismiss", data_schema=probatio.Schema({}))


async def async_create_fix_flow(
    hass: HomeAssistant, issue_id: str, data
) -> RepairsFlow:
    """Create a flow for the one supported migration repair."""
    if issue_id != MIGRATION_ISSUE:
        raise ValueError("Unknown repair issue")
    return PlayerActionMigrationFlow()

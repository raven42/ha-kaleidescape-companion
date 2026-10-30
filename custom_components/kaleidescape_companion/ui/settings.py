"""Narrow, administrator-only adapter to this entry's native HA options flow."""

import hashlib
import json

import probatio as p
from homeassistant import data_entry_flow
from homeassistant.components.calendar import CalendarEntityFeature
from homeassistant.helpers import config_validation as cv

from ..core.models import JournalError, invalid, text
from ..library.config import DEFAULTS as LIBRARY_DEFAULTS
from .preferences import DEFAULTS as UI_DEFAULTS

OPTION_FIELDS = frozenset(
    {
        "tracking_enabled",
        "media_player",
        "play_status",
        "media_location",
        "minimum_runtime_minutes",
        "minimum_seconds",
        "resume_hours",
    }
    | LIBRARY_DEFAULTS.keys()
    | UI_DEFAULTS.keys()
    | {"calendar_enabled", "calendar_entity", "calendar_title", "calendar_description"}
)


def fingerprint(entry) -> str:
    """Detect settings changed in another tab before committing a form."""
    return hashlib.sha256(
        json.dumps(dict(entry.options or entry.data), sort_keys=True).encode()
    ).hexdigest()


async def options_request(
    hass, entry, actor_id: str, operation: str, msg: dict
) -> dict:
    """Only operate flows started here for this actor and this Companion entry."""
    manager = hass.config_entries.options
    owner = {"companion_user": actor_id}
    if operation == "settings/start":
        for progress in manager.async_progress_by_handler(
            entry.entry_id, match_context=owner
        ):
            manager.async_abort(progress["flow_id"])
        result = await manager.async_init(
            entry.entry_id,
            context={**owner, "companion_config": fingerprint(entry)},
        )
    else:
        flow_id = text(msg["flow_id"], 128)
        try:
            progress = manager.async_get(flow_id)
        except data_entry_flow.UnknownFlow as error:
            raise JournalError(
                "not_found", "Settings flow has ended; reopen settings"
            ) from error
        if (
            progress["handler"] != entry.entry_id
            or progress["context"].get("companion_user") != actor_id
        ):
            raise JournalError(
                "unauthorized", "Settings flow does not belong to this user/entry"
            )
        if operation == "settings/cancel":
            manager.async_abort(flow_id)
            return {"type": "abort"}
        if fingerprint(entry) != progress["context"].get("companion_config"):
            manager.async_abort(flow_id)
            raise JournalError(
                "conflict", "Settings changed elsewhere; reopen settings"
            )
        data = msg["data"]
        if set(data) - OPTION_FIELDS:
            raise invalid("Unknown settings fields")
        try:
            result = await manager.async_configure(flow_id, data)
        except data_entry_flow.InvalidData as error:
            raise invalid("Invalid settings fields") from error
    if result["type"] == data_entry_flow.FlowResultType.FORM:
        return {
            "type": "form",
            "flow_id": result["flow_id"],
            "errors": result.get("errors", {}),
            "calendar_choices": [
                {"value": state.entity_id, "label": state.name}
                for state in hass.states.async_all("calendar")
                if int(state.attributes.get("supported_features", 0))
                & CalendarEntityFeature.CREATE_EVENT
            ][:100],
            "fields": p.to_field_list(
                result["data_schema"], custom_serializer=cv.custom_serializer
            ),
        }
    return {"type": str(result["type"])}

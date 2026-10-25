"""Admin-only journal API over HA's authenticated WebSocket connection."""

from typing import Any

import probatio as p
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .journal import JournalError
from .runtime import get_runtime


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register once; every invocation resolves the current loaded runtime."""
    scoped = {p.Required("entry_id"): str, p.Required("dataset_id"): str}
    mutations = {**scoped, p.Required("request_id"): str}
    schemas = {
        "info": {},
        "journal/create": {**mutations, p.Required("data"): dict},
        "journal/get": {**scoped, p.Required("viewing_id"): str},
        "journal/sessions": {**scoped, p.Required("viewing_id"): str},
        "now_playing": scoped,
        "journal/list": {
            **scoped,
            p.Optional("query"): str,
            p.Optional("status"): str,
            p.Optional("limit"): int,
            p.Optional("cursor"): str,
        },
        "journal/update": {
            **mutations,
            p.Required("viewing_id"): str,
            p.Required("expected_revision"): int,
            p.Required("patch"): dict,
        },
        "journal/delete": {
            **mutations,
            p.Required("viewing_id"): str,
            p.Required("expected_revision"): int,
        },
    }
    for operation, properties in schemas.items():
        command = f"{DOMAIN}/{operation}"
        websocket_api.async_register_command(
            hass,
            command,
            websocket_api.async_response(async_handle),
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
                {p.Required("type"): command, **properties}
            ),
        )


async def async_handle(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Reject unauthorized calls before reading private metadata or storage."""
    user = connection.user
    if user is None or not user.is_active or not user.is_admin:
        connection.send_error(
            msg["id"], "unauthorized", "Administrator access required"
        )
        return
    try:
        operation = msg["type"].removeprefix(f"{DOMAIN}/")
        if operation == "info":
            entries = []
            for entry_id, runtime in list(hass.data.get(DOMAIN, {}).items()):
                if runtime.ready:
                    entries.append(
                        {
                            "entry_id": entry_id,
                            **await runtime.repository.async_info(),
                            "api_version": 1,
                            "tracking_enabled": runtime.observer is not None,
                            "features": {
                                "manual_journal": True,
                                "automatic_tracking": True,
                                "now_playing": True,
                            },
                        }
                    )
            result = {"entries": entries}
        else:
            runtime = get_runtime(hass, msg["entry_id"], msg["dataset_id"])
            repository = runtime.repository
            match operation:
                case "journal/create":
                    result = await repository.async_create(
                        msg["request_id"], msg["data"]
                    )
                case "journal/get":
                    result = await repository.async_get(msg["viewing_id"])
                case "journal/sessions":
                    result = await repository.async_sessions(msg["viewing_id"])
                case "now_playing":
                    result = {
                        "players": [runtime.observer.live_state()]
                        if runtime.observer
                        else []
                    }
                case "journal/list":
                    result = await repository.async_list(
                        query=msg.get("query", ""),
                        viewing_status=msg.get("status"),
                        limit=msg.get("limit", 50),
                        cursor=msg.get("cursor"),
                    )
                case "journal/update":
                    result = await repository.async_update(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                        msg["patch"],
                    )
                case "journal/delete":
                    result = await repository.async_delete(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                    )
                case _:
                    raise JournalError("invalid_request", "Unknown journal command")
        connection.send_result(msg["id"], result)
    except JournalError as error:
        connection.send_error(msg["id"], error.code, str(error))

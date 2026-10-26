"""Household journal reads and administrator management through HA authentication."""

from typing import Any

import probatio as p
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .journal import JournalError
from .runtime import get_runtime, loaded_runtimes
from .security import is_active_admin, is_active_user

READ_OPERATIONS = frozenset({"info", "journal/list", "journal/get"})
PUBLIC_FIELDS = frozenset(
    {
        "id",
        "title",
        "started_at",
        "ended_at",
        "duration_seconds",
        "watched_seconds",
        "status",
        "origin",
    }
)


def public_viewing(record: dict) -> dict:
    """Use a positive allowlist so future private fields cannot leak into reads."""
    return {key: value for key, value in record.items() if key in PUBLIC_FIELDS}


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
    operation = msg["type"].removeprefix(f"{DOMAIN}/")
    admin = is_active_admin(user)
    if not is_active_user(user) or (operation not in READ_OPERATIONS and not admin):
        connection.send_error(
            msg["id"], "unauthorized", "Access to this journal operation is denied"
        )
        return
    try:
        if operation == "info":
            entries = []
            for entry_id, runtime in loaded_runtimes(hass):
                metadata = await runtime.repository.async_info()
                if not runtime.ready:
                    continue
                if not admin:
                    metadata = {
                        key: metadata[key]
                        for key in ("dataset_id", "revision", "viewing_count")
                    }
                entries.append(
                    {
                        "entry_id": entry_id,
                        **metadata,
                        "api_version": 1,
                        "permissions": {
                            "read": True,
                            "edit": admin,
                            "export": admin,
                        },
                        **(
                            {
                                "tracking_enabled": runtime.observer is not None,
                                "features": {
                                    "manual_journal": True,
                                    "automatic_tracking": True,
                                    "now_playing": True,
                                },
                            }
                            if admin
                            else {}
                        ),
                    }
                )
            result = {"entries": entries}
        else:
            runtime = get_runtime(hass, msg["entry_id"], msg["dataset_id"])
            repository = runtime.repository
            match operation:
                case "journal/create":
                    result = await repository.async_create(
                        msg["request_id"], msg["data"], actor_id=user.id
                    )
                case "journal/get":
                    result = await repository.async_get(msg["viewing_id"])
                    if not admin:
                        result = public_viewing(result)
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
                    if not admin:
                        result["items"] = [
                            public_viewing(row) for row in result["items"]
                        ]
                case "journal/update":
                    result = await repository.async_update(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                        msg["patch"],
                        actor_id=user.id,
                    )
                case "journal/delete":
                    result = await repository.async_delete(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                        actor_id=user.id,
                    )
                case _:
                    raise JournalError("invalid_request", "Unknown journal command")
        # Accepted writes still commit; do not disclose private results if access
        # changed while the worker was running.
        if not is_active_user(user) or is_active_admin(user) != admin:
            connection.send_error(
                msg["id"], "unauthorized", "Journal access changed during the request"
            )
            return
        if operation != "info" and not runtime.ready:
            raise JournalError("not_ready", "Journal integration unloaded")
        connection.send_result(msg["id"], result)
    except JournalError as error:
        connection.send_error(msg["id"], error.code, str(error))

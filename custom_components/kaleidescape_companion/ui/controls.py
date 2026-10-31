"""Household control access, separate administration and positive projections."""

from ..core.models import JournalError, invalid
from ..core.runtime import get_runtime
from ..core.security import is_active_admin, is_active_user
from ..playback.control_config import fingerprint


async def control_request(hass, user, runtime, operation, msg):
    controls = runtime.controls
    if controls is None:
        raise JournalError("not_ready", "Controls are unavailable")

    def authorize():
        if not is_active_user(user) or (
            operation in {"control/discover", "control/acknowledge"}
            and not is_active_admin(user)
        ):
            raise JournalError("unauthorized", "This operation is not permitted")
        if get_runtime(hass, msg["entry_id"], msg["dataset_id"]) is not runtime:
            raise JournalError("not_ready", "Integration reloaded")
        entry = hass.config_entries.async_get_entry(msg["entry_id"])
        if fingerprint(dict(entry.options or entry.data)) != controls.fingerprint:
            raise JournalError("refresh_required", "Control settings changed")

    authorize()
    if operation == "control/info":
        result = await controls.async_info()
    elif operation == "control/discover":
        result = await controls.async_discover(authorize)
    elif operation == "control/status":
        result = await controls.async_status(authorize, msg.get("player_id"))
    elif operation == "control/prepare":
        result = await controls.async_prepare(
            user.id,
            msg["operation"],
            msg.get("title_id"),
            authorize,
            msg.get("player_id"),
        )
    elif operation == "control/execute":
        result = await controls.async_execute(
            user.id, msg["request_id"], msg["token"], authorize
        )
    elif operation == "control/acknowledge":
        if msg["confirmation"] != "REVIEWED":
            raise invalid("Inspect the device before acknowledging uncertainty")
        result = await runtime.repository.async_control(
            "acknowledge", msg["request_id"], user.id
        )
    else:
        raise invalid("Unsupported control operation")
    authorize()
    if operation in {"control/info", "control/discover"}:
        # Sharing playback is not sharing network inventory or another actor's receipts.
        admin = is_active_admin(user)
        pending = result["pending"]
        return {
            "enabled": result["enabled"],
            "allow_launch": result["allow_launch"],
            "default_player": controls.player_id(result["default_player"]),
            "players": controls.players(),
            "can_manage": admin,
            "blocked_players": list(
                dict.fromkeys(
                    controls.player_id(row["player_serial"]) for row in pending
                )
            ),
            "pending": [
                {
                    "request_id": row["request_id"],
                    "player_id": controls.player_id(row["player_serial"]),
                    "operation": row["operation"],
                    "created_at": row["created_at"],
                }
                for row in pending
                if admin or row["actor_id"] == user.id
            ],
            **({"devices": result["devices"]} if admin else {}),
        }
    if operation == "control/acknowledge":
        return {"pending_count": len(result["pending"])}
    return result

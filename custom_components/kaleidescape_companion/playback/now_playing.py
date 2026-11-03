"""Permission-checked HA snapshots and token-free artwork references; no device IO."""

import hashlib
from urllib.parse import urlsplit

from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.helpers import entity_registry as er

from ..core.models import JournalError, seconds, text
from ..core.security import is_active_admin
from .identity import normalize_serial

PUBLIC_FIELDS = (
    "entity_id",
    "name",
    "title",
    "duration_seconds",
    "play_status",
    "location",
    "available",
    "observed_at",
    "artwork_key",
    "content_key",
    "power_state",
)


def picture_key(entity_id, picture, active):
    """Accept only the selected HA player's image path; never disclose query tokens."""
    if not active or not entity_id:
        return None
    try:
        picture = text(picture, 4096)
        parsed = urlsplit(picture)
        if (
            not parsed.scheme
            and not parsed.netloc
            and parsed.path == (f"/api/media_player_proxy/{entity_id}")
        ):
            return hashlib.sha256(picture.encode()).hexdigest()[:16]
    except JournalError, ValueError:
        pass
    return None


def source_entity(hass, serial):
    """Use the built-in integration's public registry identity, not its runtime."""
    for entry in er.async_get(hass).entities.values():
        if entry.domain != "media_player" or entry.platform != "kaleidescape":
            continue
        try:
            if normalize_serial(entry.unique_id) == serial and not entry.disabled:
                return entry.entity_id
        except ValueError:
            continue
    return None


def _text(attributes, key, maximum=255):
    try:
        return text(attributes.get(key), maximum)
    except JournalError:
        return None


def snapshot(hass, user, runtime, player_id=None):
    """Share display fields, retaining recording evidence only for administrators."""
    observer = runtime.observer
    entity_id = observer.entities.get("media_player") if observer else None
    controls = runtime.controls
    if player_id or (
        not entity_id
        and controls
        and controls.config.get("control_enabled")
        and controls.config.get("control_player")
    ):
        if controls is None or not controls.config.get("control_enabled", False):
            raise JournalError("control_disabled", "Playback controls are disabled")
        serial = controls._selected_serial(player_id)
        entity_id = source_entity(hass, serial)
        # Never show another player's artwork when this target lacks an HA entity.
        if entity_id is None:
            return {"players": []}
    if not entity_id:
        return {"players": []}
    entities = (
        observer.entities.values()
        if observer and observer.entities.get("media_player") == entity_id
        else (entity_id,)
    )
    if any(
        not user.permissions.check_entity(value, POLICY_READ)
        for value in entities
        if value
    ):
        raise JournalError("unauthorized", "Source entity access denied")
    state = hass.states.get(entity_id)
    if observer and observer.entities.get("media_player") == entity_id:
        value = observer.live_state()
    else:
        attrs = state.attributes if state else {}
        active = bool(state and state.state in {"playing", "paused", "buffering"})
        try:
            duration = seconds(attrs.get("media_duration"))
        except JournalError:
            duration = None
        value = {
            "entity_id": entity_id,
            "name": _text(attrs, "friendly_name"),
            "title": _text(attrs, "media_title", 1000),
            "raw_content_id": _text(attrs, "media_content_id", 2048),
            "duration_seconds": duration,
            "play_status": state.state if active else "stopped",
            "location": "unknown",
            "available": bool(state and state.state not in {"unknown", "unavailable"}),
            "observed_at": state.last_updated.isoformat() if state else None,
            "artwork_key": picture_key(entity_id, attrs.get("entity_picture"), active),
        }
    content = value.get("raw_content_id")
    value["content_key"] = (
        hashlib.sha256(content.encode()).hexdigest()[:16] if content else None
    )
    value["power_state"] = (
        "standby"
        if state and state.state == "off"
        else "on"
        if state and state.state not in {"unknown", "unavailable"}
        else "unknown"
    )
    if not is_active_admin(user):
        value = {key: value.get(key) for key in PUBLIC_FIELDS}
    return {"players": [value]}

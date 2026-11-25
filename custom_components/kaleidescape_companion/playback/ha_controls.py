"""Home Assistant player controls sharing Companion's verified command path."""

from uuid import uuid4

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr

from ..core.models import JournalError
from ..core.security import is_active_user
from .control_config import COMMANDS, fingerprint
from .identity import normalize_serial

# Fixed, button-compatible pyk and Companion commands.
FIXED_ACTIONS = {
    "power_on": "Power on",
    "power_off": "Standby",
    "play": "Play",
    "pause": "Pause",
    "resume": "Resume",
    "pause_toggle": "Toggle pause",
    "play_pause": "Play or pause",
    "stop": "Stop",
    "next": "Next chapter",
    "previous": "Previous chapter",
    "replay": "Replay",
    "scan_forward": "Scan forward",
    "scan_reverse": "Scan reverse",
    "up": "Up",
    "down": "Down",
    "left": "Left",
    "right": "Right",
    "select": "Select",
    "back": "Back",
    "cancel": "Cancel",
    "backspace": "Backspace",
    "page_up": "Page up",
    "page_down": "Page down",
    "menu": "Toggle menu",
    "menu_on": "Open menu",
    "menu_off": "Close menu",
    "details": "Details",
    "status_and_settings": "Status and settings",
    "go_movies": "Go to movies",
    "movies": "Movie covers",
    "movie_list": "Movie list",
    "movie_collections": "Movie collections",
    "movie_store": "Movie Store",
    "search": "Search",
    "screensaver": "Start screensaver",
    "screensaver_off": "Stop screensaver",
    "intermission": "Toggle intermission",
    "collection_paused": "Paused collection",
    "collection_watch_soon": "Watch Soon collection",
    "collection_new": "New collection",
    "collection_favorites": "Favorites collection",
}


def resolve_player(hass, runtime, device_id):
    """Match a built-in Kaleidescape device to one discovered Companion player."""
    device = dr.async_get(hass).async_get(device_id)
    entry = (
        hass.config_entries.async_get_entry(device.config_entry_id)
        if device is not None and device.config_entry_id
        else None
    )
    if entry is not None and entry.domain == "kaleidescape":
        serials = set()
        for domain, identity in device.identifiers:
            if domain != "kaleidescape":
                continue
            try:
                serials.add(normalize_serial(identity))
            except ValueError:
                continue
        matches = {
            player["serial"]
            for player in runtime.controls.devices
            if player["is_player"] and normalize_serial(player["serial"]) in serials
        }
        if len(matches) == 1:
            return matches.pop()
    raise HomeAssistantError(
        "Select a built-in Kaleidescape player discovered in Companion settings"
    )


async def authorize_control(hass, entry, serial, context):
    """Create a rechecked authorization for an HA actor and discovered player."""
    runtime = entry.runtime_data
    controls = runtime.controls
    if controls is None:
        raise HomeAssistantError("Player controls are unavailable")
    user_id = context.user_id if context else None
    user = await hass.auth.async_get_user(user_id) if user_id else None
    actor = user_id or "home-assistant"

    def authorize():
        if (
            not runtime.ready
            or getattr(entry, "runtime_data", None) is not runtime
            or runtime.controls is not controls
            or fingerprint(dict(entry.options or entry.data)) != controls.fingerprint
            or not any(
                row["is_player"] and row["serial"] == serial for row in controls.devices
            )
            or (user_id is not None and not is_active_user(user))
        ):
            raise JournalError("not_ready", "Player controls are unavailable")

    try:
        controls._ready(authorize)
    except JournalError as error:
        raise HomeAssistantError(str(error)) from None
    return controls, actor, authorize


async def run_control(
    hass, entry, serial, operation, context, *, title_id=None, parameter=None
):
    """Send one explicit action using the shared identity and receipt safeguards."""
    controls, actor, authorize = await authorize_control(hass, entry, serial, context)
    try:
        review = await controls.async_prepare(
            actor,
            operation,
            title_id,
            authorize,
            controls.player_id(serial),
            parameter=parameter,
        )
        result = await controls.async_execute(
            actor, str(uuid4()), review["token"], authorize
        )
    except JournalError as error:
        raise HomeAssistantError(str(error)) from None
    if result["outcome"] in ("not_sent", "rejected"):
        raise HomeAssistantError("The player did not accept the command")
    return result


assert FIXED_ACTIONS.keys() == COMMANDS.keys()

"""Parameterized Home Assistant actions for discovered Kaleidescape players."""

import voluptuous as vol
from homeassistant.core import SupportsResponse
from homeassistant.exceptions import HomeAssistantError

from ..const import DOMAIN
from ..core.models import JournalError
from ..core.runtime import loaded_runtimes
from ..core.security import is_active_user
from ..library.config import origin
from ..library.store import source_id
from .ha_controls import FIXED_ACTIONS, authorize_control, resolve_player, run_control

PARAMETER_SERVICES = {
    "keyboard_character": "keyboard_character",
    "set_player_input": "set_input",
    "open_movie_collection": "named_collection",
}
PLAY_MOVIE_SERVICE = "play_movie"
FIXED_SERVICES = {f"player_{operation}": operation for operation in FIXED_ACTIONS}
PLAYER_SERVICES = (*FIXED_SERVICES, *PARAMETER_SERVICES, PLAY_MOVIE_SERVICE)


def register_player_services(hass):
    """Register fixed actions; no raw protocol command is accepted."""

    async def run(call):
        runtimes = loaded_runtimes(hass)
        if len(runtimes) != 1:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        entry_id, runtime = runtimes[0]
        entry = hass.config_entries.async_get_entry(entry_id)
        if (
            not entry
            or getattr(entry, "runtime_data", None) is not runtime
            or not runtime.controls
        ):
            raise HomeAssistantError("Player controls are unavailable")
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if not is_active_user(user):
                raise HomeAssistantError("An active Home Assistant user is required")
        if not runtime.controls.config.get("control_enabled", False):
            raise HomeAssistantError("Enable playback controls in Companion settings")
        serial = resolve_player(hass, runtime, call.data["device_id"])
        controls, _actor, authorize = await authorize_control(
            hass, entry, serial, call.context
        )
        title_id = None
        operation = FIXED_SERVICES.get(call.service) or PARAMETER_SERVICES.get(
            call.service
        )
        if call.service == PLAY_MOVIE_SERVICE:
            operation = "launch"
            title_id = call.data.get("version_id")
            title = call.data.get("title")
            if bool(title_id) == bool(title):
                raise HomeAssistantError(
                    "Provide exactly one movie title or Library version ID"
                )
            if title:
                try:
                    source = source_id(
                        origin(runtime.controls.config.get("library_host", ""))
                    )
                    title_id = await runtime.repository.async_control(
                        "library_title", source, title
                    )
                    controls._ready(authorize)
                except (JournalError, ValueError) as error:
                    try:
                        controls._ready(authorize)
                    except JournalError as revoked:
                        raise HomeAssistantError(str(revoked)) from None
                    raise HomeAssistantError(str(error)) from None
        result = await run_control(
            hass,
            entry,
            serial,
            operation,
            call.context,
            title_id=title_id,
            parameter=call.data.get("value"),
        )
        return result if call.return_response else None

    for service in FIXED_SERVICES:
        hass.services.async_register(
            DOMAIN,
            service,
            run,
            schema=vol.Schema({vol.Required("device_id"): str}),
            supports_response=SupportsResponse.OPTIONAL,
        )
    for service in PARAMETER_SERVICES:
        hass.services.async_register(
            DOMAIN,
            service,
            run,
            schema=vol.Schema(
                {vol.Required("device_id"): str, vol.Required("value"): object}
            ),
            supports_response=SupportsResponse.OPTIONAL,
        )
    hass.services.async_register(
        DOMAIN,
        PLAY_MOVIE_SERVICE,
        run,
        schema=vol.Schema(
            {
                vol.Required("device_id"): str,
                vol.Optional("title"): str,
                vol.Optional("version_id"): str,
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )

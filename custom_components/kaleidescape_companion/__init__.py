"""Home Assistant journal backend for Kaleidescape Companion."""

import logging
from pathlib import Path

from homeassistant.const import EVENT_HOMEASSISTANT_STOP, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady

from .const import DOMAIN, NAME
from .http import JournalExportView
from .journal import JournalError
from .migrations import UnsupportedSchemaError
from .observation import PlaybackObserver
from .panel import async_remove_panel, async_setup_panel
from .repository import JournalRepository
from .runtime import KaleidescapeConfigEntry, KaleidescapeRuntime, loaded_runtimes
from .websocket import async_register_commands

_LOGGER = logging.getLogger(__name__)
PLATFORMS = [Platform.SENSOR]


async def _async_close_runtime(
    runtime: KaleidescapeRuntime, close_reason: str | None = None
) -> None:
    runtime.ready = False
    try:
        if runtime.observer:
            await runtime.observer.async_stop(close_reason)
    except JournalError as error:
        _LOGGER.error(
            "Playback shutdown could not persist all observations: %s", error.code
        )
    finally:
        await runtime.repository.async_close()


async def async_setup_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Open durable storage and expose the API without connecting to devices."""
    if loaded_runtimes(hass):
        raise ConfigEntryError("Only one household journal entry is supported")
    if entry.title == "Kaleidescape":
        hass.config_entries.async_update_entry(entry, title=NAME)
    repository = JournalRepository(Path(hass.config.path(DOMAIN, "journal.sqlite3")))
    try:
        await repository.async_open()
        info = await repository.async_info()
    except UnsupportedSchemaError as error:
        await repository.async_close()
        raise ConfigEntryError(str(error)) from error
    except JournalError as error:
        await repository.async_close()
        raise ConfigEntryNotReady("Could not open the journal database") from error
    except BaseException:
        await repository.async_close()
        raise
    runtime = entry.runtime_data = KaleidescapeRuntime(repository, info["dataset_id"])
    panel_registered = False
    platforms_started = False
    try:
        if not hass.data.get(f"{DOMAIN}.api_registered"):
            async_register_commands(hass)
            hass.http.register_view(JournalExportView())
            hass.data[f"{DOMAIN}.api_registered"] = True
        config = dict(entry.options or entry.data)
        if config.get("tracking_enabled"):
            runtime.observer = PlaybackObserver(hass, repository, config)
            await runtime.observer.async_start()
        await async_setup_panel(hass)
        panel_registered = True
        platforms_started = True
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

        async def async_stop(_event) -> None:
            await _async_close_runtime(runtime)

        entry.async_on_unload(
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, async_stop)
        )
    except BaseException:
        try:
            if platforms_started:
                await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        finally:
            if panel_registered:
                async_remove_panel(hass)
            await _async_close_runtime(runtime)
        raise
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Drain accepted writes and retain the database for reload or reinstallation."""
    runtime = entry.runtime_data
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    config = dict(entry.options or entry.data)
    reason = None
    if runtime.observer:
        if not config.get("tracking_enabled"):
            reason = "tracking_disabled"
        elif config.get("player_id") != runtime.observer.config["player_id"]:
            reason = "player_changed"
    await _async_close_runtime(runtime, reason)
    async_remove_panel(hass)
    return True

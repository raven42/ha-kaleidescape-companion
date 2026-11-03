"""Home Assistant journal backend for Kaleidescape Companion."""

import logging
from pathlib import Path

from homeassistant.const import EVENT_HOMEASSISTANT_STOP, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady

from .calendar.publisher import CalendarPublisher
from .const import DOMAIN, NAME
from .core.logging import safe_exception
from .core.migrations import UnsupportedSchemaError
from .core.models import JournalError
from .core.repository import JournalRepository
from .core.runtime import KaleidescapeConfigEntry, KaleidescapeRuntime, loaded_runtimes
from .enrichment.http import MetadataImageView
from .enrichment.sync import MetadataSync
from .library.config import origin
from .library.store import source_id
from .library.sync import LibrarySync
from .playback.controls import PlaybackControls
from .playback.observer import PlaybackObserver
from .ui.http import JournalExportView, JournalImportView, LibraryArtworkView
from .ui.panel import async_remove_panel, async_setup_panel
from .ui.websocket import async_register_commands

PLATFORMS = [Platform.SENSOR]
_LOGGER = logging.getLogger(__name__)


async def _async_close_runtime(
    runtime: KaleidescapeRuntime, close_reason: str | None = None
) -> None:
    runtime.ready = False
    try:
        if runtime.controls:
            await runtime.controls.async_stop()
        if runtime.calendar:
            await runtime.calendar.async_stop()
        if runtime.enrichment:
            await runtime.enrichment.async_stop()
        if runtime.library:
            await runtime.library.async_stop()
        if runtime.observer:
            await runtime.observer.async_stop(close_reason)
    except JournalError as error:
        _LOGGER.error("Runtime cleanup did not complete: %s", safe_exception(error))
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
    _LOGGER.debug("Opening journal storage and preparing integration")
    try:
        await repository.async_open()
        await repository.async_seed_ui_preferences(dict(entry.options or entry.data))
        await repository.async_metadata_sources(dict(entry.options or entry.data))
        ui_keys = {
            "library_default_view",
            "library_default_count",
            "library_excluded_collections",
        }
        if ui_keys & (entry.data.keys() | entry.options.keys()):
            hass.config_entries.async_update_entry(
                entry,
                data={k: v for k, v in entry.data.items() if k not in ui_keys},
                options={k: v for k, v in entry.options.items() if k not in ui_keys},
            )
        info = await repository.async_info()
    except UnsupportedSchemaError as error:
        await repository.async_close()
        _LOGGER.debug("Journal setup failed: %s", safe_exception(error))
        message = str(error)
        if message not in {
            "SQLite 3.35 or newer is required",
            "Journal schema is newer than this integration",
            "Unrecognized journal database; left unchanged",
        }:
            message = "Journal schema is unsupported"
        raise ConfigEntryError(message) from None
    except JournalError as error:
        await repository.async_close()
        _LOGGER.debug("Journal setup failed: %s", safe_exception(error))
        raise ConfigEntryNotReady("Could not open the journal database") from None
    except Exception as error:
        await repository.async_close()
        _LOGGER.debug("Journal setup fault: %s", safe_exception(error))
        raise ConfigEntryError("Unexpected journal setup failure") from None
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
            hass.http.register_view(JournalImportView())
            hass.http.register_view(LibraryArtworkView())
            hass.http.register_view(MetadataImageView())
            hass.data[f"{DOMAIN}.api_registered"] = True
        config = dict(entry.options or entry.data)
        runtime.controls = PlaybackControls(hass, repository, config)
        await runtime.controls.async_start()
        await repository.async_recording_library(
            source_id(origin(config.get("library_host", "")))
            if config.get("library_enabled", False)
            else None
        )
        runtime.calendar = CalendarPublisher(hass, repository, entry)
        await runtime.calendar.async_start()
        if config.get("tracking_enabled"):
            runtime.observer = PlaybackObserver(hass, repository, config)
            await runtime.observer.async_start()
        panel_registered = await async_setup_panel(hass)
        platforms_started = True
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        if config.get("library_enabled", False):
            if config.get("metadata_store_enabled") or config.get(
                "metadata_tmdb_enabled"
            ):
                runtime.enrichment = MetadataSync(hass, repository, entry)
            runtime.library = LibrarySync(hass, repository, config)
            if runtime.enrichment:
                runtime.library.after_sync = runtime.enrichment.request_sync
            await runtime.library.async_start()

        async def async_stop(_event) -> None:
            await _async_close_runtime(runtime)

        entry.async_on_unload(
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, async_stop)
        )
    except BaseException as error:
        try:
            if platforms_started:
                await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        finally:
            if panel_registered:
                async_remove_panel(hass)
            await _async_close_runtime(runtime)
        if isinstance(error, Exception):
            _LOGGER.debug("Companion initialization fault: %s", safe_exception(error))
            if isinstance(error, ConfigEntryNotReady):
                raise ConfigEntryNotReady(
                    "Companion initialization is not ready"
                ) from None
            if type(error) is ValueError:
                raise ValueError("Companion initialization failed") from None
            if type(error) is RuntimeError:
                raise RuntimeError("Companion initialization failed") from None
            raise ConfigEntryError("Companion initialization failed") from None
        raise
    _LOGGER.info("Kaleidescape Companion is ready")
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Drain accepted writes and retain the database for reload or reinstallation."""
    runtime = entry.runtime_data
    _LOGGER.debug("Unloading Kaleidescape Companion")
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
    if not runtime.preserve_panel_on_reload or entry.disabled_by is not None:
        async_remove_panel(hass)
    _LOGGER.debug("Kaleidescape Companion unload processing finished")
    return True


async def async_remove_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> None:
    """Remove any panel retained across an options reload that failed to finish."""
    async_remove_panel(hass)

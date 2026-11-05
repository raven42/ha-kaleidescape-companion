"""Home Assistant journal backend for Kaleidescape Companion."""

import asyncio
import logging
from pathlib import Path

from homeassistant.const import EVENT_HOMEASSISTANT_STOP, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady
from homeassistant.setup import async_when_setup

from .calendar.publisher import CalendarPublisher
from .const import DOMAIN, NAME
from .core.logging import safe_exception
from .core.migrations import UnsupportedSchemaError
from .core.models import JournalError
from .core.repository import JournalRepository
from .core.runtime import KaleidescapeConfigEntry, KaleidescapeRuntime, loaded_runtimes
from .core.security import async_finish_cleanup
from .enrichment.http import MetadataImageView
from .enrichment.sync import MetadataSync
from .library.config import origin
from .library.store import source_id
from .library.sync import LibrarySync
from .playback.controls import PlaybackControls
from .playback.observer import PlaybackObserver
from .services import (
    CALENDAR_SERVICE,
    LIBRARY_SERVICE,
    METADATA_SERVICE,
    SERVICE,
    async_register_services,
)
from .ui.automation_templates import async_install_missing
from .ui.http import JournalExportView, JournalImportView, LibraryArtworkView
from .ui.panel import async_remove_panel, async_setup_panel
from .ui.websocket import async_register_commands

PLATFORMS = [Platform.SENSOR, Platform.BUTTON, Platform.SWITCH]
_LOGGER = logging.getLogger(__name__)


async def _async_close_runtime(
    runtime: KaleidescapeRuntime, close_reason: str | None = None
) -> None:
    runtime.ready = False

    async def close_all() -> None:
        failures = []
        cancelled = False
        owners = (
            ("controls", runtime.controls, ()),
            ("calendar", runtime.calendar, ()),
            ("enrichment", runtime.enrichment, ()),
            ("library", runtime.library, ()),
            ("observer", runtime.observer, (close_reason,)),
            ("repository", runtime.repository, ()),
        )
        for name, owner, args in owners:
            if owner is None:
                continue
            try:
                await (
                    owner.async_close(*args)
                    if name == "repository"
                    else owner.async_stop(*args)
                )
            except asyncio.CancelledError:
                cancelled = True
                failures.append(name)
            except Exception as error:
                failures.append(name)
                _LOGGER.error(
                    "Runtime cleanup failed at %s: %s", name, safe_exception(error)
                )
        if failures:
            _LOGGER.error("Runtime cleanup incomplete at: %s", ", ".join(failures))
        if cancelled:
            raise asyncio.CancelledError
        if failures:
            raise RuntimeError("Companion runtime cleanup incomplete") from None

    await async_finish_cleanup(close_all())


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
    except BaseException as error:
        try:
            await async_finish_cleanup(repository.async_close())
        except asyncio.CancelledError:
            raise asyncio.CancelledError from None
        except Exception as close_error:
            _LOGGER.error(
                "Journal setup cleanup failed: %s", safe_exception(close_error)
            )
        if isinstance(error, asyncio.CancelledError):
            raise asyncio.CancelledError from None
        if isinstance(error, UnsupportedSchemaError):
            _LOGGER.debug("Journal setup failed: %s", safe_exception(error))
            message = str(error)
            if message not in {
                "SQLite 3.35 or newer is required",
                "Journal schema is newer than this integration",
                "Unrecognized journal database; left unchanged",
            }:
                message = "Journal schema is unsupported"
            raise ConfigEntryError(message) from None
        if isinstance(error, JournalError):
            _LOGGER.debug("Journal setup failed: %s", safe_exception(error))
            raise ConfigEntryNotReady("Could not open the journal database") from None
        if isinstance(error, Exception):
            _LOGGER.debug("Journal setup fault: %s", safe_exception(error))
            raise ConfigEntryError("Unexpected journal setup failure") from None
        raise
    runtime = entry.runtime_data = KaleidescapeRuntime(repository, info["dataset_id"])
    panel_registered = False
    platforms_started = False
    stop_listener = None
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
        if config.get("library_enabled", False):
            if config.get("metadata_store_enabled") or config.get(
                "metadata_tmdb_enabled"
            ):
                runtime.enrichment = MetadataSync(hass, repository, entry)
            runtime.library = LibrarySync(hass, repository, config)
            await runtime.library.async_start()

        async def async_stop(_event) -> None:
            await _async_close_runtime(runtime)

        stop_listener = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, async_stop)
        # HA publishes entity availability as platforms start. Initialize the
        # optional workers first so the initial button states are accurate.
        platforms_started = True
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

        async_register_services(hass)

        async def setup_blueprints(_hass, _component):
            if runtime.ready and getattr(entry, "runtime_data", None) is runtime:
                await async_install_missing(hass)

        if hass.data.get("blueprint", {}).get("automation") is not None:
            await setup_blueprints(hass, "automation")
        else:
            # HA may load automation after this integration, or not load it at all.
            async_when_setup(hass, "automation", setup_blueprints)
        entry.async_on_unload(stop_listener)
    except BaseException as error:

        async def rollback() -> None:
            if platforms_started:
                try:
                    unloaded = await hass.config_entries.async_unload_platforms(
                        entry, PLATFORMS
                    )
                except BaseException as rollback_error:
                    _LOGGER.error(
                        "Platform rollback failed: %s", safe_exception(rollback_error)
                    )
                    return
                if not unloaded:
                    _LOGGER.error(
                        "Platform rollback was refused; retaining the runtime"
                    )
                    return
            if stop_listener:
                stop_listener()
            try:
                if panel_registered:
                    async_remove_panel(hass)
            finally:
                await _async_close_runtime(runtime)

        cancelled = isinstance(error, asyncio.CancelledError)
        try:
            await async_finish_cleanup(rollback())
        except BaseException as rollback_error:
            cancelled |= isinstance(rollback_error, asyncio.CancelledError)
            _LOGGER.error(
                "Companion rollback failed: %s", safe_exception(rollback_error)
            )
        if cancelled:
            raise asyncio.CancelledError from None
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
    hass.services.async_remove(DOMAIN, SERVICE)
    hass.services.async_remove(DOMAIN, METADATA_SERVICE)
    hass.services.async_remove(DOMAIN, LIBRARY_SERVICE)
    hass.services.async_remove(DOMAIN, CALENDAR_SERVICE)
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

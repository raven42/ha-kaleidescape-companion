"""Home Assistant journal backend for Kaleidescape."""

from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady

from .const import DOMAIN
from .http import JournalExportView
from .journal import JournalError
from .migrations import UnsupportedSchemaError
from .repository import JournalRepository
from .runtime import KaleidescapeRuntime
from .websocket import async_register_commands

type KaleidescapeConfigEntry = ConfigEntry[KaleidescapeRuntime]


async def async_setup_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Open durable storage and expose the API without connecting to devices."""
    runtimes = hass.data.setdefault(DOMAIN, {})
    if runtimes:
        raise ConfigEntryError("Only one household journal entry is supported")
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
    try:
        if not hass.data.get(f"{DOMAIN}.api_registered"):
            async_register_commands(hass)
            hass.http.register_view(JournalExportView())
            hass.data[f"{DOMAIN}.api_registered"] = True
        runtimes[entry.entry_id] = runtime

        async def async_stop(_event) -> None:
            runtime.ready = False
            await repository.async_close()

        entry.async_on_unload(
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, async_stop)
        )
    except BaseException:
        runtimes.pop(entry.entry_id, None)
        await repository.async_close()
        raise
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Drain accepted writes and retain the database for reload or reinstallation."""
    runtime = entry.runtime_data
    runtime.ready = False
    await runtime.repository.async_close()
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True

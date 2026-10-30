"""Loaded journal resources and API scope resolution."""

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from ..calendar.publisher import CalendarPublisher
from ..const import DOMAIN
from ..library.sync import LibrarySync
from ..playback.observer import PlaybackObserver
from .models import JournalError
from .repository import JournalRepository


@dataclass(slots=True)
class KaleidescapeRuntime:
    """Own the repository for one configuration entry."""

    repository: JournalRepository
    dataset_id: str
    ready: bool = True
    observer: PlaybackObserver | None = None
    library: LibrarySync | None = None
    calendar: CalendarPublisher | None = None
    preserve_panel_on_reload: bool = False


type KaleidescapeConfigEntry = ConfigEntry[KaleidescapeRuntime]


def get_library(
    hass: HomeAssistant, entry_id: str, runtime: KaleidescapeRuntime
) -> LibrarySync:
    """Respect an opt-out immediately, including the window before native reload."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if (
        runtime.library is None
        or entry is None
        or not (entry.options or entry.data).get("library_enabled", False)
    ):
        raise JournalError("library_disabled", "Enable library sync in Settings first")
    return runtime.library


def loaded_runtimes(hass: HomeAssistant) -> list[tuple[str, KaleidescapeRuntime]]:
    """Resolve entry-owned resources without maintaining a second runtime registry."""
    return [
        (entry.entry_id, runtime)
        for entry in hass.config_entries.async_entries(DOMAIN)
        if isinstance(
            runtime := getattr(entry, "runtime_data", None), KaleidescapeRuntime
        )
        and runtime.ready
    ]


def get_runtime(
    hass: HomeAssistant, entry_id: str, dataset_id: str
) -> KaleidescapeRuntime:
    """Resolve a loaded config entry and protect against stale dataset references."""
    entry = hass.config_entries.async_get_entry(entry_id)
    runtime = getattr(entry, "runtime_data", None)
    if (
        entry is None
        or entry.domain != DOMAIN
        or not isinstance(runtime, KaleidescapeRuntime)
        or not runtime.ready
    ):
        raise JournalError("not_ready", "Journal integration is not loaded")
    if runtime.dataset_id != dataset_id:
        raise JournalError("not_found", "Dataset does not belong to this entry")
    return runtime

"""Loaded journal resources and API scope resolution."""

from dataclasses import dataclass

from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .journal import JournalError
from .repository import JournalRepository


@dataclass(slots=True)
class KaleidescapeRuntime:
    """Own the repository for one configuration entry."""

    repository: JournalRepository
    dataset_id: str
    ready: bool = True


def get_runtime(
    hass: HomeAssistant, entry_id: str, dataset_id: str
) -> KaleidescapeRuntime:
    """Resolve a loaded config entry and protect against stale dataset references."""
    runtime = hass.data.get(DOMAIN, {}).get(entry_id)
    if runtime is None or not runtime.ready:
        raise JournalError("not_ready", "Journal integration is not loaded")
    if runtime.dataset_id != dataset_id:
        raise JournalError("not_found", "Dataset does not belong to this entry")
    return runtime

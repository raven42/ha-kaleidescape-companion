"""Storage health without titles, source identities, notes, or database paths."""

from homeassistant.core import HomeAssistant

from .const import VERSION
from .core.runtime import KaleidescapeConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> dict:
    """Return bounded metadata rather than private journal records."""
    runtime = entry.runtime_data
    if not runtime.ready:
        return {"integration_version": VERSION, "ready": False}
    info = await runtime.repository.async_info()
    return {
        "integration_version": VERSION,
        "ready": True,
        "schema_version": info["schema_version"],
        "revision": info["revision"],
        "viewing_count": info["viewing_count"],
        "backup_in_progress": info["backup_in_progress"],
        "pending_operations": runtime.repository.pending,
        "database_bytes": info["database_bytes"],
        "database_limit_bytes": info["database_limit_bytes"],
        "tracking_enabled": runtime.observer is not None,
        "library_enabled": runtime.library is not None,
        "library_sync_error": runtime.library.error if runtime.library else None,
        "recording_error": runtime.observer.last_error if runtime.observer else None,
        "observation_overflows": runtime.observer.overflow_count
        if runtime.observer
        else 0,
    }

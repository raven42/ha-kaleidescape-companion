"""Storage health without titles, source identities, notes, or database paths."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import VERSION


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
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
    }

"""Home Assistant framework for Kaleidescape."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .runtime import KaleidescapeRuntime

type KaleidescapeConfigEntry = ConfigEntry[KaleidescapeRuntime]


async def async_setup_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Create the framework runtime without connecting to devices."""
    entry.runtime_data = KaleidescapeRuntime()
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: KaleidescapeConfigEntry
) -> bool:
    """Unload the scaffold, which does not yet own background resources."""
    return True

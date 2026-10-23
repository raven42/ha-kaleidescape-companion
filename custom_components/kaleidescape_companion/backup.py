"""Quiesce explicit journal writes during Home Assistant backups."""

from homeassistant.core import HomeAssistant

from .const import DOMAIN


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Drain accepted operations; later writes return backup_in_progress."""
    for runtime in list(hass.data.get(DOMAIN, {}).values()):
        if runtime.ready:
            await runtime.repository.async_pause()


async def async_post_backup(hass: HomeAssistant) -> None:
    """Resume after HA completes or fails its backup."""
    for runtime in list(hass.data.get(DOMAIN, {}).values()):
        if runtime.ready:
            await runtime.repository.async_resume()

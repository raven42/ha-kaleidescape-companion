"""Quiesce explicit journal writes during Home Assistant backups."""

from homeassistant.core import HomeAssistant

from .core.runtime import loaded_runtimes


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Drain accepted operations; later writes return backup_in_progress."""
    for _, runtime in loaded_runtimes(hass):
        try:
            if runtime.controls:
                await runtime.controls.async_pause()
            if runtime.calendar:
                await runtime.calendar.async_pause()
            if runtime.enrichment:
                await runtime.enrichment.async_pause()
            if runtime.library:
                await runtime.library.async_pause()
            if runtime.observer:
                await runtime.observer.async_pause()
            await runtime.repository.async_pause()
        except BaseException:
            await runtime.repository.async_resume()
            if runtime.controls:
                await runtime.controls.async_resume()
            if runtime.observer:
                await runtime.observer.async_resume()
            if runtime.enrichment:
                await runtime.enrichment.async_resume()
            if runtime.library:
                await runtime.library.async_resume()
            if runtime.calendar:
                await runtime.calendar.async_resume()
            raise


async def async_post_backup(hass: HomeAssistant) -> None:
    """Resume after HA completes or fails its backup."""
    for _, runtime in loaded_runtimes(hass):
        await runtime.repository.async_resume()
        if runtime.controls:
            await runtime.controls.async_resume()
        if runtime.observer:
            await runtime.observer.async_resume()
        if runtime.enrichment:
            await runtime.enrichment.async_resume()
        if runtime.library:
            await runtime.library.async_resume()
        if runtime.calendar:
            await runtime.calendar.async_resume()

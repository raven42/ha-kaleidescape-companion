"""Quiesce explicit journal writes during Home Assistant backups."""

import asyncio
import logging

from homeassistant.core import HomeAssistant

from .core.logging import safe_exception
from .core.runtime import loaded_runtimes

_LOGGER = logging.getLogger(__name__)


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Drain accepted operations; later writes return backup_in_progress."""
    for _, runtime in loaded_runtimes(hass):
        _LOGGER.info("Preparing Companion for backup")
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
        except BaseException as error:
            if isinstance(error, asyncio.CancelledError):
                _LOGGER.debug("Backup preparation cancelled; resuming Companion")
            else:
                _LOGGER.error(
                    "Backup preparation failed; attempting to resume Companion: %s",
                    safe_exception(error),
                )
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
        _LOGGER.info("Companion backup preparation completed; writes are paused")


async def async_post_backup(hass: HomeAssistant) -> None:
    """Resume after HA completes or fails its backup."""
    for _, runtime in loaded_runtimes(hass):
        try:
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
        except asyncio.CancelledError:
            _LOGGER.debug("Companion backup resume cancelled")
            raise
        except Exception as error:
            _LOGGER.error("Companion backup resume failed: %s", safe_exception(error))
            raise
        _LOGGER.info("Companion resumed after backup")

"""Quiesce explicit journal writes during Home Assistant backups."""

import asyncio
import logging

from homeassistant.core import HomeAssistant

from .core.logging import safe_exception
from .core.runtime import loaded_runtimes
from .core.security import async_finish_cleanup

_LOGGER = logging.getLogger(__name__)


async def _resume(runtime) -> None:
    """Attempt each resume, even after a failure or repeated cancellation."""

    async def resume_all() -> None:
        failure = None
        for name in (
            "repository",
            "controls",
            "observer",
            "enrichment",
            "library",
            "calendar",
        ):
            owner = getattr(runtime, name)
            if owner is None:
                continue
            try:
                await owner.async_resume()
            except BaseException as error:
                _LOGGER.error(
                    "Backup resume failed at %s: %s", name, safe_exception(error)
                )
                if failure is None or isinstance(error, asyncio.CancelledError):
                    failure = error
        if failure is not None:
            raise failure

    await async_finish_cleanup(resume_all())


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Drain accepted operations; later writes return backup_in_progress."""
    for _, runtime in loaded_runtimes(hass):
        _LOGGER.info("Preparing Companion for backup")
        try:
            if runtime.controls:
                await async_finish_cleanup(runtime.controls.async_pause())
            if runtime.calendar:
                await async_finish_cleanup(runtime.calendar.async_pause())
            if runtime.enrichment:
                await async_finish_cleanup(runtime.enrichment.async_pause())
            if runtime.library:
                await async_finish_cleanup(runtime.library.async_pause())
            if runtime.observer:
                await async_finish_cleanup(runtime.observer.async_pause())
            await async_finish_cleanup(runtime.repository.async_pause())
        except BaseException as error:
            if isinstance(error, asyncio.CancelledError):
                _LOGGER.debug("Backup preparation cancelled; resuming Companion")
            else:
                _LOGGER.error(
                    "Backup preparation failed; attempting to resume Companion: %s",
                    safe_exception(error),
                )
            cancelled = isinstance(error, asyncio.CancelledError)
            try:
                await _resume(runtime)
            except BaseException as resume_error:
                cancelled |= isinstance(resume_error, asyncio.CancelledError)
                _LOGGER.error(
                    "Backup recovery incomplete: %s", safe_exception(resume_error)
                )
            if cancelled:
                raise asyncio.CancelledError from None
            if isinstance(error, Exception):
                raise RuntimeError("Companion backup preparation failed") from None
            raise
        _LOGGER.info("Companion backup preparation completed; writes are paused")


async def async_post_backup(hass: HomeAssistant) -> None:
    """Resume after HA completes or fails its backup."""
    for _, runtime in loaded_runtimes(hass):
        try:
            await _resume(runtime)
        except asyncio.CancelledError:
            _LOGGER.debug("Companion backup resume cancelled")
            raise
        except Exception as error:
            _LOGGER.error("Companion backup resume failed: %s", safe_exception(error))
            raise RuntimeError("Companion backup resume failed") from None
        _LOGGER.info("Companion resumed after backup")

"""Wait for accepted work without exposing abandoned exception chains."""

import asyncio
import logging

from .logging import safe_exception

_LOGGER = logging.getLogger(__name__)


def _report_abandoned(future: asyncio.Future) -> None:
    if not future.cancelled() and (error := future.exception()) is not None:
        _LOGGER.error(
            "Background operation failed after its caller stopped waiting: %s",
            safe_exception(error),
        )


async def async_wait[T](future: asyncio.Future[T], *, report_abandoned=True) -> T:
    """Preserve accepted work if the caller is cancelled, without loop tracebacks."""
    completed = asyncio.Event()
    future.add_done_callback(lambda _: completed.set())
    try:
        await completed.wait()
    except asyncio.CancelledError:
        if report_abandoned:
            future.add_done_callback(_report_abandoned)
        raise
    return future.result()

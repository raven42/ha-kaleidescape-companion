"""Structured operation boundaries; no exception text or argument dumps."""

import asyncio
import time
from functools import wraps

from kaleidescape_api.logging import (
    Level,
    Operation,
    Outcome,
    Resource,
    Subsystem,
)


def traced(
    subsystem: Subsystem, operation: Operation, *, debug=False, resource_index=0
):
    """Instrument owned async operations without changing cancellation semantics."""

    def decorate(function):
        @wraps(function)
        async def run(self, *args, **kwargs):
            logger = self.repository.logger
            resource = (
                (Resource.REQUEST, args[resource_index])
                if len(args) > resource_index and isinstance(args[resource_index], str)
                else None
            )
            target = (
                (Resource.DEVICE, self.origin)
                if isinstance(getattr(self, "origin", None), str)
                else None
            )
            level = Level.DEBUG if debug else Level.INFO
            started = time.monotonic()
            logger.emit(
                subsystem,
                operation,
                Outcome.STARTED,
                level=level,
                resource=resource,
                target=target,
            )
            try:
                result = await function(self, *args, **kwargs)
            except asyncio.CancelledError:
                logger.emit(
                    subsystem,
                    operation,
                    Outcome.UNAVAILABLE,
                    level=Level.WARNING,
                    resource=resource,
                    target=target,
                )
                raise
            except Exception as error:
                logger.emit_failure(
                    subsystem, operation, error, resource=resource, target=target
                )
                raise
            logger.emit(
                subsystem,
                operation,
                Outcome.SUCCEEDED,
                level=level,
                resource=resource,
                target=target,
                elapsed_ms=min(10**12, int((time.monotonic() - started) * 1000)),
            )
            return result

        return run

    return decorate

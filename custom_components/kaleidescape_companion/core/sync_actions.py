"""Shared requests for HA actions and Companion buttons."""

from .models import JournalError


def library_sync(entry):
    """Request a sync only while the configured Library runtime is ready."""
    runtime = entry.runtime_data
    if (
        not runtime.ready
        or not (entry.options or entry.data).get("library_enabled", False)
        or runtime.library is None
    ):
        raise JournalError("not_ready", "Enable library sync first")
    runtime.library.request_sync()


def calendar_full_sync(entry):
    """Request one guarded pass against the configured dedicated calendar."""
    runtime = entry.runtime_data
    if not runtime.ready or runtime.calendar is None:
        raise JournalError("not_ready", "Calendar full sync is unavailable")
    calendar = runtime.calendar
    try:
        calendar.maintenance.check()
    except ValueError as error:
        raise JournalError("not_ready", "Calendar full sync is unavailable") from error
    calendar.maintenance.request()
    calendar._tick()

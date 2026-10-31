"""Explicit, confirmed Journal export with bounded calendar reads and matching."""

import asyncio
import json
from datetime import UTC, datetime, timedelta

from kaleidescape_api.logging import (
    Level,
    Operation,
    Outcome,
    Resource,
    Subsystem,
)

from ..core.models import JournalError
from ..core.operations import traced
from ..core.security import async_finish_cleanup
from .config import DEFAULTS, fingerprint, target


def instant(value):
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        return (
            parsed.astimezone(UTC).replace(microsecond=0).isoformat()
            if parsed.utcoffset() is not None
            else None
        )
    except ValueError, OverflowError:
        return None


def event_key(event):
    return (
        event.get("summary"),
        instant(event.get("start", event.get("start_date_time"))),
        instant(event.get("end", event.get("end_date_time"))),
    )


class JournalCalendarSync:
    def __init__(self, publisher):
        self.publisher = publisher
        self.repository = publisher.repository
        self.task = None
        self.job = None
        self.authorized = lambda: False
        self.cancelled = False
        self.keys = set()
        self.month = None

    @property
    def active(self):
        return bool(self.task and not self.task.done())

    def remember(self, data):
        start = datetime.fromisoformat(data["start_date_time"]).astimezone(UTC)
        if self.job and self.month == (start.year, start.month):
            self.keys.add(event_key(data))

    async def status(self):
        p = self.publisher
        info = await p.repository.async_calendar_sync("status")
        return {
            **info,
            "enabled": bool(p.config.get("calendar_enabled")),
            "ready": p.allowed()
            and p.hass.services.has_service("calendar", "get_events"),
            "fingerprint": fingerprint(p.config),
            "active": self.active,
            "maintenance": await p.maintenance.status(),
        }

    async def start(self, request, actor, expected, authorized):
        p = self.publisher
        if p.maintenance.enabled:
            raise JournalError(
                "not_ready", "Use Full Sync for the configured age window"
            )
        if not authorized() or not p.allowed() or expected != fingerprint(p.config):
            raise JournalError(
                "conflict", "Save/reload calendar settings before exporting"
            )
        if not p.hass.services.has_service("calendar", "get_events"):
            raise JournalError("not_ready", "Calendar event lookup is unavailable")
        async with p.lock:
            if not authorized() or not p.allowed():
                raise JournalError("unauthorized", "Calendar export access changed")
            result = await p.repository.async_calendar_sync("begin", request, actor)
            status = await p.repository.async_calendar_sync("status", result["job_id"])
            if status["job"]["finished"]:
                return result
            if self.job != result["job_id"]:
                self.keys.clear()
                self.month = None
            self.job = result["job_id"]
            self.authorized = authorized
            self.cancelled = False
            self.resume()
            return result

    def resume(self):
        p = self.publisher
        if (
            self.job
            and not self.active
            and not p.paused
            and not p.stopping
            and not self.cancelled
        ):
            self.task = p.hass.async_create_background_task(
                self.run(), "Companion Journal calendar export"
            )

    async def async_drain(self):
        if self.task:
            await async_finish_cleanup(self._drain())

    async def _drain(self):
        await asyncio.shield(self.task)

    async def cancel(self, job):
        if job != self.job:
            raise JournalError("not_found", "Calendar export is no longer active")
        self.cancelled = True
        await self.async_drain()
        await self.publisher.repository.async_calendar_sync("cancel", job)

    async def run(self):
        p = self.publisher
        while not p.paused and not p.stopping and not self.cancelled:
            if not self.authorized() or not p.allowed():
                self.cancelled = True
                break
            try:
                async with p.lock:
                    if not await self.one():
                        if self.cancelled:
                            break
                        return
            except Exception:
                self.cancelled = True
                break
            await asyncio.sleep(0)
        if self.cancelled or p.stopping:
            await p.repository.async_calendar_sync("cancel", self.job)

    @traced(Subsystem.CALENDAR, Operation.READ, debug=True)
    async def read_month(self, data):
        p = self.publisher
        start = datetime.fromisoformat(data["start_date_time"]).astimezone(UTC)
        end = datetime.fromisoformat(data["end_date_time"]).astimezone(UTC)
        if end - start > timedelta(days=7):
            raise ValueError("Viewing interval exceeds seven days")
        month = (start.year, start.month)
        if month == self.month:
            return
        first = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (first + timedelta(days=32)).replace(day=1)
        async with asyncio.timeout(30):
            result = await p.hass.services.async_call(
                "calendar",
                "get_events",
                {
                    "entity_id": target(p.hass, p.config),
                    "start_date_time": first.isoformat(),
                    "end_date_time": (next_month + timedelta(days=7)).isoformat(),
                },
                blocking=True,
                return_response=True,
            )
        if not isinstance(result, dict):
            raise ValueError("Invalid calendar response")
        events = result.get(target(p.hass, p.config), {}).get("events")
        if (
            not isinstance(events, list)
            or len(events) > 10000
            or len(json.dumps(events).encode()) > 8 * 1024 * 1024
            or any(not isinstance(event, dict) for event in events)
        ):
            raise ValueError("Calendar response exceeds bounds")
        self.keys.clear()
        self.keys.update(
            event_key(event)
            for event in events
            if isinstance(event.get("summary"), str)
        )
        self.month = month

    async def one(self):
        from .publisher import event_data

        p = self.publisher
        if self.cancelled or not self.authorized() or not p.allowed():
            self.cancelled = True
            return False
        row = await p.repository.async_calendar_sync("claim", self.job)
        if row is None:
            return False
        if row.get("skip"):
            return True
        state = "failed"
        try:
            data = event_data(
                row,
                p.config.get("calendar_title", DEFAULTS["calendar_title"]),
                p.config.get("calendar_description", DEFAULTS["calendar_description"]),
            )
            await self.read_month(data)
            if self.cancelled or not self.authorized() or not p.allowed():
                self.cancelled = True
                state = "skipped"
            elif event_key(data) in self.keys:
                state = "matched"
            elif row["uncertain"]:
                state = "uncertain"
            elif await p.repository.async_calendar_sync("ready", self.job, row):
                if self.cancelled or not self.authorized() or not p.allowed():
                    state = "skipped"
                else:
                    state = "uncertain"
                    p.repository.logger.emit(
                        Subsystem.CALENDAR,
                        Operation.CREATE,
                        Outcome.STARTED,
                        resource=(Resource.VIEWING, row["id"]),
                    )
                    async with asyncio.timeout(30):
                        await p.hass.services.async_call(
                            "calendar",
                            "create_event",
                            {"entity_id": target(p.hass, p.config), **data},
                            blocking=True,
                        )
                    state = "created"
                    self.remember(data)
            else:
                state = "skipped"
        except Exception as error:
            p.repository.logger.emit_failure(
                Subsystem.CALENDAR, Operation.CREATE, error
            )
            # Never expose private provider responses. A failed lookup must not
            # be treated as an empty calendar and followed by blind creates.
            if state == "failed":
                self.cancelled = True
        finally:
            p.repository.logger.emit(
                Subsystem.CALENDAR,
                Operation.CREATE,
                Outcome.SUCCEEDED
                if state in {"created", "matched"}
                else Outcome.UNCERTAIN
                if state == "uncertain"
                else Outcome.SKIPPED,
                level=Level.WARNING if state in {"uncertain", "failed"} else Level.INFO,
                resource=(Resource.VIEWING, row["id"]),
            )
            await async_finish_cleanup(
                p.repository.async_calendar_sync("finish", self.job, row["id"], state)
            )
        return True

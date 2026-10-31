"""Narrow HA entity adapter: event UIDs and CRUD on one configured calendar."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime

from homeassistant.components.calendar import CalendarEntity
from homeassistant.components.calendar.const import (
    DATA_COMPONENT,
    EVENT_END,
    EVENT_START,
)
from kaleidescape_api.logging import (
    Check,
    Level,
    Operation,
    Outcome,
    Reason,
    Stage,
    Subsystem,
)

from .config import FULL_SYNC_FEATURES, target


class CalendarValidationError(ValueError):
    """Owned validation code, never provider text."""

    def __init__(self, check):
        self.check = check
        super().__init__("Calendar validation failed")


def selected(publisher):
    component = publisher.hass.data.get(DATA_COMPONENT)
    entity = (
        component.get_entity(target(publisher.hass, publisher.config))
        if component
        else None
    )
    if (
        not isinstance(entity, CalendarEntity)
        or not entity.available
        or (entity.supported_features or 0) & FULL_SYNC_FEATURES != FULL_SYNC_FEATURES
    ):
        raise CalendarValidationError(Check.CAPABILITY)
    return entity


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def content(data):
    """Whole-second identity including description for write verification."""
    return {
        "summary": data["summary"],
        "description": (data.get("description") or "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .rstrip(),
        "all_day": False,
        "start": datetime.fromisoformat(data["start_date_time"])
        .astimezone(UTC)
        .replace(microsecond=0)
        .isoformat(),
        "end": datetime.fromisoformat(data["end_date_time"])
        .astimezone(UTC)
        .replace(microsecond=0)
        .isoformat(),
    }


async def read(publisher, start, end):
    entity = selected(publisher)
    async with asyncio.timeout(30):
        events = await entity.async_get_events(publisher.hass, start, end)
    if not isinstance(events, list) or len(events) > 10000:
        raise CalendarValidationError(Check.BOUNDS)
    result, size, ids = [], 0, set()
    for event in events:
        # Never infer a missing UID or mutate an entire recurring series.
        if event.rrule or event.recurrence_id:
            result.append({"recurring": True})
            continue
        if (
            not isinstance(event.uid, str)
            or not event.uid
            or len(event.uid) > 1024
            or event.uid in ids
        ):
            raise CalendarValidationError(Check.IDENTITY)
        ids.add(event.uid)
        first, last = event.start_datetime_local, event.end_datetime_local
        if (
            last <= first
            or not isinstance(event.summary, str)
            or len(event.summary) > 4096
        ):
            raise CalendarValidationError(Check.INTERVAL)
        data = {
            "summary": event.summary,
            "description": event.description or "",
            "start_date_time": first.isoformat(),
            "end_date_time": last.isoformat(),
        }
        normalized = content(data)
        normalized["all_day"] = event.all_day
        size += len(json.dumps(normalized).encode())
        if size > 8 * 1024 * 1024:
            raise CalendarValidationError(Check.BOUNDS)
        result.append(
            {
                "uid": event.uid,
                "data": data,
                "content": normalized,
                "digest": digest(normalized),
                "start": first,
                "end": last,
                "all_day": event.all_day,
            }
        )
    return result


async def write(publisher, kind, uid, data):
    entity = selected(publisher)
    async with asyncio.timeout(30):
        if kind == "create":
            await entity.async_create_event(
                summary=data["summary"],
                description=data["description"],
                **{
                    EVENT_START: datetime.fromisoformat(data["start_date_time"]),
                    EVENT_END: datetime.fromisoformat(data["end_date_time"]),
                },
            )
        elif kind == "update":
            # This is HA's calendar entity update contract, not its service schema.
            await entity.async_update_event(
                uid,
                {
                    "summary": data["summary"],
                    "description": data["description"],
                    EVENT_START: datetime.fromisoformat(data["start_date_time"]),
                    EVENT_END: datetime.fromisoformat(data["end_date_time"]),
                },
            )
        elif kind == "delete":
            await entity.async_delete_event(uid)
        else:
            raise CalendarValidationError(Check.CONFIGURATION)
    entity.async_update_event_listeners()


def _instrument(function, operation):
    async def run(publisher, *args, reason=None):
        logger = publisher.repository.logger
        logger.emit(
            Subsystem.CALENDAR,
            operation,
            Outcome.STARTED,
            level=Level.DEBUG,
            reason=reason,
        )
        try:
            result = await function(publisher, *args)
        except Exception as error:
            missing_time = (
                isinstance(error, KeyError)
                and len(error.args) == 1
                and type(error.args[0]) is str
                and error.args[0] in {EVENT_START, EVENT_END}
            )
            logger.emit_failure(
                Subsystem.CALENDAR,
                operation,
                error,
                stage=Stage.WRITE if operation == Operation.WRITE else Stage.READ,
                check=error.check
                if isinstance(error, CalendarValidationError)
                else Check.INTERVAL
                if missing_time
                else None,
                reason=Reason.SCHEMA_MISMATCH if missing_time else reason,
            )
            raise
        logger.emit(
            Subsystem.CALENDAR,
            operation,
            Outcome.SUCCEEDED,
            level=Level.DEBUG,
            count=len(result) if isinstance(result, list) else None,
            reason=reason,
        )
        return result

    return run


read = _instrument(read, Operation.READ)
write = _instrument(write, Operation.WRITE)

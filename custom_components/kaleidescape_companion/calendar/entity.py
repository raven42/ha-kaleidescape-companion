"""Narrow HA entity adapter: event UIDs and CRUD on one configured calendar."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime

from homeassistant.components.calendar import CalendarEntity
from homeassistant.components.calendar.const import DATA_COMPONENT

from .config import FULL_SYNC_FEATURES, target


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
        raise ValueError("Full Sync requires calendar read/create/delete support")
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
        raise ValueError("Calendar response exceeds bounds")
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
            raise ValueError("Calendar event IDs are missing or ambiguous")
        ids.add(event.uid)
        first, last = event.start_datetime_local, event.end_datetime_local
        if (
            last <= first
            or not isinstance(event.summary, str)
            or len(event.summary) > 4096
        ):
            raise ValueError("Invalid calendar event")
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
            raise ValueError("Calendar response exceeds bounds")
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
                start=datetime.fromisoformat(data["start_date_time"]),
                end=datetime.fromisoformat(data["end_date_time"]),
            )
        elif kind == "update":
            # This is HA's calendar entity update contract, not its service schema.
            await entity.async_update_event(
                uid,
                {
                    "summary": data["summary"],
                    "description": data["description"],
                    "start": datetime.fromisoformat(data["start_date_time"]),
                    "end": datetime.fromisoformat(data["end_date_time"]),
                },
            )
        elif kind == "delete":
            await entity.async_delete_event(uid)
        else:
            raise ValueError("Invalid calendar intent")
    entity.async_update_event_listeners()

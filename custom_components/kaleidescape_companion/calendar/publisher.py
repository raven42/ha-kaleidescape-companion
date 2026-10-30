"""Publish newly completed viewings via the fixed calendar.create_event action."""

import asyncio
import json
import logging
from datetime import datetime, timedelta

from homeassistant.components.calendar import CalendarEntityFeature
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_time_interval

from ..core.models import JournalError
from ..core.security import async_finish_cleanup
from ..library.config import origin
from ..library.store import source_id
from ..playback.manual import metadata_text
from .config import DEFAULTS, FIELDS, fingerprint, target, template

_LOGGER = logging.getLogger(__name__)


def event_data(row, dataset, title_template, description_template=None):
    """Plain text and versioned, bounded JSON references; no URLs or auth tokens."""
    metadata = row["metadata"]
    aliases = {
        "cast": "actors",
        "director": "directors",
        "writer": "writers",
        "studio": "studios",
        "genre": "genres",
        "format": "formats",
    }
    values = {}
    for key in FIELDS:
        value = metadata.get(aliases.get(key, key))
        if isinstance(value, list):
            value = ", ".join(str(item)[:100] for item in value[:20])
        values[key] = "" if value is None else metadata_text(value, 512)
    values.update(
        title=row["title"][:500],
        status="completed",
        started_at=row["started_at"],
        ended_at=row["ended_at"] or row["completed_at"] or "",
        duration=f"{row['duration_seconds'] / 60:.2f}"
        if row["duration_seconds"] is not None
        else "",
        watched=f"{row['watched_seconds'] / 60:.2f}",
        artwork=f"kaleidescape_companion:artwork:{metadata['artwork_key']}"
        if metadata.get("artwork_key")
        else "",
    )
    summary = template(title_template).format_map(values)
    if not summary.strip() or len(summary) > 1024:
        raise ValueError("Calendar event title exceeds 1024 characters")
    start = datetime.fromisoformat(row["started_at"])
    end = datetime.fromisoformat(
        row["ended_at"] or row["completed_at"] or row["started_at"]
    )
    if end <= start:
        end = start + timedelta(seconds=max(1, row["watched_seconds"]))
    description = {
        "schema": "kaleidescape_companion.calendar.v1",
        "dataset_id": dataset,
        "viewing_id": row["id"],
        "library_title_id": row["library_title_id"],
        "artwork_key": metadata.get("artwork_key"),
        "movie": values,
    }
    encoded = json.dumps(description, ensure_ascii=False)
    description_text = template(
        DEFAULTS["calendar_description"]
        if description_template is None
        else description_template,
        5000,
        empty=True,
    ).format_map(values)
    description_text += "\n\nKaleidescape Companion data:\n" + encoded
    if len(description_text.encode()) > 32 * 1024:
        raise ValueError("Calendar event metadata is too large")
    return {
        "summary": summary,
        "start_date_time": start.isoformat(),
        "end_date_time": end.isoformat(),
        "description": description_text,
    }


class CalendarPublisher:
    """One durable attempt per viewing; no backfill or blind service retries."""

    def __init__(self, hass, repository, entry, dataset):
        self.hass, self.repository, self.entry, self.dataset = (
            hass,
            repository,
            entry,
            dataset,
        )
        self.config = dict(entry.options or entry.data)
        self.cancel = None
        self.running = None
        self.stopping = False
        self.paused = False
        self.lock = asyncio.Lock()
        from .sync import JournalCalendarSync

        self.history = JournalCalendarSync(self)

    async def async_start(self):
        enabled = self.config.get("calendar_enabled", False)
        selected = target(self.hass, self.config) if enabled else None
        config = None
        if enabled and selected:
            config = {
                "target": selected,
                "fingerprint": fingerprint(self.config),
                "source": source_id(origin(self.config.get("library_host", "")))
                if self.config.get("library_enabled")
                else None,
            }
        await self.repository.async_calendar_configure(config)
        if config:
            self.cancel = async_track_time_interval(
                self.hass, self._tick, timedelta(seconds=10)
            )
            self._tick()

    @callback
    def _tick(self, _now=None):
        if (
            not self.stopping
            and not self.paused
            and (self.running is None or self.running.done())
        ):
            self.running = self.hass.async_create_task(self.async_publish_one())

    def allowed(self):
        current = dict(self.entry.options or self.entry.data)
        selected = target(self.hass, current)
        state = self.hass.states.get(selected) if selected else None
        return bool(
            current.get("calendar_enabled", False)
            and fingerprint(current) == fingerprint(self.config)
            and state
            and state.state not in {"unknown", "unavailable"}
            and int(state.attributes.get("supported_features", 0))
            & CalendarEntityFeature.CREATE_EVENT
            and self.hass.services.has_service("calendar", "create_event")
        )

    async def async_publish_one(self):
        async with self.lock:
            await self._publish_one()

    async def _publish_one(self):
        if self.stopping or self.paused or not self.allowed():
            return
        row = None
        state = "cancelled"
        try:
            row = await self.repository.async_calendar_claim()
            if not row:
                return
            data = event_data(
                row,
                self.dataset,
                self.config.get("calendar_title", "Watched: {title}"),
                self.config.get(
                    "calendar_description", DEFAULTS["calendar_description"]
                ),
            )
            # Pause/unload stop admission and drain this accepted operation;
            # an actual configuration opt-out still revokes an unstarted call.
            if not self.allowed():
                return
            # Persisted 'sending' precedes the external side effect. A timeout,
            # cancellation or crash may have committed: never repeat it blindly.
            state = "uncertain"
            async with asyncio.timeout(30):
                await self.hass.services.async_call(
                    "calendar",
                    "create_event",
                    {"entity_id": target(self.hass, self.config), **data},
                    blocking=True,
                )
            state = "sent"
            self.history.remember(data)
        except JournalError, ValueError, TimeoutError:
            _LOGGER.warning("Calendar publication requires review; no automatic retry")
        except Exception:
            # Provider errors can contain private event content or credentials.
            _LOGGER.warning(
                "Calendar provider did not confirm publication; "
                "review the calendar before retrying"
            )
        finally:
            if row:
                try:
                    await async_finish_cleanup(
                        self.repository.async_calendar_finish(row["id"], state)
                    )
                except JournalError:
                    _LOGGER.warning(
                        "Calendar receipt could not be saved; review before retrying"
                    )

    async def async_stop(self):
        self.stopping = True
        if self.cancel:
            self.cancel()
        if self.running:
            await async_finish_cleanup(self._drain())
        await self.history.async_drain()

    async def async_pause(self):
        self.paused = True
        if self.running:
            await async_finish_cleanup(self._drain())
        await self.history.async_drain()

    async def _drain(self):
        await asyncio.shield(self.running)

    async def async_resume(self):
        self.paused = False
        self._tick()
        self.history.resume()

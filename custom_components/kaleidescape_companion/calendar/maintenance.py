"""Opt-in dedicated-calendar reconciliation with guarded writes and delayed cleanup."""

import asyncio
import logging
from calendar import monthrange
from datetime import UTC, datetime, timedelta

from homeassistant.components.calendar import CalendarEntityFeature
from homeassistant.core import callback

from ..core.logging import safe_exception
from ..core.models import JournalError
from ..core.security import async_finish_cleanup
from . import entity
from .config import DEFAULTS, fingerprint
from .publisher import event_data

_LOGGER = logging.getLogger(__name__)


class SyncStopped(ValueError):
    """An owned, privacy-safe reconciliation decision."""

    def __init__(self, reason):
        self.reason = reason
        super().__init__("Synchronization stopped")


NOTICE = "Maintained by Kaleidescape Companion via Home Assistant"


def window(now, months):
    month = now.year * 12 + now.month - 1 - months
    year, index = divmod(month, 12)
    first = now.replace(
        year=year, month=index + 1, day=min(now.day, monthrange(year, index + 1)[1])
    )
    return first.isoformat(), now.isoformat()


class CalendarMaintenance:
    """Shares the publisher lock; only the saved, dedicated calendar is writable."""

    def __init__(self, publisher):
        self.publisher = publisher
        self.requested = False
        self.last_success = None
        self.active = False
        self.error = ""
        self.counts = {}
        self.clock = lambda: datetime.now(UTC)
        self.snapshot = None
        self.bounds = None
        self.failure_stage = ""

    @property
    def enabled(self):
        config = self.publisher.config
        return bool(
            config.get("calendar_enabled")
            and config.get("calendar_full_sync")
            and config.get("calendar_full_sync_dedicated")
        )

    @callback
    def request(self, _now=None):
        self.requested = True

    def check(self):
        p = self.publisher
        months = p.config.get("calendar_full_sync_months", 3)
        if type(months) is not int or not 1 <= months <= 12:
            raise SyncStopped("schema_mismatch")
        if not self.enabled or p.paused or p.stopping or not p.allowed():
            raise SyncStopped("paused")
        entity.selected(p)

    async def status(self):
        state = {"uncertain": 0, "quarantined": 0}
        if self.enabled:
            try:
                state = await self.publisher.repository.async_calendar_maintenance(
                    "status"
                )
            except JournalError:
                pass
        try:
            self.check()
            ready = True
        except ValueError:
            ready = False
        return {
            **state,
            "enabled": self.enabled,
            "ready": ready,
            "active": self.active,
            "last_success": self.last_success,
            "error": self.error,
            "counts": self.counts,
            "failure_stage": self.failure_stage,
        }

    async def tick(self):
        if not self.enabled or not self.requested:
            return
        now = self.clock()
        p = self.publisher
        self.active = True
        try:
            self.check()
            self.bounds = window(now, p.config.get("calendar_full_sync_months", 3))
            self.requested = False
            self.failure_stage = "read"
            async with asyncio.timeout(300):
                await self.reconcile(now)
            if self.error:
                _LOGGER.info("Calendar maintenance recovered")
            self.error = ""
            self.failure_stage = ""
            self.last_success = now.isoformat()
        except Exception as error:
            reason = error.reason if isinstance(error, SyncStopped) else None
            next_error = reason if reason else type(error).__name__
            if reason in {"paused", "snapshot_changed"}:
                _LOGGER.debug("Calendar maintenance deferred; request another check")
            elif self.error != next_error:
                _LOGGER.error(
                    "Calendar maintenance failed; request another check: %s",
                    safe_exception(error),
                )
            self.error = next_error
        finally:
            self.active = False
            self.snapshot = self.bounds = None

    async def stable(self):
        self.check()
        signature = await self.publisher.repository.async_calendar_maintenance(
            "signature", self.bounds
        )
        if signature != self.snapshot["signature"]:
            raise SyncStopped("snapshot_changed")
        self.check()

    async def reconcile(self, now):
        p, repo = self.publisher, self.publisher.repository
        self.snapshot = await repo.async_calendar_maintenance("snapshot", self.bounds)
        start, end = map(datetime.fromisoformat, self.bounds)
        read = await entity.read(p, start, end)
        self.check()
        self.counts = {
            "created": 0,
            "updated": 0,
            "deleted": 0,
            "matched": 0,
            "recurring_skipped": sum(bool(e.get("recurring")) for e in read),
        }
        remote = {
            e["uid"]: e
            for e in read
            if not e.get("recurring") and start <= e["start"] < end
        }
        for intent in await repo.async_calendar_maintenance("pending"):
            resolved = (
                intent["operation"] == "delete" and intent["uid"] not in remote
            ) or (
                intent["operation"] != "delete"
                and any(
                    e["digest"] == intent["digest"]
                    and (not intent["uid"] or e["uid"] == intent["uid"])
                    for e in remote.values()
                )
            )
            if resolved:
                await repo.async_calendar_maintenance(
                    "finish", intent["request_id"], "confirmed"
                )
        if (await repo.async_calendar_maintenance("status"))["uncertain"]:
            self.failure_stage = "unconfirmed"
            raise SyncStopped("pending_write")
        used, desired = set(), []
        for row in self.snapshot["rows"]:
            data = event_data(
                row,
                p.config.get("calendar_title", DEFAULTS["calendar_title"]),
                p.config.get("calendar_description", DEFAULTS["calendar_description"]),
            )
            data["description"] = (
                data["description"].rstrip() + "\n\n" + NOTICE
            ).lstrip()
            if len(data["description"].encode()) > 32 * 1024:
                raise ValueError("Calendar description exceeds bounds")
            if datetime.fromisoformat(data["end_date_time"]) - datetime.fromisoformat(
                data["start_date_time"]
            ) > timedelta(days=7):
                raise ValueError("Viewing exceeds seven days")
            desired.append(entity.digest(entity.content(data)))
            uid = self.snapshot["links"].get(row["id"])
            match = remote.get(uid) if uid not in used else None
            if match is None:
                content = entity.content(data)
                match = next(
                    (
                        e
                        for key, e in remote.items()
                        if key not in used
                        and all(
                            e["content"][k] == content[k]
                            for k in ("summary", "start", "end")
                        )
                        and not e["all_day"]
                    ),
                    None,
                )
            if match:
                used.add(match["uid"])
                await repo.async_calendar_maintenance("link", row["id"], match["uid"])
                if match["digest"] == desired[-1]:
                    self.counts["matched"] += 1
                elif (
                    entity.selected(p).supported_features
                    & CalendarEntityFeature.UPDATE_EVENT
                ):
                    await self.mutate("update", row["id"], match, data)
                else:
                    # Some providers offer create/delete but no update. Verify
                    # the replacement first; quarantine the old event normally.
                    await self.mutate("create", row["id"], None, data)
                    used.discard(match["uid"])
            else:
                await self.mutate("create", row["id"], None, data)
        await self.stable()
        extras = [e for key, e in remote.items() if key not in used]
        # A new journal/configuration or changed event resets deletion quarantine.
        expected = entity.digest(
            [self.snapshot["signature"], fingerprint(p.config), desired]
        )
        eligible = await repo.async_calendar_maintenance(
            "candidates",
            expected,
            [(e["uid"], e["digest"]) for e in extras],
            now.isoformat(),
        )
        for extra in extras:
            if extra["uid"] in eligible:
                await self.mutate("delete", None, extra, None)

    async def mutate(self, kind, viewing, previous, data):
        p, repo = self.publisher, self.publisher.repository
        await self.stable()
        self.failure_stage = "preflight"
        first = (
            datetime.fromisoformat(data["start_date_time"])
            if data
            else previous["start"]
        )
        last = (
            datetime.fromisoformat(data["end_date_time"]) if data else previous["end"]
        )
        if previous:
            fresh = await entity.read(p, previous["start"], previous["end"])
            if not any(
                e.get("uid") == previous["uid"] and e["digest"] == previous["digest"]
                for e in fresh
            ):
                raise SyncStopped("remote_changed")
        await self.stable()
        digest = entity.digest(entity.content(data)) if data else previous["digest"]
        uid = previous["uid"] if previous else None
        request = await repo.async_calendar_maintenance(
            "reserve",
            self.bounds,
            self.snapshot["signature"],
            kind,
            viewing,
            uid,
            digest,
        )
        state = "cancelled"
        try:
            self.check()
            state = "uncertain"
            self.failure_stage = "write"
            await entity.write(p, kind, uid, data)
            self.failure_stage = "verification"
            # Poll reads only: providers can expose a successful write late. Padding
            # avoids exact-boundary exclusion. Never retry the external write here.
            for attempt, delay in enumerate((0, 1, 3), start=1):
                if delay:
                    await asyncio.sleep(delay)
                self.check()
                checked = await entity.read(
                    p,
                    first - timedelta(minutes=1),
                    last + timedelta(minutes=1),
                )
                self.check()
                matches = [
                    e
                    for e in checked
                    if not e.get("recurring")
                    and e["digest"] == digest
                    and (not uid or e["uid"] == uid)
                ]
                visible = (
                    not any(e.get("uid") == uid for e in checked)
                    if kind == "delete"
                    else len(matches) == 1
                )
                if visible:
                    if kind != "delete":
                        await repo.async_calendar_maintenance(
                            "link", viewing, matches[0]["uid"]
                        )
                    break
            else:
                raise SyncStopped("ambiguous" if len(matches) > 1 else "not_visible")
            state = "confirmed"
            self.counts[
                {"create": "created", "update": "updated", "delete": "deleted"}[kind]
            ] += 1
        finally:
            await async_finish_cleanup(
                repo.async_calendar_maintenance("finish", request, state)
            )

    async def action(self, operation, expected, actor, authorized, review_token=""):
        p = self.publisher
        if not authorized() or expected != fingerprint(p.config):
            raise JournalError("conflict", "Save/reload calendar settings first")
        try:
            self.check()
        except ValueError as error:
            raise JournalError(
                "not_ready", "Full Sync calendar is unavailable"
            ) from error
        if operation == "acknowledge":
            async with p.lock:
                try:
                    self.check()
                except ValueError as error:
                    raise JournalError(
                        "not_ready", "Full Sync calendar changed"
                    ) from error
                if not authorized():
                    raise JournalError("unauthorized", "Calendar access changed")
                await p.repository.async_calendar_maintenance(
                    "acknowledge", actor, review_token
                )
        self.request()
        p._tick()
        return await self.status()

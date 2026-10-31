"""Dedicated calendar reconciliation with fictional entities and temporary SQLite."""

import copy
import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import test_backend as backend
import test_calendar as fixtures
import test_library as library
import test_repository as repository
from homeassistant import bootstrap, loader
from homeassistant.components.calendar import (
    WEBSOCKET_EVENT_SCHEMA,
    CalendarEntity,
    CalendarEvent,
)
from homeassistant.components.calendar.const import (
    DATA_COMPONENT,
    EVENT_END,
    EVENT_START,
)
from homeassistant.config_entries import ConfigEntries
from homeassistant.core import HomeAssistant
from kaleidescape_api.logging import (
    Resource,
)

from custom_components.kaleidescape_companion.calendar.config import (
    fingerprint,
    validate,
)
from custom_components.kaleidescape_companion.calendar.maintenance import NOTICE, window
from custom_components.kaleidescape_companion.calendar.publisher import (
    CalendarPublisher,
)


class FictionalCalendar(CalendarEntity):
    _attr_available = True
    _attr_supported_features = 7

    def __init__(self):
        self.events = {}
        self.writes = []
        self.fail_read = False
        self.fail_after_write = False
        self.before_read = None
        self.async_update_event_listeners = Mock()

    async def async_get_events(self, hass, start, end):
        if self.before_read:
            await self.before_read()
        if self.fail_read:
            raise RuntimeError("private provider failure")
        return copy.deepcopy(
            [
                e
                for e in self.events.values()
                if e.start_datetime_local < end and e.end_datetime_local > start
            ]
        )

    async def async_create_event(self, **data):
        data = WEBSOCKET_EVENT_SCHEMA(data)
        uid = str(uuid4())
        self.events[uid] = CalendarEvent(
            start=data[EVENT_START],
            end=data[EVENT_END],
            summary=data["summary"],
            description=data["description"],
            uid=uid,
        )
        self.writes.append(("create", uid))
        if self.fail_after_write:
            raise RuntimeError("private provider failure after commit")

    async def async_update_event(self, uid, event, **kwargs):
        event = WEBSOCKET_EVENT_SCHEMA(event)
        self.events[uid] = CalendarEvent(
            start=event[EVENT_START],
            end=event[EVENT_END],
            summary=event["summary"],
            description=event.get("description"),
            uid=uid,
        )
        self.writes.append(("update", uid))

    async def async_delete_event(self, uid, **kwargs):
        self.events.pop(uid, None)
        self.writes.append(("delete", uid))
        if self.fail_after_write:
            raise RuntimeError("private provider failure after commit")


class MaintenanceTest(unittest.IsolatedAsyncioTestCase):
    assert_error = repository.RepositoryTest.assert_error
    seed = fixtures.CalendarTest.seed
    create = fixtures.CalendarTest.create

    async def asyncSetUp(self):
        await repository.RepositoryTest.asyncSetUp(self)
        await self.seed()
        self.hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(self.hass.async_stop, force=True)
        loader.async_setup(self.hass)
        self.hass.config_entries = ConfigEntries(self.hass, {})
        await bootstrap.async_load_base_functionality(self.hass)
        self.hass.states.async_set("calendar.movies", "off", {"supported_features": 7})
        self.hass.services.async_register("calendar", "create_event", lambda _: None)
        self.entity = FictionalCalendar()
        self.hass.data[DATA_COMPONENT] = SimpleNamespace(
            get_entity=lambda _: self.entity
        )
        self.entry = SimpleNamespace(
            options={},
            data={
                "calendar_enabled": True,
                "calendar_full_sync": True,
                "calendar_full_sync_dedicated": True,
                "calendar_full_sync_months": 3,
                "calendar_entity": {
                    "entity_id": "calendar.movies",
                    "registry_id": None,
                },
                "library_enabled": True,
                "library_host": library.ORIGIN,
            },
        )
        self.publisher = CalendarPublisher(self.hass, self.repository, self.entry)
        self.manager = self.publisher.maintenance
        self.now = datetime(2026, 10, 31, 12, tzinfo=UTC)
        self.manager.clock = lambda: self.now
        await self.repository.async_calendar_configure(
            {
                "target": "calendar.movies",
                "scope": "calendar.movies",
                "full_sync": True,
                "fingerprint": fingerprint(self.entry.data),
                "source": library.SOURCE,
            }
        )

    async def run_sync(self, seconds=0):
        self.now += timedelta(seconds=seconds)
        self.manager.request()
        await self.publisher.async_publish_one()

    def extra(self, uid="orphan", **data):
        self.entity.events[uid] = CalendarEvent(
            start=self.now - timedelta(days=1),
            end=self.now - timedelta(days=1) + timedelta(hours=1),
            summary="Unrelated old event",
            uid=uid,
            **data,
        )

    async def test_create_update_and_description_maintenance(self):
        row = (await self.create())["viewing"]
        await self.run_sync()
        self.assertEqual(self.entity.writes[0][0], "create")
        uid = next(iter(self.entity.events))
        self.assertIn(NOTICE, self.entity.events[uid].description)
        await self.repository.async_update(
            str(uuid4()),
            row["id"],
            row["revision"],
            {"started_at": "2026-10-12T19:00:00Z", "ended_at": "2026-10-12T21:00:00Z"},
        )
        await self.run_sync()
        self.assertFalse(self.manager.error)
        self.assertEqual(len(self.entity.events), 1)
        self.assertEqual(self.entity.writes[-1], ("update", uid))
        self.assertEqual(self.entity.events[uid].start.hour, 19)
        await self.run_sync()
        self.assertEqual(len(self.entity.writes), 2)

    async def test_orphans_and_deleted_viewings_require_two_stable_scans_and_grace(
        self,
    ):
        row = (await self.create())["viewing"]
        self.extra()
        self.extra(
            "old",
        )
        self.entity.events["old"].start = datetime(2020, 1, 1, tzinfo=UTC)
        self.entity.events["old"].end = datetime(2020, 1, 2, tzinfo=UTC)
        await self.run_sync()
        await self.run_sync(599)
        self.assertIn("orphan", self.entity.events)
        await self.run_sync(2)
        self.assertNotIn("orphan", self.entity.events)
        self.assertIn("old", self.entity.events)
        await self.repository.async_delete(str(uuid4()), row["id"], row["revision"])
        await self.run_sync()
        self.assertEqual(len(self.entity.events), 2)
        await self.run_sync(601)
        self.assertEqual(set(self.entity.events), {"old"})

    async def test_failed_lookup_prevents_writes_and_cleanup(self):
        self.extra()
        await self.run_sync()
        self.entity.fail_read = True
        await self.run_sync(601)
        self.assertTrue(self.manager.error)
        self.assertEqual(self.entity.writes, [])
        self.assertNotIn("private provider", self.manager.error)
        self.entity.fail_read = False
        await self.run_sync(301)
        self.assertEqual(self.entity.writes, [("delete", "orphan")])

    async def test_uncertain_create_is_read_back_without_replaying_after_restart(self):
        await self.create()
        self.entity.fail_after_write = True
        await self.run_sync()
        self.assertTrue(self.manager.error)
        self.assertEqual((await self.manager.status())["uncertain"], 1)
        # Restart recovers using persisted intents and an exact remote match.
        self.publisher = CalendarPublisher(self.hass, self.repository, self.entry)
        self.manager = self.publisher.maintenance
        self.manager.clock = lambda: self.now
        self.entity.fail_after_write = False
        await self.run_sync()
        self.assertFalse(self.manager.error)
        self.assertEqual((await self.manager.status())["uncertain"], 0)
        self.assertEqual(len(self.entity.writes), 1)

    async def test_unseen_uncertain_create_blocks_replay_until_inspected(self):
        await self.create()
        self.entity.fail_after_write = True
        await self.run_sync()
        self.entity.events.clear()  # Provider visibility can lag, never blindly retry.
        self.entity.fail_after_write = False
        await self.run_sync(301)
        self.assertEqual(len(self.entity.writes), 1)
        state = await self.manager.status()
        with self.assert_error("conflict"):
            await self.repository.async_calendar_maintenance(
                "acknowledge", "admin", "stale"
            )
        await self.repository.async_calendar_maintenance(
            "acknowledge", "admin", state["review_token"]
        )
        await self.run_sync()
        self.assertEqual(len(self.entity.writes), 2)

    async def test_create_delete_only_provider_replaces_before_deleting(self):
        self.entity._attr_supported_features = 3
        row = (await self.create())["viewing"]
        await self.run_sync()
        await self.repository.async_update(
            str(uuid4()), row["id"], row["revision"], {"watched_seconds": 3600}
        )
        await self.run_sync()
        self.assertFalse(self.manager.error)
        self.assertEqual(len(self.entity.events), 2)
        self.assertEqual([op for op, _ in self.entity.writes], ["create", "create"])
        logs = await self.repository.async_logs()
        self.assertIn("update_unsupported", {r.get("reason") for r in logs["items"]})
        self.assertIn("cleanup_deferred", {r.get("reason") for r in logs["items"]})
        self.assertEqual((await self.manager.status())["quarantined"], 1)
        await self.run_sync(601)
        self.assertEqual(len(self.entity.events), 1)
        self.assertEqual(self.entity.writes[-1][0], "delete")

    async def test_edit_trace_links_database_and_calendar_after_reload(self):
        row = (await self.create())["viewing"]
        await self.run_sync()
        await self.repository.async_logs("configure", {"level": "DEBUG"})
        request, actor = str(uuid4()), "private-user@example.invalid"
        await self.repository.async_update(
            request,
            row["id"],
            row["revision"],
            {"started_at": "2026-10-12T19:00:00Z", "ended_at": "2026-10-12T21:00:00Z"},
            actor_id=actor,
        )
        self.publisher = CalendarPublisher(self.hass, self.repository, self.entry)
        self.manager = self.publisher.maintenance
        self.manager.clock = lambda: self.now
        await self.run_sync()
        logger = self.repository.logger
        logs = await self.repository.async_logs(
            "list", {"reference": logger.alias(Resource.REQUEST, request)}
        )
        reasons = {r.get("reason") for r in logs["items"]}
        self.assertTrue(
            {
                "journal_write",
                "journal_saved",
                "journal_queued",
                "content_changed",
                "preflight_read",
                "read_back",
                "link_saved",
            }
            <= reasons
        )
        related = logger.alias(Resource.VIEWING, row["id"])
        actor_alias = logger.alias(Resource.USER, actor)
        self.assertTrue(all(r.get("related") == related for r in logs["items"]))
        self.assertTrue(all(r.get("actor") == actor_alias for r in logs["items"]))
        self.assertTrue(all(r.get("line", 0) > 0 for r in logs["items"]))
        self.assertNotIn(actor, str(logs))
        self.assertNotIn(row["id"], str(logs))
        self.assertNotIn(request, str(logs))
        self.assertEqual(len(self.entity.events), 1)

    async def test_external_change_resets_orphan_quarantine(self):
        self.extra()
        await self.run_sync()
        self.entity.events["orphan"].summary = "Edited externally"
        await self.run_sync(601)
        self.assertIn("orphan", self.entity.events)
        await self.run_sync(601)
        self.assertNotIn("orphan", self.entity.events)

    async def test_journal_change_during_read_prevents_cleanup(self):
        self.extra()
        row = (await self.create())["viewing"]
        await self.run_sync()

        async def change():
            self.entity.before_read = None
            await self.repository.async_update(
                str(uuid4()), row["id"], row["revision"], {"notes": "Changed"}
            )

        self.entity.before_read = change
        await self.run_sync(601)
        self.assertIn("orphan", self.entity.events)
        self.assertTrue(self.manager.error)

    async def test_recurring_and_missing_uids_never_cause_series_deletion(self):
        self.extra(rrule="FREQ=DAILY")
        await self.run_sync()
        await self.run_sync(601)
        self.assertEqual(self.entity.writes, [])
        self.entity.events["orphan"].rrule = None
        self.entity.events["orphan"].uid = None
        await self.run_sync()
        self.assertTrue(self.manager.error)
        self.assertEqual(self.entity.writes, [])

    async def test_opt_out_while_reading_and_backup_block_side_effects(self):
        await self.create()

        async def revoke():
            self.entry.data = {**self.entry.data, "calendar_full_sync": False}

        self.entity.before_read = revoke
        await self.run_sync()
        self.assertEqual(self.entity.writes, [])
        self.entity.before_read = None
        self.entry.data["calendar_full_sync"] = True
        await self.repository.async_pause()
        await self.run_sync()
        self.assertEqual(self.entity.writes, [])
        await self.repository.async_resume()

    async def test_polling_detects_journal_edits_without_refetching_unchanged_calendar(
        self,
    ):
        row = (await self.create())["viewing"]
        await self.run_sync()
        with patch.object(
            self.entity, "async_get_events", wraps=self.entity.async_get_events
        ) as read:
            await self.publisher.async_publish_one()
            read.assert_not_called()
            await self.repository.async_update(
                str(uuid4()), row["id"], row["revision"], {"watched_seconds": 3600}
            )
            await self.publisher.async_publish_one()
            self.assertGreater(read.call_count, 0)
            self.assertEqual(self.entity.writes[-1][0], "update")

    async def test_change_after_full_read_prevents_a_stale_delete(self):
        self.extra()
        await self.run_sync()
        calls = 0

        async def change_before_narrow_read():
            nonlocal calls
            calls += 1
            if calls == 2:
                self.entity.events["orphan"].summary = "Changed after planning"

        self.entity.before_read = change_before_narrow_read
        await self.run_sync(601)
        self.assertTrue(self.manager.error)
        self.assertEqual(self.entity.writes, [])

    async def test_future_events_and_response_limits_are_outside_mutation_scope(self):
        self.extra("future")
        self.entity.events["future"].start = self.now + timedelta(days=1)
        self.entity.events["future"].end = self.now + timedelta(days=1, hours=1)
        await self.run_sync()
        await self.run_sync(601)
        self.assertEqual(self.entity.writes, [])
        with patch.object(self.entity, "async_get_events", return_value=[None] * 10001):
            await self.run_sync()
        self.assertTrue(self.manager.error)
        self.assertEqual(self.entity.writes, [])

    async def test_harmless_provider_newlines_do_not_require_another_write(self):
        await self.create()
        await self.run_sync()
        event = next(iter(self.entity.events.values()))
        event.description = event.description.replace("\n", "\r\n") + "\r\n"
        await self.run_sync()
        self.assertFalse(self.manager.error)
        self.assertEqual(len(self.entity.writes), 1)
        self.assertIsNone(self.manager.snapshot)

    async def test_worker_enforces_deletion_quarantine_independently(self):
        bounds = window(self.now, 3)
        snapshot = await self.repository.async_calendar_maintenance("snapshot", bounds)
        with self.assert_error("not_ready"):
            await self.repository.async_calendar_maintenance(
                "reserve",
                bounds,
                snapshot["signature"],
                "delete",
                None,
                "orphan",
                "digest",
            )
        await self.repository.async_calendar_maintenance(
            "candidates", "desired", [("orphan", "digest")], self.now.isoformat()
        )
        with self.assert_error("not_ready"):
            await self.repository.async_calendar_maintenance(
                "reserve",
                bounds,
                snapshot["signature"],
                "delete",
                None,
                "orphan",
                "digest",
            )

    async def test_age_schedule_and_dedicated_calendar_validation(self):
        valid = {**self.entry.data, "calendar_entity": "calendar.movies"}
        for patch_value in (
            {"calendar_full_sync_months": 13},
            {"calendar_full_sync_months": 0},
            {"calendar_full_sync_months": 1.5},
            {"calendar_full_sync_time": "24:01"},
            {"calendar_full_sync_dedicated": False},
        ):
            with self.subTest(patch_value=patch_value), self.assertRaises(ValueError):
                validate(self.hass, {**valid, **patch_value}, {})
        self.assertEqual(validate(self.hass, valid, {})["calendar_full_sync_months"], 3)
        self.assertEqual(
            window(datetime(2024, 3, 31, tzinfo=UTC), 1)[0], "2024-02-29T00:00:00+00:00"
        )
        with patch(
            "custom_components.kaleidescape_companion.calendar.maintenance.async_track_time_change"
        ) as schedule:
            self.manager.start()
            self.assertEqual(
                schedule.call_args.kwargs, {"hour": 3, "minute": 0, "second": 0}
            )

    async def test_delayed_visibility_reads_again_without_repeating_write(self):
        await self.create()
        original = self.entity.async_get_events
        reads = 0

        async def delayed(*args):
            nonlocal reads
            reads += 1
            if self.entity.writes and reads == 2:
                return []
            return await original(*args)

        self.entity.async_get_events = delayed
        with patch(
            "custom_components.kaleidescape_companion.calendar.maintenance.asyncio.sleep",
            return_value=None,
        ):
            await self.run_sync()
        self.assertEqual(len(self.entity.writes), 1)
        self.assertEqual((await self.manager.status())["uncertain"], 0)
        logs = await self.repository.async_logs()
        self.assertTrue(
            any(
                r["operation"] == "verify" and r["outcome"] == "mismatch"
                for r in logs["items"]
            )
        )

    async def test_provider_normalization_diagnoses_mismatch_without_private_values(
        self,
    ):
        await self.create()
        await self.repository.async_logs("configure", {"level": "DEBUG"})
        original = self.entity.async_create_event

        async def normalized(**data):
            data["description"] = "Provider discarded private description"
            await original(**data)

        self.entity.async_create_event = normalized
        with patch(
            "custom_components.kaleidescape_companion.calendar.maintenance.asyncio.sleep",
            return_value=None,
        ):
            await self.run_sync()
        state = await self.manager.status()
        self.assertEqual(state["uncertain"], 1)
        self.assertEqual(state["failure_stage"], "verification")
        logs = await self.repository.async_logs()
        mismatches = [r for r in logs["items"] if "description_match" in r]
        self.assertTrue(mismatches)
        self.assertFalse(mismatches[0]["description_match"])
        self.assertTrue(mismatches[0]["title_match"])
        self.assertNotIn("Provider discarded", str(logs))
        await self.run_sync(301)
        self.assertEqual(len(self.entity.writes), 1)

    async def test_contract_failure_is_explained_without_provider_arguments(self):
        await self.create()

        async def missing(**data):
            raise KeyError(EVENT_START)

        self.entity.async_create_event = missing
        await self.run_sync()
        logs = await self.repository.async_logs()
        failures = [
            r
            for r in logs["items"]
            if r.get("failure") == "missing_field" and r["operation"] == "write"
        ]
        self.assertTrue(failures)
        self.assertIn("required field is missing", failures[0]["message"])
        self.assertTrue(failures[0]["file"].endswith("calendar/entity.py"))
        self.assertGreater(failures[0]["line"], 0)
        self.assertEqual((await self.manager.status())["uncertain"], 1)


class MaintenanceAPITest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_maintenance_rejects_nonadmin_and_bad_scope(self):
        result = await self.call(
            "calendar/maintain",
            user=SimpleNamespace(is_active=True, is_admin=False),
            **self.scope,
            action="run",
            fingerprint="no",
        )
        self.assertEqual(result["code"], "unauthorized")
        result = await self.call(
            "calendar/maintain",
            **{**self.scope, "dataset_id": str(uuid4())},
            action="run",
            fingerprint="no",
        )
        self.assertEqual(result["code"], "not_found")

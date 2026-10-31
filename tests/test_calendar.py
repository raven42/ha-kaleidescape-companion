"""Library-only manual admission, completion ordering and isolated calendar writes."""

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_repository as repository
from homeassistant import bootstrap, loader
from homeassistant.components.calendar import CalendarEntityFeature
from homeassistant.config_entries import ConfigEntries
from homeassistant.core import HomeAssistant
from test_tracking import observation

from custom_components.kaleidescape_companion.calendar.config import (
    fingerprint,
    template,
    validate,
)
from custom_components.kaleidescape_companion.calendar.publisher import (
    CalendarPublisher,
)
from custom_components.kaleidescape_companion.playback.tracker import PlaybackTracker


class CalendarTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

    async def seed(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [
                {
                    **library.ROWS[0],
                    "duration_seconds": 7200,
                    "actors": ["Fictional Actor"],
                },
                {**library.ROWS[2], "duration_seconds": 6600, "year": None},
            ],
            {"Favorites": ["fixture-a"], "Played": []},
        )

    async def create(self, **values):
        return await self.repository.async_create_from_library(
            str(uuid4()),
            library.SOURCE,
            {
                "library_title_id": library.title_id(library.SOURCE, "fixture-a"),
                "started_at": "2026-10-29T19:30:00-05:00",
                **values,
            },
            actor_id="fictional-admin",
        )

    async def rows(self):
        return (await self.repository.async_inspect("calendar_publications"))["items"]

    async def enable(self, **extra):
        config = {
            "target": "calendar.movies",
            "fingerprint": "fictional-config",
            "source": library.SOURCE,
            **extra,
        }
        await self.repository.async_calendar_configure(config)
        return config

    async def test_manual_runtime_and_version_snapshot(
        self,
    ):
        await self.seed()
        result = (await self.create())["viewing"]
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["watched_seconds"], 7200)
        self.assertEqual(result["duration_seconds"], 7200)
        self.assertEqual(result["ended_at"], "2026-10-30T02:30:00.000000+00:00")
        partial = (
            await self.create(
                library_title_id=library.title_id(library.SOURCE, "fixture-a2"),
                status="partial",
                watched_seconds=123.45,
            )
        )["viewing"]
        self.assertEqual(partial["duration_seconds"], 6600)
        self.assertEqual(partial["ended_at"], "2026-10-30T00:32:03.450000+00:00")
        self.assertEqual(partial["raw_content_id"], "fixture-a2")
        self.assertEqual(await self.rows(), [])

    async def test_manual_admission_validation(
        self,
    ):
        await self.seed()
        for data in (
            {"title": "Forged"},
            {"ended_at": "2026-11-01T00:00:00Z"},
            {"duration_seconds": 1},
            {"library_title_id": "b" * 64},
            {"status": "partial", "watched_seconds": 7201},
            {"status": "partial", "watched_seconds": 0},
            {"status": "partial"},
            {"status": "completed", "watched_seconds": 5},
        ):
            with self.subTest(data=data), self.assert_error("invalid_request"):
                await self.create(**data)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)
        await self.repository.async_library_catalog(
            library.ORIGIN, [{**library.ROWS[0], "duration_seconds": None}]
        )
        with self.assert_error("invalid_request"):
            await self.create()

    async def test_completion_sort_partial_priority_and_keyset_pages(
        self,
    ):
        for title, status, ended in [
            ("C", "completed", "2026-10-29T12:00:00Z"),
            ("A", "completed", "2026-10-29T13:00:00Z"),
            ("B", "partial", None),
        ]:
            await self.repository.async_create(
                str(uuid4()),
                repository.viewing(title=title, status=status, ended_at=ended),
            )
        for descending, expected in [(True, ["B", "A", "C"]), (False, ["B", "C", "A"])]:
            titles = []
            cursor = None
            while True:
                page = await self.repository.async_list(
                    limit=1, cursor=cursor, descending=descending
                )
                titles += [row["title"] for row in page["items"]]
                cursor = page["next_cursor"]
                if not cursor:
                    break
            self.assertEqual(titles, expected)
        self.assertEqual(
            [
                r["title"]
                for r in (
                    await self.repository.async_list(sort="title", descending=False)
                )["items"]
            ],
            ["A", "B", "C"],
        )
        page = await self.repository.async_list(limit=1)
        with self.assert_error("refresh_required"):
            await self.repository.async_list(cursor=page["next_cursor"], sort="title")

    async def test_completion_queue_is_opt_in_durable_and_retries_do_not_duplicate(
        self,
    ):
        await self.seed()
        await self.create()  # Existing completions are not backfilled.
        await self.enable()
        self.assertIsNone(await self.repository.async_calendar_claim())
        data = {
            "library_title_id": library.title_id(library.SOURCE, "fixture-a"),
            "started_at": "2026-10-29T10:00:00Z",
        }
        request = str(uuid4())
        first = await self.repository.async_create_from_library(
            request, library.SOURCE, data, actor_id="admin"
        )
        await self.repository.async_pause()
        self.assertIsNone(await self.repository.async_calendar_claim())
        self.assertEqual(
            await self.repository.async_create_from_library(
                request, library.SOURCE, data, actor_id="admin"
            ),
            first,
        )
        await self.repository.async_resume()
        claimed = await self.repository.async_calendar_claim()
        self.assertEqual(claimed["metadata"]["actors"], ["Fictional Actor"])
        await self.repository.async_calendar_configure(
            {"target": "calendar.movies", "fingerprint": "fictional-config"}
        )
        self.assertIsNone(await self.repository.async_calendar_claim())
        self.assertEqual((await self.rows())[0]["state"], "uncertain")
        with self.assert_error("conflict"):
            await self.repository.async_create_from_library(
                request, library.SOURCE, data, actor_id="other-admin"
            )

    async def test_partial_transition_and_observed_credits_queue_only_one_event(self):
        await self.seed()
        await self.enable()
        partial = (await self.create(status="partial", watched_seconds=600))["viewing"]
        self.assertEqual(await self.rows(), [])
        await self.repository.async_update(
            str(uuid4()), partial["id"], 1, {"status": "completed"}
        )
        self.assertEqual(len(await self.rows()), 1)
        tracker = PlaybackTracker("fictional-player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        snapshot = tracker.apply(observation(301, location="credits"))[-1]
        await self.repository.async_save_session(snapshot, 300, 24)
        await self.repository.async_save_session(snapshot, 300, 24)
        self.assertEqual(len(await self.rows()), 2)

    async def test_opt_out_or_deleted_viewing_cancels_queued_work(self):
        await self.seed()
        await self.enable()
        row = (await self.create())["viewing"]
        await self.repository.async_delete(str(uuid4()), row["id"], 1)
        self.assertIsNone(await self.repository.async_calendar_claim())
        self.assertEqual((await self.rows())[0]["state"], "cancelled")
        await self.create()
        await self.repository.async_calendar_configure(None)
        self.assertTrue(all(row["state"] == "cancelled" for row in await self.rows()))

    async def test_fixed_action_and_uncertain_result_barrier(
        self,
    ):
        await self.seed()
        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        hass.states.async_set(
            "calendar.movies",
            "off",
            {"supported_features": int(CalendarEntityFeature.CREATE_EVENT)},
        )
        entry = SimpleNamespace(
            data={
                "calendar_enabled": True,
                "calendar_entity": {
                    "entity_id": "calendar.movies",
                    "registry_id": None,
                },
                "calendar_title": "Watched: {title} ({year}) · {director}",
            },
            options={},
        )
        publisher = CalendarPublisher(hass, self.repository, entry)
        await self.enable(fingerprint=fingerprint(entry.data))
        calls = []

        async def service(call):
            calls.append(call.data)

        hass.services.async_register("calendar", "create_event", service)
        await self.create(notes="Never share this note")
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)
        await self.create()
        hass.states.async_set(
            "calendar.movies", "unavailable", {"supported_features": 1}
        )
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)
        hass.states.async_set("calendar.movies", "off", {"supported_features": 1})
        original_claim = self.repository.async_calendar_claim

        async def revoke():
            row = await original_claim()
            entry.data = {**entry.data, "calendar_enabled": False}
            return row

        with patch.object(self.repository, "async_calendar_claim", revoke):
            await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)
        entry.data = {**entry.data, "calendar_enabled": True}
        self.assertEqual(calls[0]["entity_id"], "calendar.movies")
        self.assertIn("2025", calls[0]["summary"])
        self.assertIn("Fictional Actor", calls[0]["description"])
        self.assertNotIn("Kaleidescape Companion data:", calls[0]["description"])
        self.assertNotIn("fictional-dataset", calls[0]["description"])
        self.assertNotIn("library_title_id", calls[0]["description"])
        self.assertNotIn("Never share", json.dumps(calls))
        self.assertNotIn(library.ORIGIN, json.dumps(calls))
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)

        async def failure(call):
            calls.append(call.data)
            raise RuntimeError("private provider response")

        hass.services.async_register("calendar", "create_event", failure)
        await self.create()
        with self.assertLogs(
            "custom_components.kaleidescape_companion.calendar.publisher",
            level="WARNING",
        ) as logs:
            await publisher.async_publish_one()
        self.assertNotIn("private provider", str(logs.output))
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 2)
        self.assertIn("uncertain", {row["state"] for row in await self.rows()})
        entry.data = {**entry.data, "calendar_enabled": False}
        await self.create()
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 2)

    async def test_templates_and_calendar_capability_validation(
        self,
    ):
        for value in (
            "{title.__class__}",
            "{cast[0]}",
            "{title!r}",
            "{title:100000}",
            "{unknown}",
            "{",
            " ",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                template(value)
        self.assertEqual(template("{{Watched}} {title}"), "{{Watched}} {title}")
        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        # Inert defaults need no entity registry or writable calendar.
        self.assertFalse(validate(hass, {}, {})["calendar_enabled"])
        loader.async_setup(hass)
        hass.config_entries = ConfigEntries(hass, {})
        await bootstrap.async_load_base_functionality(hass)
        hass.states.async_set("calendar.readonly", "off", {"supported_features": 0})
        with self.assertRaises(ValueError):
            validate(
                hass,
                {"calendar_enabled": True, "calendar_entity": "calendar.readonly"},
                {},
            )
        hass.states.async_set(
            "calendar.writable",
            "off",
            {"supported_features": int(CalendarEntityFeature.CREATE_EVENT)},
        )
        self.assertTrue(
            validate(
                hass,
                {"calendar_enabled": True, "calendar_entity": "calendar.writable"},
                {},
            )["calendar_enabled"]
        )

    async def test_backup_drains_an_accepted_claim_before_pausing_storage(self):
        await self.seed()
        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        hass.states.async_set("calendar.movies", "off", {"supported_features": 1})
        config = {
            "calendar_enabled": True,
            "calendar_entity": {"entity_id": "calendar.movies"},
        }
        publisher = CalendarPublisher(
            hass, self.repository, SimpleNamespace(data=config, options={})
        )
        await self.enable(fingerprint=fingerprint(config))
        await self.create()
        calls = []

        async def service(call):
            calls.append(call.data)

        hass.services.async_register("calendar", "create_event", service)
        claimed, release = asyncio.Event(), asyncio.Event()
        original = self.repository.async_calendar_claim

        async def hold_claim():
            row = await original()
            claimed.set()
            await release.wait()
            return row

        with patch.object(self.repository, "async_calendar_claim", hold_claim):
            publisher.running = asyncio.create_task(publisher.async_publish_one())
            await claimed.wait()
            pause = asyncio.create_task(publisher.async_pause())
            await asyncio.sleep(0)
            self.assertFalse(pause.done())
            release.set()
            await pause
        self.assertEqual(len(calls), 1)
        self.assertEqual((await self.rows())[0]["state"], "sent")
        await self.create()
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)
        await publisher.async_stop()


class ManualApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call
    create = backend.BackendTest.create

    async def test_free_text_is_rejected_and_regular_users_cannot_create(self):
        self.assertEqual(
            (
                await self.call(
                    "journal/create",
                    **self.scope,
                    request_id=str(uuid4()),
                    data={"title": "invented"},
                )
            )["code"],
            "library_disabled",
        )
        await self.create()
        self.assertEqual(
            (
                await self.call(
                    "journal/create",
                    **self.scope,
                    request_id=str(uuid4()),
                    data={"title": "invented"},
                )
            )["code"],
            "invalid_request",
        )
        user = SimpleNamespace(is_active=True, is_admin=False)
        self.assertEqual(
            (
                await self.call(
                    "journal/create",
                    user=user,
                    **self.scope,
                    request_id=str(uuid4()),
                    data={},
                )
            )["code"],
            "unauthorized",
        )

    async def test_library_opt_out_during_create_withholds_result(self):
        await self.create()
        repo = self.entry.runtime_data.repository
        original = repo.async_create_from_library

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            object.__setattr__(
                self.entry, "data", {**self.entry.data, "library_enabled": False}
            )
            return result

        with patch.object(repo, "async_create_from_library", revoke):
            self.assertEqual((await self.create())["code"], "library_disabled")


class HistoricalCalendarTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error
    seed = CalendarTest.seed
    create = CalendarTest.create
    enable = CalendarTest.enable

    async def provider(self, *, events=(), lookup_error=False, create_error=False):
        from homeassistant.core import SupportsResponse

        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        hass.states.async_set("calendar.movies", "off", {"supported_features": 1})
        config = {
            "calendar_enabled": True,
            "calendar_entity": {"entity_id": "calendar.movies"},
            "calendar_title": "Watched: {title}",
            "calendar_description": "{title} · {director} · {watched} minutes",
        }
        entry = SimpleNamespace(data=config, options={})
        publisher = CalendarPublisher(hass, self.repository, entry)
        await self.enable(fingerprint=fingerprint(config))
        calls, reads = [], []

        async def lookup(call):
            reads.append(call.data)
            if lookup_error:
                raise RuntimeError("private lookup error")
            return {"calendar.movies": {"events": list(events)}}

        async def create(call):
            calls.append(dict(call.data))
            if create_error:
                raise RuntimeError("private create error")

        hass.services.async_register(
            "calendar", "get_events", lookup, supports_response=SupportsResponse.ONLY
        )
        hass.services.async_register("calendar", "create_event", create)
        return publisher, calls, reads

    async def export(self, publisher, request=None, authorized=lambda: True):
        result = await publisher.history.start(
            request or str(uuid4()),
            "fictional-admin",
            fingerprint(publisher.config),
            authorized,
        )
        await publisher.history.async_drain()
        return result, (await publisher.history.status())["job"]

    async def test_export_matches_existing_and_duplicate_rows_and_retries(self):
        await self.seed()
        first = (await self.create())["viewing"]
        await self.create()  # Same title/time is intentionally one external event.
        await self.create(started_at="2026-10-30T19:30:00-05:00")
        publisher, calls, reads = await self.provider(
            events=[
                {
                    "summary": "Watched: The Glass Harbor",
                    "start": first["started_at"],
                    "end": first["ended_at"],
                }
            ]
        )
        # The fictional source title is obtained from the seed, never household data.
        title = first["title"]
        publisher.hass.services.async_remove("calendar", "get_events")
        from homeassistant.core import SupportsResponse

        async def lookup(call):
            reads.append(call.data)
            return {
                "calendar.movies": {
                    "events": [
                        {
                            "summary": f"Watched: {title}",
                            "start": first["started_at"],
                            "end": first["ended_at"],
                        }
                    ]
                }
            }

        publisher.hass.services.async_register(
            "calendar", "get_events", lookup, supports_response=SupportsResponse.ONLY
        )
        request = str(uuid4())
        receipt, job = await self.export(publisher, request)
        self.assertEqual(job["counts"], {"created": 1, "matched": 2})
        self.assertTrue(job["finished"])
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(reads), 1)
        self.assertIn(f"{title} ·", calls[0]["description"])
        self.assertIn("120.00 minutes", calls[0]["description"])
        self.assertEqual(receipt, (await self.export(publisher, request))[0])
        self.assertEqual(len(calls), 1)
        with self.assert_error("conflict"):
            await publisher.history.start(
                request, "another-admin", fingerprint(publisher.config), lambda: True
            )
        # Export receipts suppress automatic writes for the same viewing/config.
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)

    async def test_export_failed_lookup_stops_without_writes(self):
        await self.seed()
        await self.create()
        await self.create(started_at="2026-10-31T19:30:00-05:00")
        publisher, calls, reads = await self.provider(lookup_error=True)
        _, job = await self.export(publisher)
        self.assertEqual(calls, [])
        self.assertEqual(len(reads), 1)
        self.assertEqual(job["counts"], {"failed": 1, "cancelled": 1})
        self.assertTrue(job["finished"])

    async def test_export_uncertain_write_never_blindly_repeats(self):
        await self.seed()
        await self.create()
        publisher, calls, _ = await self.provider(create_error=True)
        _, job = await self.export(publisher)
        self.assertEqual(job["counts"], {"uncertain": 1})
        await self.export(publisher)
        await publisher.async_publish_one()
        self.assertEqual(len(calls), 1)
        # A format change can legitimately create a new event; confirmation warns.
        publisher.entry.data = {**publisher.config, "calendar_title": "Movie: {title}"}
        publisher.config = dict(publisher.entry.data)
        await self.enable(fingerprint=fingerprint(publisher.config))
        await self.export(publisher)
        self.assertEqual(len(calls), 2)

    async def test_export_checks_permission_and_stale_viewing_after_lookup(self):
        await self.seed()
        created = (await self.create())["viewing"]
        publisher, calls, _ = await self.provider()
        original = publisher.history.read_month
        allowed = True

        async def revoke(data):
            nonlocal allowed
            await original(data)
            allowed = False

        with patch.object(publisher.history, "read_month", revoke):
            await self.export(publisher, authorized=lambda: allowed)
        self.assertEqual(calls, [])
        publisher.history.month = None

        async def change(data):
            await original(data)
            await self.repository.async_update(
                str(uuid4()), created["id"], created["revision"], {"notes": "changed"}
            )

        with patch.object(publisher.history, "read_month", change):
            _, job = await self.export(publisher)
        self.assertEqual(calls, [])
        self.assertEqual(job["counts"], {"skipped": 1})

    async def test_export_receipt_recovery_preserves_uncertainty(self):
        await self.seed()
        await self.create()
        config = await self.enable()
        job = await self.repository.async_calendar_sync(
            "begin", str(uuid4()), "fictional-admin"
        )
        row = await self.repository.async_calendar_sync("claim", job["job_id"])
        self.assertTrue(
            await self.repository.async_calendar_sync("ready", job["job_id"], row)
        )
        await self.repository.async_calendar_configure(config)
        status = await self.repository.async_calendar_sync("status")
        self.assertEqual(status["job"]["counts"], {"uncertain": 1})
        self.assertTrue(status["job"]["finished"])

    async def test_history_backup_pause_drains_current_item_and_resumes_remaining(self):
        await self.seed()
        await self.create()
        await self.create(started_at="2026-10-30T19:30:00-05:00")
        publisher, calls, _ = await self.provider()
        self.addAsyncCleanup(publisher.async_stop)
        entered, release = asyncio.Event(), asyncio.Event()
        original = publisher.history.read_month

        async def hold(data):
            entered.set()
            await release.wait()
            await original(data)

        with patch.object(publisher.history, "read_month", hold):
            await publisher.history.start(
                str(uuid4()),
                "fictional-admin",
                fingerprint(publisher.config),
                lambda: True,
            )
            await entered.wait()
            pause = asyncio.create_task(publisher.async_pause())
            await asyncio.sleep(0)
            self.assertFalse(pause.done())
            release.set()
            await pause
        self.assertEqual(len(calls), 1)
        self.assertEqual(
            (await publisher.history.status())["job"]["counts"],
            {"created": 1, "queued": 1},
        )
        await publisher.async_resume()
        await publisher.history.async_drain()
        self.assertEqual(len(calls), 2)
        self.assertTrue((await publisher.history.status())["job"]["finished"])

    async def test_cancel_during_lookup_prevents_unstarted_writes(self):
        await self.seed()
        await self.create()
        await self.create(started_at="2026-10-30T19:30:00-05:00")
        publisher, calls, _ = await self.provider()
        entered, release = asyncio.Event(), asyncio.Event()
        original = publisher.history.read_month

        async def hold(data):
            entered.set()
            await release.wait()
            await original(data)

        with patch.object(publisher.history, "read_month", hold):
            receipt = await publisher.history.start(
                str(uuid4()),
                "fictional-admin",
                fingerprint(publisher.config),
                lambda: True,
            )
            await entered.wait()
            cancel = asyncio.create_task(publisher.history.cancel(receipt["job_id"]))
            await asyncio.sleep(0)
            release.set()
            await cancel
        self.assertEqual(calls, [])
        self.assertEqual(
            (await publisher.history.status())["job"]["counts"],
            {"skipped": 1, "cancelled": 1},
        )

    async def test_remote_match_resolves_prior_uncertainty_without_second_write(self):
        await self.seed()
        await self.create()
        events = []
        publisher, calls, _ = await self.provider(events=events, create_error=True)
        await self.export(publisher)
        event = calls[0]
        events.append(
            {
                "summary": event["summary"],
                "start": event["start_date_time"],
                "end": event["end_date_time"],
            }
        )
        _, job = await self.export(publisher)
        self.assertEqual(job["counts"], {"matched": 1})
        self.assertEqual(len(calls), 1)
        receipts = (await self.repository.async_inspect("calendar_publications"))[
            "items"
        ]
        self.assertEqual(receipts[0]["state"], "sent")
        self.assertEqual(
            {
                item["state"]
                for item in (
                    await self.repository.async_inspect("calendar_sync_items")
                )["items"]
            },
            {"matched"},
        )

    async def test_description_template_validation_and_empty_description(self):
        publisher, _, _ = await self.provider()
        loader.async_setup(publisher.hass)
        publisher.hass.config_entries = ConfigEntries(publisher.hass, {})
        await bootstrap.async_load_base_functionality(publisher.hass)
        values = {"calendar_description": "{title.__class__}"}
        with self.assertRaises(ValueError):
            validate(publisher.hass, values, publisher.config)
        with self.assertRaises(ValueError):
            validate(
                publisher.hass, {"calendar_description": "x" * 5001}, publisher.config
            )
        self.assertEqual(
            validate(publisher.hass, {"calendar_description": ""}, publisher.config)[
                "calendar_description"
            ],
            "",
        )

    async def test_only_user_templates_are_exported_and_legacy_artwork_is_blank(self):
        from custom_components.kaleidescape_companion.calendar.publisher import (
            event_data,
        )

        await self.seed()
        await self.enable()
        await self.create()
        row = await self.repository.async_calendar_claim()
        empty = event_data(row, "{title}", "")
        self.assertEqual(empty["description"], "")
        human = event_data(row, "{title}", "{cast} |{artwork}| {director}")
        self.assertEqual(human["description"], "Fictional Actor || A. Director")
        for value in (
            row["id"],
            row["library_title_id"],
            "Kaleidescape Companion data:",
            "kaleidescape_companion:",
        ):
            self.assertNotIn(value, json.dumps(human))


class LibraryCompletionTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

    async def test_partial_fuzzy_unicode_and_literal_title_completion(self):
        titles = ["Amélie", "The Lantern Voyage", "The Lantern Voyage", "Moana"]
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [
                {
                    **library.ROWS[0],
                    "source_handle": f"fiction-{index}",
                    "title": title,
                    "source_group": f"group-{index}",
                    "duration_seconds": 7200,
                }
                for index, title in enumerate(titles)
            ],
        )
        for query, expected in [
            ("amel", ["Amélie"]),
            ("lant", titles[1:3]),
            ("lantren voyge", titles[1:3]),
            ("moa", ["Moana"]),
            ("%' OR 1=1 --", []),
        ]:
            with self.subTest(query=query):
                result = await self.repository.async_library_search(
                    library.SOURCE, query, []
                )
                self.assertEqual([row["title"] for row in result["items"]], expected)
                self.assertNotIn("source_handle", json.dumps(result))
        for query in ["x" * 101, "a " * 20, "bad\x00", []]:
            with self.assert_error("invalid_request"):
                await self.repository.async_library_search(library.SOURCE, query, [])

    async def test_database_relationships_include_composite_keys_and_system_sources(
        self,
    ):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [library.ROWS[0]],
            {"Director's picks": [library.ROWS[0]["source_handle"]]},
        )
        page = await self.repository.async_inspect("library_memberships")
        self.assertIn(
            {
                "table": "library_collections",
                "key": {"source_id": "source_id", "name": "collection"},
            },
            page["references"],
        )
        self.assertIn(
            {"table": "library", "key": {"id": "title_id"}}, page["references"]
        )
        self.assertNotIn("library_sources", page["main_tables"])
        self.assertNotIn("library_collections", page["main_tables"])
        self.assertNotIn("library_artwork", page["main_tables"])
        self.assertEqual(len(page["tables"]), 22)
        titles = await self.repository.async_inspect("library")
        self.assertIn(
            {"table": "library_artwork", "key": {"cache_key": "artwork_key"}},
            titles["references"],
        )


class CalendarApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call
    create = backend.BackendTest.create

    async def test_calendar_commands_are_admin_only_and_scope_bound(self):
        from unittest.mock import AsyncMock

        history = SimpleNamespace(
            status=AsyncMock(return_value={"ready": False}),
            start=AsyncMock(return_value={"job_id": "fictional", "total": 0}),
            cancel=AsyncMock(),
            async_drain=AsyncMock(),
        )
        self.entry.runtime_data.calendar.history = history
        normal = SimpleNamespace(id="normal", is_active=True, is_admin=False)
        for command, extra in [
            ("calendar/status", {}),
            (
                "calendar/sync",
                {
                    "request_id": str(uuid4()),
                    "fingerprint": "fictional",
                    "confirmation": "EXPORT JOURNAL",
                },
            ),
            ("calendar/cancel", {"job_id": str(uuid4())}),
        ]:
            with self.subTest(command=command):
                result = await self.call(command, user=normal, **self.scope, **extra)
                self.assertEqual(result["code"], "unauthorized")
        history.status.assert_not_awaited()
        history.start.assert_not_awaited()
        history.cancel.assert_not_awaited()
        self.assertEqual(
            (
                await self.call(
                    "calendar/status", **{**self.scope, "dataset_id": str(uuid4())}
                )
            )["code"],
            "not_found",
        )
        self.assertEqual(
            (
                await self.call(
                    "calendar/sync",
                    **self.scope,
                    request_id=str(uuid4()),
                    fingerprint="fictional",
                    confirmation="wrong",
                )
            )["code"],
            "invalid_request",
        )
        history.start.assert_not_awaited()
        self.assertTrue((await self.call("calendar/status", **self.scope))["success"])

    async def test_regular_library_completion_redaction_and_opt_out_during_wait(self):
        await self.create()
        normal = SimpleNamespace(id="normal", is_active=True, is_admin=False)
        result = await self.call(
            "library/search", user=normal, **self.scope, query="Fictnal"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["result"]["items"][0]["title"], "Fictional Film")
        self.assertNotIn("source_handle", json.dumps(result))
        repository = self.entry.runtime_data.repository
        original = repository.async_library_search

        async def disable(*args):
            value = await original(*args)
            object.__setattr__(
                self.entry, "data", {**self.entry.data, "library_enabled": False}
            )
            return value

        with patch.object(repository, "async_library_search", disable):
            self.assertEqual(
                (
                    await self.call(
                        "library/search", user=normal, **self.scope, query="Fictnal"
                    )
                )["code"],
                "library_disabled",
            )

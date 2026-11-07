"""Bounded local-month reads and household-safe calendar detail projections."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_metadata as metadata
import test_repository as repository

from custom_components.kaleidescape_companion.core.journal_calendar import MOVIE_FIELDS
from custom_components.kaleidescape_companion.core.journal_store import PUBLIC_FIELDS
from custom_components.kaleidescape_companion.core.repository import JournalRepository

START, END = "2026-10-01T05:00:00Z", "2026-11-01T05:00:00Z"


class JournalCalendarTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error
    seed = metadata.MetadataTest.seed

    async def create(self, stamp=START, handle=metadata.HANDLE, **values):
        return (
            await self.repository.async_create_from_library(
                str(uuid4()),
                library.SOURCE,
                {
                    "library_title_id": library.title_id(library.SOURCE, handle),
                    "started_at": stamp,
                    **values,
                },
                actor_id="admin",
            )
        )["viewing"]

    async def month(self, **values):
        return await self.repository.async_calendar_month(START, END, **values)

    async def test_open_completed_tracker_session_appears_in_completion_month(self):
        from datetime import UTC, datetime, timedelta

        from custom_components.kaleidescape_companion.playback.tracker import (
            Observation,
            PlaybackTracker,
        )

        base = datetime(2026, 10, 31, 23, 59, 30, tzinfo=UTC)
        tracker = PlaybackTracker("fictional-player")
        for seconds, location in (
            (0, "content"),
            (0.5, "content"),
            (20, "content"),
            (40, "credits"),
        ):
            point = Observation(
                at=(base + timedelta(seconds=seconds)).isoformat(
                    timespec="microseconds"
                ),
                monotonic=seconds,
                content_id="fictional-film",
                title="Fictional Film",
                duration=7200,
                available=True,
                play_status="playing",
                location=location,
            )
            for snapshot in tracker.apply(point):
                await self.repository.async_save_session(snapshot, 30, 24)
        row = (await self.repository.async_inspect("viewings"))["items"][0]
        self.assertIsNone(row["ended_at"])
        self.assertIsNotNone(row["completed_at"])
        october = await self.repository.async_calendar_month(
            "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"
        )
        november = await self.repository.async_calendar_month(
            "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"
        )
        self.assertEqual(len(october["items"]), 1)
        self.assertEqual(october["summary"]["viewing_count"], 0)
        self.assertEqual(len(november["items"]), 1)
        self.assertEqual(november["items"][0]["completed_at"], row["completed_at"])
        self.assertEqual(november["summary"]["viewing_count"], 1)
        self.assertEqual(november["summary"]["watched_seconds"], row["watched_seconds"])

    async def test_half_open_local_range_handles_midnight_precision_and_deleted_rows(
        self,
    ):
        await self.seed()
        first = await self.create(START)
        second = await self.create("2026-10-31T23:30:00-05:00")
        await self.create(
            "2026-10-01T04:59:59.999999Z", status="partial", watched_seconds=60
        )
        await self.create(END)
        deleted = await self.create("2026-10-10T12:00:00Z")
        await self.repository.async_delete(
            str(uuid4()), deleted["id"], deleted["revision"]
        )

        def observation_precision():
            with self.repository._db() as db:
                db.execute(
                    "UPDATE viewings SET started_at=? WHERE id=?",
                    (START.replace("Z", "+00:00"), first["id"]),
                )

        await self.repository._call(observation_precision)
        result = await self.month(source=library.SOURCE)
        self.assertEqual(
            [row["id"] for row in result["items"]], [first["id"], second["id"]]
        )
        self.assertEqual(
            set(result["items"][0]),
            PUBLIC_FIELDS | {"library_title_id", "artwork_key", "completed_at"},
        )
        self.assertEqual(
            result["revision"], (await self.repository.async_info())["revision"]
        )
        with self.assert_error("not_found"):
            await self.repository.async_calendar_details(deleted["id"], library.SOURCE)

    async def test_filters_include_versions_and_rewatches_but_not_same_name_remakes(
        self,
    ):
        await self.seed([{**row, "duration_seconds": 7200} for row in metadata.ROWS])
        first = await self.create()
        partial = await self.create(
            handle="0-S_B123BC45", status="partial", watched_seconds=600
        )
        await self.create(handle="0-S_C123BC45")
        title_id = library.title_id(library.SOURCE, metadata.HANDLE)
        filtered = await self.month(source=library.SOURCE, title_id=title_id)
        self.assertEqual(
            {row["id"] for row in filtered["items"]}, {first["id"], partial["id"]}
        )
        self.assertEqual(
            [
                row["id"]
                for row in (await self.month(viewing_status="partial"))["items"]
            ],
            [partial["id"]],
        )
        self.assertEqual(
            (await self.month(query="Voyge Europa", fuzzy=False))["items"], []
        )
        self.assertEqual(
            len((await self.month(query="Voyge Europa", fuzzy=True))["items"]), 3
        )
        with self.assert_error("library_disabled"):
            await self.month(title_id=title_id)
        with self.assert_error("not_found"):
            await self.month(source="other", title_id=title_id)

    async def test_compact_metadata_preserves_version_and_excludes_private_fields(
        self,
    ):
        await self.seed()
        viewing = await self.create(
            handle="0-S_B123BC45", notes="Private household note"
        )
        detail = await self.repository.async_calendar_details(
            viewing["id"], library.SOURCE
        )
        self.assertEqual(set(detail["viewing"]), PUBLIC_FIELDS | {"completed_at"})
        self.assertEqual(set(detail["movie"]), set(MOVIE_FIELDS))
        self.assertEqual(detail["movie"]["year"], 2025)
        self.assertEqual(detail["movie"]["edition"], "HD")
        self.assertEqual(detail["movie"]["duration_seconds"], 6600)
        self.assertEqual(detail["movie"]["actors"], ["Fictional Actor"])
        self.assertEqual(detail["movie"]["directors"], ["A. Director"])
        for key in (
            "purchase_date",
            "added_on",
            "order_id",
            "purchase_price",
            "notes",
            "source_handle",
            "source_group",
            "synopsis",
        ):
            self.assertNotIn(key, json.dumps(detail))
        for source in (None, "other"):
            self.assertIsNone(
                (await self.repository.async_calendar_details(viewing["id"], source))[
                    "movie"
                ]
            )
            self.assertIsNone(
                (await self.month(source=source))["items"][0]["library_title_id"]
            )
        await self.repository.async_library_catalog(library.ORIGIN, [], {})
        self.assertIsNone(
            (
                await self.repository.async_calendar_details(
                    viewing["id"], library.SOURCE
                )
            )["movie"]
        )

    async def test_cross_month_completion_includes_both_endpoints_only(self):
        await self.seed()
        row = await self.create("2026-10-01T04:30:00Z")
        # A start in the prior local month still appears on completion day.
        october = await self.month(source=library.SOURCE)
        self.assertEqual([item["id"] for item in october["items"]], [row["id"]])
        september = await self.repository.async_calendar_month(
            "2026-09-01T05:00:00Z", START
        )
        self.assertEqual([item["id"] for item in september["items"]], [row["id"]])
        november = await self.repository.async_calendar_month(
            END, "2026-12-01T06:00:00Z"
        )
        self.assertEqual(november["items"], [])
        self.assertEqual(
            october["summary"],
            {"viewing_count": 1, "watched_seconds": row["watched_seconds"]},
        )
        self.assertEqual(
            september["summary"], {"viewing_count": 0, "watched_seconds": 0}
        )
        self.assertEqual(
            november["summary"], {"viewing_count": 0, "watched_seconds": 0}
        )
        filtered = await self.month(query="Nothing matches this title")
        self.assertEqual(filtered["items"], [])
        self.assertEqual(filtered["summary"], october["summary"])

        # A completed endpoint exactly on the upper bound belongs to next month.
        def boundary():
            with self.repository._db() as db:
                db.execute(
                    "UPDATE viewings SET started_at=?,ended_at=? WHERE id=?",
                    (
                        "2026-10-31T23:00:00+00:00",
                        END.replace("Z", "+00:00"),
                        row["id"],
                    ),
                )

        await self.repository._call(boundary)
        self.assertEqual(len((await self.month())["items"]), 1)
        self.assertEqual(
            len(
                (
                    await self.repository.async_calendar_month(
                        END, "2026-12-01T06:00:00Z"
                    )
                )["items"]
            ),
            1,
        )

    async def test_invalid_ranges_and_month_limit_fail_without_partial_results(self):
        for start, end in (
            (START, START),
            (END, START),
            (START, "2026-12-01T00:00:00Z"),
            ("bad", END),
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_calendar_month(start, end)
        for fields in (
            {"fuzzy": "yes"},
            {"viewing_status": "bad"},
            {"query": "a" * 501},
        ):
            with self.assert_error("invalid_request"):
                await self.month(**fields)
        # A DST transition month can have an extra UTC hour without exceeding 32 days.
        self.assertEqual(
            (
                await self.repository.async_calendar_month(
                    "2026-11-01T00:00:00-05:00", "2026-12-01T00:00:00-06:00"
                )
            )["items"],
            [],
        )
        await self.seed()
        viewing = await self.create()

        def copies():
            db = self.repository._db()
            row = dict(
                db.execute(
                    "SELECT * FROM viewings WHERE id=?", (viewing["id"],)
                ).fetchone()
            )
            placeholders = ",".join("?" for _ in row)
            sql = f"INSERT INTO viewings ({','.join(row)}) VALUES ({placeholders})"
            with db:
                for _ in range(999):
                    db.execute(sql, tuple({**row, "id": str(uuid4())}.values()))

        await self.repository._call(copies)
        self.assertEqual(len((await self.month())["items"]), 1000)
        await self.create()
        with self.assert_error("calendar_limit"):
            await self.month()

    async def test_personal_journal_view_survives_startup_search_migration(
        self,
    ):
        self.assertEqual(
            (await self.repository.async_ui_preferences("a", area="journal"))["values"],
            {
                "view": "list",
                "calendar_size": 180,
                "calendar_fit": False,
                "movie_details": "full",
            },
        )
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            0,
            {
                "view": "calendar",
                "calendar_size": 90,
                "calendar_fit": True,
                "movie_details": "compact",
            },
            "journal",
        )
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        await self.repository.async_seed_ui_preferences({})
        self.assertEqual(
            (await self.repository.async_ui_preferences("a", area="journal"))["values"],
            {
                "view": "calendar",
                "calendar_size": 90,
                "calendar_fit": True,
                "movie_details": "compact",
            },
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("b", area="journal"))["values"],
            {
                "view": "list",
                "calendar_size": 180,
                "calendar_fit": False,
                "movie_details": "full",
            },
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("a", area="search"))["values"],
            {"fuzzy_search": True},
        )
        for values in (
            {"view": "covers"},
            {"fuzzy_search": False},
            {"calendar_size": True},
            {"calendar_size": 59},
            {"calendar_size": 321},
            {"calendar_size": 90.5},
            {"calendar_fit": "true"},
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_ui_preferences_update(
                    "a", False, str(uuid4()), 0, values, "journal"
                )


class JournalCalendarApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call
    create = backend.BackendTest.create

    async def test_safe_role_projections_and_disabled_library_placeholders(
        self,
    ):
        viewing = (await self.create())["result"]["viewing"]
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        for user in (reader, self.admin):
            result = await self.call(
                "journal/calendar", user=user, **self.scope, start=START, end=END
            )
            self.assertEqual(
                set(result["result"]["items"][0]),
                PUBLIC_FIELDS | {"library_title_id", "artwork_key", "completed_at"},
            )
            result = await self.call(
                "journal/calendar/get",
                user=user,
                **self.scope,
                viewing_id=viewing["id"],
            )
            self.assertEqual(
                set(result["result"]["viewing"]), PUBLIC_FIELDS | {"completed_at"}
            )
            self.assertEqual(set(result["result"]["movie"]), set(MOVIE_FIELDS))
        object.__setattr__(
            self.entry, "data", {**self.entry.data, "library_enabled": False}
        )
        result = await self.call(
            "journal/calendar/get", user=reader, **self.scope, viewing_id=viewing["id"]
        )
        self.assertIsNone(result["result"]["movie"])
        result = await self.call(
            "journal/calendar", user=reader, **self.scope, start=START, end=END
        )
        self.assertEqual(len(result["result"]["items"]), 1)
        self.assertIsNone(result["result"]["items"][0]["artwork_key"])
        reader.is_active = False
        self.assertEqual(
            (
                await self.call(
                    "journal/calendar", user=reader, **self.scope, start=START, end=END
                )
            )["code"],
            "unauthorized",
        )

    async def test_access_and_source_are_rechecked_after_worker_await(self):
        viewing = (await self.create())["result"]["viewing"]
        repo = self.entry.runtime_data.repository
        original = repo.async_calendar_details
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)

        async def revoked(*args):
            result = await original(*args)
            reader.is_active = False
            return result

        with patch.object(repo, "async_calendar_details", revoked):
            self.assertEqual(
                (
                    await self.call(
                        "journal/calendar/get",
                        user=reader,
                        **self.scope,
                        viewing_id=viewing["id"],
                    )
                )["code"],
                "unauthorized",
            )

        async def disabled(*args):
            result = await original(*args)
            object.__setattr__(
                self.entry, "data", {**self.entry.data, "library_enabled": False}
            )
            return result

        with patch.object(repo, "async_calendar_details", disabled):
            self.assertEqual(
                (
                    await self.call(
                        "journal/calendar/get", **self.scope, viewing_id=viewing["id"]
                    )
                )["code"],
                "library_disabled",
            )

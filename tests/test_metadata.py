"""Fictional playback identity bridges, durable snapshots and reviewed repair."""

import json
import unittest
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_repository as repository
from test_tracking import observation

from custom_components.kaleidescape_companion.calendar.publisher import event_data
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.playback.tracker import PlaybackTracker

HANDLE = "0-S_A123BC45"
RAW = "26-0.0-S_A123BC45"
ROWS = [
    {
        **library.ROWS[0],
        "source_handle": HANDLE,
        "duration_seconds": 7200,
        "actors": ["Fictional Actor"],
        "synopsis": "A fictional voyage.",
    },
    {
        **library.ROWS[2],
        "source_handle": "0-S_B123BC45",
        "duration_seconds": 6600,
        "year": None,
        "directors": [],
    },
    {
        **library.ROWS[0],
        "source_handle": "0-S_C123BC45",
        "source_group": "remake",
        "year": 2026,
        "directors": ["Remake Director"],
    },
]


class MetadataTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

    async def seed(self, rows=ROWS):
        await self.repository.async_library_catalog(
            library.ORIGIN, rows, {"Favorites": [HANDLE], "Played": [HANDLE]}
        )

    async def observed(self, raw=RAW, *, close=True):
        tracker = PlaybackTracker(str(uuid4()))
        result = None
        steps = [
            (0, {}),
            (0.5, {}),
            (40, {"location": "credits"}),
        ]
        if close:
            steps.extend([(50, {"location": "none"}), (52, {"location": "none"})])
        for time, values in steps:
            for checkpoint in tracker.apply(
                observation(time, content_id=raw, **values)
            ):
                result = await self.repository.async_save_session(checkpoint, 30, 24)
        return result, tracker

    async def row(self, id):
        return next(
            r
            for r in (await self.repository.async_inspect("viewings"))["items"]
            if r["id"] == id
        )

    async def repair(
        self, preview=None, *, request=None, actor="admin", source=library.SOURCE
    ):
        preview = preview or await self.repository.async_metadata_preview(source)
        return await self.repository.async_metadata_repair(
            source, request or str(uuid4()), actor, preview["token"]
        )

    async def test_observed_snapshots_do_not_depend_on_calendar_and_keep_exact_edition(
        self,
    ):
        await self.seed()
        await self.repository.async_recording_library(library.SOURCE)
        id, _ = await self.observed("26-0.0-S_B123BC45")
        row = await self.row(id)
        metadata = json.loads(row["library_metadata"])
        self.assertEqual(row["status"], "completed")
        self.assertEqual(row["raw_content_id"], "26-0.0-S_B123BC45")
        self.assertEqual(
            row["library_title_id"], library.title_id(library.SOURCE, "0-S_B123BC45")
        )
        self.assertEqual(metadata["year"], 2025)
        self.assertEqual(metadata["directors"], ["A. Director"])
        self.assertEqual(metadata["duration_seconds"], 6600)
        self.assertEqual(metadata["edition"], "HD")
        self.assertEqual(metadata["actors"], ["Fictional Actor"])
        self.assertEqual(
            (await self.repository.async_inspect("calendar_publications"))["items"], []
        )
        public = await self.repository.async_get(id)
        self.assertNotIn("library_metadata", public)
        self.assertNotIn("library_title_id", public)

    async def test_late_library_details_are_saved_before_calendar_claim(self):
        await self.repository.async_recording_library(library.SOURCE)
        tracker = PlaybackTracker("next-player")
        tracker.apply(observation(0, content_id=RAW))
        checkpoint = tracker.apply(observation(0.5, content_id=RAW))[-1]
        id = await self.repository.async_save_session(checkpoint, 30, 24)
        self.assertEqual(json.loads((await self.row(id))["library_metadata"]), {})
        await self.seed()
        await self.repository.async_calendar_configure(
            {"target": "calendar.fiction", "fingerprint": "f", "source": library.SOURCE}
        )
        # A fresh completion must persist the snapshot before enqueueing.
        checkpoint = tracker.apply(observation(40, content_id=RAW, location="credits"))[
            -1
        ]
        await self.repository.async_save_session(checkpoint, 30, 24)
        row = await self.row(id)
        self.assertEqual(
            json.loads(row["library_metadata"])["actors"], ["Fictional Actor"]
        )
        claimed = await self.repository.async_calendar_claim()
        data = event_data(
            claimed,
            "{title} {year}",
            "{cast} | {director} | {genre} | {rating}",
        )
        self.assertIn("2025", data["summary"])
        self.assertIn(
            "Fictional Actor | A. Director | Adventure | PG", data["description"]
        )

    async def test_repair_preserves_history_and_receipts_and_is_actor_bound(self):
        await self.seed()
        id, _ = await self.observed()
        before = await self.row(id)
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        self.assertEqual(preview["updated_count"], 1)
        request = str(uuid4())
        result = await self.repair(preview, request=request)
        self.assertEqual(result["updated_count"], 1)
        after = await self.row(id)
        for key in before.keys() - {
            "library_title_id",
            "library_metadata",
            "revision",
            "updated_at",
        }:
            self.assertEqual(before[key], after[key], key)
        self.assertEqual(after["revision"], before["revision"] + 1)
        self.assertEqual(
            json.loads(after["library_metadata"])["collection"],
            ["Favorites", "Watched"],
        )
        await self.repository.async_pause()
        self.assertEqual(await self.repair(preview, request=request), result)
        with self.assert_error("conflict"):
            await self.repair(preview, request=request, actor="other-admin")
        await self.repository.async_resume()
        self.assertEqual(
            (await self.repository.async_metadata_preview(library.SOURCE))[
                "updated_count"
            ],
            0,
        )
        audit = (await self.repository.async_inspect("database_audit"))["items"]
        self.assertEqual(audit[0]["operation"], "repair_library_metadata")
        self.assertNotIn("Fictional Actor", json.dumps(audit))
        self.assertEqual(
            (await self.repository.async_inspect("calendar_publications"))["items"], []
        )

    async def test_unknown_ambiguous_cross_source_active_and_deleted_are_not_repaired(
        self,
    ):
        await self.seed(
            [*ROWS, {**ROWS[0], "source_handle": RAW, "source_group": "collision"}]
        )
        id, _ = await self.observed()  # Both spellings exist: reject ambiguity.
        unknown, _ = await self.observed("unknown-version")
        active, _ = await self.observed(HANDLE, close=False)
        deleted, _ = await self.observed(HANDLE)
        await self.repository.async_delete(
            str(uuid4()), deleted, (await self.row(deleted))["revision"]
        )
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        self.assertEqual(preview["updated_count"], 0)
        self.assertEqual(preview["unmatched_count"], 2)
        self.assertEqual(preview["active_count"], 1)
        other = await self.repository.async_metadata_preview("another-source")
        self.assertEqual(other["updated_count"], 0)
        for key in (id, unknown, active):
            self.assertEqual((await self.row(key))["library_metadata"], "{}")

    async def test_changed_review_backup_limits_and_rollback(self):
        await self.seed()
        id, _ = await self.observed()
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        await self.repository.async_update(
            str(uuid4()),
            id,
            (await self.row(id))["revision"],
            {"notes": "A correction"},
        )
        with self.assert_error("conflict"):
            await self.repair(preview)
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.repair(preview)
        await self.repository.async_resume()
        with (
            patch(
                "custom_components.kaleidescape_companion.playback.repair.MAX_VIEWINGS",
                0,
            ),
            self.assert_error("repair_limit"),
        ):
            await self.repair(preview)
        self.assertEqual((await self.row(id))["library_metadata"], "{}")
        await self.repair(preview)

    async def test_fill_only_retains_manual_snapshots_and_augments_missing_fields(self):
        await self.seed()
        manual = (
            await self.repository.async_create_from_library(
                str(uuid4()),
                library.SOURCE,
                {
                    "library_title_id": library.title_id(library.SOURCE, HANDLE),
                    "started_at": "2026-10-29T10:00:00Z",
                },
                actor_id="admin",
            )
        )["viewing"]
        before = await self.row(manual["id"])
        await self.seed([{**ROWS[0], "actors": ["Changed cast"], "year": 2026}])
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        self.assertEqual(preview["updated_count"], 0)
        await self.repair(preview)
        self.assertEqual(before, await self.row(manual["id"]))
        await self.repository.async_library_details(
            library.SOURCE, before["library_title_id"], {"writers": ["New Writer"]}
        )
        await self.repair()
        metadata = json.loads((await self.row(manual["id"]))["library_metadata"])
        self.assertEqual(metadata["actors"], ["Fictional Actor"])
        self.assertEqual(metadata["writers"], ["New Writer"])

    async def test_partial_repair_failure_rolls_back_all_rows_and_receipts(self):
        from custom_components.kaleidescape_companion.playback import repair

        await self.seed()
        first, _ = await self.observed()
        second, _ = await self.observed()
        preview = await self.repository.async_metadata_preview(library.SOURCE)
        original = repair.candidates
        calls = 0

        def interrupted(*args):
            nonlocal calls
            calls += 1
            for candidate in original(*args):
                yield candidate
                if calls == 2:
                    raise JournalError("repair_limit", "Fictional deadline")

        with (
            patch.object(repair, "candidates", interrupted),
            self.assert_error("repair_limit"),
        ):
            await self.repair(preview)
        for id in (first, second):
            self.assertEqual((await self.row(id))["library_metadata"], "{}")
        self.assertEqual(
            (await self.repository.async_inspect("database_audit"))["items"], []
        )


class MetadataAPITest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call
    create = backend.BackendTest.create

    async def test_repair_requires_admin_dataset_library_and_confirmation(self):
        from types import SimpleNamespace

        user = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        result = await self.call("journal/metadata/preview", **self.scope, user=user)
        self.assertEqual(result["code"], "unauthorized")
        result = await self.call(
            "journal/metadata/repair",
            **self.scope,
            user=user,
            request_id=str(uuid4()),
            token="a" * 64,
            confirmation="REPAIR METADATA",
        )
        self.assertEqual(result["code"], "unauthorized")
        self.assertEqual(
            (await self.call("journal/metadata/preview", **self.scope))["code"],
            "library_disabled",
        )
        await self.create()
        preview = await self.call("journal/metadata/preview", **self.scope)
        self.assertTrue(preview["success"])
        for confirmation, code in [("", "invalid_request"), ("REPAIR METADATA", None)]:
            result = await self.call(
                "journal/metadata/repair",
                **self.scope,
                request_id=str(uuid4()),
                token=preview["result"]["token"],
                confirmation=confirmation,
            )
            self.assertEqual(result.get("code"), code)
        result = await self.call(
            "journal/metadata/preview", **{**self.scope, "dataset_id": str(uuid4())}
        )
        self.assertEqual(result["code"], "not_found")

    async def test_authority_and_library_opt_out_are_rechecked_after_preview(self):
        await self.create()
        repo = self.entry.runtime_data.repository
        original = repo.async_metadata_preview

        async def demoted(source):
            result = await original(source)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_metadata_preview", demoted):
            result = await self.call("journal/metadata/preview", **self.scope)
        self.assertEqual(result["code"], "unauthorized")
        self.admin.is_admin = True

        async def disabled(source):
            result = await original(source)
            object.__setattr__(
                self.entry, "data", {**self.entry.data, "library_enabled": False}
            )
            return result

        with patch.object(repo, "async_metadata_preview", disabled):
            result = await self.call("journal/metadata/preview", **self.scope)
        self.assertEqual(result["code"], "library_disabled")

    async def test_native_setup_configures_recording_metadata_without_calendar(self):
        from custom_components.kaleidescape_companion import (
            async_setup_entry,
            async_unload_entry,
        )

        await self.create()
        await async_unload_entry(self.hass, self.entry)
        with patch(
            "custom_components.kaleidescape_companion.library.sync.LibrarySync.async_start"
        ):
            await async_setup_entry(self.hass, self.entry)
        repo = self.entry.runtime_data.repository
        self.addAsyncCleanup(repo.async_close)
        tracker = PlaybackTracker("fictional-player")
        tracker.apply(observation(0, content_id="fictional"))
        checkpoint = tracker.apply(observation(0.5, content_id="fictional"))[-1]
        id = await repo.async_save_session(checkpoint, 30, 24)
        row = next(
            row
            for row in (await repo.async_inspect("viewings"))["items"]
            if row["id"] == id
        )
        self.assertTrue(json.loads(row["library_metadata"])["title"])
        self.assertEqual(
            (await repo.async_inspect("calendar_publications"))["items"], []
        )

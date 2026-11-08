"""Fictional queue, status moves, no-replay and interrupted-work coverage."""

import asyncio
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import test_library as library
from _expected_logs import expected_log
from _schema_fixtures import remove_collection_queue_schema

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.collections import (
    member_hash,
    parameters,
)
from custom_components.kaleidescape_companion.library.config import DEFAULTS
from custom_components.kaleidescape_companion.library.store import title_id
from custom_components.kaleidescape_companion.library.sync import LibrarySync
from custom_components.kaleidescape_companion.vendor.kaleidescape.local_browser import (
    BrowserOutcomeUnknownError,
)


class CollectionQueueTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def test_schema_27_preserves_uncertain_collection_receipt(self):
        await self.seed()
        request = str(uuid4())
        _, fingerprint = parameters(
            request, library.SOURCE, self.title, "Favorites", 1, "admin"
        )
        await self.repository.async_collection_begin(
            library.SOURCE,
            request,
            fingerprint,
            self.title,
            "Favorites",
            1,
            member_hash(["fixture-a"]),
            "admin",
        )
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db, db:
            remove_collection_queue_schema(db)
            db.execute("PRAGMA user_version=27")
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual((await self.repository.async_info())["schema_version"], 28)
        intent = await self.repository.async_collection_intent(library.SOURCE, request)
        self.assertEqual(intent["status"], "uncertain")
        self.assertEqual(intent["operation"], "add")
        self.assertIsNone(intent["other_collection"])

    async def seed(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            library.ROWS,
            {
                "Played": ["fixture-a"],
                "New": ["fixture-b"],
                "Paused": [],
                "Favorites": [],
                "WatchSoon": [],
            },
        )
        self.title = title_id(library.SOURCE, "fixture-a")
        self.members = {
            "Played": [library.ROWS[0]],
            "New": [library.ROWS[1]],
            "Paused": [],
            "Favorites": [],
            "WatchSoon": [],
        }

        async def executor(function, *args):
            return function(*args)

        hass = SimpleNamespace(
            async_add_executor_job=executor,
            async_create_background_task=lambda task, name: asyncio.create_task(task),
        )
        self.sync = LibrarySync(
            hass,
            self.repository,
            {
                **DEFAULTS,
                "library_host": library.ORIGIN,
                "library_allow_collection_add": True,
            },
        )
        self.sync._resolve = AsyncMock(return_value="192.168.50.10")
        self.sync._collection_members = AsyncMock(
            side_effect=lambda name: list(self.members[name])
        )

        async def remove(handle, collection):
            found = next(
                row
                for row in self.members[collection]
                if row["source_handle"] == handle
            )
            self.members[collection].remove(found)
            if collection in {"New", "Played"}:
                self.members["New" if collection == "Played" else "Played"].append(
                    found
                )

        self.sync.browser = SimpleNamespace(
            movies=AsyncMock(return_value=(library.ROWS, list(self.members))),
            remove_from_collection=AsyncMock(side_effect=remove),
            add_to_collection=AsyncMock(),
            add_targets=AsyncMock(
                return_value={"Favorites": "Often", "Watch Soon": "Soon"}
            ),
        )

    def job(self, collection="Played", operation="remove", request=None):
        return {
            "request": request or str(uuid4()),
            "title": self.title,
            "collection": collection,
            "operation": operation,
            "revision": 1,
            "actor": "fictional-admin",
            "excluded": [],
            "authorize": lambda: None,
        }

    async def enqueue(self, job):
        return await self.repository.async_collection_queue(
            "enqueue",
            library.SOURCE,
            job["request"],
            job["title"],
            job["collection"],
            job["operation"],
            job["revision"],
            job["actor"],
            [],
        )

    async def test_move_checks_both_collections_and_never_reposts(self):
        await self.seed()
        job = self.job()
        await self.enqueue(job)
        result = await self.sync._queued_collection_change(job)
        self.assertEqual(result["status"], "confirmed")
        self.sync.browser.remove_from_collection.assert_awaited_once_with(
            "fixture-a", "Played"
        )
        self.assertTrue(
            await self.repository.async_collection_queue(
                "verified", library.SOURCE, job["request"]
            )
        )
        with self.assert_error("conflict"):
            await self.sync._queued_collection_change(job)
        self.sync.browser.remove_from_collection.assert_awaited_once()

    async def test_accepted_queue_runs_in_background_and_waits_for_rescan(self):
        await self.seed()
        scan_started, scan_release = asyncio.Event(), asyncio.Event()

        def start_scan():
            async def scan():
                scan_started.set()
                await scan_release.wait()

            self.sync.task = asyncio.create_task(scan())

        self.sync.request_sync = start_scan
        job = self.job()
        result = await self.sync.async_enqueue_collection(**job)
        self.assertEqual(result["status"], "queued")
        await asyncio.wait_for(scan_started.wait(), 2)
        self.assertEqual(
            (await self.repository.async_collection_queue("status", library.SOURCE))[0][
                "status"
            ],
            "syncing",
        )
        scan_release.set()
        await self.sync.collection_queue_task
        self.assertEqual(
            (await self.repository.async_collection_queue("status", library.SOURCE))[0][
                "status"
            ],
            "confirmed",
        )
        self.sync.browser.remove_from_collection.assert_awaited_once()

    async def test_cancelled_caller_does_not_cancel_accepted_queue_work(self):
        await self.seed()
        started, release = asyncio.Event(), asyncio.Event()
        original = self.repository.async_collection_queue

        async def delayed(operation, *args):
            if operation == "enqueue":
                started.set()
                await release.wait()
            return await original(operation, *args)

        self.repository.async_collection_queue = delayed
        self.sync.paused = False
        job = self.job()
        caller = asyncio.create_task(self.sync.async_enqueue_collection(**job))
        await started.wait()
        caller.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await caller
        self.sync.paused = True
        release.set()
        await asyncio.gather(*tuple(self.sync.collection_accepts))
        rows = await original("status", library.SOURCE)
        self.assertEqual(rows[0]["status"], "interrupted")
        self.sync.browser.remove_from_collection.assert_not_awaited()

    async def test_multiple_actions_queue_while_first_is_slow(self):
        await self.seed()
        started, release = asyncio.Event(), asyncio.Event()
        original_remove = self.sync.browser.remove_from_collection.side_effect

        async def slow_remove(handle, collection):
            started.set()
            await release.wait()
            await original_remove(handle, collection)

        async def add(handle, collection):
            self.members[collection].append(
                next(row for row in library.ROWS if row["source_handle"] == handle)
            )

        def scan():
            self.sync.task = asyncio.create_task(asyncio.sleep(0))

        self.sync.browser.remove_from_collection.side_effect = slow_remove
        self.sync.browser.add_to_collection.side_effect = add
        self.sync.request_sync = scan
        first, second = self.job(), self.job("Favorites", "add")
        await self.sync.async_enqueue_collection(**first)
        await asyncio.wait_for(started.wait(), 2)
        await self.sync.async_enqueue_collection(**second)
        states = await self.repository.async_collection_queue("status", library.SOURCE)
        self.assertEqual({row["status"] for row in states}, {"working", "queued"})
        release.set()
        await self.sync.collection_queue_task
        states = await self.repository.async_collection_queue("status", library.SOURCE)
        self.assertEqual({row["status"] for row in states}, {"confirmed"})
        self.sync.browser.remove_from_collection.assert_awaited_once()
        self.sync.browser.add_to_collection.assert_awaited_once()

    async def test_queue_is_bounded_durable_actor_bound_and_paused_add_rejected(self):
        await self.seed()
        with self.assert_error("invalid_request"):
            await self.enqueue(self.job("Paused", "add"))
        job = self.job("Favorites", "add")
        self.assertEqual((await self.enqueue(job))["status"], "queued")
        self.assertEqual((await self.enqueue(job))["status"], "queued")
        with self.assert_error("conflict"):
            await self.enqueue({**job, "actor": "other-admin"})
        await self.repository.async_collection_queue("recover", library.SOURCE)
        statuses = await self.repository.async_collection_queue(
            "status", library.SOURCE
        )
        self.assertEqual(statuses[0]["status"], "interrupted")
        self.sync.browser.add_to_collection.assert_not_awaited()

    async def test_revoked_access_before_send_is_safe(self):
        await self.seed()
        job = self.job()
        await self.enqueue(job)

        def denied():
            raise JournalError("unauthorized", "Access changed")

        job["authorize"] = denied
        with self.assert_error("unauthorized"):
            await self.sync._queued_collection_change(job)
        self.sync.browser.remove_from_collection.assert_not_awaited()

    async def test_queue_limit_and_conflicting_status_changes(self):
        await self.seed()
        job = self.job("New", "add")
        await self.enqueue(job)
        with self.assert_error("busy"):
            await self.enqueue(self.job("Played", "remove"))
        for index in range(9):
            await self.repository._call(
                lambda: (
                    self.repository._db()
                    .execute(
                        "INSERT INTO collection_jobs "
                        "VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)",
                        (
                            str(uuid4()),
                            "token",
                            library.SOURCE,
                            title_id(library.SOURCE, f"queue-{index}"),
                            "Favorites",
                            "add",
                            "admin",
                            1,
                            "queued",
                            "2026",
                            "2026",
                        ),
                    )
                    .connection.commit()
                )
            )
        # A fresh title is not required to prove admission rejects the full queue.
        with self.assert_error("busy"):
            await self.enqueue(self.job("Favorites", "add"))

    @expected_log(
        "custom_components.kaleidescape_companion.library.sync",
        "Collection readback did not match:",
    )
    async def test_unexpected_other_membership_keeps_move_uncertain(self):
        await self.seed()
        job = self.job()
        await self.enqueue(job)
        original = self.sync.browser.remove_from_collection.side_effect

        async def wider(handle, collection):
            await original(handle, collection)
            self.members["New"].append(library.ROWS[2])

        self.sync.browser.remove_from_collection.side_effect = wider
        result = await self.sync._queued_collection_change(job)
        self.assertEqual(result["status"], "uncertain")
        self.sync.browser.remove_from_collection.assert_awaited_once()
        self.assertEqual(
            (await self.sync.async_collection_check(job["request"], lambda: None))[
                "status"
            ],
            "uncertain",
        )
        self.sync.browser.remove_from_collection.assert_awaited_once()

    async def test_preflight_timeout_does_not_leave_an_uncertain_barrier(self):
        await self.seed()
        self.sync.browser.add_to_collection.side_effect = TimeoutError(
            "private title and address"
        )
        job = self.job("WatchSoon", "add")
        with self.assertLogs(
            "custom_components.kaleidescape_companion.library.sync", level="DEBUG"
        ) as logs:
            await self.sync.async_enqueue_collection(**job)
            await self.sync.collection_queue_task
        status = (
            await self.repository.async_collection_queue("status", library.SOURCE)
        )[0]
        self.assertEqual(status["status"], "failed")
        self.assertEqual(status["error"], "library_timeout")
        intent = await self.repository.async_collection_intent(
            library.SOURCE, job["request"]
        )
        self.assertEqual(intent["status"], "abandoned")
        self.assertEqual(
            (await self.repository.async_collection_snapshot(library.SOURCE))[
                "pending"
            ],
            [],
        )
        messages = "\n".join(logs.output)
        self.assertIn("stage=submit", messages)
        self.assertIn("outcome=not_sent", messages)
        self.assertIn("TimeoutError", messages)
        self.assertNotIn("private title and address", messages)
        self.assertNotIn(job["request"], messages)

    async def test_unknown_post_is_not_replayed_and_logs_readback_mismatch(self):
        await self.seed()
        self.sync.browser.add_to_collection.side_effect = BrowserOutcomeUnknownError(
            "private response"
        )
        job = self.job("WatchSoon", "add")
        with self.assertLogs(
            "custom_components.kaleidescape_companion.library.sync", level="WARNING"
        ) as logs:
            await self.sync.async_enqueue_collection(**job)
            await self.sync.collection_queue_task
        status = (
            await self.repository.async_collection_queue("status", library.SOURCE)
        )[0]
        self.assertEqual(status["status"], "uncertain")
        self.assertEqual(self.sync.browser.add_to_collection.await_count, 1)
        self.assertIn("selected_matches=False", "\n".join(logs.output))
        self.assertNotIn("private response", "\n".join(logs.output))
        self.assertEqual(
            (await self.sync.async_collection_check(job["request"], lambda: None))[
                "status"
            ],
            "uncertain",
        )
        self.assertEqual(self.sync.browser.add_to_collection.await_count, 1)

    async def test_cancelled_send_remains_uncertain_without_readback_or_replay(self):
        await self.seed()
        job = self.job("WatchSoon", "add")
        await self.enqueue(job)
        started = asyncio.Event()

        async def send(*args):
            started.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError as error:
                raise BrowserOutcomeUnknownError("unknown") from error

        self.sync.browser.add_to_collection.side_effect = send
        task = asyncio.create_task(self.sync._queued_collection_change(job))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        intent = await self.repository.async_collection_intent(
            library.SOURCE, job["request"]
        )
        self.assertEqual(intent["status"], "uncertain")
        self.assertEqual(self.sync._collection_members.await_count, 1)
        self.assertEqual(self.sync.browser.add_to_collection.await_count, 1)

    async def test_refresh_updates_only_selected_version_and_uses_live_details(self):
        await self.seed()
        self.sync.browser.version_collections = AsyncMock(
            return_value=(library.ROWS[0]["title"], ["Played", "Watch Soon"])
        )
        result = await self.sync.async_refresh_title_collections(
            self.title, 1, [], lambda: None
        )
        self.assertEqual(
            result, {"collections": ["Played", "WatchSoon"], "revision": 2}
        )
        self.sync.browser.version_collections.assert_awaited_once_with("fixture-a")
        other = await self.repository.async_library_versions(
            library.SOURCE, title_id(library.SOURCE, "fixture-b")
        )
        self.assertEqual(other["items"][0]["collections"], ["New"])
        self.sync.browser.add_to_collection.assert_not_awaited()
        self.sync.browser.remove_from_collection.assert_not_awaited()

    async def test_refresh_rejects_unrecognized_identity_and_names_without_writing(
        self,
    ):
        await self.seed()
        self.sync.browser.version_collections = AsyncMock(
            return_value=("Different title", ["Watch Soon"])
        )
        with self.assert_error("library_changed"):
            await self.sync.async_refresh_title_collections(
                self.title, 1, [], lambda: None
            )
        self.sync.browser.version_collections.return_value = (
            library.ROWS[0]["title"],
            ["Unknown collection"],
        )
        with self.assert_error("library_changed"):
            await self.sync.async_refresh_title_collections(
                self.title, 1, [], lambda: None
            )
        state = await self.repository.async_collection_snapshot(
            library.SOURCE, self.title
        )
        self.assertEqual(state["revision"], 1)

    async def test_dismiss_removes_only_terminal_job(self):
        await self.seed()
        job = self.job("Favorites", "add")
        await self.enqueue(job)
        with self.assert_error("busy"):
            await self.repository.async_collection_queue(
                "dismiss", library.SOURCE, job["request"]
            )
        await self.repository.async_collection_queue(
            "update", library.SOURCE, job["request"], "failed", "not_sent"
        )
        await self.repository.async_collection_queue(
            "dismiss", library.SOURCE, job["request"]
        )
        self.assertEqual(
            await self.repository.async_collection_queue("status", library.SOURCE), []
        )

    async def test_refresh_rechecks_authorization_and_revision_before_cache_write(self):
        await self.seed()
        permitted = True

        def authorize():
            if not permitted:
                raise JournalError("unauthorized", "Access changed")

        async def revoke(_handle):
            nonlocal permitted
            permitted = False
            return library.ROWS[0]["title"], ["Played", "Watch Soon"]

        self.sync.browser.version_collections = AsyncMock(side_effect=revoke)
        with self.assert_error("unauthorized"):
            await self.sync.async_refresh_title_collections(
                self.title, 1, [], authorize
            )
        self.assertEqual(
            (
                await self.repository.async_collection_snapshot(
                    library.SOURCE, self.title
                )
            )["revision"],
            1,
        )
        with self.assert_error("refresh_required"):
            await self.repository.async_collection_refresh_version(
                library.SOURCE, self.title, 0, ["Played"], []
            )

    async def test_dismiss_never_removes_a_job_with_an_uncertain_intent(self):
        await self.seed()
        job = self.job("Favorites", "add")
        await self.enqueue(job)
        _, fingerprint = parameters(
            job["request"], library.SOURCE, self.title, "Favorites", 1, job["actor"]
        )
        await self.repository.async_collection_begin(
            library.SOURCE,
            job["request"],
            fingerprint,
            self.title,
            "Favorites",
            1,
            member_hash(["fixture-a"]),
            job["actor"],
        )
        await self.repository.async_collection_queue(
            "update", library.SOURCE, job["request"], "interrupted", "not_sent"
        )
        with self.assert_error("collection_uncertain"):
            await self.repository.async_collection_queue(
                "dismiss", library.SOURCE, job["request"]
            )
        self.assertEqual(
            (
                await self.repository.async_collection_intent(
                    library.SOURCE, job["request"]
                )
            )["status"],
            "uncertain",
        )

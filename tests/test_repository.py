"""Exercise durable journal behavior using real temporary SQLite databases."""

import asyncio
import json
import shutil
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from custom_components.kaleidescape_companion import migrations
from custom_components.kaleidescape_companion.journal import JournalError
from custom_components.kaleidescape_companion.repository import JournalRepository


def request_id():
    """Generate an independent mutation identifier."""
    return str(uuid4())


def viewing(**overrides):
    """Return a fictional, minimal manual viewing."""
    return {
        "title": "Example Film",
        "started_at": "2026-10-23T10:00:00-05:00",
        **overrides,
    }


class RepositoryTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "journal.sqlite3"
        self.repository = JournalRepository(self.path)
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)

    def assert_error(self, code):
        """Check public error codes without depending on prose."""
        return ErrorContext(self, code)

    async def test_persistence_and_retry_survive_restart(self):
        request = request_id()
        original = await self.repository.async_create(
            request, viewing(raw_content_id="26-0.0-S_exact")
        )
        dataset = (await self.repository.async_info())["dataset_id"]
        await self.repository.async_close()
        reopened = JournalRepository(self.path)
        await reopened.async_open()
        self.addAsyncCleanup(reopened.async_close)
        self.assertEqual(
            original,
            await reopened.async_create(
                request, viewing(raw_content_id="26-0.0-S_exact")
            ),
        )
        record = await reopened.async_get(original["viewing"]["id"])
        self.assertEqual(record["started_at"], "2026-10-23T15:00:00.000000+00:00")
        self.assertEqual(record["raw_content_id"], "26-0.0-S_exact")
        info = await reopened.async_info()
        self.assertEqual(info["dataset_id"], dataset)
        self.assertEqual(info["viewing_count"], 1)
        self.assertEqual(info["revision"], 1)

    async def test_no_title_based_deduplication(self):
        await self.repository.async_create(request_id(), viewing())
        await self.repository.async_create(request_id(), viewing())
        self.assertEqual((await self.repository.async_info())["viewing_count"], 2)

    async def test_failed_transaction_does_not_commit_record_or_retry(self):
        with closing(sqlite3.connect(self.path)) as connection:
            connection.execute(
                "CREATE TRIGGER fail_request BEFORE INSERT ON requests "
                "BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END"
            )
        request = request_id()
        with self.assert_error("storage_error"):
            await self.repository.async_create(request, viewing())
        info = await self.repository.async_info()
        self.assertEqual(info["revision"], 0)
        self.assertEqual(info["viewing_count"], 0)
        with closing(sqlite3.connect(self.path)) as connection:
            connection.execute("DROP TRIGGER fail_request")
        await self.repository.async_create(request, viewing())
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_concurrent_retry_writes_once(self):
        request = request_id()
        results = await asyncio.gather(
            *(self.repository.async_create(request, viewing()) for _ in range(8))
        )
        self.assertTrue(all(item == results[0] for item in results))
        self.assertEqual((await self.repository.async_info())["revision"], 1)
        with self.assert_error("conflict"):
            await self.repository.async_create(request, viewing(title="Other title"))

    async def test_update_conflict_and_tombstone(self):
        created = await self.repository.async_create(request_id(), viewing())
        record_id = created["viewing"]["id"]
        request = request_id()
        corrected = await self.repository.async_update(
            request, record_id, 1, {"status": "completed", "watched_seconds": 600}
        )
        self.assertEqual(corrected["viewing"]["revision"], 2)
        self.assertEqual(
            corrected,
            await self.repository.async_update(
                request, record_id, 1, {"status": "completed", "watched_seconds": 600}
            ),
        )
        with self.assert_error("conflict"):
            await self.repository.async_update(
                request_id(), record_id, 1, {"title": "Stale"}
            )
        with self.assert_error("invalid_request"):
            await self.repository.async_update(
                request_id(), record_id, 2, {"ended_at": "2020-01-01T00:00:00Z"}
            )
        self.assertEqual((await self.repository.async_get(record_id))["revision"], 2)
        deletion_request = request_id()
        deleted = await self.repository.async_delete(deletion_request, record_id, 2)
        self.assertIsNotNone(deleted["viewing"]["deleted_at"])
        self.assertEqual(
            deleted, await self.repository.async_delete(deletion_request, record_id, 2)
        )
        with self.assert_error("not_found"):
            await self.repository.async_get(record_id)
        self.assertEqual((await self.repository.async_list())["items"], [])

    async def test_pagination_search_and_invalidation(self):
        for title in [
            "Example A",
            "EXAMPLE B",
            "A 100% film",
            "SQL '; DROP TABLE viewings;",
        ]:
            await self.repository.async_create(request_id(), viewing(title=title))
        first = await self.repository.async_list(limit=2)
        second = await self.repository.async_list(limit=2, cursor=first["next_cursor"])
        self.assertEqual(
            len({item["id"] for item in first["items"] + second["items"]}), 4
        )
        self.assertIsNone(second["next_cursor"])
        self.assertEqual(
            len((await self.repository.async_list(query="example"))["items"]), 2
        )
        self.assertEqual(len((await self.repository.async_list(query="%"))["items"]), 1)
        self.assertEqual(
            len((await self.repository.async_list(query="'; DROP"))["items"]), 1
        )
        with self.assert_error("refresh_required"):
            await self.repository.async_list(
                query="different", cursor=first["next_cursor"]
            )
        await self.repository.async_create(request_id(), viewing())
        with self.assert_error("refresh_required"):
            await self.repository.async_list(cursor=first["next_cursor"])
        with self.assert_error("invalid_request"):
            await self.repository.async_list(cursor="invalid!")

    async def test_invalid_records_do_not_write(self):
        cases = [
            {"title": " "},
            {"started_at": "2026-10-23T10:00:00"},
            {"watched_seconds": -1},
            {"watched_seconds": float("nan")},
            {"watched_seconds": float("inf")},
            {"watched_seconds": True},
            {"watched_seconds": 10**1000},
            {"unknown": "data"},
            {"status": "playing"},
            {"ended_at": "2000-01-01T00:00:00Z"},
        ]
        for data in cases:
            with self.subTest(data=data), self.assert_error("invalid_request"):
                await self.repository.async_create(request_id(), viewing(**data))
        self.assertEqual((await self.repository.async_info())["revision"], 0)
        with self.assert_error("invalid_request"):
            await self.repository.async_create("not-a-uuid", viewing())
        for limit in (0, 101, True):
            with self.assert_error("invalid_request"):
                await self.repository.async_list(limit=limit)

    async def test_backup_barrier_and_resume(self):
        request = request_id()
        created = await self.repository.async_create(request, viewing())
        await self.repository.async_pause()
        self.assertTrue((await self.repository.async_info())["backup_in_progress"])
        self.assertEqual(
            created, await self.repository.async_create(request, viewing())
        )
        with self.assert_error("backup_in_progress"):
            await self.repository.async_create(request_id(), viewing())
        # The live file is consistent once accepted writes have drained.
        copy = self.path.with_name("ha-backup.sqlite3")
        shutil.copyfile(self.path, copy)
        restored = JournalRepository(copy)
        await restored.async_open()
        self.addAsyncCleanup(restored.async_close)
        self.assertEqual((await restored.async_info())["viewing_count"], 1)
        await self.repository.async_resume()
        await self.repository.async_create(request_id(), viewing())
        self.assertEqual((await self.repository.async_info())["viewing_count"], 2)

    async def test_queue_overload_does_not_block_backup_release(self):
        with patch(
            "custom_components.kaleidescape_companion.repository.MAX_PENDING", 0
        ):
            with self.assert_error("busy"):
                await self.repository.async_list()
            await self.repository.async_pause()
            await self.repository.async_resume()
        self.assertFalse((await self.repository.async_info())["backup_in_progress"])

    async def test_exports_preserve_records_and_retry_history(self):
        request = request_id()
        created = await self.repository.async_create(
            request, viewing(notes="Private note")
        )
        await self.repository.async_delete(request_id(), created["viewing"]["id"], 1)
        json_path = await self.repository.async_export("json")
        self.addCleanup(json_path.unlink, missing_ok=True)
        exported = json.loads(json_path.read_text())
        self.assertEqual(exported["metadata"]["format_version"], 2)
        self.assertIsNotNone(exported["viewings"][0]["deleted_at"])
        snapshot = await self.repository.async_export("sqlite")
        self.addCleanup(snapshot.unlink, missing_ok=True)
        restored = JournalRepository(snapshot)
        await restored.async_open()
        self.addAsyncCleanup(restored.async_close)
        self.assertEqual(
            created, await restored.async_create(request, viewing(notes="Private note"))
        )
        self.assertEqual((await restored.async_info())["viewing_count"], 0)

    async def test_cancelled_write_finishes_before_close(self):
        entered = threading.Event()
        release = threading.Event()
        mutate = self.repository._mutate

        def slow_mutate(*args):
            entered.set()
            if not release.wait(5):
                raise TimeoutError("Test worker was not released")
            return mutate(*args)

        request = request_id()
        with patch.object(self.repository, "_mutate", slow_mutate):
            task = asyncio.create_task(self.repository.async_create(request, viewing()))
            self.assertTrue(await asyncio.to_thread(entered.wait, 5))
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            close = asyncio.create_task(self.repository.async_close())
            await asyncio.sleep(0)
            with self.assert_error("not_ready"):
                await self.repository.async_list()
            release.set()
            await close
        reopened = JournalRepository(self.path)
        await reopened.async_open()
        self.addAsyncCleanup(reopened.async_close)
        await reopened.async_create(request, viewing())
        self.assertEqual((await reopened.async_info())["viewing_count"], 1)

    async def test_newer_schema_is_left_untouched(self):
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as connection:
            connection.execute("PRAGMA user_version = 99")
        before = self.path.read_bytes()
        newer = JournalRepository(self.path)
        self.addAsyncCleanup(newer.async_close)
        with self.assertRaises(migrations.UnsupportedSchemaError):
            await newer.async_open()
        self.assertEqual(self.path.read_bytes(), before)


class ErrorContext:
    """Assert a stable error code as well as the exception type."""

    def __init__(self, test, code):
        self.test = test
        self.code = code
        self.context = test.assertRaises(JournalError)

    def __enter__(self):
        return self.context.__enter__()

    def __exit__(self, *args):
        result = self.context.__exit__(*args)
        self.test.assertEqual(self.context.exception.code, self.code)
        return result


class MigrationTest(unittest.TestCase):
    def test_upgrade_failure_rolls_back_and_keeps_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "journal.sqlite3"
            with closing(sqlite3.connect(path)) as connection:
                migrations.migrate(connection, path)
                original = connection.execute(
                    "SELECT dataset_id FROM schema_metadata"
                ).fetchone()[0]
                future = {
                    **migrations.MIGRATIONS,
                    migrations.SCHEMA_VERSION + 1: (
                        "CREATE TABLE future (id INTEGER)",
                        "INVALID SQL",
                    ),
                }
                with (
                    patch.object(
                        migrations, "SCHEMA_VERSION", migrations.SCHEMA_VERSION + 1
                    ),
                    patch.object(migrations, "MIGRATIONS", future),
                ):
                    with self.assertRaises(sqlite3.Error):
                        migrations.migrate(connection, path)
                self.assertEqual(
                    connection.execute("PRAGMA user_version").fetchone()[0],
                    migrations.SCHEMA_VERSION,
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT count(*) FROM sqlite_master WHERE name = 'future'"
                    ).fetchone()[0],
                    0,
                )
                snapshot = next(path.parent.glob("*.bak"))
                with closing(sqlite3.connect(snapshot)) as backup:
                    self.assertEqual(
                        backup.execute(
                            "SELECT dataset_id FROM schema_metadata"
                        ).fetchone()[0],
                        original,
                    )

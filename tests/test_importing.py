"""Import compatibility, atomicity, access control, and hostile-file regressions."""

import asyncio
import json
import sqlite3
import threading
import unittest
import warnings
from contextlib import closing
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend_tests
import test_repository as repository_tests
from aiohttp import web
from aiohttp.test_utils import make_mocked_request
from aiohttp.web_exceptions import NotAppKeyWarning
from homeassistant.components.http import KEY_HASS

from custom_components.kaleidescape_companion.http import JournalImportView
from custom_components.kaleidescape_companion.importing import parse_import


def record(**overrides):
    return {
        "id": str(uuid4()),
        "title": "A Fictional Import",
        "started_at": "2026-10-26T00:00:00.123456Z",
        "watched_seconds": 115.37234567,
        **overrides,
    }


def payload(*rows):
    return json.dumps(
        {"metadata": {"format_version": 1}, "viewings": list(rows)}
    ).encode()


class ImportStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp
    assert_error = repository_tests.RepositoryTest.assert_error

    async def load(
        self, data, format="json", request=None, revision=None, actor="fictional-admin"
    ):
        async with self.repository.async_import_slot():
            return await self.repository.async_import(
                data,
                format,
                request or str(uuid4()),
                (await self.repository.async_info())["revision"]
                if revision is None
                else revision,
                actor_id=actor,
            )

    async def test_merge_keeps_existing_ids_and_precision_and_retries_are_durable(self):
        row = record()
        data, request = payload(row), str(uuid4())
        result = await self.load(data, request=request, revision=0)
        self.assertEqual(
            result, {"imported_count": 1, "skipped_count": 0, "revision": 1}
        )
        self.assertEqual(await self.load(data, request=request, revision=0), result)
        stored = await self.repository.async_get(row["id"])
        self.assertEqual(stored["watched_seconds"], row["watched_seconds"])
        self.assertTrue(stored["started_at"].endswith("123456+00:00"))
        result = await self.load(payload({**row, "title": "Must not overwrite"}))
        self.assertEqual(result["skipped_count"], 1)
        self.assertEqual(
            (await self.repository.async_get(row["id"]))["title"], row["title"]
        )
        with self.assert_error("conflict"):
            await self.load(data, request=request, revision=0, actor="other-admin")
        audit = (await self.repository.async_inspect("import_audit"))["items"]
        self.assertEqual(len(audit), 2)
        self.assertNotIn(row["title"], json.dumps(audit))
        self.assertNotIn(row["id"], json.dumps(audit))

    async def test_actual_json_and_sqlite_exports_import_same_viewing_keys(self):
        created = await self.repository.async_create(
            str(uuid4()), repository_tests.viewing()
        )
        for format in ("json", "sqlite"):
            async with self.repository.async_export_snapshot(format) as path:
                data = path.read_bytes()
            records = parse_import(data, format)
            self.assertEqual(records[0]["id"], created["viewing"]["id"])
            self.assertEqual(records[0]["title"], created["viewing"]["title"])
            result = await self.load(data, format)
            self.assertEqual(result["skipped_count"], 1)

    async def test_prior_sqlite_schema_and_tombstones_are_snapshots_not_live_state(
        self,
    ):
        row = record(deleted_at="2026-10-26T01:00:00Z", origin="observed")
        with closing(sqlite3.connect(":memory:")) as source:
            source.execute(
                "CREATE TABLE viewings (id, title, started_at, deleted_at, origin)"
            )
            source.execute(
                "INSERT INTO viewings VALUES (?, ?, ?, ?, ?)",
                tuple(
                    row[key]
                    for key in ("id", "title", "started_at", "deleted_at", "origin")
                ),
            )
            source.execute("PRAGMA user_version = 1")
            data = source.serialize()
        result = await self.load(data, "sqlite")
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual((await self.repository.async_list())["items"], [])
        self.assertIsNotNone(
            (await self.repository.async_inspect("viewings"))["items"][0]["deleted_at"]
        )
        self.assertEqual((await self.repository.async_inspect("sessions"))["items"], [])

    async def test_all_validation_precedes_writes_and_bad_rows_are_not_silently_skipped(
        self,
    ):
        good = record()
        for data in (
            payload(good, record(watched_seconds=-1)),
            payload(good, {**good}),
            payload({**good, "id": "not-a-uuid"}),
            b'{"viewings":[],"viewings":[]}',
            b'{"viewings":[NaN]}',
            b"\xff",
        ):
            with self.assert_error("invalid_request"):
                await self.load(data)
        self.assertEqual((await self.repository.async_info())["revision"], 0)
        self.assertEqual((await self.repository.async_list())["items"], [])

    async def test_conflicts_backup_and_failed_audit_leave_no_partial_import(
        self,
    ):
        await self.load(payload(record()))
        with self.assert_error("conflict"):
            await self.load(payload(record()), revision=0)
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.load(payload(record()))
        await self.repository.async_resume()
        async with self.repository.async_export_snapshot("json"):
            with self.assert_error("busy"):
                await self.load(payload(record()))
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_import BEFORE INSERT ON import_audit "
                "BEGIN SELECT RAISE(ABORT, 'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.load(payload(record(), record()))
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)
        self.assertEqual((await self.repository.async_info())["revision"], 1)

    async def test_hostile_sqlite_and_incompatible_tables_are_denied(
        self,
    ):
        for sql in (
            "CREATE VIEW viewings AS SELECT 'x' AS id, "
            "load_extension('untrusted') AS title, 'now' AS started_at",
            "CREATE TABLE different (id, title)",
            "CREATE TABLE viewings (id, title)",
        ):
            with closing(sqlite3.connect(":memory:")) as source:
                source.execute(sql)
                data = source.serialize()
            with self.assert_error("invalid_request"):
                await self.load(data, "sqlite")
        with self.assert_error("invalid_request"):
            await self.load(b"CREATE TABLE viewings (id, title)", "sqlite")
        with patch(
            "custom_components.kaleidescape_companion.importing.MAX_IMPORT_ROWS", 1
        ):
            with self.assert_error("invalid_request"):
                await self.load(payload(record(), record()))

    async def test_cancelled_upload_keeps_slot_until_accepted_import_finishes(self):
        started, release = threading.Event(), threading.Event()
        original = self.repository._import
        data, request = payload(record()), str(uuid4())

        def held(*args):
            started.set()
            if not release.wait(2):
                raise AssertionError("Worker timed out")
            return original(*args)

        with patch.object(self.repository, "_import", side_effect=held):
            task = asyncio.create_task(self.load(data, request=request, revision=0))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                await asyncio.sleep(0)
                with self.assert_error("busy"):
                    await self.load(data)
            finally:
                release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        result = await self.load(data, request=request, revision=0)
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)


class ImportApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call

    def request(self, data, *, user="admin", request_id=None, revision=0, on_read=None):
        async def chunks(_size):
            yield data
            if on_read:
                on_read()

        class Body:
            iter_chunked = staticmethod(chunks)

        app = web.Application()
        app[KEY_HASS] = self.hass
        request = make_mocked_request(
            "POST",
            f"/import?format=json&request_id={request_id or uuid4()}"
            f"&revision={revision}",
            app=app,
            payload=Body(),
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", NotAppKeyWarning)
            request["hass_user"] = self.admin if user == "admin" else user
        return request

    async def post(self, request):
        return await JournalImportView().post(
            request, self.scope["entry_id"], self.scope["dataset_id"]
        )

    async def test_upload_is_authenticated_bounded_scoped_and_merges(self):
        data = payload(record())
        with self.assertRaises(web.HTTPForbidden):
            await self.post(self.request(data, user=None))
        self.entry.runtime_data.observer = object()
        self.assertEqual((await self.post(self.request(data))).status, 409)
        self.entry.runtime_data.observer = None
        with patch("custom_components.kaleidescape_companion.http.MAX_IMPORT_BYTES", 5):
            self.assertEqual((await self.post(self.request(data))).status, 413)
        result = await self.post(self.request(data))
        self.assertEqual(result.status, 200)
        self.assertEqual(json.loads(result.body)["imported_count"], 1)
        self.assertEqual(result.headers["Cache-Control"], "no-store")

    async def test_access_loss_during_upload_prevents_writes(self):
        def revoke():
            self.admin.is_admin = False

        with self.assertRaises(web.HTTPForbidden):
            await self.post(self.request(payload(record()), on_read=revoke))
        self.assertEqual(
            (await self.entry.runtime_data.repository.async_info())["viewing_count"], 0
        )

    async def test_completed_import_withholds_result_after_access_loss_and_retries_once(
        self,
    ):
        request_id, data = str(uuid4()), payload(record())
        repo = self.entry.runtime_data.repository
        original = repo.async_import

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_import", side_effect=revoke):
            with self.assertRaises(web.HTTPForbidden):
                await self.post(self.request(data, request_id=request_id))
        self.admin.is_admin = True
        result = await self.post(self.request(data, request_id=request_id))
        self.assertEqual(json.loads(result.body)["imported_count"], 1)
        self.assertEqual((await repo.async_info())["viewing_count"], 1)

    async def test_advanced_corrections_include_tombstones_and_keep_evidence_protected(
        self,
    ):
        repo = self.entry.runtime_data.repository
        created = await repo.async_create(str(uuid4()), repository_tests.viewing())
        row = created["viewing"]
        await repo.async_delete(str(uuid4()), row["id"], 1)
        result = await self.call(
            "database/update",
            **self.scope,
            request_id=str(uuid4()),
            viewing_id=row["id"],
            expected_revision=2,
            patch={"notes": "An explicit correction"},
        )
        self.assertTrue(result["success"])
        self.assertIsNotNone(result["result"]["viewing"]["deleted_at"])
        self.assertEqual((await repo.async_list())["items"], [])
        result = await self.call(
            "database/update",
            **self.scope,
            request_id=str(uuid4()),
            viewing_id=row["id"],
            expected_revision=3,
            patch={"deleted_at": None},
        )
        self.assertEqual(result["code"], "invalid_request")

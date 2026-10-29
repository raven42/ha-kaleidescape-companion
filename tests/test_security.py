"""Security boundary regressions with fictional data and private temporary files."""

import asyncio
import json
import os
import sqlite3
import stat
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import probatio
import test_backend as backend_tests
import test_repository as repository_tests
from aiohttp import web

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.diagnostics import (
    async_get_config_entry_diagnostics,
)
from custom_components.kaleidescape_companion.ui.http import JournalExportView

request_id = repository_tests.request_id
viewing = repository_tests.viewing


class PrivateStorageTest(unittest.IsolatedAsyncioTestCase):
    async def test_repairs_permissions_and_removes_only_owned_stale_exports(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "storage"
            root.mkdir(mode=0o755)
            root.chmod(0o755)
            path = root / "journal.sqlite3"
            path.touch(mode=0o666)
            path.chmod(0o666)
            backup = root / "journal.sqlite3.v1.fictional.bak"
            backup.write_text("private fictional backup")
            backup.chmod(0o644)
            exports = root / ".journal.sqlite3.exports"
            exports.mkdir(mode=0o755)
            exports.chmod(0o755)
            stale = exports / "kaleidescape-stale.json"
            stale.write_text("private fictional data")
            unrelated = exports / "keep.txt"
            unrelated.write_text("unrelated")
            repository = JournalRepository(path)
            try:
                await repository.async_open()
                self.assertEqual(stat.S_IMODE(root.stat().st_mode), 0o700)
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(exports.stat().st_mode), 0o700)
                self.assertFalse(stale.exists())
                self.assertTrue(unrelated.exists())
                async with repository.async_export_snapshot("sqlite") as snapshot:
                    self.assertEqual(snapshot.parent, exports)
                    self.assertEqual(stat.S_IMODE(snapshot.stat().st_mode), 0o600)
                self.assertFalse(snapshot.exists())
            finally:
                await repository.async_close()

    async def test_new_storage_is_private_under_permissive_creation_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "storage" / "journal.sqlite3"
            repository = JournalRepository(path)
            previous = os.umask(0)
            try:
                await repository.async_open()
                self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            finally:
                os.umask(previous)
                await repository.async_close()

    async def test_linked_managed_paths_fail_without_changing_the_target(self):
        for kind in (
            "directory",
            "database",
            "hardlink",
            "sidecar",
            "backup",
            "exports",
        ):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                outside = root / "outside"
                outside.mkdir(mode=0o755)
                outside.chmod(0o755)
                target = outside / "keep"
                target.write_text("do not modify")
                target.chmod(0o644)
                storage = root / "storage"
                if kind == "directory":
                    storage.symlink_to(outside, target_is_directory=True)
                else:
                    storage.mkdir()
                    if kind == "exports":
                        (storage / ".journal.sqlite3.exports").symlink_to(
                            outside, target_is_directory=True
                        )
                    else:
                        name = {
                            "database": "journal.sqlite3",
                            "hardlink": "journal.sqlite3",
                            "sidecar": "journal.sqlite3-journal",
                            "backup": "journal.sqlite3.v1.fictional.bak",
                        }[kind]
                        if kind == "hardlink":
                            (storage / name).hardlink_to(target)
                        else:
                            (storage / name).symlink_to(target)
                repository = JournalRepository(storage / "journal.sqlite3")
                try:
                    with self.assertRaises(JournalError) as caught:
                        await repository.async_open()
                    self.assertEqual(caught.exception.code, "storage_error")
                    self.assertNotIn(str(target), str(caught.exception))
                    self.assertEqual(target.read_text(), "do not modify")
                    self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o644)
                    self.assertEqual(stat.S_IMODE(outside.stat().st_mode), 0o755)
                finally:
                    await repository.async_close()


class RepositorySecurityTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp
    assert_error = repository_tests.RepositoryTest.assert_error

    async def test_manual_audit_is_atomic_private_and_deduplicated(self):
        actor = uuid4().hex
        request = request_id()
        created = await self.repository.async_create(
            request, viewing(notes="private fictional note"), actor_id=actor
        )
        await self.repository.async_create(
            request, viewing(notes="private fictional note"), actor_id=actor
        )
        record = created["viewing"]
        await self.repository.async_update(
            request_id(), record["id"], 1, {"title": "Corrected"}, actor_id=actor
        )
        await self.repository.async_delete(
            request_id(), record["id"], 2, actor_id=actor
        )
        with closing(sqlite3.connect(self.path)) as db:
            db.row_factory = sqlite3.Row
            rows = [
                dict(row)
                for row in db.execute(
                    "SELECT * FROM manual_audit ORDER BY dataset_revision"
                )
            ]
        self.assertEqual(
            [row["operation"] for row in rows], ["create", "update", "delete"]
        )
        self.assertEqual([row["viewing_revision"] for row in rows], [1, 2, 3])
        self.assertTrue(all(row["actor_id"] == actor for row in rows))
        self.assertTrue(all(row["viewing_id"] == record["id"] for row in rows))
        self.assertNotIn("private fictional note", json.dumps(rows))
        self.assertNotIn("Example Film", json.dumps(rows))
        with self.assert_error("conflict"):
            await self.repository.async_create(
                request, viewing(notes="private fictional note"), actor_id=uuid4().hex
            )
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_audit BEFORE INSERT ON manual_audit "
                "BEGIN SELECT RAISE(ABORT, 'fictional audit failure'); END"
            )
        with self.assert_error("storage_error"):
            await self.repository.async_create(request_id(), viewing(), actor_id=actor)
        self.assertEqual((await self.repository.async_info())["revision"], 3)
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(
                db.execute("SELECT count(*) FROM requests").fetchone()[0], 3
            )
            self.assertEqual(
                db.execute("SELECT count(*) FROM viewings").fetchone()[0], 1
            )

    async def test_schema_two_migration_preserves_legacy_retry_without_inventing_actor(
        self,
    ):
        request = request_id()
        original = await self.repository.async_create(request, viewing())
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("DROP TABLE manual_audit")
            db.execute("DROP TABLE maintenance_audit")
            db.execute("DROP TABLE import_audit")
            for table in (
                "library_collection_intents",
                "library_memberships",
                "library_collections",
                "library_titles",
                "library_artwork",
                "library_sources",
            ):
                db.execute(f"DROP TABLE {table}")
            db.execute("PRAGMA user_version = 2")
            db.commit()
        reopened = JournalRepository(self.path)
        self.addAsyncCleanup(reopened.async_close)
        await reopened.async_open()
        self.assertEqual(
            await reopened.async_create(request, viewing(), actor_id=uuid4().hex),
            original,
        )
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(
                db.execute("SELECT count(*) FROM manual_audit").fetchone()[0], 0
            )
        backup = next(self.path.parent.glob("journal.sqlite3.v2.*.bak"))
        self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
        with closing(sqlite3.connect(backup)) as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 2)

    async def test_export_slot_covers_snapshot_lifetime_and_releases_after_failure(
        self,
    ):
        async with self.repository.async_export_snapshot("json") as path:
            with self.assert_error("busy"):
                async with self.repository.async_export_snapshot("sqlite"):
                    self.fail("Concurrent export accepted")
            self.assertTrue(path.exists())
        self.assertFalse(path.exists())
        for format in ("json", "sqlite"):
            with self.subTest(format=format):
                with (
                    patch(
                        "custom_components.kaleidescape_companion.core.repository.MAX_EXPORT_BYTES",
                        1,
                    ),
                    self.assert_error("export_too_large"),
                ):
                    async with self.repository.async_export_snapshot(format):
                        self.fail("Oversized export accepted")
                self.assertEqual(list(self.repository._export_directory.iterdir()), [])
        with (
            patch(
                "custom_components.kaleidescape_companion.core.repository.EXPORT_BUILD_SECONDS",
                -1,
            ),
            self.assert_error("export_timeout"),
        ):
            async with self.repository.async_export_snapshot("json"):
                self.fail("Export time limit ignored")
        async with self.repository.async_export_snapshot("json"):
            pass

    async def test_database_growth_limit_preserves_reads_and_failed_transaction(self):
        original = await self.repository.async_create(request_id(), viewing())
        await self.repository.async_close()
        reopened = JournalRepository(self.path)
        self.addAsyncCleanup(reopened.async_close)
        with patch(
            "custom_components.kaleidescape_companion.core.repository.MAX_DATABASE_BYTES",
            1,
        ):
            await reopened.async_open()
        size = self.path.stat().st_size
        for _ in range(100):
            try:
                await reopened.async_create(request_id(), viewing(notes="x" * 10000))
            except JournalError as error:
                self.assertEqual(error.code, "storage_error")
                break
        else:
            self.fail("Database continued growing past its page limit")
        self.assertEqual(self.path.stat().st_size, size)
        self.assertEqual(
            await reopened.async_get(original["viewing"]["id"]), original["viewing"]
        )
        with closing(sqlite3.connect(self.path)) as db:
            count = db.execute("SELECT count(*) FROM viewings").fetchone()[0]
            self.assertEqual(
                db.execute("SELECT count(*) FROM requests").fetchone()[0], count
            )
            self.assertEqual(
                db.execute("SELECT count(*) FROM manual_audit").fetchone()[0], count
            )


class APISecurityTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call
    create = backend_tests.BackendTest.create
    export_request = backend_tests.BackendTest.export_request

    async def test_actor_comes_from_authenticated_user_and_cannot_be_supplied(self):
        created = await self.create()
        repository = self.entry.runtime_data.repository
        with closing(sqlite3.connect(repository.path)) as db:
            row = db.execute("SELECT actor_id, viewing_id FROM manual_audit").fetchone()
        self.assertEqual(row, (self.admin.id, created["result"]["viewing"]["id"]))
        _, schema = self.hass.data["websocket_api"][
            f"{self.entry.domain}/journal/create"
        ]
        with self.assertRaises(probatio.Invalid):
            schema(
                {
                    "id": 1,
                    "type": f"{self.entry.domain}/journal/create",
                    **self.scope,
                    "request_id": request_id(),
                    "data": viewing(),
                    "actor_id": "forged",
                }
            )
        diagnostics = await async_get_config_entry_diagnostics(self.hass, self.entry)
        self.assertNotIn(self.admin.id, json.dumps(diagnostics))

    async def test_websocket_withholds_private_data_after_access_changes(self):
        repository = self.entry.runtime_data.repository
        info = repository.async_info

        async def revoke():
            result = await info()
            self.admin.is_admin = False
            return result

        with patch.object(repository, "async_info", revoke):
            result = await self.call("info")
        self.assertEqual(result["code"], "unauthorized")
        self.assertNotIn("result", result)

    async def test_all_commands_deny_before_runtime_lookup(self):
        commands = {
            "info": {},
            "journal/create": {"request_id": request_id(), "data": viewing()},
            "journal/get": {"viewing_id": request_id()},
            "journal/list": {},
            "journal/update": {
                "request_id": request_id(),
                "viewing_id": request_id(),
                "expected_revision": 1,
                "patch": {"title": "x"},
            },
            "journal/delete": {
                "request_id": request_id(),
                "viewing_id": request_id(),
                "expected_revision": 1,
            },
            "journal/sessions": {"viewing_id": request_id()},
            "now_playing": {},
        }
        self.admin.is_active = False
        with patch(
            "custom_components.kaleidescape_companion.ui.websocket.get_runtime",
            side_effect=AssertionError("Unauthorized runtime access"),
        ):
            for command, data in commands.items():
                with self.subTest(command=command):
                    scope = {} if command == "info" else self.scope
                    self.assertEqual(
                        (await self.call(command, **scope, **data))["code"],
                        "unauthorized",
                    )
        with patch(
            "custom_components.kaleidescape_companion.ui.http.get_runtime",
            side_effect=AssertionError("Unauthorized runtime access"),
        ):
            with self.assertRaises(web.HTTPForbidden):
                await JournalExportView().get(
                    self.export_request(self.admin), **self.scope
                )

    async def test_http_revocation_after_snapshot_denies_download_and_cleans_up(self):
        repository = self.entry.runtime_data.repository
        export = repository.async_export

        async def revoke(format):
            path = await export(format)
            self.admin.is_admin = False
            return path

        with patch.object(repository, "async_export", revoke):
            with self.assertRaises(web.HTTPForbidden):
                await JournalExportView().get(
                    self.export_request(self.admin), **self.scope
                )
        self.assertEqual(list(repository._export_directory.iterdir()), [])

    async def test_http_timeout_before_headers_cleans_up_and_releases_slot(self):
        repository = self.entry.runtime_data.repository
        with patch(
            "custom_components.kaleidescape_companion.ui.http.EXPORT_DOWNLOAD_SECONDS",
            0,
        ):
            response = await JournalExportView().get(
                self.export_request(self.admin), **self.scope
            )
        self.assertEqual(response.status, 503)
        self.assertEqual(json.loads(response.body)["code"], "export_timeout")
        self.assertEqual(list(repository._export_directory.iterdir()), [])
        async with repository.async_export_snapshot("json"):
            pass

    async def test_repeated_cancellation_waits_for_snapshot_cleanup(self):
        repository = self.entry.runtime_data.repository
        export = repository.async_export
        started = asyncio.Event()
        finish = asyncio.Event()

        async def slow(format):
            path = await export(format)
            started.set()
            await finish.wait()
            return path

        with patch.object(repository, "async_export", slow):
            request = asyncio.create_task(
                JournalExportView().get(self.export_request(self.admin), **self.scope)
            )
            await asyncio.wait_for(started.wait(), 2)
            request.cancel()
            await asyncio.sleep(0)
            request.cancel()
            await asyncio.sleep(0)
            self.assertFalse(request.done())
            # A second request cannot start another snapshot during cleanup.
            busy = await JournalExportView().get(
                self.export_request(self.admin), **self.scope
            )
            self.assertEqual(busy.status, 503)
            self.assertEqual(busy.headers["Retry-After"], "5")
            finish.set()
            with self.assertRaises(asyncio.CancelledError):
                await request
        self.assertEqual(list(repository._export_directory.iterdir()), [])

    async def test_streaming_export_holds_slot_and_stops_when_access_is_revoked(self):
        repository = self.entry.runtime_data.repository
        for _ in range(8):
            await repository.async_create(request_id(), viewing(notes="x" * 10000))
        writing = asyncio.Event()
        finish = asyncio.Event()

        async def write(_chunk):
            writing.set()
            await finish.wait()

        stream = SimpleNamespace(
            prepare=AsyncMock(),
            write=AsyncMock(side_effect=write),
            write_eof=AsyncMock(),
        )
        with patch(
            "custom_components.kaleidescape_companion.ui.http.web.StreamResponse",
            return_value=stream,
        ) as response_type:
            first = asyncio.create_task(
                JournalExportView().get(self.export_request(self.admin), **self.scope)
            )
            try:
                await asyncio.wait_for(writing.wait(), 2)
                # A snapshot is still present and the second request cannot create one.
                self.assertEqual(len(list(repository._export_directory.iterdir())), 1)
                busy = await JournalExportView().get(
                    self.export_request(self.admin), **self.scope
                )
                self.assertEqual(busy.status, 503)
                headers = response_type.call_args.kwargs["headers"]
                self.assertEqual(headers["Cache-Control"], "no-store")
                self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
                self.admin.is_active = False
                finish.set()
                with self.assertRaises(ConnectionResetError):
                    await first
            finally:
                if not first.done():
                    first.cancel()
                    await asyncio.gather(first, return_exceptions=True)
        self.assertEqual(stream.write.await_count, 1)
        self.assertEqual(list(repository._export_directory.iterdir()), [])

    async def test_timeout_after_headers_aborts_partial_download_and_removes_snapshot(
        self,
    ):
        async def stalled_write(_chunk):
            await asyncio.Future()

        stream = SimpleNamespace(
            prepare=AsyncMock(),
            write=AsyncMock(side_effect=stalled_write),
            write_eof=AsyncMock(),
        )
        repository = self.entry.runtime_data.repository
        with (
            patch(
                "custom_components.kaleidescape_companion.ui.http.EXPORT_DOWNLOAD_SECONDS",
                0.5,
            ),
            patch(
                "custom_components.kaleidescape_companion.ui.http.web.StreamResponse",
                return_value=stream,
            ),
        ):
            with self.assertRaises(ConnectionResetError):
                await JournalExportView().get(
                    self.export_request(self.admin), **self.scope
                )
        stream.write_eof.assert_not_awaited()
        self.assertEqual(list(repository._export_directory.iterdir()), [])
        async with repository.async_export_snapshot("json"):
            pass

    async def test_scoped_websocket_withholds_results_after_entry_unloads(self):
        runtime = self.entry.runtime_data
        listing = runtime.repository.async_list

        async def unload(**kwargs):
            result = await listing(**kwargs)
            runtime.ready = False
            return result

        with patch.object(runtime.repository, "async_list", unload):
            result = await self.call("journal/list", **self.scope)
        self.assertEqual(result["code"], "not_ready")
        self.assertNotIn("result", result)

    async def test_export_io_error_is_safe_and_removes_snapshot(self):
        repository = self.entry.runtime_data.repository
        with patch.object(
            JournalExportView,
            "_stream",
            side_effect=OSError("fictional secret path /private/household/notes"),
        ):
            result = await JournalExportView().get(
                self.export_request(self.admin), **self.scope
            )
        self.assertEqual(result.status, 500)
        self.assertEqual(json.loads(result.body)["code"], "storage_error")
        self.assertNotIn(b"household", result.body)
        self.assertEqual(list(repository._export_directory.iterdir()), [])

"""Reviewed snapshot merges, legacy dates, hostile files and transfer boundaries."""

import asyncio
import hashlib
import json
import sqlite3
import threading
import unittest
import warnings
from contextlib import closing
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_repository as repository
from aiohttp import web
from aiohttp.test_utils import make_mocked_request
from aiohttp.web_exceptions import NotAppKeyWarning
from homeassistant.components.http import KEY_HASS

from custom_components.kaleidescape_companion.core.importing import parse_bundle
from custom_components.kaleidescape_companion.core.migrations import MIGRATIONS
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.store import title_id
from custom_components.kaleidescape_companion.ui.http import JournalImportView


def record(**overrides):
    return {
        "id": str(uuid4()),
        "title": "Fictional Import",
        "started_at": "2026-10-26T00:00:00.123456Z",
        **overrides,
    }


def payload(*rows, **tables):
    return json.dumps({"viewings": list(rows), **tables}).encode()


class ImportStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

    async def preview(self, data, format="json", actor="fictional-admin"):
        async with self.repository.async_import_slot():
            return await self.repository.async_import_preview(
                data, format, actor_id=actor
            )

    async def apply(self, plan, selected=None, request=None, actor="fictional-admin"):
        if selected is None:
            selected = [
                r["key"] for r in plan["rows"] if r["action"] in {"new", "merge"}
            ]
        return await self.repository.async_import_apply(
            request or str(uuid4()),
            plan["plan_id"],
            plan["revision"],
            selected,
            actor_id=actor,
        )

    async def snapshot(self):
        async with self.repository.async_export_snapshot("sqlite") as path:
            return path.read_bytes()

    async def seed_library(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        return title_id(library.SOURCE, library.ROWS[0]["source_handle"])

    async def test_read_only_review_selection_and_durable_retries(
        self,
    ):
        rows = [record(), record()]
        plan = await self.preview(payload(*rows))
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)
        request = str(uuid4())
        selected = [plan["rows"][0]["key"]]
        result = await self.apply(plan, selected, request)
        self.assertEqual(
            result,
            {
                "imported_count": 1,
                "updated_count": 0,
                "skipped_count": 1,
                "revision": 1,
            },
        )
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(await self.apply(plan, selected, request), result)
        with self.assert_error("conflict"):
            await self.apply(plan, selected, request, actor="another-admin")
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_missing_fields_fill_without_overwriting_manual_fields_or_tombstones(
        self,
    ):
        row = record(watched_seconds=115.37234567)
        await self.apply(await self.preview(payload(row)))
        correction = {
            **row,
            "notes": "Recovered note",
            "duration_seconds": 6000,
            "title": "Conflicting title",
            "status": "completed",
        }
        plan = await self.preview(payload(correction))
        self.assertEqual(set(plan["rows"][0]["changes"]), {"notes", "duration_seconds"})
        await self.apply(plan)
        stored = await self.repository.async_get(row["id"])
        self.assertEqual(stored["title"], row["title"])
        self.assertEqual(stored["status"], "partial")
        self.assertEqual(stored["watched_seconds"], row["watched_seconds"])
        self.assertTrue(stored["started_at"].endswith("123456+00:00"))
        stored = (
            await self.repository.async_update(
                str(uuid4()), row["id"], 2, {"notes": ""}
            )
        )["viewing"]
        plan = await self.preview(payload(correction))
        self.assertNotIn("notes", plan["rows"][0]["changes"])
        await self.repository.async_delete(str(uuid4()), row["id"], stored["revision"])
        plan = await self.preview(payload(correction))
        self.assertEqual(plan["rows"][0]["action"], "skip")
        self.assertEqual((await self.repository.async_inspect("sessions"))["items"], [])

    async def test_legacy_sqlite_purchase_dates_merge_by_exact_version_and_survive_sync(
        self,
    ):
        id = await self.seed_library()
        data = await self.snapshot()
        with closing(sqlite3.connect(":memory:")) as source:
            source.deserialize(data)
            source.execute(
                "CREATE TABLE library_purchase_dates (title_id,purchased_on)"
            )
            source.execute(
                "INSERT INTO library_purchase_dates VALUES (?,?)", (id, "2020-01-02")
            )
            source.execute("PRAGMA user_version=7")
            source.commit()
            data = source.serialize()
        digest = hashlib.sha256(data).hexdigest()
        plan = await self.preview(data, "sqlite")
        row = next(r for r in plan["rows"] if r["key"].endswith(id))
        self.assertEqual(
            row["changes"], {"purchased_on": {"before": None, "after": "2020-01-02"}}
        )
        result = await self.apply(plan)
        self.assertEqual(result["updated_count"], 1)
        self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        versions = (await self.repository.async_library_versions(library.SOURCE, id))[
            "items"
        ]
        self.assertEqual(
            next(r for r in versions if r["id"] == id)["purchased_on"], "2020-01-02"
        )
        self.assertTrue(all(not r["purchased_on"] for r in versions if r["id"] != id))
        second = await self.preview(data, "sqlite")
        self.assertEqual(second["counts"]["merge"], 0)
        audit = (await self.repository.async_inspect("import_audit"))["items"]
        self.assertEqual(audit[0]["updated_count"], 1)
        self.assertNotIn(library.ROWS[0]["title"], json.dumps(audit))

    async def test_json_library_fields_known_sources_and_conflicts(self):
        id = await self.seed_library()
        original = parse_bundle(await self.snapshot(), "sqlite")["library"][0]
        row = {
            **original,
            "purchased_on": "2020-01-02",
            "data": {"actors": ["Fictional Actor"], "year": 1901},
        }
        plan = await self.preview(payload(library=[row]))
        selected = plan["rows"][0]
        self.assertIn("purchased_on", selected["changes"])
        await self.apply(plan)
        row["purchased_on"] = "2021-01-02"
        plan = await self.preview(payload(library=[row]))
        self.assertIn("purchased_on", plan["rows"][0]["conflicts"])
        self.assertNotIn("purchased_on", plan["rows"][0]["changes"])
        unknown = {**original, "source_id": "a" * 64}
        unknown["id"] = title_id(unknown["source_id"], unknown["source_handle"])
        plan = await self.preview(payload(library=[unknown]))
        self.assertEqual(plan["rows"][0]["action"], "skip")
        bad = {**original, "id": "b" * 64}
        with self.assert_error("invalid_request"):
            await self.preview(payload(library=[bad]))
        self.assertTrue(id)

    async def test_portable_json_export_round_trips_dates_without_cache_or_origins(
        self,
    ):
        id = await self.seed_library()
        source = parse_bundle(await self.snapshot(), "sqlite")["library"][0]
        source["purchased_on"] = "2020-01-02"
        await self.apply(await self.preview(payload(library=[source])))
        await self.repository.async_library_details(
            library.SOURCE,
            id,
            {
                "synopsis": "Fictional synopsis",
                "artwork_path": "/webcovers/private.jpg",
            },
        )
        async with self.repository.async_export_snapshot("json") as path:
            data = path.read_bytes()
        document = json.loads(data)
        self.assertEqual(document["metadata"]["format_version"], 5)
        self.assertTrue(document["library"])
        self.assertNotIn(library.ORIGIN, data.decode())
        for row in document["library"]:
            self.assertFalse(
                {"artwork_path", "artwork_key", "base_hash", "fetched_at"} & row.keys()
            )
        plan = await self.preview(data)
        self.assertEqual(plan["counts"]["merge"], 0)
        rows = parse_bundle(data, "json")["library"]
        self.assertEqual(
            next(row for row in rows if row["id"] == source["id"])["purchased_on"],
            "2020-01-02",
        )

    async def test_new_versions_remain_inactive_without_imported_paths(
        self,
    ):
        await self.seed_library()
        row = parse_bundle(await self.snapshot(), "sqlite")["library"][0]
        row.update(source_handle="fictional-new", source_group="fictional-group")
        row["id"] = title_id(row["source_id"], row["source_handle"])
        row.update(artwork_path="/private/untrusted", artwork_key="a" * 64)
        await self.apply(await self.preview(payload(library=[row])))
        stored = next(
            r
            for r in (await self.repository.async_inspect("library"))["items"]
            if r["id"] == row["id"]
        )
        self.assertEqual(stored["available"], 0)
        self.assertIsNone(stored["artwork_path"])
        self.assertIsNone(stored["artwork_key"])
        candidates = await self.repository.async_library_candidates(library.SOURCE)
        self.assertNotIn(row["id"], [item["id"] for item in candidates])

    async def test_stale_expired_replaced_actor_and_tampered_reviews_are_denied(self):
        plan = await self.preview(payload(record()))
        with self.assert_error("conflict"):
            await self.apply(plan, actor="other-admin")
        with self.assert_error("invalid_request"):
            await self.apply(plan, ["viewings:" + str(uuid4())])
        with self.assert_error("invalid_request"):
            await self.apply(plan, [])
        with patch(
            "custom_components.kaleidescape_companion.core.import_merge.REVIEW_SECONDS",
            -1,
        ):
            expired = await self.preview(payload(record()))
        with self.assert_error("conflict"):
            await self.apply(expired)
        await self.repository.async_create(str(uuid4()), repository.viewing())
        with self.assert_error("conflict"):
            await self.apply(plan)
        newer = await self.preview(payload(record()))
        with self.assert_error("conflict"):
            await self.apply(plan)
        await self.apply(newer)

    async def test_failed_audit_rolls_back_all_changes_and_backup_export_barriers_hold(
        self,
    ):
        plan = await self.preview(payload(record(), record()))
        async with self.repository.async_export_snapshot("json"):
            with self.assert_error("busy"):
                await self.apply(plan)
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.apply(plan)
        await self.repository.async_resume()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_import BEFORE INSERT ON import_audit "
                "BEGIN SELECT RAISE(ABORT,'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.apply(plan)
        self.assertEqual((await self.repository.async_info())["revision"], 0)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)

    async def test_malformed_files_duplicates_and_hostile_sqlite_fail_before_writes(
        self,
    ):
        good = record()
        for data in (
            payload(good, record(watched_seconds=-1)),
            payload(good, good),
            payload(record(id="invalid")),
            b'{"viewings":[],"viewings":[]}',
            b'{"viewings":[NaN]}',
            b"\xff",
        ):
            with self.assert_error("invalid_request"):
                await self.preview(data)
        for sql in (
            "CREATE VIEW viewings AS SELECT 'x' "
            "id,load_extension('evil') title,'now' started_at",
            "CREATE TABLE different(id,title)",
            "CREATE TABLE viewings(id,title)",
        ):
            with closing(sqlite3.connect(":memory:")) as source:
                source.execute(sql)
                data = source.serialize()
            with self.assert_error("invalid_request"):
                await self.preview(data, "sqlite")
        with patch(
            "custom_components.kaleidescape_companion.core.importing.MAX_IMPORT_ROWS", 1
        ):
            with self.assert_error("invalid_request"):
                await self.preview(payload(record(), record()))
        self.assertEqual((await self.repository.async_info())["revision"], 0)

    async def test_thousands_of_review_rows_and_bounded_response(self):
        rows = [record(title=f"Fictional movie {i}") for i in range(2000)]
        plan = await self.preview(payload(*rows))
        self.assertEqual(plan["counts"]["new"], 2000)
        self.assertEqual(len(plan["rows"]), 2000)
        result = await self.apply(plan, [plan["rows"][-1]["key"]])
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["skipped_count"], 1999)
        with patch(
            "custom_components.kaleidescape_companion.core.import_merge.MAX_REVIEW_BYTES",
            1,
        ):
            with self.assert_error("invalid_request"):
                await self.preview(payload(record()))
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_cancelled_preview_keeps_transfer_slot_until_worker_finishes(self):
        started, release = threading.Event(), threading.Event()
        original = self.repository._preview_import

        def held(*args):
            started.set()
            if not release.wait(3):
                raise AssertionError("Worker timed out")
            return original(*args)

        with patch.object(self.repository, "_preview_import", side_effect=held):
            task = asyncio.create_task(self.preview(payload(record())))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                await asyncio.sleep(0)
                with self.assert_error("busy"):
                    await self.preview(payload(record()))
            finally:
                release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)

    async def test_cancelled_apply_drains_then_exact_retry_confirms_one_transaction(
        self,
    ):
        plan = await self.preview(payload(record()))
        request = str(uuid4())
        started, release = threading.Event(), threading.Event()
        original = self.repository._apply_import

        def held(*args):
            started.set()
            if not release.wait(3):
                raise AssertionError("Worker timed out")
            return original(*args)

        with patch.object(self.repository, "_apply_import", side_effect=held):
            task = asyncio.create_task(self.apply(plan, request=request))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                await asyncio.sleep(0)
                with self.assert_error("busy"):
                    await self.preview(payload(record()))
            finally:
                release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual((await self.apply(plan, request=request))["imported_count"], 1)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_schema_seven_migration_consolidates_dates_and_audits_losslessly(
        self,
    ):
        await self.repository.async_close()
        self.path.unlink()
        with closing(sqlite3.connect(self.path)) as db:
            for version in range(1, 8):
                for statement in MIGRATIONS[version]:
                    db.execute(statement)
            db.execute(
                "INSERT INTO schema_metadata VALUES (1,?,'2026-01-01',1)",
                (str(uuid4()),),
            )
            db.execute(
                "INSERT INTO library_sources(id,origin,first_seen) VALUES "
                "(?,?,'2026-01-01')",
                (library.SOURCE, library.ORIGIN),
            )
            id = title_id(library.SOURCE, "test")
            db.execute(
                "INSERT INTO "
                "library_titles(id,source_id,source_handle,source_group,title"
                ",title_search,base_hash,data,first_seen,last_seen) VALUES "
                "(?,?,'test','test','Fictional','fictional','','{}','2026-01-"
                "01','2026-01-01')",
                (id, library.SOURCE),
            )
            request = str(uuid4())
            db.execute(
                "INSERT INTO library_purchase_dates VALUES "
                "(?,'2020-01-02','2026-01-01')",
                (id,),
            )
            db.execute("INSERT INTO requests VALUES (?,'hash','{}')", (request,))
            db.execute(
                "INSERT INTO library_purchase_audit VALUES "
                "(?,'fictional-admin',1,12,'2026-01-01')",
                (request,),
            )
            db.execute("PRAGMA user_version=7")
            db.commit()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        titles = (await self.repository.async_inspect("library"))["items"]
        self.assertEqual(titles[0]["purchased_on"], "2020-01-02")
        audit = (await self.repository.async_inspect("import_audit"))["items"][0]
        self.assertEqual(
            (audit["kind"], audit["source_revision"], audit["dataset_revision"]),
            ("purchase_dates", 12, None),
        )
        for table in ("library_purchase_dates", "library_purchase_audit"):
            with self.assert_error("invalid_request"):
                await self.repository.async_inspect(table)
        self.assertTrue(list(self.path.parent.glob("*.v7.*.bak")))


class ImportApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    def request(self, data, user=None, on_read=None, *, purchase_only=False):
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
            "/import/preview?format=json"
            + ("&purchase_only=true" if purchase_only else ""),
            app=app,
            payload=Body(),
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", NotAppKeyWarning)
            request["hass_user"] = user or self.admin
        return request

    async def post(self, request):
        return await JournalImportView().post(request, **self.scope)

    async def test_purchase_only_review_and_match_with_tracking_enabled(self):
        repo = self.entry.runtime_data.repository
        await repo.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.entry.runtime_data.observer = object()
        self.addCleanup(setattr, self.entry.runtime_data, "observer", None)
        purchase = {
            "title": "Unknown fictional title",
            "purchased_on": "2020-01-02",
            "purchase_price": "$9.99",
        }
        response = await self.post(
            self.request(json.dumps([purchase]).encode(), purchase_only=True)
        )
        self.assertEqual(response.status, 200)
        plan = json.loads(response.body)
        key = plan["rows"][0]["key"]
        args = {
            **self.scope,
            "plan_id": plan["plan_id"],
            "revision": plan["revision"],
            "purchase_key": key,
        }
        search = await self.call("database/import/search", **args, query="Voyage")
        self.assertTrue(search["success"])
        target = title_id(library.SOURCE, library.ROWS[0]["source_handle"])
        match = await self.call("database/import/match", **args, title_id=target)
        self.assertTrue(match["success"])
        updated = match["result"]
        result = await self.call(
            "database/import",
            **self.scope,
            request_id=str(uuid4()),
            plan_id=updated["plan_id"],
            revision=updated["revision"],
            selected=[key],
        )
        self.assertEqual(result["result"]["imported_count"], 1)

    async def test_tracking_purchase_mode_rejects_mixed_data_and_old_plans(self):
        self.entry.runtime_data.observer = None
        old = await self.post(self.request(payload(record())))
        plan = json.loads(old.body)
        self.entry.runtime_data.observer = object()
        self.addCleanup(setattr, self.entry.runtime_data, "observer", None)
        mixed = payload(
            record(),
            library_purchases=[{"title": "Fictional", "purchased_on": "2020-01-02"}],
        )
        rejected = await self.post(self.request(mixed, purchase_only=True))
        self.assertEqual(rejected.status, 400)
        result = await self.call(
            "database/import",
            **self.scope,
            request_id=str(uuid4()),
            plan_id=plan["plan_id"],
            revision=plan["revision"],
            selected=[plan["rows"][0]["key"]],
        )
        self.assertEqual(result["code"], "tracking_enabled")

    async def test_recording_change_invalidates_purchase_review(self):
        repo = self.entry.runtime_data.repository
        await repo.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.entry.runtime_data.observer = object()
        self.addCleanup(setattr, self.entry.runtime_data, "observer", None)
        purchase = {
            "title": library.ROWS[0]["title"],
            "purchased_on": "2020-01-02",
            "purchase_price": "$9.99",
        }
        response = await self.post(
            self.request(json.dumps([purchase]).encode(), purchase_only=True)
        )
        plan = json.loads(response.body)
        await repo.async_create(str(uuid4()), repository.viewing())
        result = await self.call(
            "database/import",
            **self.scope,
            request_id=str(uuid4()),
            plan_id=plan["plan_id"],
            revision=plan["revision"],
            selected=[plan["rows"][0]["key"]],
        )
        self.assertEqual(result["code"], "conflict")

    async def test_preview_apply_admin_scope_and_revocation(
        self,
    ):
        reader = type(
            "Reader", (), {"is_active": True, "is_admin": False, "id": "reader"}
        )()
        with self.assertRaises(web.HTTPForbidden):
            await self.post(self.request(payload(record()), reader))
        self.entry.runtime_data.observer = object()
        self.assertEqual((await self.post(self.request(payload(record())))).status, 409)
        self.entry.runtime_data.observer = None
        response = await self.post(self.request(payload(record())))
        self.assertEqual(response.status, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        plan = json.loads(response.body)
        args = {
            **self.scope,
            "request_id": str(uuid4()),
            "plan_id": plan["plan_id"],
            "revision": plan["revision"],
            "selected": [plan["rows"][0]["key"]],
        }
        self.assertEqual(
            (await self.call("database/import", user=reader, **args))["code"],
            "unauthorized",
        )
        repo = self.entry.runtime_data.repository
        original = repo.async_import_apply

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_import_apply", side_effect=revoke):
            self.assertEqual(
                (await self.call("database/import", **args))["code"], "unauthorized"
            )
        self.admin.is_admin = True
        self.assertEqual(
            (await self.call("database/import", **args))["result"]["imported_count"], 1
        )

    async def test_upload_size_and_mid_upload_revocation(self):
        with patch(
            "custom_components.kaleidescape_companion.ui.http.MAX_IMPORT_BYTES", 5
        ):
            self.assertEqual(
                (await self.post(self.request(payload(record())))).status, 413
            )

        def revoke():
            self.admin.is_admin = False

        with self.assertRaises(web.HTTPForbidden):
            await self.post(self.request(payload(record()), on_read=revoke))
        self.assertEqual(
            (await self.entry.runtime_data.repository.async_info())["revision"], 0
        )

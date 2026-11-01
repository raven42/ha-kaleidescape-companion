"""Validated query and administrator mutation boundaries on real temporary SQLite."""

import json
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
from test_repository import viewing


class DatabaseStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def seed(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        await self.repository.async_library_details(
            library.SOURCE,
            library.title_id(library.SOURCE, "fixture-a"),
            library.details(library.DETAIL),
        )

    async def page(self, table="viewings", **kwargs):
        return await self.repository.async_inspect(table, **kwargs)

    async def mutate(
        self,
        page,
        operation="edit",
        patch_data=None,
        index=0,
        request=None,
        actor="admin",
    ):
        row = page["items"][index]
        keys = {
            field["name"]: row[field["name"]]
            for field in page["schema"]
            if field["primary"]
        }
        data = {
            "table": page["table"],
            "operation": operation,
            "rows": [{"key": keys, "token": page["row_tokens"][index]}],
            "patch": patch_data or {},
            "expected_revision": page["dataset_revision"],
            "confirmation": "SAVE" if operation == "edit" else "DELETE",
        }
        return await self.repository.async_database_mutate(
            request or str(uuid4()), data, actor
        )

    async def test_queries_bind_values_cover_null_arrays_patterns_and_guide_errors(
        self,
    ):
        await self.seed()
        page = await self.page(
            "library", query="purchased_on IS NULL AND actors CONTAINS 'zoË'"
        )
        self.assertGreater(page["total"], 0)
        self.assertEqual(
            (await self.page("library", query="title LIKE '%100%'"))["total"], 1
        )
        self.assertGreater(
            (
                await self.page(
                    "library", query="NOT (year < 2000) AND artwork_key IS NULL"
                )
            )["total"],
            0,
        )
        self.assertEqual(
            (
                await self.page(
                    "library",
                    query="source_id = 'bad' OR title = ''' OR 1=1 --'",
                )
            )["total"],
            0,
        )
        for query in (
            "WHERE missing IS NULL",
            "title = NULL",
            "title = 'x'; DELETE FROM viewings",
            "title =",
            "actors CONTAINS 4",
            "year > 1e300",
            "(" * 10 + "title = 'x'" + ")" * 10,
        ):
            with self.assert_error("query_syntax"):
                await self.page("library", query=query)
        self.assertIn("actors", {field["name"] for field in page["query_fields"]})
        self.assertNotIn("expression", json.dumps(page["query_fields"]))
        self.assertEqual((await self.page("library"))["total"], len(library.ROWS))

    async def test_viewing_edit_delete_exact_retry_audit_and_stale_snapshot(self):
        original = await self.repository.async_create(str(uuid4()), viewing())
        page = await self.page()
        request = str(uuid4())
        result = await self.mutate(
            page,
            patch_data={"notes": "Manual administrator correction"},
            request=request,
        )
        self.assertEqual(
            await self.mutate(
                page,
                patch_data={"notes": "Manual administrator correction"},
                request=request,
            ),
            result,
        )
        with self.assert_error("conflict"):
            await self.mutate(page, patch_data={"notes": "Different"})
        row = await self.repository.async_get(original["viewing"]["id"])
        self.assertEqual(row["notes"], "Manual administrator correction")
        with self.assert_error("invalid_request"):
            await self.mutate(await self.page(), patch_data={"id": str(uuid4())})
        page = await self.page()
        request = str(uuid4())
        deleted = await self.mutate(page, "delete", request=request)
        self.assertEqual(deleted["deleted_count"], 1)
        self.assertEqual(await self.mutate(page, "delete", request=request), deleted)
        with self.assert_error("not_found"):
            await self.repository.async_get(row["id"])
        audit = await self.page("database_audit")
        self.assertEqual(audit["total"], 2)
        self.assertNotIn("Manual administrator correction", json.dumps(audit))
        self.assertNotIn(row["id"], json.dumps(audit))

    async def test_library_edit_validation_and_metadata_delete_references(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            library.ROWS,
            {"Favorites": [library.ROWS[0]["source_handle"]]},
        )
        page = await self.page("library")
        await self.mutate(
            page,
            patch_data={
                "purchased_on": "2020-01-02",
                "data": json.dumps(
                    {"actors": ["A New Actor"], "year": 2024, "rating": "PG-13"}
                ),
            },
        )
        row = (await self.page("library", query="purchased_on IS NOT NULL"))["items"][0]
        self.assertEqual(json.loads(row["data"])["actors"], ["A New Actor"])
        with self.assert_error("invalid_request"):
            await self.mutate(
                await self.page("library"),
                patch_data={"data": '{"actors": "bad"}'},
            )
        await self.mutate(await self.page("library_collections"), "delete")
        self.assertEqual((await self.page("library_memberships"))["total"], 0)
        await self.mutate(await self.page("library_sources"), "delete")
        self.assertEqual((await self.page("library"))["total"], 0)

    async def test_protected_system_rows_backup_and_transaction_rollback(self):
        await self.repository.async_create(str(uuid4()), viewing())
        for table in ("schema_metadata", "requests", "manual_audit"):
            with self.assert_error("invalid_request"):
                await self.mutate(await self.page(table), "delete")
        page = await self.page()
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.mutate(page, "delete")
        await self.repository.async_resume()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER reject_admin BEFORE INSERT ON database_audit "
                "BEGIN SELECT RAISE(ABORT,'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.mutate(page, "delete")
        self.assertEqual((await self.page())["total"], 1)
        self.assertEqual((await self.page("database_audit"))["total"], 0)

    async def test_fit_page_accepts_bounded_dynamic_sizes(self):
        await self.seed()
        for limit in (1, 7, 499, 500):
            page = await self.page("library", limit=limit)
            self.assertEqual(page["limit"], limit)
            self.assertLessEqual(len(page["items"]), limit)
        for limit in (0, 501, True, "fit"):
            with self.assert_error("invalid_request"):
                await self.page(limit=limit)
        value = await self.repository.async_ui_preferences(
            "fit-reader", area="database"
        )
        self.assertEqual(value["values"]["limit"], "fit")

    async def test_personal_database_preferences_and_settings_deletion_revision(self):
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            0,
            {
                "limit": 100,
                "show_system": True,
                "sorts": {"viewings": {"sort": "title", "descending": True}},
            },
            "database",
        )
        own = await self.repository.async_ui_preferences("a", area="database")
        self.assertEqual(own["values"]["limit"], 100)
        self.assertEqual(
            (await self.repository.async_ui_preferences("b", area="database"))[
                "values"
            ]["limit"],
            "fit",
        )
        self.assertEqual((await self.repository.async_info())["revision"], 0)
        page = await self.page("settings")
        await self.mutate(page, "delete")
        self.assertGreater((await self.page("settings"))["revision"], page["revision"])
        self.assertEqual(
            (await self.repository.async_ui_preferences("a", area="database"))[
                "values"
            ]["limit"],
            "fit",
        )

    async def test_search_matches_partial_people_in_the_current_source(
        self,
    ):
        await self.seed()
        for query in ("zoË", "DIRECT", "100%_"):
            result = await self.repository.async_library_list(
                library.SOURCE, {"query": query, "grouped": True}
            )
            self.assertGreater(result["total"], 0)
        suggestions = await self.repository.async_library_suggest(
            library.SOURCE, "actor", "zoË"
        )
        self.assertIn("Zoë Example", suggestions["items"])
        with self.assert_error("invalid_request"):
            await self.repository.async_library_suggest(library.SOURCE, "sql", "")

    async def test_open_playback_protection_and_artwork_cleanup(self):
        created = await self.repository.async_create(str(uuid4()), viewing())
        row = created["viewing"]
        session = {
            "id": str(uuid4()),
            "viewing_id": row["id"],
            "player_id": "fixture-player",
            "raw_content_id": "fixture-content",
            "title": "Fixture",
            "duration_seconds": 3600,
            "started_at": row["started_at"],
            "last_observed_at": row["started_at"],
            "boot_id": "fixture-boot",
            "watched_seconds": 10,
            "credits_seen": 0,
            "credits_confirmed": 0,
            "credits_at": None,
            "credits_watched_seconds": 0,
            "closed_at": None,
            "end_reason": None,
            "revision": 1,
            "gap_count": 0,
        }
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "INSERT INTO sessions ("
                + ",".join(session)
                + ") VALUES ("
                + ",".join("?" for _ in session)
                + ")",
                tuple(session.values()),
            )
            db.commit()
        with self.assert_error("busy"):
            await self.mutate(await self.page(), "delete")
        with self.assert_error("busy"):
            await self.mutate(
                await self.page("sessions"), patch_data={"watched_seconds": 5}
            )
        await self.seed()
        image = b"\x89PNG\r\n\x1a\n" + b"q" * 12
        await self.repository.async_library_artwork_save(
            library.SOURCE,
            library.title_id(library.SOURCE, "fixture-a"),
            image,
            "image/png",
            32 * 1024 * 1024,
        )
        page = await self.page("library_artwork")
        key = page["items"][0]["cache_key"]
        await self.mutate(page, "delete")
        self.assertEqual((await self.page("library_artwork"))["total"], 0)
        with self.assert_error("not_found"):
            await self.repository.async_library_artwork(library.SOURCE, key)
        self.assertFalse((self.path.parent / "artwork" / (key + ".img")).exists())

    async def test_retry_during_backup_and_actor_binding(self):
        await self.repository.async_create(str(uuid4()), viewing())
        page = await self.page()
        request = str(uuid4())
        result = await self.mutate(
            page, patch_data={"notes": "Confirmed"}, request=request
        )
        await self.repository.async_pause()
        self.assertEqual(
            await self.mutate(page, patch_data={"notes": "Confirmed"}, request=request),
            result,
        )
        with self.assert_error("conflict"):
            await self.mutate(
                page, patch_data={"notes": "Confirmed"}, request=request, actor="other"
            )
        await self.repository.async_resume()


class DatabaseApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_new_routes_admin_scope_and_revocation(self):
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        for op, data in (
            ("database/validate_query", {"table": "viewings", "query": "id IS NULL"}),
            ("database/mutate", {"request_id": str(uuid4()), "data": {}}),
        ):
            self.assertEqual(
                (await self.call(op, user=reader, **self.scope, **data))["code"],
                "unauthorized",
            )
        self.assertEqual(
            (
                await self.call(
                    "database/validate_query",
                    **self.scope,
                    table="viewings",
                    query="status = 'partial'",
                )
            )["result"],
            {"valid": True},
        )
        self.assertEqual(
            (
                await self.call(
                    "database/validate_query",
                    **self.scope,
                    table="viewings",
                    query="unknown IS NULL",
                )
            )["code"],
            "query_syntax",
        )
        original = self.entry.runtime_data.repository.async_database_validate_query

        async def revoke(*args):
            result = await original(*args)
            self.admin.is_active = False
            return result

        with patch.object(
            self.entry.runtime_data.repository, "async_database_validate_query", revoke
        ):
            self.assertEqual(
                (
                    await self.call(
                        "database/validate_query",
                        **self.scope,
                        table="viewings",
                        query="",
                    )
                )["code"],
                "unauthorized",
            )

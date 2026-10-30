"""Private purchase history, reviewed group suggestions and portable round trips."""

import json
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_database_admin as database
import test_importing as importing
import test_library as library

from custom_components.kaleidescape_companion.core.importing import parse_bundle
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.playback.metadata import snapshot


def purchase(**overrides):
    return {
        "title": library.ROWS[0]["title"],
        "purchased_on": "2020-01-02",
        "purchase_price": "$12.99",
        "retail_price": "$24.99",
        "order_id": "PRIVATE-DEMO-ORDER",
        "href": "/movie-store/movie/fictional-voyage",
        **overrides,
    }


def payload(*rows):
    return json.dumps(list(rows)).encode()


class PurchaseImportTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    assert_error = importing.ImportStorageTest.assert_error
    preview = importing.ImportStorageTest.preview
    apply = importing.ImportStorageTest.apply
    seed_library = importing.ImportStorageTest.seed_library
    snapshot = importing.ImportStorageTest.snapshot
    mutate = database.DatabaseStorageTest.mutate

    async def page(self, **kwargs):
        return await self.repository.async_inspect("library_purchases", **kwargs)

    async def match_review(self, plan, key, title_id):
        result = await self.repository.async_import_match(
            plan["plan_id"], plan["revision"], key, title_id, "fictional-admin"
        )
        return {
            **plan,
            **{k: v for k, v in result.items() if k != "row"},
            "rows": [
                result["row"] if row["key"] == key else row for row in plan["rows"]
            ],
        }

    async def test_unresolved_first_manual_title_choice_and_rotated_approval(self):
        await self.seed_library()
        remake = {
            **library.ROWS[0],
            "source_handle": "remake",
            "source_group": "remake",
            "year": 1990,
            "directors": ["Other Director"],
        }
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, remake], {}
        )
        plan = await self.preview(
            payload(
                purchase(title=library.ROWS[1]["title"]),
                purchase(title="A different purchase spelling"),
                purchase(),
            )
        )
        self.assertEqual(
            [row["needs_match"] for row in plan["rows"]], [True, True, False]
        )
        key = plan["rows"][0]["key"]
        choices = await self.repository.async_import_match_search(
            plan["plan_id"], plan["revision"], key, "VOYAGE", "fictional-admin"
        )
        self.assertEqual(len(choices["items"]), 2)
        self.assertEqual({row["year"] for row in choices["items"]}, {1990, 2025})
        chosen = next(row for row in choices["items"] if row["year"] == 2025)
        revised = await self.match_review(plan, key, chosen["id"])
        self.assertNotEqual(plan["plan_id"], revised["plan_id"])
        row = next(row for row in revised["rows"] if row["key"] == key)
        self.assertFalse(row["needs_match"])
        self.assertIn(library.ROWS[0]["title"], row["detail"])
        self.assertEqual((await self.page())["total"], 0)
        with self.assert_error("conflict"):
            await self.apply(plan, [key])
        request = str(uuid4())
        applied = await self.apply(revised, [key], request=request)
        self.assertEqual(await self.apply(revised, [key], request=request), applied)
        stored = (await self.page())["items"][0]
        self.assertEqual(stored["title"], "A different purchase spelling")
        self.assertEqual(stored["source_group"], "group-a")

    async def test_match_unlinked_purchase_clear_choice_and_protect_stored_links(
        self,
    ):
        body = payload(purchase(title="Original store spelling"))
        await self.apply(await self.preview(body))
        target = await self.seed_library()
        original = (await self.page())["items"][0]
        plan = await self.preview(body)
        self.assertEqual(plan["rows"][0]["action"], "unchanged")
        key = plan["rows"][0]["key"]
        matched = await self.match_review(plan, key, target)
        self.assertEqual(
            set(matched["rows"][0]["changes"]), {"source_id", "source_group"}
        )
        cleared = await self.match_review(matched, key, None)
        self.assertTrue(cleared["rows"][0]["needs_match"])
        self.assertEqual(cleared["rows"][0]["action"], "unchanged")
        with self.assert_error("invalid_request"):
            await self.apply(cleared, [key])
        matched = await self.match_review(cleared, key, target)
        await self.apply(matched, [key])
        stored = (await self.page())["items"][0]
        self.assertEqual(stored["purchase_price"], original["purchase_price"])
        self.assertEqual(stored["imported_at"], original["imported_at"])
        fresh = await self.preview(body)
        self.assertFalse(fresh["rows"][0]["can_match"])
        with self.assert_error("invalid_request"):
            await self.match_review(fresh, key, target)

    async def test_match_search_and_choices_recheck_actor_review_and_live_revision(
        self,
    ):
        target = await self.seed_library()
        plan = await self.preview(payload(purchase(title="Unmatched")))
        key = plan["rows"][0]["key"]
        with self.assert_error("conflict"):
            await self.repository.async_import_match_search(
                plan["plan_id"], plan["revision"], key, "Voyage", "other-admin"
            )
        with self.assert_error("conflict"):
            await self.repository.async_import_match(
                plan["plan_id"], plan["revision"], key, target, "other-admin"
            )
        with self.assert_error("not_found"):
            await self.match_review(plan, key, "f" * 64)
        for query in ("x" * 101, "\x00", "\ud800"):
            with self.assert_error("invalid_request"):
                await self.repository.async_import_match_search(
                    plan["plan_id"], plan["revision"], key, query, "fictional-admin"
                )
        literal = await self.repository.async_import_match_search(
            plan["plan_id"], plan["revision"], key, "%_", "fictional-admin"
        )
        self.assertEqual([row["title"] for row in literal["items"]], ["Midnight 100%_"])
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with self.assert_error("conflict"):
            await self.match_review(plan, key, target)
        fresh = await self.preview(payload(purchase(title="Unmatched")))
        with self.assert_error("conflict"):
            await self.repository.async_import_match_search(
                plan["plan_id"], plan["revision"], key, "Voyage", "fictional-admin"
            )
        self.assertNotEqual(fresh["plan_id"], plan["plan_id"])

    async def test_review_only_selection_repeat_orders_dates_and_private_projection(
        self,
    ):
        title_id = await self.seed_library()
        body = payload(
            purchase(), purchase(order_id="OTHER-ORDER", purchased_on="2022-05-06")
        )
        plan = await self.preview(body)
        self.assertEqual((await self.page())["total"], 0)
        self.assertEqual(plan["counts"]["new"], 2)
        self.assertTrue(all(not row["selected_by_default"] for row in plan["rows"]))
        self.assertIn("2 versions", plan["rows"][0]["detail"])
        request = str(uuid4())
        result = await self.apply(plan, request=request)
        self.assertEqual(result["imported_count"], 2)
        versions = await self.repository.async_library_versions(
            library.SOURCE, title_id
        )
        self.assertTrue(
            all(row["purchased_on"] == "2020-01-02" for row in versions["items"])
        )
        grouped = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "sort": "added"}
        )
        self.assertEqual(grouped["items"][0]["purchased_on"], "2020-01-02")
        for projection in (versions, grouped):
            self.assertNotIn("PRIVATE-DEMO-ORDER", json.dumps(projection))
            self.assertNotIn("purchase_price", json.dumps(projection))
            self.assertNotIn("movie-store", json.dumps(projection))
        suggestions = await self.repository.async_library_search(
            library.SOURCE, "Voyage", ""
        )
        self.assertEqual(suggestions["items"][0]["purchased_on"], "2020-01-02")

        def viewing_snapshot():
            db = self.repository._db()
            row = db.execute(
                "SELECT * FROM library_titles WHERE id=?", (title_id,)
            ).fetchone()
            return snapshot(db, row)

        display = await self.repository._call(viewing_snapshot)
        self.assertEqual(display["purchase_date"], "2020-01-02")
        self.assertNotIn("PRIVATE-DEMO-ORDER", json.dumps(display))
        self.assertNotIn("purchase_price", display)
        audit = await self.repository.async_inspect("import_audit")
        self.assertNotIn("PRIVATE-DEMO-ORDER", json.dumps(audit))
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.assertEqual((await self.page())["total"], 2)
        self.assertEqual((await self.preview(body))["counts"]["new"], 0)
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(await self.apply(plan, request=request), result)
        with self.assert_error("conflict"):
            await self.apply(plan, request=request, actor="other-admin")

    async def test_unmatched_and_ambiguous_names_stay_unlinked_then_can_fill(self):
        body = payload(purchase())
        await self.apply(await self.preview(body))
        self.assertIsNone((await self.page())["items"][0]["source_id"])
        await self.seed_library()
        remake = {
            **library.ROWS[0],
            "source_handle": "remake",
            "source_group": "remake",
            "year": 1990,
        }
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, remake], {}
        )
        plan = await self.preview(body)
        self.assertEqual(plan["counts"]["merge"], 0)
        self.assertIn("without a Library link", plan["rows"][0]["detail"])
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        plan = await self.preview(body)
        self.assertEqual(set(plan["rows"][0]["changes"]), {"source_id", "source_group"})
        await self.apply(plan)
        self.assertEqual((await self.page())["items"][0]["source_group"], "group-a")
        await self.repository.async_library_catalog(
            "http://other-fictional.local", library.ROWS, {}
        )
        plan = await self.preview(payload(purchase(order_id="AMBIGUOUS-SOURCE")))
        self.assertNotIn("source_id", plan["rows"][0]["changes"])

    async def test_fill_only_prices_and_export_round_trips_and_explicit_date_wins(self):
        title_id = await self.seed_library()
        await self.apply(await self.preview(payload(purchase(purchase_price=None))))
        plan = await self.preview(payload(purchase()))
        self.assertEqual(set(plan["rows"][0]["changes"]), {"purchase_price"})
        await self.apply(plan)
        plan = await self.preview(payload(purchase(purchase_price="$0.00")))
        self.assertEqual(plan["counts"]["merge"], 0)
        self.assertIn("purchase_price", plan["rows"][0]["conflicts"])
        async with self.repository.async_export_snapshot("json") as path:
            exported = path.read_bytes()
        doc = json.loads(exported)
        self.assertEqual(doc["metadata"]["format_version"], 4)
        self.assertEqual(doc["library_purchases"][0]["order_id"], "PRIVATE-DEMO-ORDER")
        self.assertEqual((await self.preview(exported))["counts"]["merge"], 0)
        self.assertEqual(
            (await self.preview(await self.snapshot(), "sqlite"))["counts"]["merge"], 0
        )
        version = next(row for row in doc["library_titles"] if row["id"] == title_id)
        version["purchased_on"] = "2023-04-05"
        await self.apply(
            await self.preview(importing.payload(library_titles=[version]))
        )
        versions = (
            await self.repository.async_library_versions(library.SOURCE, title_id)
        )["items"]
        self.assertEqual(
            next(row for row in versions if row["id"] == title_id)["purchased_on"],
            "2023-04-05",
        )
        # Dates are derived, not copied into every format's stored purchase date.
        raw = (await self.repository.async_inspect("library_titles"))["items"]
        self.assertTrue(
            all(row["purchased_on"] is None for row in raw if row["id"] != title_id)
        )

    async def test_explicit_links_require_a_cached_group_with_the_same_name(self):
        await self.seed_library()
        body = payload(purchase(source_id=library.SOURCE, source_group="group-b"))
        plan = await self.preview(body)
        self.assertNotIn("source_id", plan["rows"][0]["changes"])
        self.assertIn("without a Library link", plan["rows"][0]["detail"])
        unknown = payload(purchase(source_id="f" * 64, source_group="group-a"))
        self.assertNotIn(
            "source_id", (await self.preview(unknown))["rows"][0]["changes"]
        )
        valid = payload(purchase(source_id=library.SOURCE, source_group="group-a"))
        plan = await self.preview(valid)
        self.assertEqual(plan["rows"][0]["changes"]["source_group"]["after"], "group-a")
        await self.apply(plan)
        # Reimporting cannot move an approved purchase to another movie group.
        plan = await self.preview(body)
        self.assertEqual(plan["counts"]["merge"], 0)
        self.assertEqual((await self.page())["items"][0]["source_group"], "group-a")

    async def test_validation_sqlite_purchase_only_and_atomic_failure(self):
        for row in (
            purchase(purchase_price=-1),
            purchase(purchase_price=True),
            purchase(purchase_price="-$1.00"),
            purchase(retail_price="$2.123"),
            purchase(order_id="x" * 257),
            purchase(href="javascript:alert(1)"),
            purchase(href="https://user:secret@example.invalid/movie"),
            purchase(source_id=library.SOURCE),
            purchase(id="wrong"),
            purchase(purchased_on="2999-01-02"),
        ):
            with self.assert_error("invalid_request"):
                await self.preview(payload(row))
        with self.assert_error("invalid_request"):
            await self.preview(payload(purchase(), purchase()))
        normalized = parse_bundle(payload(purchase()), "json")["library_purchases"][0]
        with closing(sqlite3.connect(":memory:")) as db:
            db.execute(
                "CREATE TABLE library_purchases(id,title,purchased_on,order_id,href)"
            )
            columns = ("id", "title", "purchased_on", "order_id", "href")
            db.execute(
                "INSERT INTO library_purchases VALUES (?,?,?,?,?)",
                tuple(normalized[k] for k in columns),
            )
            db.commit()
            plan = await self.preview(db.serialize(), "sqlite")
        self.assertEqual(plan["counts"]["new"], 1)
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_purchase BEFORE INSERT ON import_audit "
                "BEGIN SELECT RAISE(ABORT,'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.apply(plan)
        self.assertEqual((await self.page())["total"], 0)
        with closing(sqlite3.connect(":memory:")) as db:
            db.execute(
                "CREATE VIEW library_purchases AS SELECT 'id' id,'title' title,"
                "'2020-01-02' purchased_on"
            )
            with self.assert_error("invalid_request"):
                await self.preview(db.serialize(), "sqlite")

    async def test_database_price_edits_deletions_and_source_detachment(self):
        title_id = await self.seed_library()
        await self.apply(await self.preview(payload(purchase())))
        page = await self.page()
        for field in ("id", "order_id", "purchased_on", "source_group", "href"):
            with self.assert_error("invalid_request"):
                await self.mutate(page, patch_data={field: "changed"})
        await self.mutate(page, patch_data={"purchase_price": "$0.00"})
        self.assertEqual((await self.page())["items"][0]["purchase_price"], "$0.00")
        await self.mutate(await self.page(), operation="delete")
        versions = await self.repository.async_library_versions(
            library.SOURCE, title_id
        )
        self.assertTrue(all(row["purchased_on"] is None for row in versions["items"]))
        await self.apply(await self.preview(payload(purchase())))
        sources = await self.repository.async_inspect("library_sources")
        await self.mutate(sources, operation="delete")
        row = (await self.page())["items"][0]
        self.assertIsNone(row["source_id"])
        self.assertIsNone(row["source_group"])
        self.assertEqual(row["order_id"], "PRIVATE-DEMO-ORDER")

    async def test_schema_14_upgrade_preserves_titles_and_retains_private_backup(self):
        await self.seed_library()
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("DROP TABLE library_purchases")
            db.execute("DROP INDEX library_purchase_matches")
            db.execute("PRAGMA user_version=14")
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual((await self.repository.async_info())["schema_version"], 15)
        self.assertEqual((await self.page())["total"], 0)
        self.assertEqual(
            (await self.repository.async_inspect("library_titles"))["total"], 3
        )
        backups = list(self.path.parent.glob(self.path.name + ".v14.*.bak"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)

    async def test_large_purchase_review_explicit_selection_and_stale_apply(self):
        await self.seed_library()
        body = payload(
            *(purchase(order_id=f"DEMO-ORDER-{index}") for index in range(2000))
        )
        plan = await self.preview(body)
        self.assertEqual(plan["counts"]["new"], 2000)
        self.assertTrue(all(not row["selected_by_default"] for row in plan["rows"]))
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with self.assert_error("conflict"):
            await self.apply(plan, [plan["rows"][0]["key"]])
        plan = await self.preview(body)
        result = await self.apply(plan, [plan["rows"][-1]["key"]])
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["skipped_count"], 1999)
        self.assertEqual((await self.page())["total"], 1)


class PurchaseMatchApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportApiTest.asyncSetUp
    call = importing.ImportApiTest.call

    async def test_matches_require_admin_paused_recording_and_post_await_authority(
        self,
    ):
        repo = self.entry.runtime_data.repository
        await repo.async_library_catalog(library.ORIGIN, library.ROWS, {})
        async with repo.async_import_slot():
            plan = await repo.async_import_preview(
                payload(purchase(title="Unknown")), "json", actor_id=self.admin.id
            )
        args = {
            **self.scope,
            "plan_id": plan["plan_id"],
            "revision": plan["revision"],
            "purchase_key": plan["rows"][0]["key"],
        }
        target = library.title_id(library.SOURCE, library.ROWS[0]["source_handle"])
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        for operation, values in (
            ("database/import/search", {"query": "Voyage"}),
            ("database/import/match", {"title_id": target}),
        ):
            self.assertEqual(
                (await self.call(operation, user=reader, **args, **values))["code"],
                "unauthorized",
            )
            self.entry.runtime_data.observer = object()
            self.assertEqual(
                (await self.call(operation, **args, **values))["code"],
                "tracking_enabled",
            )
            self.entry.runtime_data.observer = None
        result = await self.call("database/import/search", **args, query="Voyage")
        self.assertEqual(len(result["result"]["items"]), 1)
        original = repo.async_import_match

        async def revoke(*values, **kwargs):
            result = await original(*values, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_import_match", side_effect=revoke):
            denied = await self.call("database/import/match", **args, title_id=target)
        self.assertEqual(denied["code"], "unauthorized")
        self.admin.is_admin = True
        self.assertEqual((await repo.async_inspect("library_purchases"))["total"], 0)

"""Private purchase history, reviewed group suggestions and portable round trips."""

import json
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_database_admin as database
import test_importing as importing
import test_library as library

from custom_components.kaleidescape_companion.core.importing import parse_bundle
from custom_components.kaleidescape_companion.core.migrations import MIGRATIONS, migrate
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

    async def page(self):
        return await self.repository.async_inspect("library", limit=100)

    async def invoices(self):
        return [
            (row, invoice)
            for row in (await self.page())["items"]
            for invoice in json.loads(row["purchase_history"])
        ]

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

    async def test_unresolved_cannot_import_and_manual_match_rotates_approval(self):
        target = await self.seed_library()
        plan = await self.preview(
            payload(purchase(title="Different store spelling"), purchase())
        )
        row = plan["rows"][0]
        self.assertTrue(row["needs_match"])
        self.assertEqual(row["action"], "skip")
        self.assertEqual(row["table"], "library")
        with self.assert_error("invalid_request"):
            await self.apply(plan, [row["key"]])
        matched = await self.match_review(plan, row["key"], target)
        self.assertFalse(matched["rows"][0]["needs_match"])
        self.assertEqual(await self.invoices(), [])
        with self.assert_error("conflict"):
            await self.apply(plan, [row["key"]])
        request = str(uuid4())
        result = await self.apply(matched, [row["key"]], request)
        self.assertEqual(result, await self.apply(matched, [row["key"]], request))
        owner, invoice = (await self.invoices())[0]
        self.assertEqual(owner["id"], target)
        self.assertEqual(invoice["title"], "Different store spelling")
        self.assertEqual((await self.page())["total"], 3)
        fresh = await self.preview(payload(purchase(title="Different store spelling")))
        self.assertEqual(fresh["counts"]["unchanged"], 1)
        self.assertFalse(fresh["rows"][0]["can_match"])

    async def test_ambiguous_remakes_and_sources_require_review_choice(self):
        target = await self.seed_library()
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
            payload(purchase(title=library.ROWS[0]["title"]), purchase(title="Unknown"))
        )
        self.assertTrue(all(row["needs_match"] for row in plan["rows"]))
        key = plan["rows"][0]["key"]
        choices = await self.repository.async_import_match_search(
            plan["plan_id"], plan["revision"], key, "VOYAGE", "fictional-admin"
        )
        self.assertEqual({row["year"] for row in choices["items"]}, {1990, 2025})
        matched = await self.match_review(plan, key, target)
        cleared = await self.match_review(matched, key, None)
        self.assertEqual(cleared["rows"][0]["action"], "skip")
        with self.assert_error("invalid_request"):
            await self.apply(cleared, [key])
        with self.assert_error("not_found"):
            await self.match_review(cleared, key, "f" * 64)
        await self.repository.async_library_catalog(
            "http://other-fictional.local", library.ROWS, {}
        )
        plan = await self.preview(payload(purchase()))
        self.assertTrue(plan["rows"][0]["needs_match"])

    async def test_review_role_revision_and_search_bounds(self):
        target = await self.seed_library()
        plan = await self.preview(payload(purchase(title="Unknown")))
        key = plan["rows"][0]["key"]
        with self.assert_error("conflict"):
            await self.repository.async_import_match_search(
                plan["plan_id"], plan["revision"], key, "Voyage", "other-admin"
            )
        with self.assert_error("conflict"):
            await self.repository.async_import_match(
                plan["plan_id"], plan["revision"], key, target, "other-admin"
            )
        for query in ("x" * 101, "\x00", "\ud800"):
            with self.assert_error("invalid_request"):
                await self.repository.async_import_match_search(
                    plan["plan_id"], plan["revision"], key, query, "fictional-admin"
                )
        choices = await self.repository.async_import_match_search(
            plan["plan_id"], plan["revision"], key, "%_", "fictional-admin"
        )
        self.assertEqual([row["title"] for row in choices["items"]], ["Midnight 100%_"])
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with self.assert_error("conflict"):
            await self.match_review(plan, key, target)

    async def test_repeat_orders_stay_on_one_entry_and_private_fields_stay_private(
        self,
    ):
        title = await self.seed_library()
        plan = await self.preview(
            payload(
                purchase(purchased_on="2022-05-06"), purchase(order_id="OTHER-ORDER")
            )
        )
        self.assertTrue(all(not row["selected_by_default"] for row in plan["rows"]))
        await self.apply(plan)
        invoices = await self.invoices()
        self.assertEqual(len(invoices), 2)
        self.assertEqual(len({row["id"] for row, _ in invoices}), 1)
        self.assertEqual((await self.page())["total"], 3)
        versions = await self.repository.async_library_versions(library.SOURCE, title)
        self.assertTrue(
            all(row["purchased_on"] == "2020-01-02" for row in versions["items"])
        )
        grouped = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}
        )
        suggestions = await self.repository.async_library_search(
            library.SOURCE, "Voyage", ""
        )
        for projection in (
            versions,
            grouped,
            suggestions,
            await self.repository.async_library_summary(library.SOURCE),
        ):
            for private in (
                "PRIVATE-DEMO-ORDER",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
                "purchase_history",
            ):
                self.assertNotIn(private, json.dumps(projection))
        private = await self.repository.async_library_versions(
            library.SOURCE, title, admin=True
        )
        self.assertEqual(
            sum(len(row["purchase_history"]) for row in private["items"]), 2
        )

        def display():
            db = self.repository._db()
            return snapshot(
                db, db.execute("SELECT * FROM library WHERE id=?", (title,)).fetchone()
            )

        self.assertNotIn(
            "PRIVATE-DEMO-ORDER", json.dumps(await self.repository._call(display))
        )
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.assertEqual(len(await self.invoices()), 2)
        self.assertEqual(
            (
                await self.preview(
                    payload(
                        purchase(purchased_on="2022-05-06"),
                        purchase(order_id="OTHER-ORDER"),
                    )
                )
            )["counts"]["new"],
            0,
        )

    async def test_store_year_and_edition_suggest_exact_owner_without_writing_review(
        self,
    ):
        await self.seed_library()
        remake = {
            **library.ROWS[0],
            "source_handle": "earlier-film",
            "source_group": "earlier-film",
            "year": 1990,
        }
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, remake], {}
        )
        row = purchase(
            title="A VOYAGE TO EUROPA - Extended Edition",
            href="/movie-store/movie/a-voyage-to-europa-2025-deadbeef",
        )
        plan = await self.preview(payload(row))
        self.assertFalse(plan["rows"][0]["needs_match"])
        self.assertIn("release year", plan["rows"][0]["detail"])
        self.assertFalse(plan["rows"][0]["selected_by_default"])
        self.assertEqual(await self.invoices(), [])
        await self.apply(plan)
        owner, saved = (await self.invoices())[0]
        self.assertEqual(owner["source_group"], "group-a")
        self.assertEqual(saved["title"], row["title"])
        self.assertEqual(saved["href"], row["href"])
        self.assertEqual((await self.preview(payload(row)))["counts"]["new"], 0)

    async def test_fill_only_prices_private_export_and_legacy_title_dates(self):
        target = await self.seed_library()
        await self.apply(await self.preview(payload(purchase(purchase_price=None))))
        plan = await self.preview(payload(purchase()))
        self.assertEqual(set(plan["rows"][0]["changes"]), {"purchase_price"})
        await self.apply(plan)
        conflict = await self.preview(payload(purchase(purchase_price="$0.00")))
        self.assertEqual(conflict["counts"]["merge"], 0)
        self.assertIn("purchase_price", conflict["rows"][0]["conflicts"])
        async with self.repository.async_export_snapshot("json") as path:
            exported = path.read_bytes()
        document = json.loads(exported)
        self.assertEqual(document["metadata"]["format_version"], 5)
        self.assertNotIn("library_purchases", document)
        self.assertNotIn("library_titles", document)
        self.assertEqual(
            sum(len(row["purchase_history"]) for row in document["library"]), 1
        )
        self.assertEqual((await self.preview(exported))["counts"]["merge"], 0)
        self.assertEqual(
            (await self.preview(await self.snapshot(), "sqlite"))["counts"]["merge"], 0
        )
        version = next(row for row in document["library"] if row["id"] == target)
        version = {
            key: value
            for key, value in version.items()
            if key
            not in {
                "purchase_history",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
                "purchase_match_pending",
            }
        }
        version["purchased_on"] = "2023-04-05"
        legacy = await self.preview(importing.payload(library_titles=[version]))
        self.assertEqual(legacy["counts"]["new"], 0)
        self.assertEqual(legacy["counts"]["merge"], 0)
        raw = next(row for row in (await self.page())["items"] if row["id"] == target)
        self.assertEqual(raw["purchased_on"], "2020-01-02")
        self.assertEqual(len(await self.invoices()), 1)

    async def test_flat_purchase_fields_import_and_summary_validation(
        self,
    ):
        target = await self.seed_library()
        async with self.repository.async_export_snapshot("json") as path:
            entry = next(
                row
                for row in json.loads(path.read_text())["library"]
                if row["id"] == target
            )
        entry.pop("purchase_history")
        entry.update(
            {key: value for key, value in purchase().items() if key != "title"}
        )
        plan = await self.preview(importing.payload(library=[entry]))
        purchase_row = next(
            row for row in plan["rows"] if row["key"].startswith("purchases:")
        )
        await self.apply(plan, [purchase_row["key"]])
        owner, invoice = (await self.invoices())[0]
        self.assertEqual(owner["id"], target)
        self.assertEqual(invoice["purchase_price"], "$12.99")
        async with self.repository.async_export_snapshot("json") as path:
            exported = json.loads(path.read_text())
        entry = next(row for row in exported["library"] if row["id"] == target)
        entry["purchase_price"] = "$1.00"
        with self.assert_error("invalid_request"):
            await self.preview(json.dumps(exported).encode())
        for price in (True, -1, "-$1.00"):
            with self.assert_error("invalid_request"):
                await self.preview(
                    importing.payload(
                        library=[
                            {**entry, "purchase_history": [], "purchase_price": price}
                        ]
                    )
                )

    async def test_legacy_purchase_only_sqlite_validation_and_atomic_failure(self):
        await self.seed_library()
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
        normalized = parse_bundle(payload(purchase()), "json")["purchases"][0]
        with closing(sqlite3.connect(":memory:")) as db:
            columns = ("id", "title", "purchased_on", "order_id", "href")
            db.execute(
                "CREATE TABLE library_purchases(id,title,purchased_on,order_id,href)"
            )
            db.execute(
                "INSERT INTO library_purchases VALUES (?,?,?,?,?)",
                tuple(normalized[key] for key in columns),
            )
            db.commit()
            plan = await self.preview(db.serialize(), "sqlite")
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_purchase BEFORE INSERT ON import_audit "
                "BEGIN SELECT RAISE(ABORT,'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.apply(plan)
        self.assertEqual(await self.invoices(), [])
        with closing(sqlite3.connect(":memory:")) as db:
            db.execute(
                "CREATE VIEW library_purchases AS SELECT 'id' id,'title' "
                "title,'2020-01-02' purchased_on"
            )
            with self.assert_error("invalid_request"):
                await self.preview(db.serialize(), "sqlite")

    async def test_prices_edit_history_in_same_row_and_delete_cannot_orphan(self):
        await self.seed_library()
        await self.apply(await self.preview(payload(purchase())))
        owner, invoice = (await self.invoices())[0]
        page = await self.page()
        page["items"] = [owner]
        # Mutation helpers derive tokens from the selected row.
        for field in ("id", "order_id", "href", "purchase_history", "source_group"):
            with self.assert_error("invalid_request"):
                await self.mutate(page, patch_data={field: "changed"})
        await self.mutate(page, patch_data={"purchase_price": "$0.00"})
        owner, invoice = (await self.invoices())[0]
        self.assertEqual(
            (owner["purchase_price"], invoice["purchase_price"]), ("$0.00", "$0.00")
        )
        page = await self.page()
        page["items"] = [owner]
        await self.mutate(page, operation="delete")
        self.assertEqual(await self.invoices(), [])
        with self.assert_error("invalid_request"):
            await self.repository.async_inspect("library_titles")
        with self.assert_error("invalid_request"):
            await self.repository.async_inspect("library_purchases")

    async def test_schema_15_consolidates_linked_and_preserves_unmatched_for_review(
        self,
    ):
        target = await self.seed_library()
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("ALTER TABLE library RENAME TO library_titles")
            for column in (
                "purchase_history",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
                "purchase_match_pending",
            ):
                db.execute(f"ALTER TABLE library_titles DROP COLUMN {column}")
            for statement in MIGRATIONS[15][:-1]:
                db.execute(statement)
            for row in (
                purchase(source_id=library.SOURCE, source_group="group-a"),
                purchase(title="Old unmatched spelling"),
            ):
                record = parse_bundle(payload(row), "json")["purchases"][0]
                record.pop("library_id")
                record.update(
                    title_search=record["title"].casefold(),
                    imported_at="2026-01-01T00:00:00Z",
                )
                db.execute(
                    f"INSERT INTO library_purchases ({','.join(record)}) "
                    f"VALUES ({','.join('?' for _ in record)})",
                    tuple(record.values()),
                )
            db.execute(
                "INSERT INTO settings VALUES "
                "('user:test','database',?,1,'2026-01-01T00:00:00Z')",
                (
                    json.dumps(
                        {
                            "table": "library_titles",
                            "sorts": {
                                "library_titles": {"sort": "title", "descending": True},
                                "library_purchases": {
                                    "sort": "imported_at",
                                    "descending": False,
                                },
                            },
                        }
                    ),
                ),
            )
            db.execute("DROP INDEX IF EXISTS viewings_library_title")
            db.execute("DROP TABLE IF EXISTS playback_controls")
            db.execute("PRAGMA user_version=15")
            db.commit()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual((await self.repository.async_info())["schema_version"], 18)
        invoices = await self.invoices()
        self.assertEqual(len(invoices), 2)
        pending = next(row for row, _ in invoices if row["purchase_match_pending"])
        self.assertEqual(pending["available"], 0)
        backups = list(self.path.parent.glob(self.path.name + ".v15.*.bak"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        async with self.repository.async_export_snapshot("json") as path:
            exported = path.read_bytes()
        plan = await self.preview(exported)
        unresolved = next(row for row in plan["rows"] if row["needs_match"])
        matched = await self.match_review(plan, unresolved["key"], target)
        await self.apply(matched, [unresolved["key"]])
        self.assertEqual(len(await self.invoices()), 2)
        moved = next(
            invoice
            for _, invoice in await self.invoices()
            if invoice["title"] == "Old unmatched spelling"
        )
        self.assertEqual(moved["imported_at"], "2026-01-01T00:00:00.000000+00:00")
        self.assertFalse(
            any(row["purchase_match_pending"] for row, _ in await self.invoices())
        )
        self.assertEqual((await self.page())["total"], 3)

        def integrity():
            return self.repository._db().execute("PRAGMA foreign_key_check").fetchall()

        self.assertEqual(await self.repository._call(integrity), [])
        preferences = await self.repository.async_ui_preferences(
            "test", area="database"
        )
        self.assertEqual(preferences["values"]["table"], "library")
        self.assertEqual(
            preferences["values"]["sorts"],
            {"library": {"sort": "title", "descending": True}},
        )

    async def test_failed_consolidation_rolls_back_table_rename_and_retains_backup(
        self,
    ):
        path = self.path.parent / "synthetic-legacy.sqlite"
        with closing(sqlite3.connect(path)) as db:
            db.row_factory = sqlite3.Row
            for version in range(1, 16):
                for statement in MIGRATIONS[version]:
                    db.execute(statement)
                if version == 1:
                    db.execute(
                        "INSERT INTO schema_metadata VALUES (1,?,'2026-01-01',0)",
                        (str(uuid4()),),
                    )
            db.execute("DROP INDEX IF EXISTS viewings_library_title")
            db.execute("DROP TABLE IF EXISTS playback_controls")
            db.execute("PRAGMA user_version=15")
            db.commit()
            with patch(
                "custom_components.kaleidescape_companion.core.migrations.library.consolidate",
                side_effect=sqlite3.OperationalError("synthetic failure"),
            ):
                with self.assertRaises(sqlite3.OperationalError):
                    migrate(db, path)
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 15)
            tables = {
                row[0]
                for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            self.assertIn("library_titles", tables)
            self.assertIn("library_purchases", tables)
            self.assertNotIn("library", tables)
        backups = list(path.parent.glob(path.name + ".v15.*.bak"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)

    async def test_large_review_selection_stale_apply_and_restart_retry(self):
        await self.seed_library()
        body = payload(
            *(purchase(order_id=f"DEMO-ORDER-{index}") for index in range(2000))
        )
        plan = await self.preview(body)
        self.assertEqual(plan["counts"]["new"], 2000)
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with self.assert_error("conflict"):
            await self.apply(plan, [plan["rows"][0]["key"]])
        plan = await self.preview(body)
        request = str(uuid4())
        selected = [plan["rows"][-1]["key"]]
        result = await self.apply(plan, selected, request)
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["skipped_count"], 1999)
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(await self.apply(plan, selected, request), result)
        with self.assert_error("conflict"):
            await self.apply(plan, selected, request, actor="other-admin")


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
        self.assertEqual(
            sum(
                len(json.loads(row["purchase_history"]))
                for row in (await repo.async_inspect("library"))["items"]
            ),
            0,
        )


class PurchaseLibraryAccessTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportApiTest.asyncSetUp
    call = importing.ImportApiTest.call

    async def seed(self):
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(source=library.SOURCE, async_stop=AsyncMock())
        repo = runtime.repository
        await repo.async_library_catalog(library.ORIGIN, library.ROWS, {})
        async with repo.async_import_slot():
            plan = await repo.async_import_preview(
                payload(purchase()), "json", actor_id=self.admin.id
            )
        await repo.async_import_apply(
            str(uuid4()),
            plan["plan_id"],
            plan["revision"],
            [plan["rows"][0]["key"]],
            actor_id=self.admin.id,
        )
        return repo

    async def test_purchase_fields_only_enter_administrator_detail_responses(self):
        await self.seed()
        target = library.title_id(library.SOURCE, library.ROWS[0]["source_handle"])
        args = {**self.scope, "title_id": target}
        private = await self.call("library/versions", **args)
        self.assertIn("PRIVATE-DEMO-ORDER", json.dumps(private))
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        for operation, values in (
            ("library/versions", {"title_id": target}),
            ("library/list", {"filters": {"grouped": True}}),
            ("library/search", {"query": "Voyage"}),
        ):
            result = await self.call(operation, user=reader, **self.scope, **values)
            self.assertTrue(result["success"])
            for field in (
                "purchase_history",
                "purchase_price",
                "retail_price",
                "order_id",
                "PRIVATE-DEMO-ORDER",
            ):
                self.assertNotIn(field, json.dumps(result))
        denied = await self.call(
            "database/inspect", user=reader, **self.scope, table="library"
        )
        self.assertEqual(denied["code"], "unauthorized")

    async def test_downgrade_while_loading_private_details_withholds_response(self):
        repo = await self.seed()
        original = repo.async_library_versions

        async def downgrade(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        target = library.title_id(library.SOURCE, library.ROWS[0]["source_handle"])
        with patch.object(repo, "async_library_versions", side_effect=downgrade):
            result = await self.call("library/versions", **self.scope, title_id=target)
        self.assertEqual(result["code"], "unauthorized")
        self.assertNotIn("PRIVATE-DEMO-ORDER", json.dumps(result))

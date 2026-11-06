"""Private purchase repairs, identity barriers, and reversal stay transactional."""

import json
import shutil
import sqlite3
import unittest
from contextlib import closing
from unittest.mock import patch
from uuid import uuid4

import test_importing as importing
import test_library as library
import test_purchase_importing as invoices

from custom_components.kaleidescape_companion.core import migrations
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.purchases import (
    INVOICE_FIELDS,
    purchase_record,
)


class PurchaseRepairTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    assert_error = importing.ImportStorageTest.assert_error
    preview_import = importing.ImportStorageTest.preview
    apply_import = importing.ImportStorageTest.apply
    seed_library = importing.ImportStorageTest.seed_library

    async def seed_purchase(self, **changes):
        target = await self.seed_library()
        record = invoices.purchase(**changes)
        plan = await self.preview_import(invoices.payload(record))
        await self.apply_import(plan)
        page = await self.repository.async_inspect("purchase_records")
        return target, record, page["items"][0], page["row_tokens"][0]

    async def preview_repair(self, action, key, token, changes=None, actor="admin"):
        return await self.repository.async_purchase_repair_preview(
            action, key, token, changes or {}, actor
        )

    async def apply_repair(self, plan, request=None, actor="admin"):
        return await self.repository.async_purchase_repair_apply(
            request or str(uuid4()), plan["plan_id"], plan["revision"], actor
        )

    async def event(self, event_id):
        page = await self.repository.async_inspect("purchase_repair_events")
        index = next(
            i for i, row in enumerate(page["items"]) if row["request_id"] == event_id
        )
        return page["items"][index], page["row_tokens"][index]

    async def test_correct_replay_reverse_and_identity_barriers(self):
        target, original, row, token = await self.seed_purchase(href=None)
        plan = await self.preview_repair(
            "correct",
            row["id"],
            token,
            {"href": "/movie-store/movie/details/123", "purchase_price": "$8.99"},
        )
        self.assertEqual(plan["before"]["id"], row["id"])
        self.assertNotEqual(plan["after"]["id"], row["id"])
        self.assertEqual(plan["after_library"]["id"], target)
        effect = plan["totals_change"][0]
        self.assertEqual(effect["before"]["currencies"][0]["library_cost"], "$12.99")
        self.assertEqual(effect["after"]["currencies"][0]["library_cost"], "$8.99")
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["items"][0], row
        )
        request = str(uuid4())
        result = await self.apply_repair(plan, request)
        self.assertEqual(result, await self.apply_repair(plan, request))
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(result, await self.apply_repair(plan, request))
        with self.assert_error("conflict"):
            await self.apply_repair(plan, request, actor="other-admin")
        replay = await self.preview_import(invoices.payload(original))
        self.assertTrue(replay["rows"][0]["repair_barrier"])
        self.assertFalse(replay["rows"][0]["can_match"])
        with self.assert_error("invalid_request"):
            await self.apply_import(replay, [replay["rows"][0]["key"]])
        event, event_token = await self.event(request)
        self.assertEqual(json.loads(event["before_library"])["id"], target)
        self.assertEqual(json.loads(event["before_record"])["id"], row["id"])
        self.assertEqual(json.loads(event["after_record"])["id"], plan["after"]["id"])
        reverse = await self.preview_repair("reverse", event["request_id"], event_token)
        await self.apply_repair(reverse)
        restored = (await self.repository.async_inspect("purchase_records"))["items"][0]
        self.assertEqual(restored, row)
        with self.assert_error("conflict"):
            await self.preview_repair("reverse", event["request_id"], event_token)
        enriched = {**original, "href": "/movie-store/movie/details/123"}
        replay = await self.preview_import(invoices.payload(enriched))
        self.assertTrue(replay["rows"][0]["repair_barrier"])

    async def test_void_blocks_automation_and_survives_full_snapshot(self):
        _, original, row, token = await self.seed_purchase()
        plan = await self.preview_repair("void", row["id"], token)
        self.assertEqual(plan["totals_change"][0]["after"]["purchase_count"], 0)
        request = str(uuid4())
        await self.apply_repair(plan, request)
        result = await self.repository.async_purchase_email(
            {"source": "kaleidescape", "purchases": [original]}
        )
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["issues"][0]["reason"], "purchase_identity_reserved")
        enriched = {**original, "href": "/movie-store/movie/details/456"}
        review = await self.preview_import(invoices.payload(enriched))
        self.assertTrue(review["rows"][0]["possible_duplicate"])
        self.assertTrue(
            review["rows"][0]["duplicate_candidates"][0]["reserved_by_repair"]
        )
        self.assertTrue(review["rows"][0]["needs_match"])
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["total"], 0
        )
        async with self.repository.async_export_snapshot("sqlite") as snapshot:
            with closing(sqlite3.connect(snapshot)) as db:
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) FROM purchase_identity_barriers"
                    ).fetchone()[0],
                    1,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) FROM purchase_repair_events"
                    ).fetchone()[0],
                    1,
                )
            restored_path = self.path.parent / "restored.sqlite"
            shutil.copyfile(snapshot, restored_path)
        restored = JournalRepository(restored_path)
        self.addAsyncCleanup(restored.async_close)
        await restored.async_open()
        replay = await restored.async_purchase_email(
            {"source": "kaleidescape", "purchases": [original]}
        )
        self.assertEqual(replay["issues"][0]["reason"], "purchase_identity_reserved")
        event, token = await self.event(request)
        await self.apply_repair(
            await self.preview_repair("reverse", event["request_id"], token)
        )
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["items"][0], row
        )

    async def test_stale_review_collisions_and_actor_changes_fail_closed(self):
        _, _, row, token = await self.seed_purchase()
        with self.assert_error("conflict"):
            await self.preview_repair("void", row["id"], "0" * 64)
        plan = await self.preview_repair(
            "correct", row["id"], token, {"purchase_price": "$5.00"}
        )
        with self.assert_error("conflict"):
            await self.apply_repair(plan, actor="other-admin")
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with self.assert_error("conflict"):
            await self.apply_repair(plan)
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["items"][0], row
        )

    async def test_collision_and_reassignment_are_checked_before_writing(self):
        target, original, first, token = await self.seed_purchase()
        second = {
            **original,
            "title": "Fictional other movie",
            "order_id": "ORDER-2",
            "href": "/movie-store/movie/fictional-other",
        }
        result = await self.repository.async_purchase_email(
            {"source": "kaleidescape", "purchases": [second]}
        )
        self.assertEqual(result["status"], "needs_review")
        page = await self.repository.async_inspect("purchase_records")
        other = next(row for row in page["items"] if row["id"] != first["id"])
        with self.assert_error("conflict"):
            await self.preview_repair(
                "correct",
                first["id"],
                token,
                {
                    key: other[key]
                    for key in ("title", "purchased_on", "order_id", "href")
                },
            )
        unlinked = await self.preview_repair(
            "correct", first["id"], token, {"library_id": None}
        )
        self.assertEqual(unlinked["before_library"]["id"], target)
        self.assertIsNone(unlinked["after_library"])
        await self.apply_repair(unlinked)
        page = await self.repository.async_inspect("purchase_records")
        current = next(row for row in page["items"] if row["id"] == first["id"])
        self.assertIsNone(current["library_id"])
        self.assertEqual(current["issue"], "unmatched")

    async def test_correcting_later_purchase_changes_totals_not_earliest_summary(self):
        target, original, first, _token = await self.seed_purchase()
        second = {
            **original,
            "order_id": "ORDER-2",
            "purchased_on": "2021-01-02",
            "purchase_price": "$20.00",
            "href": "/movie-store/movie/second-purchase",
        }
        plan = await self.preview_import(invoices.payload(second))
        await self.apply_import(plan)
        page = await self.repository.async_inspect("purchase_records")
        index = next(
            i for i, row in enumerate(page["items"]) if row["id"] != first["id"]
        )
        later, token = page["items"][index], page["row_tokens"][index]
        self.assertEqual(later["library_id"], target)
        review = await self.preview_repair(
            "correct", later["id"], token, {"purchase_price": "$7.00"}
        )
        self.assertEqual(
            review["totals_change"][0]["before"]["currencies"][0]["library_cost"],
            "$32.99",
        )
        self.assertEqual(
            review["totals_change"][0]["after"]["currencies"][0]["library_cost"],
            "$19.99",
        )
        await self.apply_repair(review)
        page = await self.repository.async_inspect("library")
        linked = next(row for row in page["items"] if row["id"] == target)
        self.assertEqual(linked["purchase_price"], "$12.99")

    async def test_event_history_is_append_only_and_failed_writes_are_atomic(self):
        _, _, row, token = await self.seed_purchase()
        plan = await self.preview_repair("void", row["id"], token)
        request = str(uuid4())
        await self.apply_repair(plan, request)

        def inspect():
            db = self.repository._db()
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE purchase_repair_events SET actor_id='other'")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("DELETE FROM purchase_repair_events")
            db.rollback()
            return db.execute("SELECT actor_id FROM purchase_repair_events").fetchone()[
                0
            ]

        self.assertEqual(await self.repository._call(inspect), "admin")

    async def test_interrupted_barrier_write_rolls_back_record_and_audit(self):
        _, _, row, token = await self.seed_purchase()
        plan = await self.preview_repair("void", row["id"], token)
        request = str(uuid4())

        def block_barrier():
            self.repository._db().execute(
                "CREATE TRIGGER fail_purchase_barrier BEFORE INSERT ON "
                "purchase_identity_barriers BEGIN SELECT RAISE(ABORT, 'fictional'); END"
            )

        await self.repository._call(block_barrier)
        with self.assert_error("storage_error"):
            await self.apply_repair(plan, request)
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["items"][0], row
        )
        self.assertEqual(
            (await self.repository.async_inspect("purchase_repair_events"))["total"], 0
        )

        def unblock():
            self.repository._db().execute("DROP TRIGGER fail_purchase_barrier")

        await self.repository._call(unblock)
        result = await self.apply_repair(plan, request)
        self.assertEqual(result["event_id"], request)

    async def test_duplicate_candidates_are_bounded_and_report_truncation(self):
        target = await self.seed_library()

        def insert_candidates():
            db = self.repository._db()
            with db:
                for number in range(7):
                    record = purchase_record(
                        invoices.purchase(href=f"/movie-store/movie/fictional-{number}")
                    )
                    db.execute(
                        "INSERT INTO purchase_records "
                        "(id,title,purchased_on,purchase_price,retail_price,order_id,href,"
                        "imported_at,library_id,issue) VALUES (?,?,?,?,?,?,?,?,?,NULL)",
                        (
                            record["id"],
                            *(record[key] for key in INVOICE_FIELDS),
                            "2026-11-05",
                            target,
                        ),
                    )
                db.execute("UPDATE schema_metadata SET revision=revision+1")

        await self.repository._call(insert_candidates)
        plan = await self.preview_import(
            invoices.payload(invoices.purchase(href="/movie-store/movie/new-link"))
        )
        row = plan["rows"][0]
        self.assertEqual(len(row["duplicate_candidates"]), 5)
        self.assertTrue(row["duplicate_candidates_more"])
        self.assertEqual(
            [candidate["id"] for candidate in row["duplicate_candidates"]],
            sorted(candidate["id"] for candidate in row["duplicate_candidates"]),
        )

    async def test_schema_upgrade_retains_backup_and_rolls_back_failure(self):
        path = self.path.parent / "schema26.sqlite"
        record = purchase_record(invoices.purchase())
        with closing(sqlite3.connect(path)) as db:
            with patch.object(migrations, "SCHEMA_VERSION", 26):
                migrations.migrate(db, path)
            db.execute(
                "INSERT INTO purchase_records "
                "(id,title,purchased_on,purchase_price,retail_price,order_id,href,"
                "imported_at,library_id,issue) "
                "VALUES (?,?,?,?,?,?,?,?,NULL,'unmatched')",
                (record["id"], *(record[key] for key in INVOICE_FIELDS), "2026-11-05"),
            )
            db.commit()
            broken = {
                **migrations.MIGRATIONS,
                27: (*migrations.MIGRATIONS[27], "SELECT no_such_column"),
            }
            with patch.object(migrations, "MIGRATIONS", broken):
                with self.assertRaises(sqlite3.OperationalError):
                    migrations.migrate(db, path)
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 26)
            self.assertEqual(
                db.execute("SELECT id FROM purchase_records").fetchone()[0],
                record["id"],
            )
            self.assertIsNone(
                db.execute(
                    "SELECT name FROM sqlite_master WHERE name='purchase_repair_events'"
                ).fetchone()
            )
            backups = list(path.parent.glob("schema26.sqlite.v26.*.bak"))
            self.assertEqual(len(backups), 1)
            with closing(sqlite3.connect(backups[0])) as backup:
                self.assertEqual(
                    backup.execute("SELECT id FROM purchase_records").fetchone()[0],
                    record["id"],
                )
                self.assertEqual(
                    backup.execute("PRAGMA user_version").fetchone()[0], 26
                )
            migrations.migrate(db, path)
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 27)
            self.assertEqual(
                db.execute("SELECT id FROM purchase_records").fetchone()[0],
                record["id"],
            )

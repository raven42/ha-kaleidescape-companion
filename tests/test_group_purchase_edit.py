"""Fictional group purchase edits retain ledger identities and retry safety."""

import sqlite3
import unittest
from contextlib import closing
from uuid import uuid4

import test_library as library

from custom_components.kaleidescape_companion.library.purchases import (
    merge_into,
    purchase_record,
)


class GroupPurchaseEditTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    seed = library.LibraryStorageTest.seed
    assert_error = library.LibraryStorageTest.assert_error

    async def add_receipt(self, handle="fixture-a", **changes):
        record = purchase_record(
            {
                "title": "Fictional Film",
                "purchased_on": "2020-01-02",
                "purchase_price": "$9.99",
                "retail_price": "$19.99",
                "order_id": "FICTIONAL-1",
                "href": "/movie-store/movie/fictional",
                **changes,
            }
        )

        def write():
            db = self.repository._db()
            with db:
                merge_into(
                    db,
                    record,
                    library.title_id(library.SOURCE, handle),
                    "2020-01-02T00:00:00+00:00",
                )

        await self.repository._call(write)
        return record

    async def inspect(self):
        return await self.repository.async_group_purchase_edit(
            library.SOURCE, library.title_id(library.SOURCE, "fixture-a"), "admin"
        )

    async def save(self, review, data, request=None, actor="admin"):
        return await self.repository.async_group_purchase_edit(
            library.SOURCE,
            library.title_id(library.SOURCE, "fixture-a"),
            actor,
            request or str(uuid4()),
            review["snapshot"],
            data,
        )

    async def test_receipt_and_matching_manual_date_save_atomically_and_retry(self):
        await self.seed()
        record = await self.add_receipt()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-02", library.title_id(library.SOURCE, "fixture-a2")),
            )
        review = await self.inspect()
        self.assertEqual(len(review["records"]), 1)
        self.assertEqual(len(review["manual"]), 1)
        data = {
            "receipt_id": record["id"],
            "unavailable": False,
            "fields": {"purchased_on": "2020-01-03", "purchase_price": "$8.99"},
        }
        request = str(uuid4())
        result = await self.save(review, data, request)
        self.assertEqual(result, await self.save(review, data, request))
        with self.assert_error("conflict"):
            await self.save(review, {**data, "unavailable": True}, request)
        current = await self.inspect()
        self.assertEqual(current["records"][0]["purchased_on"], "2020-01-03")
        self.assertEqual(current["records"][0]["purchase_price"], "$8.99")
        self.assertEqual(current["manual"][0]["purchased_on"], "2020-01-03")
        self.assertNotEqual(current["records"][0]["id"], record["id"])
        events = await self.repository.async_inspect("purchase_repair_events")
        self.assertEqual(len(events["items"]), 1)
        self.assertEqual(events["items"][0]["request_id"], request)
        reverse = await self.repository.async_purchase_repair_preview(
            "reverse", request, events["row_tokens"][0], {}, "admin"
        )
        await self.repository.async_purchase_repair_apply(
            str(uuid4()), reverse["plan_id"], reverse["revision"], "admin"
        )
        restored = await self.inspect()
        self.assertEqual(restored["records"][0]["id"], record["id"])
        self.assertEqual(restored["manual"][0]["purchased_on"], "2020-01-02")

    async def test_checkbox_preserves_receipt_and_manual_group_fields(self):
        await self.seed()
        record = await self.add_receipt()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-02", library.title_id(library.SOURCE, "fixture-a2")),
            )
        review = await self.inspect()
        with self.assert_error("invalid_request"):
            await self.save(
                review,
                {
                    "receipt_id": record["id"],
                    "unavailable": True,
                    "fields": {"purchase_price": "$1.00"},
                },
            )
        await self.save(
            review, {"receipt_id": record["id"], "unavailable": True, "fields": {}}
        )
        current = await self.inspect()
        self.assertTrue(current["unavailable"])
        self.assertEqual(current["records"], review["records"])
        page = await self.repository.async_library_versions(
            library.SOURCE, library.title_id(library.SOURCE, "fixture-a"), admin=True
        )
        self.assertTrue(page["group_purchase_details"]["unavailable"])
        result = await self.save(
            current,
            {
                "receipt_id": record["id"],
                "unavailable": False,
                "fields": {"purchase_price": "$8.99"},
            },
        )
        self.assertFalse((await self.inspect())["unavailable"])
        events = await self.repository.async_inspect("purchase_repair_events")
        reverse = await self.repository.async_purchase_repair_preview(
            "reverse", result["event_id"], events["row_tokens"][0], {}, "admin"
        )
        await self.repository.async_purchase_repair_apply(
            str(uuid4()), reverse["plan_id"], reverse["revision"], "admin"
        )
        restored = await self.inspect()
        self.assertTrue(restored["unavailable"])
        self.assertEqual(restored["records"][0]["purchase_price"], "$9.99")

    async def test_reversal_refuses_changed_group_evidence(self):
        await self.seed()
        record = await self.add_receipt()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-02", library.title_id(library.SOURCE, "fixture-a2")),
            )
        review = await self.inspect()
        result = await self.save(
            review,
            {
                "receipt_id": record["id"],
                "unavailable": False,
                "fields": {"purchased_on": "2020-01-03"},
            },
        )
        events = await self.repository.async_inspect("purchase_repair_events")
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-04", library.title_id(library.SOURCE, "fixture-a2")),
            )
        with self.assert_error("conflict"):
            await self.repository.async_purchase_repair_preview(
                "reverse", result["event_id"], events["row_tokens"][0], {}, "admin"
            )

    async def test_separate_receipts_are_not_merged_and_stale_snapshots_fail(self):
        await self.seed()
        first = await self.add_receipt()
        second = await self.add_receipt(
            "fixture-a2",
            order_id="FICTIONAL-2",
            purchased_on="2021-02-03",
            purchase_price="$5.99",
        )
        review = await self.inspect()
        await self.save(
            review,
            {
                "receipt_id": second["id"],
                "unavailable": False,
                "fields": {"purchase_price": "$4.99"},
            },
        )
        updated = await self.inspect()
        self.assertEqual(
            {row["order_id"]: row["purchase_price"] for row in updated["records"]},
            {"FICTIONAL-1": "$9.99", "FICTIONAL-2": "$4.99"},
        )
        with self.assert_error("refresh_required"):
            await self.save(
                review,
                {
                    "receipt_id": first["id"],
                    "unavailable": False,
                    "fields": {"purchase_price": "$1.99"},
                },
            )

    async def test_manual_fields_from_multiple_versions_are_edited_as_one_group(self):
        await self.seed()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-02", library.title_id(library.SOURCE, "fixture-a")),
            )
            db.execute(
                "UPDATE library SET retail_price=? WHERE id=?",
                ("$19.99", library.title_id(library.SOURCE, "fixture-a2")),
            )
        review = await self.inspect()
        await self.save(
            review,
            {
                "receipt_id": None,
                "unavailable": False,
                "fields": {
                    "purchased_on": "2020-01-03",
                    "retail_price": "$18.99",
                    "order_id": "FICTIONAL",
                },
            },
        )
        updated = await self.inspect()
        self.assertEqual(
            {row["purchased_on"] for row in updated["manual"]} - {None}, {"2020-01-03"}
        )
        self.assertEqual(
            {row["retail_price"] for row in updated["manual"]} - {None}, {"$18.99"}
        )
        self.assertIn("FICTIONAL", {row["order_id"] for row in updated["manual"]})

    async def test_value_from_another_receipt_requires_selecting_its_owner(self):
        await self.seed()
        first = await self.add_receipt(purchase_price=None)
        second = await self.add_receipt(
            "fixture-a2",
            order_id="FICTIONAL-2",
            purchased_on="2021-02-03",
            purchase_price="$5.99",
        )
        review = await self.inspect()
        with self.assert_error("invalid_request"):
            await self.save(
                review,
                {
                    "receipt_id": first["id"],
                    "unavailable": False,
                    "fields": {"purchase_price": "$4.99"},
                },
            )
        await self.save(
            review,
            {
                "receipt_id": second["id"],
                "unavailable": False,
                "fields": {"purchase_price": "$4.99"},
            },
        )
        records = (await self.inspect())["records"]
        self.assertEqual(
            {row["order_id"]: row["purchase_price"] for row in records},
            {"FICTIONAL-1": None, "FICTIONAL-2": "$4.99"},
        )

    async def test_failed_group_update_rolls_back_receipt_and_audit(self):
        await self.seed()
        record = await self.add_receipt()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET purchased_on=? WHERE id=?",
                ("2020-01-02", library.title_id(library.SOURCE, "fixture-a2")),
            )
        review = await self.inspect()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "CREATE TRIGGER fail_purchase_group BEFORE UPDATE ON library "
                "BEGIN SELECT RAISE(ABORT,'fictional failure'); END"
            )
        with self.assertRaises(Exception):
            await self.save(
                review,
                {
                    "receipt_id": record["id"],
                    "unavailable": False,
                    "fields": {"purchased_on": "2020-01-03", "purchase_price": "$8.99"},
                },
            )
        self.assertEqual((await self.inspect())["records"], review["records"])
        self.assertEqual(
            (await self.repository.async_inspect("purchase_repair_events"))["items"], []
        )

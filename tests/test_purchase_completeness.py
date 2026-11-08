"""Group completeness retains purchase evidence across catalog editions."""

import unittest
from uuid import uuid4

import test_database_admin as database
import test_library as library
import test_library_sensors as sensors
from test_purchase_email import invoice, movie

from custom_components.kaleidescape_companion.library.store import source_id, title_id


class PurchaseCompletenessTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    setup_sensors = sensors.LibrarySensorTest.setup_sensors
    mutate = database.DatabaseStorageTest.mutate

    async def scan(self, rows):
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})

    async def seed(self):
        await self.scan(library.ROWS)
        result = await self.repository.async_purchase_email(
            invoice(movie(library.ROWS[0]["title"]))
        )
        self.assertEqual(result["status"], "imported")
        self.record = (await self.repository.async_inspect("purchase_records"))[
            "items"
        ][0]
        self.owner = self.record["library_id"]
        self.remaining = [
            row
            for row in library.ROWS
            if title_id(library.SOURCE, row["source_handle"]) != self.owner
        ]
        _, self.entities = await self.setup_sensors()

    async def assert_missing(self, titles, source=library.SOURCE):
        summary = await self.repository.async_library_summary(source)
        self.assertEqual(summary["missing_purchase_information"], len(titles))
        page = await self.repository.async_library_list(
            source, {"grouped": True, "missing_purchase_information": True}
        )
        self.assertEqual({row["title"] for row in page["items"]}, set(titles))
        if source == library.SOURCE and hasattr(self, "entities"):
            sensor = self.entities["missing_purchase_information"]
            await sensor.coordinator.async_refresh()
            self.assertEqual(sensor.native_value, len(titles))
            self.assertEqual(set(sensor.extra_state_attributes["movies"]), set(titles))

    async def test_owner_disappears_returns_and_group_disappears(self):
        await self.seed()
        other_origin = "http://other-fictional.local"
        await self.repository.async_library_catalog(other_origin, library.ROWS, {})
        for rows in (library.ROWS, self.remaining, library.ROWS):
            with self.subTest(handles=[row["source_handle"] for row in rows]):
                await self.scan(rows)
                await self.assert_missing([library.ROWS[1]["title"]])
                survivor = next(row for row in rows if row["source_group"] == "group-a")
                details = await self.repository.async_library_versions(
                    library.SOURCE,
                    title_id(library.SOURCE, survivor["source_handle"]),
                    admin=True,
                )
                records = details["group_purchase_details"]["records"]
                self.assertEqual([row["id"] for row in records], [self.record["id"]])
                self.assertEqual(records[0]["library_id"], self.owner)
                self.assertEqual(details["items"][0]["purchased_on"], "2020-01-02")
                totals = await self.repository.async_purchase_totals(library.SOURCE)
                self.assertEqual(totals["purchase_count"], 1)
                self.assertEqual(totals["currencies"][0]["library_cost"], "$9.99")
                await self.assert_missing(
                    [library.ROWS[0]["title"], library.ROWS[1]["title"]],
                    source_id(other_origin),
                )
        await self.scan([library.ROWS[1]])
        await self.assert_missing([library.ROWS[1]["title"]])
        # An absent, incomplete group must not be counted either.
        await self.scan([library.ROWS[0]])
        await self.assert_missing([])

    async def test_unlinked_invoice_no_longer_completes_surviving_group(self):
        await self.seed()
        await self.scan(self.remaining)
        page = await self.repository.async_inspect("purchase_records")
        plan = await self.repository.async_purchase_repair_preview(
            "correct",
            self.record["id"],
            page["row_tokens"][0],
            {"library_id": None},
            "admin",
        )
        await self.repository.async_purchase_repair_apply(
            str(uuid4()), plan["plan_id"], plan["revision"], "admin"
        )
        await self.assert_missing([library.ROWS[0]["title"], library.ROWS[1]["title"]])

    async def test_deleted_owner_does_not_supply_group_evidence(self):
        await self.seed()
        await self.scan(self.remaining)

        # Simulate an old database with an already removed Library owner.
        # Current Database management intentionally forbids this deletion.
        def remove_legacy_owner():
            db = self.repository._db()
            with db:
                db.execute(
                    "UPDATE purchase_records SET library_id=NULL WHERE library_id=?",
                    (self.owner,),
                )
                db.execute(
                    "DELETE FROM library_memberships WHERE title_id=?", (self.owner,)
                )
                db.execute("DELETE FROM library WHERE id=?", (self.owner,))

        await self.repository._call(remove_legacy_owner)
        await self.assert_missing([library.ROWS[0]["title"], library.ROWS[1]["title"]])
        records = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(records), 1)
        self.assertIsNone(records[0]["library_id"])

    async def test_retained_manual_fields_and_unavailable_override(self):
        await self.scan(library.ROWS)
        owner = title_id(library.SOURCE, "fixture-a")
        for fields in (
            {
                "purchased_on": "2020-01-02",
                "purchase_price": "$0.00",
                "retail_price": "$20.00",
            },
            {
                "purchased_on": None,
                "purchase_price": None,
                "retail_price": None,
                "purchase_information_unavailable": True,
            },
            {"purchase_information_unavailable": False},
        ):
            await self.scan(library.ROWS)
            review = await self.repository.async_library_edit(library.SOURCE, owner)
            await self.repository.async_library_edit(
                library.SOURCE, owner, "admin", str(uuid4()), review["snapshot"], fields
            )
            await self.scan(library.ROWS[1:])
            missing = [library.ROWS[1]["title"]]
            if fields.get("purchase_information_unavailable") is False:
                missing.append(library.ROWS[0]["title"])
            await self.assert_missing(missing)
            details = await self.repository.async_library_versions(
                library.SOURCE, title_id(library.SOURCE, "fixture-a2"), admin=True
            )
            self.assertEqual(
                details["group_purchase_details"]["unavailable"],
                fields.get("purchase_information_unavailable", False),
            )

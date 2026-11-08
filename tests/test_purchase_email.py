"""Purchase email actions, atomic matching, and bundle allocation."""

import base64
import json
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import test_importing as importing
import test_library as library
from _schema_fixtures import remove_collection_queue_schema
from homeassistant.core import Context, ServiceCall
from homeassistant.exceptions import HomeAssistantError

from custom_components.kaleidescape_companion.library.purchase_email import normalize
from custom_components.kaleidescape_companion.services import async_register_services


def invoice(*items):
    return {
        "source": "kaleidescape",
        "order_id": "ORDER-1",
        "purchased_on": "2020-01-02",
        "prices_reconciled": True,
        "purchases": list(items),
    }


def movie(title, **kwargs):
    return {
        "title": title,
        "purchase_price": "$9.99",
        "retail_price": "$19.99",
        **kwargs,
    }


class EmailTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    seed_library = importing.ImportStorageTest.seed_library
    assert_error = importing.ImportStorageTest.assert_error

    async def test_overcomplex_html_releases_repository_worker(self):
        import asyncio

        from test_receipt_parser import envelope

        html = "<table><tr><td>" + "<span>" * 5000 + "x" * 100 + "</span>" * 5000
        result = await asyncio.wait_for(
            self.repository.async_purchase_email(envelope(html)), timeout=3
        )
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["issues"], [{"reason": "html_items_unavailable"}])
        await asyncio.wait_for(self.repository.async_info(), timeout=3)
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["items"], []
        )

    async def test_mixed_receipt_saves_both_items_and_reports_only_missing_retail(self):
        from test_receipt_parser import MIXED_PRICE_HTML, MIXED_PRICE_TEXT, envelope

        await self.seed_library()
        first, second = library.ROWS[0]["title"], library.ROWS[1]["title"]
        body = MIXED_PRICE_TEXT.replace("Fictional Voyage", first).replace(
            "Second Film", second
        )
        html = MIXED_PRICE_HTML.replace("Fictional Voyage", first).replace(
            "Second Film", second
        )
        result = await self.repository.async_purchase_email(
            envelope(body, html_part={"content_type": "text/html", "part_data": html})
        )
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["imported_count"], 2)
        self.assertEqual(
            result["issues"], [{"title": second, "reason": "retail_price_missing"}]
        )
        records = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(records), 2)
        records_by_title = {row["title"]: row for row in records}
        self.assertEqual(records_by_title[first]["purchase_price"], "$18.00")
        self.assertEqual(records_by_title[first]["retail_price"], "$24.00")
        self.assertEqual(records_by_title[second]["purchase_price"], "$18.00")
        self.assertIsNone(records_by_title[second]["retail_price"])
        self.assertTrue(all(row["library_id"] for row in records))

    async def test_replaying_partial_receipt_fills_purchase_price_without_duplicate(
        self,
    ):
        from test_receipt_parser import SINGLE_PRICE_HTML, envelope

        target = await self.seed_library()
        title = library.ROWS[0]["title"]
        body = SINGLE_PRICE_HTML.replace("Fictional Voyage", title)
        partial = envelope(body.replace("<td>$18.00</td></tr>", "<td></td></tr>", 1))
        await self.repository.async_purchase_email(partial)
        original = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(original), 1)
        self.assertIsNone(original[0]["purchase_price"])
        self.assertEqual(original[0]["library_id"], target)

        result = await self.repository.async_purchase_email(envelope(body))
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], original[0]["id"])
        self.assertEqual(rows[0]["library_id"], target)
        self.assertEqual(rows[0]["purchase_price"], "$18.00")
        self.assertIsNone(rows[0]["retail_price"])
        self.assertIn(
            {"title": title, "reason": "retail_price_missing"}, result["issues"]
        )

    async def test_html_links_are_used_only_for_unique_exact_store_titles(self):
        document = """
          <a href="https://store.kaleidescape.com/movie-store/movie/details/123"><img></a>
          <a href="/movie-store/movie/details/123">Film &amp; Example</a>
          <a href="https://store.kaleidescape.com/movie-store/movie/details/456">Ambiguous</a>
          <a href="https://store.kaleidescape.com/movie-store/movie/details/789">Ambiguous</a>
          <a href="https://attacker.invalid/movie-store/movie/details/999">
            Wrong Host</a>
        """
        email = invoice(
            movie("Film & Example"), movie("Ambiguous"), movie("Wrong Host")
        )
        email["html_part"] = {
            "content_type": "text/html",
            "content_transfer_encoding": "base64",
            "part_data": base64.b64encode(document.encode()).decode(),
        }
        records = {row["title"]: row for row in normalize(email)}
        self.assertEqual(
            records["Film & Example"]["href"], "/movie-store/movie/details/123"
        )
        self.assertIsNone(records["Ambiguous"]["href"])
        self.assertIsNone(records["Wrong Host"]["href"])
        email["purchases"][0]["href"] = "/movie-store/movie/details/999"
        self.assertEqual(normalize(email)[0]["href"], "/movie-store/movie/details/999")

    async def test_unmatched_receipt_is_saved_then_linked_after_library_sync(self):
        email = invoice(movie(library.ROWS[0]["title"]))
        result = await self.repository.async_purchase_email(email)
        self.assertEqual(result["status"], "needs_review")
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["library_id"])
        await self.repository.async_purchase_email(email)
        self.assertEqual(
            len((await self.repository.async_inspect("purchase_records"))["items"]), 1
        )
        target = await self.seed_library()
        plan = await self.repository.async_purchase_reconciliation("admin")
        key = plan["rows"][0]["key"]
        matched = await self.repository.async_import_match(
            plan["plan_id"], plan["revision"], key, target, "admin"
        )
        await self.repository.async_import_apply(
            str(__import__("uuid").uuid4()),
            matched["plan_id"],
            matched["revision"],
            [key],
            actor_id="admin",
        )
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["library_id"], target)
        self.assertEqual(
            await self.repository.async_purchase_reconciliation("admin"),
            {"empty": True},
        )

    async def test_receipt_with_html_link_can_be_replayed_without_duplicate(self):
        email = invoice(movie("Unscanned title"))
        email["html_part"] = {
            "content_type": "text/html",
            "content_transfer_encoding": "quoted-printable",
            "part_data": (
                '<a href=3D"https://store.kaleidescape.com/movie-store/'
                'movie/details/123">Unscanned title</a>'
            ),
        }
        await self.repository.async_purchase_email(email)
        result = await self.repository.async_purchase_email(email)
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["href"], "/movie-store/movie/details/123")
        self.assertEqual(result["status"], "needs_review")

    async def test_unmatched_receipt_is_in_both_backup_formats(self):
        from custom_components.kaleidescape_companion.core.importing import parse_bundle

        await self.repository.async_purchase_email(invoice(movie("Unscanned title")))
        for kind in ("json", "sqlite"):
            async with self.repository.async_export_snapshot(kind) as path:
                records = parse_bundle(path.read_bytes(), kind)["purchases"]
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["title"], "Unscanned title")
            self.assertIsNone(records[0]["library_id"])

    async def test_replayed_unmatched_receipt_reports_changed_price(self):
        email = invoice(movie("Unscanned title"))
        await self.repository.async_purchase_email(email)
        email["purchases"][0]["purchase_price"] = "$3.99"
        result = await self.repository.async_purchase_email(email)
        self.assertEqual(result["issues"][0]["reason"], "conflict")
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["purchase_price"], "$9.99")

    async def test_schema_24_moves_embedded_history_to_purchase_table(self):
        import sqlite3

        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )

        target = await self.seed_library()
        item = normalize(invoice(movie(library.ROWS[0]["title"])))[0]
        keys = (
            "id",
            "title",
            "purchased_on",
            "purchase_price",
            "retail_price",
            "order_id",
            "href",
        )
        stored = {key: item[key] for key in keys}
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("DROP TABLE purchase_records")
            db.execute(
                "ALTER TABLE library ADD COLUMN purchase_history "
                "TEXT NOT NULL DEFAULT '[]'"
            )
            db.execute(
                "UPDATE library SET purchase_history=?,purchase_price=?,"
                "retail_price=? WHERE id=?",
                (
                    json.dumps([stored]),
                    stored["purchase_price"],
                    stored["retail_price"],
                    target,
                ),
            )
            db.execute("DROP TABLE purchase_identity_barriers")
            db.execute("DROP TABLE purchase_repair_events")
            remove_collection_queue_schema(db)
            db.execute("PRAGMA user_version=24")
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(
            (rows[0]["library_id"], rows[0]["purchase_price"]),
            (target, stored["purchase_price"]),
        )
        columns = await self.repository._call(
            lambda: [
                row[1]
                for row in self.repository._db().execute("PRAGMA table_info(library)")
            ]
        )
        self.assertNotIn("purchase_history", columns)
        self.assertTrue(list(self.path.parent.glob("*.v24.*.bak")))

    async def test_single_import_replay_conflict_and_serialized_json(self):
        await self.seed_library()
        email = invoice(movie(library.ROWS[0]["title"]))
        result = await self.repository.async_purchase_email(json.dumps(email))
        self.assertEqual((result["status"], result["imported_count"]), ("imported", 1))
        again = await self.repository.async_purchase_email(email)
        self.assertEqual(again["status"], "unchanged")
        email["purchases"][0]["purchase_price"] = "$3.99"
        conflict = await self.repository.async_purchase_email(email)
        self.assertEqual(conflict["status"], "needs_review")
        self.assertEqual(conflict["issues"][0]["reason"], "conflict")
        entries = (await self.repository.async_inspect("library", limit=100))["items"]
        self.assertEqual(
            next(
                row["purchase_price"]
                for row in entries
                if row["purchase_history"] != "[]"
            ),
            "$9.99",
        )

    async def test_bundle_imports_matches_and_retains_unmatched_for_review(self):
        await self.seed_library()
        item = movie(
            "Set",
            purchase_price="$10.00",
            retail_price="$12.01",
            included_titles=[{"title": library.ROWS[0]["title"]}, {"title": "Missing"}],
        )
        email = invoice(item)
        records = normalize(email)
        self.assertEqual(
            sum(
                int(row["purchase_price"].replace("$", "").replace(".", ""))
                for row in records
            ),
            1000,
        )
        self.assertEqual(
            sum(
                int(row["retail_price"].replace("$", "").replace(".", ""))
                for row in records
            ),
            1201,
        )
        item["included_titles"].reverse()
        self.assertEqual(records, normalize(email))
        result = await self.repository.async_purchase_email(email)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(len(result["review_records"]), 1)
        self.assertEqual(result["review_records"][0]["title"], "Missing")
        rows = (await self.repository.async_inspect("library", limit=100))["items"]
        self.assertEqual(sum(row["purchase_history"] != "[]" for row in rows), 1)
        retry = await self.repository.async_purchase_email(email)
        self.assertEqual(retry["status"], "needs_review")
        self.assertEqual((retry["imported_count"], retry["unchanged_count"]), (0, 1))
        self.assertEqual(retry["review_records"], result["review_records"])

    async def test_no_response_mode_still_saves_receipt(self):
        await self.seed_library()
        email = invoice(movie(library.ROWS[0]["title"]), movie("Missing"))
        result = await self.repository.async_purchase_email(email, allow_partial=False)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(len(result["review_records"]), 2)
        rows = (await self.repository.async_inspect("library", limit=100))["items"]
        self.assertEqual(sum(row["purchase_history"] != "[]" for row in rows), 1)
        self.assertEqual(
            len((await self.repository.async_inspect("purchase_records"))["items"]), 2
        )

    async def test_store_price_fills_only_missing_retail_and_survives_invoice(self):
        from custom_components.kaleidescape_companion.library.purchases import (
            fill_retail_price,
        )

        target = await self.seed_library()
        await self.repository._call(
            lambda: fill_retail_price(self.repository._db(), target, "$25.00")
        )
        email = invoice(movie(library.ROWS[0]["title"], retail_price=None))
        await self.repository.async_purchase_email(email)
        await self.repository._call(
            lambda: fill_retail_price(self.repository._db(), target, "$99.00")
        )
        entries = (await self.repository.async_inspect("library", limit=100))["items"]
        row = next(row for row in entries if row["id"] == target)
        self.assertEqual(
            (row["purchase_price"], row["retail_price"]), ("$9.99", "$25.00")
        )
        self.assertEqual(
            json.loads(row["purchase_history"])[0]["retail_price"], "$25.00"
        )

    async def test_email_conflicting_with_manual_price_needs_review(self):
        from uuid import uuid4

        target = await self.seed_library()
        review = await self.repository.async_library_edit(library.SOURCE, target)
        await self.repository.async_library_edit(
            library.SOURCE,
            target,
            "admin",
            str(uuid4()),
            review["snapshot"],
            {"purchased_on": "2020-01-02", "purchase_price": "$5.00"},
        )
        result = await self.repository.async_purchase_email(
            invoice(movie(library.ROWS[0]["title"]))
        )
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["issues"][0]["reason"], "conflict")
        row = next(
            row
            for row in (await self.repository.async_inspect("library"))["items"]
            if row["id"] == target
        )
        self.assertEqual(row["purchase_price"], "$5.00")
        self.assertEqual(row["purchase_history"], "[]")
        saved = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(saved), 1)
        self.assertIsNone(saved[0]["library_id"])
        self.assertEqual(saved[0]["purchase_price"], "$9.99")
        plan = await self.repository.async_purchase_reconciliation("admin")
        choice = await self.repository.async_import_match(
            plan["plan_id"], plan["revision"], plan["rows"][0]["key"], target, "admin"
        )
        self.assertEqual(choice["row"]["action"], "skip")
        self.assertIn("purchase_price", choice["row"]["conflicts"])

    async def test_linked_invoice_owns_matching_manual_summary(self):
        from uuid import uuid4

        target = await self.seed_library()
        review = await self.repository.async_library_edit(library.SOURCE, target)
        await self.repository.async_library_edit(
            library.SOURCE,
            target,
            "admin",
            str(uuid4()),
            review["snapshot"],
            {"purchased_on": "2020-01-02", "purchase_price": "$9.99"},
        )
        await self.repository.async_purchase_email(
            invoice(movie(library.ROWS[0]["title"]))
        )
        raw = await self.repository._call(
            lambda: (
                self.repository._db()
                .execute(
                    "SELECT purchased_on,purchase_price FROM library WHERE id=?",
                    (target,),
                )
                .fetchone()
            )
        )
        self.assertEqual(tuple(raw), (None, None))

    async def test_conflict_does_not_block_other_matches(self):
        from uuid import uuid4

        target = await self.seed_library()
        review = await self.repository.async_library_edit(library.SOURCE, target)
        await self.repository.async_library_edit(
            library.SOURCE,
            target,
            "admin",
            str(uuid4()),
            review["snapshot"],
            {"purchased_on": "2020-01-02", "purchase_price": "$5.00"},
        )
        email = invoice(
            movie(library.ROWS[0]["title"]), movie(library.ROWS[1]["title"])
        )
        result = await self.repository.async_purchase_email(email)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["issues"][0]["reason"], "conflict")
        self.assertEqual(result["review_records"][0]["title"], library.ROWS[0]["title"])
        rows = (await self.repository.async_inspect("library"))["items"]
        self.assertEqual(
            next(row for row in rows if row["id"] == target)["purchase_price"], "$5.00"
        )
        self.assertEqual(sum(row["purchase_history"] != "[]" for row in rows), 1)

    async def test_large_receipt_imports_clear_titles_and_returns_ambiguous_titles(
        self,
    ):
        rows = []
        for index in range(96):
            versions = 2 if index >= 90 else 1
            for version in range(versions):
                rows.append(
                    {
                        **library.ROWS[0],
                        "title": f"Fictional film {index}",
                        "source_handle": f"film-{index}-{version}",
                        "source_group": f"film-{index}-{version}",
                        "year": 2000 + version,
                    }
                )
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        email = invoice(*(movie(f"Fictional film {index}") for index in range(96)))
        result = await self.repository.async_purchase_email(email)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["imported_count"], 90)
        self.assertEqual(len(result["issues"]), 6)
        self.assertEqual(len(result["review_records"]), 6)
        retry = await self.repository.async_purchase_email(email)
        self.assertEqual((retry["imported_count"], retry["unchanged_count"]), (0, 90))
        self.assertEqual(len(retry["review_records"]), 6)

    async def test_retail_only_export_can_be_imported_without_inventing_invoice(self):
        from custom_components.kaleidescape_companion.core.importing import parse_bundle
        from custom_components.kaleidescape_companion.library.purchases import (
            fill_retail_price,
        )

        target = await self.seed_library()
        await self.repository._call(
            lambda: fill_retail_price(self.repository._db(), target, "$25.00")
        )
        async with self.repository.async_export_snapshot("json") as path:
            document = path.read_bytes()
        parsed = parse_bundle(document, "json")
        self.assertEqual(parsed["purchases"], [])
        self.assertEqual(
            next(row for row in parsed["library"] if row["id"] == target)[
                "retail_price"
            ],
            "$25.00",
        )
        async with self.repository.async_import_slot():
            plan = await self.repository.async_import_preview(
                document, "json", actor_id="admin"
            )
        self.assertEqual(plan["counts"]["merge"], 0)

    async def test_enriched_receipt_requires_review_without_storing_duplicate(self):
        from custom_components.kaleidescape_companion.core.importing import parse_bundle

        await self.seed_library()
        original = invoice(movie(library.ROWS[1]["title"]))
        first = await self.repository.async_purchase_email(original)
        self.assertEqual(first["status"], "imported")
        self.assertEqual(
            (await self.repository.async_purchase_email(original))["status"],
            "unchanged",
        )
        enriched = invoice(
            movie(library.ROWS[1]["title"], href="/movie-store/movie/details/123")
        )
        result = await self.repository.async_purchase_email(enriched)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["issues"][0]["reason"], "possible_duplicate")
        self.assertEqual(result["imported_count"], 0)
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["total"], 1
        )
        self.assertEqual(
            result["review_records"][0]["href"], "/movie-store/movie/details/123"
        )
        # A different order for the same title/date remains a separate purchase.
        repeat = {**enriched, "order_id": "ORDER-2"}
        repeated = await self.repository.async_purchase_email(repeat)
        self.assertEqual(repeated["status"], "imported")
        async with self.repository.async_export_snapshot("sqlite") as path:
            self.assertEqual(
                len(parse_bundle(path.read_bytes(), "sqlite")["purchases"]), 2
            )

    async def test_changed_receipt_evidence_is_held_for_review(self):
        await self.seed_library()
        title = library.ROWS[1]["title"]
        base = invoice(movie(title))
        self.assertEqual(
            (await self.repository.async_purchase_email(base))["status"], "imported"
        )
        variants = (
            invoice(movie("Changed fictional title")),
            {**invoice(movie(title)), "purchased_on": "2020-01-03"},
            invoice(movie(title, href="/movie-store/movie/details/456")),
        )
        for changed in variants:
            with self.subTest(changed=changed):
                result = await self.repository.async_purchase_email(changed)
                self.assertEqual(result["issues"][0]["reason"], "possible_duplicate")
        self.assertEqual(
            (await self.repository.async_inspect("purchase_records"))["total"], 1
        )

    async def test_link_enrichment_without_order_does_not_double_count(self):
        await self.seed_library()
        title = library.ROWS[1]["title"]
        original = {**invoice(movie(title)), "order_id": None}
        first = await self.repository.async_purchase_email(original)
        self.assertEqual(first["status"], "imported")
        changed = {
            **invoice(movie(title, href="/movie-store/movie/details/321")),
            "order_id": None,
        }
        result = await self.repository.async_purchase_email(changed)
        self.assertEqual(result["issues"][0]["reason"], "possible_duplicate")
        totals = await self.repository.async_purchase_totals(library.SOURCE)
        self.assertEqual(totals["purchase_count"], 1)
        self.assertEqual(totals["currencies"][0]["library_cost"], "$9.99")

    async def test_raw_email_import_stores_only_selected_fields_and_round_trips(self):
        from test_receipt_parser import envelope

        from custom_components.kaleidescape_companion.core.importing import parse_bundle

        result = await self.repository.async_purchase_email(
            envelope(fields=["purchase-price"])
        )
        self.assertEqual(result["pending_count"], 2)
        rows = (await self.repository.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["purchased_on"] is None for row in rows))
        self.assertTrue(all(row["order_id"] is None for row in rows))
        self.assertTrue(all(row["retail_price"] is None for row in rows))
        self.assertEqual({row["purchase_price"] for row in rows}, {"$9.99", "$4.99"})
        self.assertTrue(all(row["href"] for row in rows))
        for kind in ("json", "sqlite"):
            async with self.repository.async_export_snapshot(kind) as path:
                parsed = parse_bundle(path.read_bytes(), kind)
            self.assertEqual(len(parsed["purchases"]), 2)
            self.assertTrue(
                all(row["purchased_on"] is None for row in parsed["purchases"])
            )
        with self.assert_error("invalid_request"):
            await self.repository.async_purchase_email(envelope(fields=[]))

    async def test_invalid_or_unreconciled_rejected_without_write(self):
        await self.seed_library()
        for email in (
            invoice(movie(library.ROWS[0]["title"], purchase_price="-$5.00")),
            {**invoice(movie("A")), "prices_reconciled": False},
            invoice(movie("A"), movie("A")),
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_purchase_email(email)
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.repository.async_purchase_email(invoice(movie("A")))


class ServiceTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        patcher = patch(
            "custom_components.kaleidescape_companion.services._LOGGER.warning"
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_action_permissions_and_review_response(self):
        hass = SimpleNamespace(
            services=SimpleNamespace(async_register=Mock()),
            auth=SimpleNamespace(async_get_user=AsyncMock()),
        )
        async_register_services(hass)
        handler = hass.services.async_register.call_args.args[2]
        repo = SimpleNamespace(
            async_purchase_email=AsyncMock(
                return_value={
                    "status": "needs_review",
                    "review_records": [],
                    "issues": [{"reason": "conflict"}],
                }
            )
        )
        runtime = SimpleNamespace(repository=repo)
        with patch(
            "custom_components.kaleidescape_companion.services.loaded_runtimes",
            return_value=[("entry", runtime)],
        ):
            call = ServiceCall(
                hass,
                "kaleidescape_companion",
                "import_purchase_email",
                {"invoice": {}},
                return_response=True,
            )
            self.assertEqual((await handler(call))["status"], "needs_review")
            call.return_response = False
            with self.assertRaises(HomeAssistantError):
                await handler(call)
            call.context = Context(user_id="nonadmin")
            hass.auth.async_get_user.return_value = SimpleNamespace(
                is_active=True, is_admin=False
            )
            with self.assertRaises(HomeAssistantError):
                await handler(call)
            self.assertEqual(repo.async_purchase_email.await_count, 2)
            hass.auth.async_get_user.return_value = SimpleNamespace(
                is_active=True, is_admin=True
            )
            call.return_response = True
            self.assertEqual((await handler(call))["status"], "needs_review")
            self.assertEqual(hass.auth.async_get_user.await_count, 3)

    async def test_action_withholds_private_result_when_actor_or_runtime_changes(self):
        for change in ("inactive", "downgrade", "deleted", "unloaded", "replaced"):
            with self.subTest(change=change):
                user = SimpleNamespace(is_active=True, is_admin=True)
                hass = SimpleNamespace(
                    services=SimpleNamespace(async_register=Mock()),
                    auth=SimpleNamespace(async_get_user=AsyncMock(return_value=user)),
                )
                async_register_services(hass)
                handler = hass.services.async_register.call_args.args[2]
                current = []

                async def write(*args, **kwargs):
                    if change == "inactive":
                        user.is_active = False
                    elif change == "downgrade":
                        user.is_admin = False
                    elif change == "deleted":
                        hass.auth.async_get_user.return_value = None
                    elif change == "unloaded":
                        current.clear()
                    else:
                        current[:] = [("entry", SimpleNamespace())]
                    return {
                        "status": "needs_review",
                        "review_records": [{"title": "private"}],
                        "issues": [],
                    }

                repo = SimpleNamespace(
                    async_purchase_email=AsyncMock(side_effect=write)
                )
                runtime = SimpleNamespace(repository=repo)
                current.append(("entry", runtime))
                call = ServiceCall(
                    hass,
                    "kaleidescape_companion",
                    "import_purchase_email",
                    {"invoice": {}},
                    context=Context(user_id="fictional"),
                    return_response=True,
                )
                with patch(
                    "custom_components.kaleidescape_companion.services.loaded_runtimes",
                    side_effect=lambda _: list(current),
                ):
                    with self.assertRaises(HomeAssistantError) as caught:
                        await handler(call)
                self.assertIn("may have been saved", str(caught.exception))
                self.assertNotIn("private", str(caught.exception))
                repo.async_purchase_email.assert_awaited_once()


class ReceiptLoggingTest(unittest.IsolatedAsyncioTestCase):
    async def test_action_logs_full_receipt_and_specific_reasons(self):
        import tempfile
        from pathlib import Path

        from test_receipt_parser import envelope

        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )

        with tempfile.TemporaryDirectory() as directory:
            repo = JournalRepository(Path(directory) / "journal.sqlite3")
            await repo.async_open()
            self.addAsyncCleanup(repo.async_close)
            hass = SimpleNamespace(
                services=SimpleNamespace(async_register=Mock()),
                auth=SimpleNamespace(async_get_user=AsyncMock()),
                config=SimpleNamespace(time_zone="UTC"),
            )
            async_register_services(hass)
            handler = hass.services.async_register.call_args.args[2]
            raw = envelope(
                text=(
                    "Order ID PRIVATE-ORDER\nItem Quality Price\n"
                    "Fictional title $19.99\nSubtotal $19.99"
                ),
                html_part={
                    "content_type": "text/html",
                    "content_transfer_encoding": "base64",
                    "part_data": base64.b64encode(
                        b"<div>Order ID PRIVATE-ORDER</div><table><tr><td>"
                        b'<a href="/movie-store/movie/details/1">Fictional title</a>'
                        b"</td><td>$19.99</td></tr></table><!-- fictional html -->"
                    ).decode(),
                },
            )
            call = ServiceCall(
                hass,
                "kaleidescape_companion",
                "import_purchase_email",
                {"invoice": raw},
                return_response=True,
            )
            runtime = SimpleNamespace(repository=repo)
            with (
                patch(
                    "custom_components.kaleidescape_companion.services.loaded_runtimes",
                    return_value=[("entry", runtime)],
                ),
                self.assertLogs(
                    "custom_components.kaleidescape_companion.services", level="WARNING"
                ) as logs,
            ):
                result = await handler(call)
            self.assertEqual(result["status"], "needs_review")
            self.assertTrue(
                any(
                    issue.get("reason") == "retail_price_missing"
                    for issue in result["issues"]
                )
            )
            output = "\n".join(logs.output)
            self.assertIn(f"imported={result['imported_count']}", output)
            self.assertIn(f"pending={result['pending_count']}", output)
            self.assertLess(output.index("imported="), output.index("receipt="))
            self.assertIn("Fictional title", output)
            self.assertIn("PRIVATE-ORDER", output)
            self.assertIn("retail_price_missing", output)
            self.assertIn("$19.99", output)
            self.assertIn("fictional html", output)
            self.assertEqual(result["pending_count"], 1)
            self.assertEqual(result["extracted_records"][0]["title"], "Fictional title")

    async def test_html_only_action_saves_selected_fields_with_titles_and_links(self):
        import tempfile
        from pathlib import Path

        from test_receipt_parser import HTML, envelope

        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )

        with tempfile.TemporaryDirectory() as directory:
            repo = JournalRepository(Path(directory) / "journal.sqlite3")
            await repo.async_open()
            self.addAsyncCleanup(repo.async_close)
            hass = SimpleNamespace(
                services=SimpleNamespace(async_register=Mock()),
                auth=SimpleNamespace(async_get_user=AsyncMock()),
            )
            async_register_services(hass)
            handler = hass.services.async_register.call_args.args[2]
            part = {
                "content_type": "text/html",
                "content_transfer_encoding": "base64",
                "part_data": base64.b64encode(HTML.encode()).decode(),
            }
            payload = envelope(text="", fields=["transaction-id"], html_part=part)
            call = ServiceCall(
                hass,
                "kaleidescape_companion",
                "import_purchase_email",
                {"invoice": payload},
                return_response=True,
            )
            with (
                patch(
                    "custom_components.kaleidescape_companion.services.loaded_runtimes",
                    return_value=[("entry", SimpleNamespace(repository=repo))],
                ),
                self.assertLogs(
                    "custom_components.kaleidescape_companion.services", level="WARNING"
                ),
            ):
                result = await handler(call)
            self.assertEqual(result["pending_count"], 2)
            records = (await repo.async_inspect("purchase_records"))["items"]
            self.assertEqual(
                {row["title"] for row in records}, {"Fictional Voyage", "Second Film"}
            )
            self.assertTrue(
                all(row["href"] and row["order_id"] == "ORDER-123" for row in records)
            )
            self.assertTrue(
                all(
                    row["purchased_on"] is None
                    and row["purchase_price"] is None
                    and row["retail_price"] is None
                    for row in records
                )
            )

    async def test_empty_selection_is_rejected_by_the_action(self):
        import tempfile
        from pathlib import Path

        from test_receipt_parser import envelope

        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )

        with tempfile.TemporaryDirectory() as directory:
            repo = JournalRepository(Path(directory) / "journal.sqlite3")
            await repo.async_open()
            self.addAsyncCleanup(repo.async_close)
            hass = SimpleNamespace(
                services=SimpleNamespace(async_register=Mock()),
                auth=SimpleNamespace(async_get_user=AsyncMock()),
            )
            async_register_services(hass)
            handler = hass.services.async_register.call_args.args[2]
            call = ServiceCall(
                hass,
                "kaleidescape_companion",
                "import_purchase_email",
                {"invoice": envelope(fields=[])},
                return_response=True,
            )
            with (
                patch(
                    "custom_components.kaleidescape_companion.services.loaded_runtimes",
                    return_value=[("entry", SimpleNamespace(repository=repo))],
                ),
                self.assertLogs(
                    "custom_components.kaleidescape_companion.services", level="WARNING"
                ),
            ):
                with self.assertRaisesRegex(HomeAssistantError, "Select at least one"):
                    await handler(call)
            self.assertEqual((await repo.async_inspect("purchase_records"))["total"], 0)

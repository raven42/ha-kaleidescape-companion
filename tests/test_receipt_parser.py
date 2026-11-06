"""Fictional IMAP messages exercise the Python receipt extraction boundary."""

import base64
import unittest
from itertools import combinations

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library.purchase_email import (
    SELECTABLE_FIELDS,
)
from custom_components.kaleidescape_companion.library.receipt_parser import (
    parse_receipt,
)

TEXT = """Order ID ORDER-123
Order Date: October 13, 2026
Item Quality Price
[image: Cover]
Fictional Voyage <https://store.kaleidescape.com/movie-store/movie/details/123>
$19.99 $9.99
[image: Cover]
Second Film <https://store.kaleidescape.com/movie-store/movie/details/456> $14.99 $4.99
Subtotal $14.98
Taxes $1.00
Total $15.98
"""
HTML = (
    "<html><body><div>Order ID ORDER-123</div>"
    "<div>Order Date: October 13, 2026</div>"
    "<table><tr><th>Item</th><th>Quality</th><th>Price</th></tr>"
    '<tr><td><a href="https://store.kaleidescape.com/movie-store/movie/details/123">'
    "Fictional Voyage</a></td><td>HD</td><td>$19.99 $9.99</td></tr>"
    '<tr><td><a href="/movie-store/movie/details/456">Second Film</a></td>'
    "<td>4K</td><td>$14.99 $4.99</td></tr>"
    "<tr><td>Subtotal $14.98</td></tr></table></body></html>"
)


def envelope(text=TEXT, fields=None, **kwargs):
    return {
        "source": "kaleidescape",
        "email": {
            "text": text,
            "subject": "Kaleidescape Store Receipt",
            "date": "2026-10-13T12:00:00+00:00",
        },
        "selected_fields": sorted(SELECTABLE_FIELDS) if fields is None else fields,
        **kwargs,
    }


class ReceiptParserTest(unittest.TestCase):
    def test_every_nonempty_selection_saves_only_requested_fields(self):
        options = sorted(SELECTABLE_FIELDS)
        for count in range(1, len(options) + 1):
            for selected in combinations(options, count):
                with self.subTest(selected=selected):
                    records, _issues = parse_receipt(envelope(fields=list(selected)))
                    self.assertEqual(len(records), 2)
                    row = records[0]
                    self.assertEqual(row["title"], "Fictional Voyage")
                    self.assertEqual(row["href"], "/movie-store/movie/details/123")
                    for key, name, expected in (
                        ("transaction-id", "order_id", "ORDER-123"),
                        ("purchase-date", "purchased_on", "2026-10-13"),
                        ("purchase-price", "purchase_price", "$9.99"),
                        ("retail-price", "retail_price", "$19.99"),
                    ):
                        self.assertEqual(
                            row[name], expected if key in selected else None
                        )

    def test_empty_or_unknown_field_selection_is_rejected(self):
        for fields in ([], ["title"], ["purchase-date", "purchase-date"]):
            with self.subTest(fields=fields), self.assertRaises(JournalError):
                parse_receipt(envelope(fields=fields))

    def test_parsed_receipts_honor_selection_and_require_at_least_one(self):
        from custom_components.kaleidescape_companion.library.purchase_email import (
            normalize,
        )

        payload = {
            "source": "kaleidescape",
            "order_id": "ORDER-1",
            "purchased_on": "2020-01-02",
            "selected_fields": ["retail-price"],
            "purchases": [
                {
                    "title": "Fictional",
                    "href": "/movie-store/movie/details/3",
                    "purchase_price": "$5.00",
                    "retail_price": "$9.00",
                }
            ],
        }
        record = normalize(payload)[0]
        self.assertEqual(record["title"], "Fictional")
        self.assertEqual(record["href"], "/movie-store/movie/details/3")
        self.assertEqual(record["retail_price"], "$9.00")
        self.assertIsNone(record["purchase_price"])
        self.assertIsNone(record["order_id"])
        self.assertIsNone(record["purchased_on"])
        payload["selected_fields"] = []
        with self.assertRaises(JournalError):
            normalize(payload)

    def test_original_html_with_encoded_part(self):
        part = {
            "content_type": "text/html",
            "content_transfer_encoding": "base64",
            "part_data": base64.b64encode(HTML.encode()).decode(),
        }
        records, issues = parse_receipt(envelope(text="", html_part=part))
        self.assertEqual(
            [row["title"] for row in records], ["Fictional Voyage", "Second Film"]
        )
        self.assertEqual([row["purchase_price"] for row in records], ["$9.99", "$4.99"])
        self.assertEqual(records[1]["href"], "/movie-store/movie/details/456")
        self.assertFalse(issues)

    def test_original_html_with_cover_and_title_links_parses_one_item(self):
        html = (
            "<div>Order ID ORDER-123</div><div>Order Date: October 13, 2026</div>"
            "<table><tr><th>Item</th><th>Quality</th><th>Price</th></tr>"
            '<tr><td><a href="/movie-store/movie/details/123">'
            '<img alt="Cover"></a></td>'
            '<td><a href="/movie-store/movie/details/123">Fictional Voyage</a></td>'
            "<td>HD</td><td>$19.99 $9.99</td></tr>"
            "<tr><td>Subtotal $9.99</td></tr></table>"
        )
        records, issues = parse_receipt(envelope(text=html))
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Fictional Voyage")
        self.assertEqual(records[0]["href"], "/movie-store/movie/details/123")
        self.assertEqual(records[0]["purchase_price"], "$9.99")
        self.assertEqual(issues, [])

    def test_missing_heading_uses_store_links_with_review_warning(self):
        body = TEXT.replace("Item Quality Price\n", "")
        records, issues = parse_receipt(envelope(body))
        self.assertEqual(
            [row["title"] for row in records], ["Fictional Voyage", "Second Film"]
        )
        self.assertIn({"reason": "item_section_missing"}, issues)

    def test_currency_and_untrusted_links(self):
        body = TEXT.replace("$", "£").replace(
            "https://store.kaleidescape.com/movie-store/movie/details/123",
            "https://attacker.invalid/movie-store/movie/details/123",
        )
        records, issues = parse_receipt(envelope(body))
        self.assertEqual(records[0]["purchase_price"], "£9.99")
        self.assertIsNone(records[0]["href"])
        self.assertIn(
            {"title": "Fictional Voyage", "reason": "store_link_missing"}, issues
        )

    def test_hidden_html_content_does_not_change_visible_prices(self):
        html = HTML.replace(
            "$19.99 $9.99", '<span style="display:none">$999.99</span>$19.99 $9.99'
        )
        records, issues = parse_receipt(envelope(text=html))
        self.assertEqual(records[0]["purchase_price"], "$9.99")
        self.assertEqual(records[0]["retail_price"], "$19.99")
        self.assertFalse(issues)

    def test_relative_store_link_and_title_words_are_preserved(self):
        body = TEXT.replace("Fictional Voyage", "HD Fictional Voyage").replace(
            "https://store.kaleidescape.com/movie-store/movie/details/123",
            "/movie-store/movie/details/123",
        )
        records, _ = parse_receipt(envelope(text=body))
        self.assertEqual(records[0]["title"], "HD Fictional Voyage")
        self.assertEqual(records[0]["href"], "/movie-store/movie/details/123")

    def test_partial_rows_and_total_discrepancies_do_not_discard_other_items(self):
        body = TEXT.replace("$14.99 $4.99", "$14.99").replace(
            "Total $15.98", "Total $16.98"
        )
        records, issues = parse_receipt(envelope(text=body))
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["purchase_price"], "$9.99")
        self.assertIsNone(records[1]["purchase_price"])
        self.assertIn(
            {"title": "Second Film", "reason": "purchase_price_missing"}, issues
        )
        self.assertIn({"reason": "total_mismatch"}, issues)

    def test_malformed_total_does_not_discard_valid_items(self):
        body = TEXT.replace("Subtotal $14.98", "Subtotal $1,2.98")
        records, issues = parse_receipt(envelope(body))
        self.assertEqual(len(records), 2)
        self.assertIn({"reason": "invalid_total"}, issues)

    def test_invalid_or_ambiguous_prices_are_not_invented(self):
        for prices in ("$19.99 -$9.99", "$19.99 $1,2.99", "$19.99 $9.99 $4.99"):
            with self.subTest(prices=prices):
                body = TEXT.replace("$19.99 $9.99", prices)
                records, issues = parse_receipt(envelope(text=body))
                first = next(
                    row for row in records if row["title"] == "Fictional Voyage"
                )
                self.assertIsNone(first["purchase_price"])
                self.assertIsNone(first["retail_price"])
                self.assertTrue(
                    any(
                        issue["reason"] in {"invalid_price", "ambiguous_price"}
                        for issue in issues
                    )
                )
                self.assertEqual(records[1]["purchase_price"], "$4.99")

    def test_forwarded_quote_uses_original_date_and_repeated_title_links(self):
        receipt = """From: Kaleidescape Movie Store <store@kaleidescape.com>
Date: Tue, Oct 13, 2026 at 9:01 AM
Item Quality Price
[image: Cover]
<https://store.kaleidescape.com/movie-store/movie/details/123> The Fictional
Voyage Beyond
<https://store.kaleidescape.com/movie-store/movie/details/123> [image: HD] $19.99 $9.99
[image: Cover]
<https://store.kaleidescape.com/movie-store/movie/details/456> Another Film
<https://store.kaleidescape.com/movie-store/movie/details/456> [image: 4K] $14.99 $4.99
Subtotal $14.98
Taxes $1.00
Total $15.98"""
        body = "\n".join("> > " + line for line in receipt.splitlines())
        data = envelope(text=body)
        data["email"]["subject"] = "Fwd: Kaleidescape Store Receipt"
        records, issues = parse_receipt(data)
        self.assertEqual(
            [row["title"] for row in records],
            ["The Fictional Voyage Beyond", "Another Film"],
        )
        self.assertTrue(all(row["purchased_on"] == "2026-10-13" for row in records))
        self.assertEqual([row["purchase_price"] for row in records], ["$9.99", "$4.99"])
        self.assertEqual(issues, [{"reason": "order_id_missing"}])

    def test_html_recovers_unique_links_for_plain_text_items(self):
        from test_automation_blueprints import UNLINKED_BODY

        html = (
            '<a href="https://store.kaleidescape.com/movie-store/movie/details/123">'
            "The Fictional Voyage</a>"
        )
        part = {"content_type": "text/html", "part_data": html}
        records, issues = parse_receipt(envelope(text=UNLINKED_BODY, html_part=part))
        self.assertEqual(len(records), 3)
        self.assertEqual(records[0]["href"], "/movie-store/movie/details/123")
        self.assertEqual(
            sum(issue["reason"] == "store_link_missing" for issue in issues), 2
        )

    def test_forward_date_is_not_mistaken_for_purchase_date(self):
        body = TEXT.replace("Order Date: October 13, 2026\n", "")
        payload = envelope(body)
        payload["email"]["subject"] = "Fwd: Kaleidescape Store Receipt"
        records, issues = parse_receipt(payload)
        self.assertEqual(len(records), 2)
        self.assertTrue(all(row["purchased_on"] is None for row in records))
        self.assertIn({"reason": "purchase_date_missing"}, issues)

    def test_html_failure_and_no_items_are_actionable(self):
        records, issues = parse_receipt(
            envelope("unsupported message", html_expected=True)
        )
        self.assertEqual(records, [])
        self.assertIn({"reason": "html_part_unavailable"}, issues)
        self.assertIn({"reason": "no_items_found"}, issues)
        records, issues = parse_receipt(envelope("", html_expected=True))
        self.assertEqual(records, [])
        self.assertIn({"reason": "email_body_missing"}, issues)
        self.assertIn({"reason": "html_part_unavailable"}, issues)


class ReceiptMigrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_schema_25_is_backed_up_and_existing_invoices_survive(self):
        import sqlite3
        import tempfile
        from contextlib import closing
        from pathlib import Path
        from unittest.mock import patch

        from custom_components.kaleidescape_companion.core import migrations
        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )
        from custom_components.kaleidescape_companion.library.purchase_email import (
            normalize,
        )

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "journal.sqlite3"
            with patch.object(migrations, "SCHEMA_VERSION", 25):
                original = JournalRepository(path)
                await original.async_open()
                record = normalize(
                    {
                        "source": "kaleidescape",
                        "purchased_on": "2020-01-02",
                        "order_id": "fixture",
                        "purchases": [
                            {"title": "Fictional", "purchase_price": "$9.99"}
                        ],
                    }
                )[0]

                def insert():
                    with original._db() as db:
                        db.execute(
                            "INSERT INTO purchase_records "
                            "(id,title,purchased_on,purchase_price,retail_price,order_id,"
                            "href,imported_at,library_id,issue) "
                            "VALUES (?,?,?,?,?,?,?,?,?,?)",
                            (
                                record["id"],
                                record["title"],
                                record["purchased_on"],
                                record["purchase_price"],
                                None,
                                record["order_id"],
                                None,
                                "2020-01-02T00:00:00+00:00",
                                None,
                                "unmatched",
                            ),
                        )

                await original._call(insert)
                await original.async_close()
            upgraded = JournalRepository(path)
            await upgraded.async_open()
            try:
                self.assertEqual((await upgraded.async_info())["schema_version"], 26)
                rows = (await upgraded.async_inspect("purchase_records"))["items"]
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["id"], record["id"])
                result = await upgraded.async_purchase_email(
                    envelope(fields=["purchase-price"])
                )
                self.assertEqual(result["pending_count"], 2)
                with closing(sqlite3.connect(path)) as db:
                    self.assertEqual(
                        db.execute("PRAGMA foreign_key_check").fetchall(), []
                    )
                self.assertEqual(
                    len(list(path.parent.glob("journal.sqlite3.v25.*.bak"))), 1
                )
            finally:
                await upgraded.async_close()

"""Fictional IMAP messages exercise the Python receipt extraction boundary."""

import base64
import quopri
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
    "Fictional Voyage</a></td><td>HD</td><td><s>$19.99</s> $9.99</td></tr>"
    '<tr><td><a href="/movie-store/movie/details/456">Second Film</a></td>'
    "<td>4K</td><td><s>$14.99</s> $4.99</td></tr>"
    "<tr><td>Subtotal $14.98</td></tr></table></body></html>"
)
SINGLE_PRICE_TEXT = """Order ID ORDER-456
Order Date: October 13, 2026
Item Quality Price
[image: Cover]
Fictional Voyage <https://store.kaleidescape.com/movie-store/movie/details/123>
[image: HD]
$18.00
Subtotal $18.00
Taxes $1.50
Total $19.50
"""
SINGLE_PRICE_HTML = """<html><body><div>Order ID ORDER-456</div>
<div>Order Date: October 13, 2026</div><table><tr><td><table>
<thead><tr><th>Item</th><th>Quality</th><th></th><th>Price</th></tr></thead>
<tbody><tr><td><a href="https://store.kaleidescape.com/movie-store/movie/details/123">
Fictional Voyage</a></td><td><img alt="HD"></td>
<td style="text-decoration: line-through"></td><td>$18.00</td></tr>
<tr><td>Subtotal</td><td>$18.00</td></tr>
<tr><td>Taxes</td><td>$1.50</td></tr><tr><td>Total</td><td>$19.50</td></tr>
</tbody></table></td></tr></table></body></html>"""
MIXED_PRICE_TEXT = """Order ID ORDER-789
Order Date: October 13, 2026
Item Quality Price
Fictional Voyage
$24.00
$18.00
Second Film
$18.00
Subtotal $36.00
Taxes $3.00
Total $39.00
"""
MIXED_PRICE_HTML = """<html><body><div>Order ID ORDER-789</div>
<div>Order Date: October 13, 2026</div><table><tr><td><table>
<thead><tr><th>Item</th><th></th><th>Quality</th><th></th><th>Price</th></tr></thead>
<tbody><tr><td><a href="/movie-store/movie/details/123"><img alt="Cover"></a></td>
<td><a href="/movie-store/movie/details/123">Fictional Voyage</a></td>
<td><img alt="HD"></td><td style="text-decoration: line-through">$24.00</td>
<td>$18.00</td></tr>
<tr><td><a href="/movie-store/movie/details/456"><img alt="Cover"></a></td>
<td><a href="/movie-store/movie/details/456">Second Film</a></td>
<td><img alt="HD"></td><td style="text-decoration: line-through"></td>
<td>$18.00</td></tr>
<tr><td>Subtotal</td><td>$36.00</td></tr>
<tr><td>Taxes</td><td>$3.00</td></tr><tr><td>Total</td><td>$39.00</td></tr>
</tbody></table></td></tr></table></body></html>"""


def envelope(text=TEXT, fields=None, **kwargs):
    if "html_part" not in kwargs:
        if text == TEXT:
            kwargs["html_part"] = {"content_type": "text/html", "part_data": HTML}
        elif "<table" in text.lower():
            kwargs["html_part"] = {"content_type": "text/html", "part_data": text}
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
    def test_html_is_required_and_text_is_never_imported(self):
        records, issues = parse_receipt(envelope(TEXT, html_part=None))
        self.assertEqual(records, [])
        self.assertEqual(issues, [{"reason": "html_part_unavailable"}])
        records, issues = parse_receipt(
            envelope(
                TEXT,
                html_part={
                    "content_type": "text/html",
                    "part_data": "<p>not a receipt</p>",
                },
            )
        )
        self.assertEqual(records, [])
        self.assertEqual(issues, [{"reason": "html_items_unavailable"}])

    def test_nested_price_rows_are_associated_with_the_owning_movie(self):
        html = """<div>Order ID ORDER-1</div><table>
        <tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">First</a></td><td>
        <table><tr><td><s>$20.00</s></td><td>$7.00</td></tr></table></td></tr>
        <tr><td><a href="/movie-store/movie/details/102">Second</a></td>
        <td><s>$15.00</s> $5.00</td></tr></table>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(
            [(r["title"], r["purchase_price"], r["retail_price"]) for r in records],
            [("First", "$7.00", "$20.00"), ("Second", "$5.00", "$15.00")],
        )
        self.assertEqual(issues, [])



    def test_html_rows_identify_struck_retail_and_paid_price_independent_of_order(self):
        html = """<html><body><div>Order ID ORDER-321</div>
        <div>Order Date: October 13, 2026</div>
        <table><tr><th>Item</th><th>Price</th></tr>
          <tr><td><a href="/movie-store/movie/details/101">Fictional One</a></td>
              <td>$7.00</td><td><span class="line-through">$20.00</span></td></tr>
          <tr><td><a href="/movie-store/movie/details/102">Fictional Two</a></td>
              <td><s>$25.00</s></td><td>$8.00</td></tr>
          <tr><td><a href="/movie-store/movie/details/103">Fictional Three</a></td>
              <td>$9.00</td><td style="text-decoration: line-through"></td></tr>
        </table></body></html>"""
        # Deliberately conflicting text has the same item count; HTML is authoritative.
        text = """Order ID ORDER-321
Order Date: October 13, 2026
Item Quality Price
Fictional One $7.00 $20.00
Fictional Two $25.00 $8.00
Fictional Three $9.00
"""
        part = {"content_type": "text/html", "part_data": html}
        for body in (text, ""):
            with self.subTest(text_present=bool(body)):
                records, issues = parse_receipt(envelope(body, html_part=part))
                self.assertEqual(
                    [record["title"] for record in records],
                    ["Fictional One", "Fictional Two", "Fictional Three"],
                )
                self.assertEqual(
                    [record["purchase_price"] for record in records],
                    ["$7.00", "$8.00", "$9.00"],
                )
                self.assertEqual(
                    [record["retail_price"] for record in records],
                    ["$20.00", "$25.00", None],
                )
                self.assertEqual(
                    issues,
                    [{"title": "Fictional Three", "reason": "retail_price_missing"}],
                )

    def test_html_table_uses_purchase_rows_not_unrelated_movie_recommendations(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><td><a href="/movie-store/movie/details/999">Suggested Film</a></td>
        <td>$9.00</td></tr></table>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">Purchased Film</a></td>
        <td><span style="display:none">$999.00</span>$7.00</td></tr></table>
        </body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual([row["title"] for row in records], ["Purchased Film"])
        self.assertEqual(records[0]["purchase_price"], "$7.00")
        self.assertEqual(
            issues, [{"title": "Purchased Film", "reason": "retail_price_missing"}]
        )

    def test_html_finds_movie_rows_across_multiple_tables_before_subtotal(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><td><a href="/movie-store/movie/details/999">Suggested</a></td>
        <td>$9.00</td></tr></table>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">First Film</a></td>
        <td>$7.00</td></tr></table>
        <table><tr><td><a href="/movie-store/movie/details/102">Second Film</a></td>
        <td>$8.00</td></tr></table>
        <table><tr><td>Subtotal</td><td>$15.00</td></tr></table>
        <table><tr><td><a href="/movie-store/movie/details/998">Also Suggested</a></td>
        <td>$8.00</td></tr></table></body></html>"""
        for header in ("th", "td"):
            with self.subTest(header=header):
                body = html.replace("<th>", f"<{header}>").replace(
                    "</th>", f"</{header}>"
                )
                records, issues = parse_receipt(envelope(body))
                self.assertEqual(
                    [row["title"] for row in records], ["First Film", "Second Film"]
                )
                self.assertEqual(
                    [row["purchase_price"] for row in records], ["$7.00", "$8.00"]
                )
                self.assertEqual(
                    [item["reason"] for item in issues], ["retail_price_missing"] * 2
                )

    def test_html_cover_link_and_unlinked_title_are_combined_within_row(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101"><img alt="Cover"></a></td>
        <td>Fictional Film</td><td>$7.00</td></tr></table></body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(records[0]["title"], "Fictional Film")
        self.assertEqual(records[0]["href"], "/movie-store/movie/details/101")
        self.assertEqual(records[0]["purchase_price"], "$7.00")
        self.assertEqual(
            issues, [{"title": "Fictional Film", "reason": "retail_price_missing"}]
        )

    def test_nested_inline_markup_preserves_strikethrough_for_the_whole_price(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">Fictional Film</a></td>
        <td><span style="text-decoration: line-through"><span>$20</span>.00</span></td>
        <td><span>$</span><span>7.00</span></td></tr></table></body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(records[0]["retail_price"], "$20.00")
        self.assertEqual(records[0]["purchase_price"], "$7.00")
        self.assertEqual(issues, [])

    def test_html_row_with_multiple_unmarked_prices_remains_ambiguous(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">Fictional Film</a></td>
        <td>$20.00 $7.00</td></tr></table></body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(len(records), 1)
        self.assertIsNone(records[0]["purchase_price"])
        self.assertIsNone(records[0]["retail_price"])
        self.assertEqual(
            {issue["reason"] for issue in issues},
            {"ambiguous_price", "purchase_price_missing", "retail_price_missing"},
        )

    def test_html_bundle_rows_are_allocated_to_included_movies(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/set/fictional-set">Fictional Set</a></td>
            <td><s>$20.00</s></td><td>$10.00</td></tr>
        <tr><td><a href="/movie-store/movie/details/101">First Film</a></td>
            <td>Included</td></tr>
        <tr><td><a href="/movie-store/movie/details/102">Second Film</a></td>
            <td>Included</td></tr>
        </table></body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(
            {row["title"] for row in records}, {"First Film", "Second Film"}
        )
        self.assertEqual({row["purchase_price"] for row in records}, {"$5.00"})
        self.assertEqual({row["retail_price"] for row in records}, {"$10.00"})
        self.assertEqual(issues, [])

    def test_html_bundle_with_nested_movie_rows_is_not_double_imported(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/set/fictional-set">Fictional Set</a>
          <table><tr><td><a href="/movie-store/movie/details/101">First Film</a></td>
          </tr><tr><td><a href="/movie-store/movie/details/102">Second Film</a></td>
          </tr></table>
        </td><td><del>$20.00</del></td><td>$10.00</td></tr>
        </table></body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(
            {row["title"] for row in records}, {"First Film", "Second Film"}
        )
        self.assertEqual(len(records), 2)
        self.assertEqual({row["purchase_price"] for row in records}, {"$5.00"})
        self.assertEqual(issues, [])

    def test_html_bundle_members_in_following_table_remain_in_the_set(self):
        html = """<html><body><div>Order ID ORDER-1</div>
        <table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/set/fictional-set">Fictional Set</a></td>
        <td><s>$20.00</s></td><td>$10.00</td></tr></table>
        <table><tr><td><a href="/movie-store/movie/details/101">First Film</a></td>
        <td>Included</td></tr>
        <tr><td><a href="/movie-store/movie/details/102">Second Film</a></td>
        <td>Included</td></tr></table>
        <table><tr><td>Subtotal</td><td>$10.00</td></tr></table>
        </body></html>"""
        records, issues = parse_receipt(envelope(html))
        self.assertEqual(
            {row["title"] for row in records}, {"First Film", "Second Film"}
        )
        self.assertEqual({row["purchase_price"] for row in records}, {"$5.00"})
        self.assertEqual(issues, [])

    def test_forwarded_html_table_uses_original_receipt_date(self):
        html = """<html><body><blockquote>
        <div>From: Kaleidescape Movie Store &lt;store@kaleidescape.com&gt;</div>
        <div>Date: Tue, Oct 13, 2026 at 9:01 AM</div>
        <div>Order ID ORDER-1</div><table><tr><th>Item</th><th>Price</th></tr>
        <tr><td><a href="/movie-store/movie/details/101">Fictional Film</a></td>
        <td>$7.00</td></tr></table></blockquote></body></html>"""
        payload = envelope(
            "", html_part={"content_type": "text/html", "part_data": html}
        )
        payload["email"]["subject"] = "Fwd: Kaleidescape Store Receipt"
        payload["email"]["date"] = "2026-10-20T12:00:00+00:00"
        records, issues = parse_receipt(payload)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["purchased_on"], "2026-10-13")
        self.assertEqual(records[0]["purchase_price"], "$7.00")
        self.assertEqual(
            issues, [{"title": "Fictional Film", "reason": "retail_price_missing"}]
        )

    def test_mixed_discounted_and_single_price_items_import_without_inventing_retail(
        self,
    ):
        part = {
            "content_type": "text/html",
            "content_transfer_encoding": "quoted-printable",
            "part_data": quopri.encodestring(MIXED_PRICE_HTML.encode()).decode(),
        }
        for text in (MIXED_PRICE_TEXT, ""):
            with self.subTest(text_present=bool(text)):
                records, issues = parse_receipt(envelope(text=text, html_part=part))
                self.assertEqual(
                    [item["title"] for item in records],
                    ["Fictional Voyage", "Second Film"],
                )
                self.assertEqual(
                    [item["purchase_price"] for item in records], ["$18.00", "$18.00"]
                )
                self.assertEqual(
                    [item["retail_price"] for item in records], ["$24.00", None]
                )
                self.assertEqual(
                    [item["href"] for item in records],
                    [
                        "/movie-store/movie/details/123",
                        "/movie-store/movie/details/456",
                    ],
                )
                self.assertEqual(
                    issues, [{"title": "Second Film", "reason": "retail_price_missing"}]
                )

    def test_single_item_price_is_confirmed_by_subtotal_for_text_and_html(self):
        part = {
            "content_type": "text/html",
            "content_transfer_encoding": "quoted-printable",
            "part_data": quopri.encodestring(SINGLE_PRICE_HTML.encode()).decode(),
        }
        for text, html in (
            ("", part),
            (SINGLE_PRICE_TEXT, part),
        ):
            with self.subTest(text=bool(text), html=bool(html)):
                records, issues = parse_receipt(envelope(text=text, html_part=html))
                self.assertEqual(len(records), 1)
                self.assertEqual(records[0]["purchase_price"], "$18.00")
                self.assertIsNone(records[0]["retail_price"])
                self.assertEqual(
                    issues,
                    [{"title": "Fictional Voyage", "reason": "retail_price_missing"}],
                )

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
            "<td>HD</td><td><s>$19.99</s> $9.99</td></tr>"
            "<tr><td>Subtotal $9.99</td></tr></table>"
        )
        records, issues = parse_receipt(envelope(text=html))
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Fictional Voyage")
        self.assertEqual(records[0]["href"], "/movie-store/movie/details/123")
        self.assertEqual(records[0]["purchase_price"], "$9.99")
        self.assertEqual(issues, [])

    def test_hidden_html_content_does_not_change_visible_prices(self):
        html = HTML.replace(
            "<s>$19.99</s> $9.99",
            '<span style="display:none">$999.99</span><s>$19.99</s> $9.99',
        )
        records, issues = parse_receipt(envelope(text=html))
        self.assertEqual(records[0]["purchase_price"], "$9.99")
        self.assertEqual(records[0]["retail_price"], "$19.99")
        self.assertFalse(issues)

    def test_html_failure_and_no_items_are_actionable(self):
        records, issues = parse_receipt(
            envelope("unsupported message", html_expected=True)
        )
        self.assertEqual(records, [])
        self.assertIn({"reason": "html_part_unavailable"}, issues)
        records, issues = parse_receipt(envelope("", html_expected=True))
        self.assertEqual(records, [])
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
                self.assertEqual((await upgraded.async_info())["schema_version"], 27)
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

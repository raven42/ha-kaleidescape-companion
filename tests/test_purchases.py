"""Fictional offline invoices, scoped corrections, permissions, and private copies."""

import hashlib
import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from html import escape
from io import StringIO
from pathlib import Path
from uuid import uuid4

import test_library as library

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library.config import collection_names
from custom_components.kaleidescape_companion.library.store import title_id
from custom_components.kaleidescape_companion.ui.preferences import validate
from dev.purchase_history import (
    DATE_BINDING,
    parse_history,
    parse_purchases,
)


def invoice(
    title="Voyage to Europa",
    date="October 12, 2025",
    *,
    rental=False,
    cancelled=False,
    pending=False,
):
    return f"""<div class="invoice"><div class="section">
    <div class="title"><span data-bind="visible: is_pending()"
    style="{"display:none" if not pending else ""}"></span></div>
    <div class="content"><span data-bind="{DATE_BINDING}">{date}</span>
    <table><tr class="{"cancelled" if cancelled else ""}"><th>
    <span data-bind="text: full_title">{title}</span>
    <span data-bind="visible: is_rental"
    style="{"display:none" if not rental else ""}">Rental</span>
    </th></tr></table></div></div></div>"""


def purchased_invoice(*, href="/movie-store/movie/fictional-voyage", bundled=False):
    """Fictional rendered fields, including prices hidden by the store's UI."""
    body = invoice("Fictional &amp; Zoë").replace(
        '<div class="title">',
        '<div class="title"><span data-bind="text: customer_invoice_number">'
        "ORDER-DEMO-123</span>",
    )
    return body.replace(
        '<span data-bind="text: full_title">Fictional &amp; Zoë</span>',
        f'<a href="{escape(href, quote=True)}">'
        '<span data-bind="text: full_title">Fictional &amp; Zoë</span></a>'
        '<span class="retail-price" data-bind="visible: movie_purchased, html: amount" '
        f'style="{"display:none" if bundled else ""}">$19.99</span>'
        '<span class="original_price" '
        'data-bind="visible: is_discount, html: original_amount" '
        'style="display:none">$24.99</span>',
    )


def offline_helper():
    spec = importlib.util.spec_from_file_location(
        "offline_purchases",
        Path(__file__).resolve().parents[1] / "dev/import_purchase_dates.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def bundle_rows(amount="$10.00", *, count=3, name="Fictional bundle"):
    """The saved page renders bundle headers before the included movie rows."""
    return (
        '<tbody><tr><th><a data-bind="attr: { href: collection_uri }">'
        f'<span data-bind="text: title">{escape(name)}</span></a></th>'
        f'<td><span data-bind="html: amount">{escape(amount)}</span></td>'
        "</tr></tbody>"
        + "".join(
            "<tbody><tr><th>"
            f'<span data-bind="text: full_title">Movie {index + 1}</span></th>'
            '<td><span data-bind="visible: included_in_bundle">Included</span>'
            '<span class="retail-price" style="display:none">$0.00</span>'
            '<span class="original_price">$24.99</span></td></tr></tbody>'
            for index in range(count)
        )
    )


def invoice_with_rows(rows):
    body = invoice()
    start, end = body.index("<table>") + len("<table>"), body.index("</table>")
    return body[:start] + rows + body[end:]


class PurchaseParserTest(unittest.TestCase):
    def test_bundle_cost_is_split_evenly_with_exact_cent_totals(self):
        for total, expected in (
            ("$10.00", ["$3.34", "$3.33", "$3.33"]),
            ("$0.01", ["$0.01", "$0.00", "$0.00"]),
            ("$0.00", ["$0.00"] * 3),
            ("$1,000.02", ["$333.34"] * 3),
            ("£12.00", ["£4.00"] * 3),
        ):
            with self.subTest(total=total):
                rows = parse_purchases(invoice_with_rows(bundle_rows(total)).encode())
                self.assertEqual([r["purchase_price"] for r in rows], expected)
                self.assertEqual([r["retail_price"] for r in rows], ["$24.99"] * 3)

    def test_bundle_allocation_is_local_to_invoice_and_skips_unmarked_titles(self):
        standalone = (
            '<tr><th><span data-bind="text: full_title">Standalone</span></th>'
            '<td><span class="retail-price">$14.99</span>'
            '<span data-bind="visible: included_in_bundle" '
            'style="display:none">Included</span></td></tr>'
        )
        body = invoice_with_rows(bundle_rows("$20.00", count=2) + standalone)
        body += invoice_with_rows(bundle_rows("$9.00", count=2))
        rows = parse_purchases(body.encode())
        self.assertEqual(
            [r["purchase_price"] for r in rows],
            ["$10.00", "$10.00", "$14.99", "$4.50", "$4.50"],
        )

    def test_missing_or_unsupported_bundle_totals_leave_prices_unknown(self):
        for amount in ("", "Unknown", "-$12.00", "$12,50", "$12.345"):
            with self.subTest(amount=amount):
                body = invoice_with_rows(bundle_rows(amount))
                self.assertEqual(
                    [r["purchase_price"] for r in parse_purchases(body.encode())],
                    [None] * 3,
                )
        for replacement in ("<tr class=cancelled>", '<tr style="display:none">'):
            body = invoice_with_rows(bundle_rows().replace("<tr>", replacement, 1))
            self.assertEqual(
                [r["purchase_price"] for r in parse_purchases(body.encode())],
                [None] * 3,
            )

    def test_multiple_bundles_share_only_the_combined_bundle_cost(self):
        first = bundle_rows("$10.00", count=3).split("</tbody>", 1)
        second = bundle_rows("$8.00", count=2, name="Other bundle").split("</tbody>", 1)
        # As on the captured page, all bundle headings precede all title rows.
        body = invoice_with_rows(
            first[0] + "</tbody>" + second[0] + "</tbody>" + first[1] + second[1]
        )
        rows = parse_purchases(body.encode())
        self.assertEqual([r["purchase_price"] for r in rows], ["$3.60"] * 5)
        for unsupported in ("", "€8.00"):
            with self.subTest(amount=unsupported):
                self.assertEqual(
                    [
                        r["purchase_price"]
                        for r in parse_purchases(
                            body.replace("$8.00", unsupported).encode()
                        )
                    ],
                    [None] * 5,
                )

    def test_json_fields_repeat_purchases_and_missing_optional_values(self):
        first = purchased_invoice()
        second = first.replace("ORDER-DEMO-123", "ORDER-DEMO-456").replace(
            "October 12, 2025", "May 2, 2020"
        )
        rows = parse_purchases((first + second + invoice()).encode())
        self.assertEqual(
            rows[0],
            {
                "title": "Fictional & Zoë",
                "year": None,
                "purchased_on": "2025-10-12",
                "purchase_price": "$19.99",
                "retail_price": "$24.99",
                "order_id": "ORDER-DEMO-123",
                "href": "/movie-store/movie/fictional-voyage",
            },
        )
        self.assertEqual(rows[1]["order_id"], "ORDER-DEMO-456")
        self.assertEqual(rows[1]["purchased_on"], "2020-05-02")
        self.assertEqual(
            rows[2],
            {
                "title": "Voyage to Europa",
                "year": None,
                "purchased_on": "2025-10-12",
                "purchase_price": None,
                "retail_price": None,
                "order_id": None,
                "href": None,
            },
        )
        self.assertEqual(
            parse_history((first + second).encode()),
            [{"title": "Fictional & Zoë", "purchased_on": "2020-05-02"}],
        )

    def test_release_year_comes_from_the_store_link_not_the_invoice_date(self):
        for href, year in (
            ("/movie-store/movie/fictional-voyage-1998", 1998),
            (
                "https://store.example.invalid/movie-store/movie/"
                "fictional-voyage-2024-extended-edition?format=4k",
                2024,
            ),
            ("movie-store/movie/2001-a-distant-shore-1968", 1968),
            ("/movie-store/movie/2001-a-distant-shore", None),
            ("/movie-store/movie/fictional-voyage", None),
            ("https://store.example.invalid/other/fictional-voyage-1998", None),
            ("javascript:fictional-voyage-1998", None),
        ):
            with self.subTest(href=href):
                row = parse_purchases(purchased_invoice(href=href).encode())[0]
                self.assertEqual(row["year"], year)
                if year is not None:
                    self.assertIs(type(row["year"]), int)
                self.assertEqual(row["purchased_on"], "2025-10-12")

    def test_bundle_titles_exclusions_and_unavailable_individual_prices(self):
        body = purchased_invoice(bundled=True).replace(
            "<table>",
            '<table><tr><td><span data-bind="text: title">Fictional bundle</span>'
            '</td><td class="retail-price">$99.99</td></tr>',
        )
        body += invoice("Rental", rental=True)
        body += invoice("Cancelled", cancelled=True)
        body += invoice("Pending", pending=True)
        body += invoice("Hidden").replace("<tr", '<tr style="display: none"')
        rows = parse_purchases(body.encode())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "Fictional & Zoë")
        self.assertIsNone(rows[0]["purchase_price"])
        self.assertEqual(rows[0]["retail_price"], "$24.99")

    def test_links_are_copied_without_resolving_or_fetching(self):
        for href in (
            "/movie-store/movie/fictional-voyage",
            "movie-store/movie/fictional-voyage?edition=hd&lang=en",
            "https://store.example.invalid/movie-store/movie/fictional-voyage",
        ):
            with self.subTest(href=href):
                self.assertEqual(
                    parse_purchases(purchased_invoice(href=href).encode())[0]["href"],
                    href,
                )
        for href in (
            "",
            "/movie-store",
            "javascript:alert(1)",
            "data:text/html,markup",
            "file:///private/data",
            "//store.example.invalid/movie",
            "https://user:password@store.example.invalid/movie",
            "https://[invalid/movie",
            "/movie-store/movie/" + "a" * 2048,
        ):
            with self.subTest(href=href):
                self.assertIsNone(
                    parse_purchases(purchased_invoice(href=href).encode())[0]["href"]
                )

    def test_multiple_pages_earliest_unicode_and_no_markup_execution(self):
        body = (
            invoice("Fictional &amp; Zoë", "May 2, 2020")
            + invoice("Fictional &amp; Zoë")
            + invoice("Rental", rental=True)
            + invoice("Cancelled", cancelled=True)
            + invoice("Pending", pending=True)
        )
        self.assertEqual(
            parse_history(body.encode()),
            [{"title": "Fictional & Zoë", "purchased_on": "2020-05-02"}],
        )
        self.assertEqual(
            parse_history(
                (
                    invoice()
                    + '<script src="http://evil.invalid/a.js">throw 1</script>'
                ).encode()
            )[0]["title"],
            "Voyage to Europa",
        )

    def test_missing_invalid_or_future_dates_and_oversized_documents_fail(self):
        for body in (
            b"<html>Login</html>",
            invoice(date="February 31, 2020").encode(),
            invoice(date="May 1, 2999").encode(),
            invoice().replace(DATE_BINDING, "unknown").encode(),
            b"\xff",
            b" " * (8 * 1024 * 1024 + 1),
        ):
            with self.assertRaises(JournalError):
                parse_history(body)

    def test_display_defaults_and_collection_list_legacy_migration(self):
        from custom_components.kaleidescape_companion.ui.preferences import (
            validate_library,
        )

        self.assertEqual(
            validate({}, {}), {"default_landing_page": "library", "fuzzy_search": True}
        )
        self.assertFalse(validate({"fuzzy_search": False}, {})["fuzzy_search"])
        with self.assertRaises(ValueError):
            validate({"fuzzy_search": "false"}, {})
        self.assertEqual(validate_library({})["page_size"], 100)
        for value in (0, 50, 1001, True, "100", 1.5, None):
            with self.assertRaises(JournalError):
                validate_library({"page_size": value})
        self.assertEqual(
            validate_library({"view": "covers", "page_size": 1000})["page_size"], 1000
        )
        self.assertEqual(
            collection_names(" Demo extras\nOther\nDemo extras"),
            ["Demo extras", "Other"],
        )
        self.assertEqual(
            collection_names(["Demo extras", "demo extras"]), ["Demo extras"]
        )
        for value in (["bad\nname"], [1], "a" * 257, ["x"] * 201):
            with self.assertRaises(ValueError):
                collection_names(value)


class PurchaseJsonExportTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.parent = Path(directory.name)
        self.parent.chmod(0o755)
        self.history = self.parent / "purchases.html"
        self.history.write_text(
            purchased_invoice(href="/movie-store/movie/fictional-voyage-1998"),
            encoding="utf-8",
        )
        self.output = self.parent / "purchases.json"
        self.helper = offline_helper()

    def test_cli_export_needs_no_database_and_preserves_input_and_parent(self):
        digest = hashlib.sha256(self.history.read_bytes()).hexdigest()
        result = subprocess.run(
            [
                sys.executable,
                self.helper.__file__,
                "--format",
                "json",
                "--history",
                str(self.history),
                "--output",
                str(self.output),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("Wrote 1 purchase record to", result.stdout)
        self.assertNotIn("ORDER-DEMO", result.stdout + result.stderr)
        self.assertEqual(
            json.loads(self.output.read_bytes()),
            parse_purchases(self.history.read_bytes()),
        )
        self.assertEqual(json.loads(self.output.read_bytes())[0]["year"], 1998)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.parent.stat().st_mode & 0o777, 0o755)
        self.assertEqual(hashlib.sha256(self.history.read_bytes()).hexdigest(), digest)

    def test_refuse_overwrite_and_links_and_parse_before_creating_output(self):
        self.output.write_text("Existing content")
        with self.assertRaises(ValueError):
            self.helper.export_json(self.history, self.output)
        self.assertEqual(self.output.read_text(), "Existing content")
        with self.assertRaises(ValueError):
            self.helper.export_json(self.history, self.history)
        self.output.unlink()
        self.output.symlink_to(self.parent / "missing.json")
        with self.assertRaises(ValueError):
            self.helper.export_json(self.history, self.output)
        self.assertTrue(self.output.is_symlink())
        self.output.unlink()
        linked = self.parent / "linked.html"
        linked.symlink_to(self.history)
        with self.assertRaises(ValueError):
            self.helper.export_json(linked, self.output)
        self.history.write_bytes(b"<html>Not a history page</html>")
        with self.assertRaises(JournalError):
            self.helper.export_json(self.history, self.output)
        self.assertFalse(self.output.exists())
        self.history.write_bytes(b" " * (8 * 1024 * 1024 + 1))
        with self.assertRaises(ValueError):
            self.helper.export_json(self.history, self.output)
        self.assertFalse(self.output.exists())


class PurchaseStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def preview(self, *args):
        from dev.purchase_history import preview

        return await self.repository._call(preview, self.repository._db(), *args)

    async def apply(self, *args):
        from dev.purchase_history import apply

        return await self.repository._call(self.repository._library_write, apply, *args)

    async def seed(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.id = title_id(library.SOURCE, library.ROWS[0]["source_handle"])

    async def test_explicit_dates_survive_sync_sort_and_idempotent_actor_bound_retry(
        self,
    ):
        await self.seed()
        title = library.ROWS[0]["title"]
        preview = await self.preview(library.SOURCE, invoice(title).encode())
        self.assertEqual(len(preview["rows"][0]["versions"]), 2)
        before = (
            await self.repository.async_library_versions(library.SOURCE, self.id)
        )["items"]
        request = str(uuid4())
        updates = [{"title_id": self.id, "purchased_on": "2020-01-02"}]
        args = (
            library.SOURCE,
            request,
            preview["revision"],
            updates,
            "fictional-admin",
        )
        result = await self.apply(*args)
        self.assertEqual(await self.apply(*args), result)
        with self.assert_error("conflict"):
            await self.apply(*args[:-1], "other-admin")
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        rows = (await self.repository.async_library_versions(library.SOURCE, self.id))[
            "items"
        ]
        self.assertEqual(
            [row["first_seen"] for row in before], [row["first_seen"] for row in rows]
        )
        self.assertEqual(
            next(row for row in rows if row["id"] == self.id)["purchased_on"],
            "2020-01-02",
        )
        group = (
            await self.repository.async_library_list(
                library.SOURCE, {"grouped": True, "sort": "added"}
            )
        )["items"][0]
        self.assertEqual(group["purchased_on"], "2020-01-02")
        audit = await self.repository.async_inspect("import_audit")
        self.assertEqual(len(audit["items"]), 1)
        self.assertNotIn(title, json.dumps(audit))
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)

    async def test_ambiguous_unmatched_and_rollback_scope_validation(self):
        rows = [
            *library.ROWS,
            {
                **library.ROWS[0],
                "source_group": "remake",
                "source_handle": "remake",
                "year": 1990,
            },
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        preview = await self.preview(
            library.SOURCE,
            (
                invoice(library.ROWS[0]["title"]) + invoice("Unmatched fictional title")
            ).encode(),
        )
        self.assertTrue(preview["rows"][0]["ambiguous"])
        self.assertFalse(preview["rows"][1]["versions"])
        id = title_id(library.SOURCE, library.ROWS[0]["source_handle"])
        updates = [
            {"title_id": id, "purchased_on": "2020-01-02"},
            {"title_id": "f" * 64, "purchased_on": "2020-01-02"},
        ]
        with self.assert_error("not_found"):
            await self.apply(
                library.SOURCE, str(uuid4()), preview["revision"], updates, "admin"
            )
        self.assertEqual(
            [
                r
                for r in (await self.repository.async_inspect("library"))["items"]
                if r["purchased_on"]
            ],
            [],
        )
        for bad in (
            [],
            updates[:1] * 2,
            [{"title_id": id, "purchased_on": "2020-01-02", "sql": "bad"}],
            [{"title_id": id, "purchased_on": "2999-01-02"}],
        ):
            with self.assert_error("invalid_request"):
                await self.apply(
                    library.SOURCE, str(uuid4()), preview["revision"], bad, "admin"
                )
        with self.assert_error("conflict"):
            await self.apply(
                library.SOURCE,
                str(uuid4()),
                preview["revision"] - 1,
                updates[:1],
                "admin",
            )

    async def test_offline_helper_preserves_input_and_creates_private_copy(self):
        await self.seed()
        await self.repository.async_close()
        digest = hashlib.sha256(self.path.read_bytes()).hexdigest()
        history = self.path.parent / "history.html"
        history.write_text(invoice(library.ROWS[0]["title"]))
        output = self.path.parent / "private" / "corrected.sqlite"
        module = offline_helper()
        with redirect_stdout(StringIO()):
            await module.run(self.path, history, output)
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(), digest)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(output.parent.stat().st_mode & 0o777, 0o700)
        with closing(sqlite3.connect(output)) as db:
            self.assertEqual(
                db.execute(
                    "SELECT count(*) FROM library WHERE purchased_on IS NOT NULL"
                ).fetchone()[0],
                2,
            )

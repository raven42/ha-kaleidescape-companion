"""Fictional offline invoices, scoped corrections, permissions, and private copies."""

import hashlib
import importlib.util
import json
import sqlite3
import unittest
from contextlib import closing, redirect_stdout
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


class PurchaseParserTest(unittest.TestCase):
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

        self.assertEqual(validate({}, {}), {"default_landing_page": "journal"})
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
                for r in (await self.repository.async_inspect("library_titles"))[
                    "items"
                ]
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
        spec = importlib.util.spec_from_file_location(
            "offline_purchases",
            Path(__file__).resolve().parents[1] / "dev/import_purchase_dates.py",
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with redirect_stdout(StringIO()):
            await module.run(self.path, history, output)
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(), digest)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(output.parent.stat().st_mode & 0o777, 0o700)
        with closing(sqlite3.connect(output)) as db:
            self.assertEqual(
                db.execute(
                    "SELECT count(*) FROM library_titles WHERE purchased_on IS NOT NULL"
                ).fetchone()[0],
                2,
            )

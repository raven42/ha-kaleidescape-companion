"""Fictional offline invoices, scoped corrections, permissions, and private copies."""

import asyncio
import hashlib
import importlib.util
import json
import sqlite3
import unittest
from contextlib import closing, redirect_stdout
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_backend as backend
import test_library as library
from aiohttp import web
from aiohttp.test_utils import make_mocked_request
from homeassistant.components.http import KEY_HASS

from custom_components.kaleidescape_companion.journal import JournalError
from custom_components.kaleidescape_companion.library_config import collection_names
from custom_components.kaleidescape_companion.library_store import title_id
from custom_components.kaleidescape_companion.purchase_http import PurchasePreviewView
from custom_components.kaleidescape_companion.purchases import (
    DATE_BINDING,
    parse_history,
)
from custom_components.kaleidescape_companion.ui_config import validate


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
        self.assertEqual(validate({}, {})["library_default_count"], 50)
        for value in (0, 1001, True, "100", 1.5, None):
            with self.assertRaises(ValueError):
                validate({"library_default_count": value}, {})
        self.assertEqual(
            validate(
                {
                    "library_default_count": 1000,
                    "library_default_view": "covers",
                    "default_landing_page": "library",
                },
                {},
            )["library_default_count"],
            1000,
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

    async def seed(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        self.id = title_id(library.SOURCE, library.ROWS[0]["source_handle"])

    async def test_explicit_dates_survive_sync_sort_and_idempotent_actor_bound_retry(
        self,
    ):
        await self.seed()
        title = library.ROWS[0]["title"]
        preview = await self.repository.async_purchase_preview(
            library.SOURCE, invoice(title).encode()
        )
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
        result = await self.repository.async_purchase_apply(*args)
        self.assertEqual(await self.repository.async_purchase_apply(*args), result)
        with self.assert_error("conflict"):
            await self.repository.async_purchase_apply(*args[:-1], "other-admin")
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
        audit = await self.repository.async_inspect("library_purchase_audit")
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
        preview = await self.repository.async_purchase_preview(
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
            await self.repository.async_purchase_apply(
                library.SOURCE, str(uuid4()), preview["revision"], updates, "admin"
            )
        self.assertEqual(
            (await self.repository.async_inspect("library_purchase_dates"))["items"], []
        )
        for bad in (
            [],
            updates[:1] * 2,
            [{"title_id": id, "purchased_on": "2020-01-02", "sql": "bad"}],
            [{"title_id": id, "purchased_on": "2999-01-02"}],
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_purchase_apply(
                    library.SOURCE, str(uuid4()), preview["revision"], bad, "admin"
                )
        with self.assert_error("conflict"):
            await self.repository.async_purchase_apply(
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
            Path(__file__).resolve().parents[1] / "scripts/import_purchase_dates.py",
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
                db.execute("SELECT count(*) FROM library_purchase_dates").fetchone()[0],
                2,
            )


class PurchaseApiTest(unittest.IsolatedAsyncioTestCase):
    call = backend.BackendTest.call

    async def asyncSetUp(self):
        await backend.BackendTest.asyncSetUp(self)
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        self.entry.runtime_data.library = SimpleNamespace(
            source=library.SOURCE, async_stop=AsyncMock()
        )
        await self.entry.runtime_data.repository.async_library_catalog(
            library.ORIGIN, library.ROWS, {}
        )

    async def test_apply_admin_scoping_and_revoked_reply(self):
        reader = SimpleNamespace(is_active=True, is_admin=False, id="reader")
        arguments = {
            **self.scope,
            "request_id": str(uuid4()),
            "revision": 1,
            "updates": [
                {
                    "title_id": title_id(
                        library.SOURCE, library.ROWS[0]["source_handle"]
                    ),
                    "purchased_on": "2020-01-02",
                }
            ],
        }
        denied = await self.call("library/purchases/apply", user=reader, **arguments)
        self.assertEqual(denied["code"], "unauthorized")
        repo = self.entry.runtime_data.repository
        original = repo.async_purchase_apply

        async def revoke(*args):
            result = await original(*args)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_purchase_apply", revoke):
            result = await self.call("library/purchases/apply", **arguments)
            self.assertEqual(result["code"], "unauthorized")
        self.assertEqual(
            len((await repo.async_inspect("library_purchase_dates"))["items"]), 1
        )

    async def test_upload_authorization_size_and_post_await_rechecks(self):
        body = invoice(library.ROWS[0]["title"]).encode()
        payload = SimpleNamespace(iter_chunked=lambda size: chunks(body))
        request = make_mocked_request(
            "POST",
            "/api/fictional",
            headers={"Content-Length": str(len(body))},
            app={KEY_HASS: self.hass},
            payload=payload,
        )
        request["hass_user"] = self.admin
        view = PurchasePreviewView()
        response = await view.post(request, **self.scope)
        self.assertEqual(response.status, 200)
        self.assertEqual(len(json.loads(response.body)["rows"]), 1)
        request["hass_user"] = SimpleNamespace(is_active=True, is_admin=False)
        with self.assertRaises(web.HTTPForbidden):
            await view.post(request, **self.scope)
        request["hass_user"] = self.admin
        repo = self.entry.runtime_data.repository
        original = repo.async_purchase_preview

        async def revoke(*args):
            result = await original(*args)
            self.admin.is_active = False
            return result

        with patch.object(repo, "async_purchase_preview", revoke):
            with self.assertRaises(web.HTTPForbidden):
                await view.post(request, **self.scope)
        self.admin.is_active = True
        payload.iter_chunked = lambda size: chunks(b" " * (8 * 1024 * 1024 + 1))
        response = await view.post(request, **self.scope)
        self.assertEqual(response.status, 413)

    async def test_cancelled_preview_drains_before_releasing_transfer_slot(self):
        started, release = asyncio.Event(), asyncio.Event()
        body = invoice(library.ROWS[0]["title"]).encode()
        payload = SimpleNamespace(iter_chunked=lambda size: chunks(body))
        request = make_mocked_request(
            "POST", "/api/fictional", app={KEY_HASS: self.hass}, payload=payload
        )
        request["hass_user"] = self.admin
        repo = self.entry.runtime_data.repository
        original = repo.async_purchase_preview

        async def slow(*args):
            started.set()
            await release.wait()
            return await original(*args)

        with patch.object(repo, "async_purchase_preview", slow):
            task = asyncio.create_task(
                PurchasePreviewView().post(request, **self.scope)
            )
            await started.wait()
            task.cancel()
            await asyncio.sleep(0)
            with self.assertRaises(JournalError) as error:
                async with repo.async_import_slot():
                    self.fail("Cancelled preview released its slot early")
            self.assertEqual(error.exception.code, "busy")
            release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        async with repo.async_import_slot():
            pass


async def chunks(body):
    yield body

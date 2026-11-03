"""Fictional add-only form, transport, reconciliation, and authorization tests."""

import asyncio
import unittest
from html import escape
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import test_backend as backend
import test_library as library
from _expected_logs import expected_log
from kaleidescape.library_parser import LibraryFormatError
from kaleidescape.local_browser import form_targets

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library.collections import (
    member_hash,
    parameters,
)
from custom_components.kaleidescape_companion.library.config import DEFAULTS
from custom_components.kaleidescape_companion.library.store import title_id
from custom_components.kaleidescape_companion.library.sync import LibrarySync


def form():
    checkboxes = "".join(
        f'<input type="checkbox" name="check-{escape(row["source_handle"])}">'
        for row in library.ROWS
    )
    return f"""<form id="main" method="post" enctype="multipart/form-data">
    {library.listing()}{checkboxes}
    <input type="hidden" id="add_to_collection_select_dropdown_value"
    name="add_to_collection_select">
    <div id="add_to_collection_select_dropdown"><ul>
    <li class="dropdown_option"><input value="favorite-token">
    <a>Favorites</a></li>
    <li class="dropdown_option"><input value="played-token">
    <a>Played</a></li></ul></div>
    <button id="add_to_collection"
    onclick="submit_parent_form_once( event, 'Add-To-Collection' );"
    >Add</button></form>"""


class CollectionParserTest(unittest.TestCase):
    def test_exact_add_form_and_version_control(self):
        self.assertEqual(
            form_targets(form(), "fixture-a"), {"Favorites": "favorite-token"}
        )
        for page in (
            form().replace('method="post"', 'method="get"'),
            form().replace('id="main"', 'id="other"'),
            form().replace("<form ", '<form action="http://evil.invalid/" '),
            form().replace("Add-To-Collection", "Delete"),
            form().replace('name="check-fixture-a"', 'name="wrong"'),
        ):
            with self.assertRaises(LibraryFormatError):
                form_targets(page, "fixture-a")


class CollectionOperationTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def seed(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            library.ROWS,
            {"Played": ["fixture-a"], "Paused": [], "Favorites": ["fixture-b"]},
        )
        self.id = title_id(library.SOURCE, "fixture-a")
        self.members = [library.ROWS[1]]
        self.sync = self.connector()

    def connector(self):
        async def executor(function, *args):
            return function(*args)

        hass = SimpleNamespace(
            async_add_executor_job=executor,
            async_create_background_task=lambda task, name: asyncio.create_task(task),
        )
        sync = LibrarySync(
            hass,
            self.repository,
            {
                **DEFAULTS,
                "library_host": library.ORIGIN,
                "library_allow_collection_add": True,
            },
        )
        sync._resolve = AsyncMock(return_value="192.168.50.10")
        sync.browser = SimpleNamespace(
            movies=AsyncMock(return_value=(library.ROWS, ["Favorites", "Played"])),
            add_targets=AsyncMock(return_value={"Favorites": "favorite-token"}),
            add_to_collection=AsyncMock(),
        )
        sync._collection_members = AsyncMock(
            side_effect=lambda name: list(self.members)
        )

        async def post(handle, collection):
            self.members.append(
                next(row for row in library.ROWS if row["source_handle"] == handle)
            )

        sync._post_collection_add = AsyncMock(side_effect=post)
        return sync

    async def add(self, request=None, **changes):
        state = await self.repository.async_collection_snapshot(library.SOURCE)
        values = {
            "request": request or str(uuid4()),
            "title": self.id,
            "collection": "Favorites",
            "revision": state["revision"],
            "actor": "fictional-admin",
            "excluded": [],
            "authorize": lambda: None,
            **changes,
        }
        return await self.sync.async_collection_add(**values)

    async def test_confirmed_add_preserves_memberships_and_uuid_barrier(
        self,
    ):
        await self.seed()
        request = str(uuid4())
        result = await self.add(request)
        self.assertEqual(result["status"], "confirmed")
        self.sync._post_collection_add.assert_awaited_once_with(
            "fixture-a", "Favorites"
        )
        rows = (await self.repository.async_library_versions(library.SOURCE, self.id))[
            "items"
        ]
        self.assertEqual(
            next(row for row in rows if row["id"] == self.id)["collections"],
            ["Favorites", "Played"],
        )
        self.assertNotIn(
            "Favorites",
            next(row for row in rows if row["id"] != self.id)["collections"],
        )
        self.assertEqual(await self.add(request, revision=1), result)
        with self.assert_error("conflict"):
            await self.add(request, revision=1, actor="other-admin")
        self.assertEqual(self.sync._post_collection_add.await_count, 1)
        row = (await self.repository.async_inspect("library_collection_intents"))[
            "items"
        ][0]
        self.assertIsNone(row["title_id"])
        self.assertIsNone(row["collection"])
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)

    async def test_targets_preflight_hidden_reserved_revision_and_missing_version(self):
        await self.seed()
        choices = await self.sync.async_collection_targets(self.id, 1, [], lambda: None)
        self.assertEqual(choices["collections"], ["Favorites"])
        for values, code in (
            ({"collection": "Played"}, "invalid_request"),
            ({"collection": "Unknown"}, "invalid_request"),
            ({"excluded": ["Favorites"]}, "invalid_request"),
            ({"revision": 0}, "refresh_required"),
            ({"title": "a" * 64}, "not_found"),
        ):
            with self.assert_error(code):
                await self.add(**values)
        self.sync.browser.add_targets.side_effect = JournalError(
            "collection_form", "Collection form was rejected"
        )
        with self.assertRaises(JournalError):
            await self.add()
        self.sync._post_collection_add.assert_not_awaited()

    async def test_no_post_for_already_member_or_revoked_preflight(self):
        await self.seed()
        self.members.append(library.ROWS[0])
        self.assertEqual((await self.add())["status"], "confirmed")
        self.sync._post_collection_add.assert_not_awaited()

        def deny():
            raise JournalError("unauthorized", "Access changed")

        with self.assert_error("unauthorized"):
            await self.add(authorize=deny)
        self.sync._post_collection_add.assert_not_awaited()

    @expected_log(
        "custom_components.kaleidescape_companion.library.sync",
        "Collection addition outcome is uncertain",
    )
    async def test_uncertain_add_is_never_replayed_and_survives_connector_restart(self):
        await self.seed()
        self.sync._post_collection_add.side_effect = TimeoutError
        request = str(uuid4())
        self.assertEqual((await self.add(request))["status"], "uncertain")
        self.assertEqual((await self.add(request, revision=1))["status"], "uncertain")
        self.assertEqual(self.sync._post_collection_add.await_count, 1)
        with self.assert_error("collection_uncertain"):
            await self.add()
        replacement = self.connector()
        replacement._post_collection_add.side_effect = AssertionError("Never replay")
        self.assertEqual(
            (await replacement.async_collection_check(request, lambda: None))["status"],
            "uncertain",
        )
        self.members.append(library.ROWS[0])
        self.assertEqual(
            (await replacement.async_collection_check(request, lambda: None))["status"],
            "confirmed",
        )
        replacement._post_collection_add.assert_not_awaited()

    async def test_response_loss_after_commit_is_confirmed_by_readback(self):
        await self.seed()

        async def lost(*args):
            self.members.append(library.ROWS[0])
            raise TimeoutError

        self.sync._post_collection_add.side_effect = lost
        self.assertEqual((await self.add())["status"], "confirmed")

    @expected_log(
        "custom_components.kaleidescape_companion.library.sync",
        "Collection addition outcome is uncertain",
    )
    async def test_wider_membership_change_remains_uncertain_until_acknowledged(self):
        await self.seed()

        async def wider(*args):
            self.members.extend([library.ROWS[0], library.ROWS[2]])

        self.sync._post_collection_add.side_effect = wider
        request = str(uuid4())
        self.assertEqual((await self.add(request))["status"], "uncertain")
        self.assertEqual(
            (
                await self.sync.async_collection_check(
                    request, lambda: None, "ack-admin"
                )
            )["status"],
            "abandoned",
        )
        self.assertEqual((await self.add(request, revision=1))["status"], "abandoned")
        row = (await self.repository.async_inspect("library_collection_intents"))[
            "items"
        ][0]
        self.assertEqual(row["acknowledged_by"], "ack-admin")
        self.assertIsNone(row["collection"])

    async def test_caller_cancel_does_not_cancel_accepted_add_and_pause_drains_it(self):
        await self.seed()
        started, release = asyncio.Event(), asyncio.Event()

        async def slow(*args):
            started.set()
            await release.wait()
            self.members.append(library.ROWS[0])

        self.sync._post_collection_add.side_effect = slow
        request = str(uuid4())
        task = asyncio.create_task(self.add(request))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        pause = asyncio.create_task(self.sync.async_pause())
        await asyncio.sleep(0)
        self.assertFalse(pause.done())
        with self.assert_error("not_ready"):
            await self.add()
        release.set()
        await pause
        self.assertEqual(
            (await self.repository.async_collection_intent(library.SOURCE, request))[
                "status"
            ],
            "confirmed",
        )

    async def test_access_loss_after_intent_prevents_post_and_retires_intent(self):
        await self.seed()
        calls = 0

        def authorize():
            nonlocal calls
            calls += 1
            if calls == 3:
                raise JournalError("unauthorized", "Access changed")

        with self.assert_error("unauthorized"):
            await self.add(authorize=authorize)
        self.sync._post_collection_add.assert_not_awaited()
        rows = (await self.repository.async_inspect("library_collection_intents"))[
            "items"
        ]
        self.assertEqual(rows[0]["status"], "abandoned")
        self.assertIsNone(rows[0]["collection"])

    async def test_receipt_limit_rejects_before_post(self):
        await self.seed()
        with patch(
            "custom_components.kaleidescape_companion.library.collections.MAX_RECEIPTS",
            0,
        ):
            with self.assert_error("collection_limit"):
                await self.add()
        self.sync._post_collection_add.assert_not_awaited()

    async def test_fixed_multipart_transport_and_redirect_body_limits(self):
        await self.seed()
        sync = self.connector()
        sync.address = "192.168.50.10"

        class Content:
            body = b""

            async def iter_chunked(self, size):
                yield self.body

        response = SimpleNamespace(
            status=303,
            content_type="text/html",
            charset="utf-8",
            headers={"Location": "/movies"},
            content=Content(),
        )

        class Context:
            async def __aenter__(self):
                return response

            async def __aexit__(self, *args):
                pass

        sync.session = SimpleNamespace(post=Mock(return_value=Context()))
        await sync.post(
            "/movies",
            {
                "submit_type": "Add-To-Collection",
                "add_to_collection_select": "Zoë & Favorites",
                "check-fixture-a": "on",
            },
        )
        call = sync.session.post.call_args
        self.assertEqual(str(call.args[0]), "http://192.168.50.10/movies")
        self.assertFalse(call.kwargs["allow_redirects"])
        self.assertEqual(call.kwargs["headers"]["Host"], "fictional-cinema.local:80")
        fields = {item[0]["name"]: item[2] for item in call.kwargs["data"]._fields}
        self.assertEqual(
            fields,
            {
                "submit_type": "Add-To-Collection",
                "add_to_collection_select": "Zoë & Favorites",
                "check-fixture-a": "on",
            },
        )
        response.headers["Location"] = "http://evil.invalid/"
        self.assertEqual(
            (await sync.post("/movies", {"submit_type": "Add-To-Collection"})).location,
            "http://evil.invalid/",
        )
        response.status = 200
        response.headers = {}
        response.content.body = b"x" * (8 * 1024 * 1024 + 1)
        with self.assert_error("library_too_large"):
            await sync.post("/movies", {"submit_type": "Add-To-Collection"})


class CollectionApiTest(unittest.IsolatedAsyncioTestCase):
    call = backend.BackendTest.call

    async def asyncSetUp(self):
        await backend.BackendTest.asyncSetUp(self)
        object.__setattr__(
            self.entry,
            "data",
            {"library_enabled": True, "library_host": library.ORIGIN},
        )
        repo = self.entry.runtime_data.repository
        await repo.async_library_catalog(
            library.ORIGIN, library.ROWS, {"Favorites": [], "Played": [], "Paused": []}
        )
        self.sync = LibrarySync(self.hass, repo, dict(self.entry.data))
        self.entry.runtime_data.library = self.sync

    async def test_default_off_roles_and_option_revocation_before_post(self):
        data = {
            **self.scope,
            "title_id": title_id(library.SOURCE, "fixture-a"),
            "collection": "Favorites",
            "revision": 1,
            "request_id": str(uuid4()),
        }
        with patch.object(self.sync, "async_collection_add", AsyncMock()) as add:
            reader = SimpleNamespace(is_active=True, is_admin=False)
            self.assertEqual(
                (await self.call("library/collections/add", user=reader, **data))[
                    "code"
                ],
                "unauthorized",
            )
            self.assertEqual(
                (await self.call("library/collections/add", **data))["code"],
                "collection_disabled",
            )
            add.assert_not_awaited()
        object.__setattr__(
            self.entry,
            "data",
            {**self.entry.data, "library_allow_collection_add": True},
        )

        async def revoke(*args):
            object.__setattr__(
                self.entry,
                "data",
                {**self.entry.data, "library_allow_collection_add": False},
            )
            args[-1]()

        with patch.object(self.sync, "async_collection_add", revoke):
            self.assertEqual(
                (await self.call("library/collections/add", **data))["code"],
                "not_ready",
            )

    async def test_check_and_acknowledge_work_with_add_option_off(self):
        request = str(uuid4())
        title = title_id(library.SOURCE, "fixture-a")
        _, fingerprint = parameters(
            request, library.SOURCE, title, "Favorites", 1, self.admin.id
        )
        repo = self.entry.runtime_data.repository
        await repo.async_collection_begin(
            library.SOURCE,
            request,
            fingerprint,
            title,
            "Favorites",
            1,
            member_hash(["fixture-a"]),
            self.admin.id,
        )
        self.sync._resolve = AsyncMock(return_value="192.168.50.10")
        self.sync._collection_members = AsyncMock(return_value=[])
        self.sync._post_collection_add = AsyncMock(
            side_effect=AssertionError("Check must never post")
        )
        result = await self.call(
            "library/collections/check", **self.scope, request_id=request
        )
        self.assertEqual(result["result"]["status"], "uncertain")
        rejected = await self.call(
            "library/collections/acknowledge",
            **self.scope,
            request_id=request,
            confirmation="wrong",
        )
        self.assertEqual(rejected["code"], "invalid_request")
        result = await self.call(
            "library/collections/acknowledge",
            **self.scope,
            request_id=request,
            confirmation="ACKNOWLEDGE",
        )
        self.assertEqual(result["result"]["status"], "abandoned")
        self.sync._post_collection_add.assert_not_awaited()

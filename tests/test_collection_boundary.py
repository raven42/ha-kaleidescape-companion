"""Actual browser/parser/transport authority checks with fictional HTTP replies."""

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import test_library as library
import test_library_collections as collections
from _expected_logs import expected_log

from custom_components.kaleidescape_companion.library.store import title_id
from custom_components.kaleidescape_companion.vendor.kaleidescape.local_browser import (
    REMOVAL_ACTIONS,
    BrowserResponse,
)


class CollectionBoundaryTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = collections.CollectionApiTest.asyncSetUp
    call = collections.CollectionApiTest.call

    async def prepare(self, collection, operation, legacy=False):
        self.admin.is_active = self.admin.is_admin = True
        self.entry.runtime_data.library = self.sync
        object.__setattr__(
            self.entry,
            "data",
            {
                "library_enabled": True,
                "library_host": library.ORIGIN,
                "library_allow_collection_add": True,
                "library_sync_collections": True,
            },
        )
        selected = library.ROWS[0]
        members = {
            name: [] for name in ("Favorites", "WatchSoon", "New", "Played", "Paused")
        }
        if operation == "remove":
            members[collection] = [selected]
        elif collection in {"New", "Played"}:
            members["Played" if collection == "New" else "New"] = [selected]
        repo = self.sync.repository
        await repo.async_library_catalog(
            library.ORIGIN,
            library.ROWS,
            {
                name: [row["source_handle"] for row in rows]
                for name, rows in members.items()
            },
        )
        revision = (await repo.async_collection_snapshot(library.SOURCE))["revision"]
        request = str(uuid4())
        data = {
            **self.scope,
            "title_id": title_id(library.SOURCE, "fixture-a"),
            "collection": collection,
            "revision": revision,
            "request_id": request,
        }
        if not legacy:
            data["operation"] = operation
        self.sync._resolve = AsyncMock(return_value="192.168.50.10")
        self.sync._collection_members = AsyncMock(
            side_effect=lambda name: list(members[name])
        )
        started, release = asyncio.Event(), asyncio.Event()
        page = collections.form().replace(
            "</ul>",
            '<li class="dropdown_option"><input value="soon-token">'
            "<a>Watch Soon</a></li></ul>",
        )
        buttons = "".join(
            f'<button id="{button}" '
            f"onclick=\"submit_parent_form_once( event, '{action}' );\">Remove</button>"
            for _, button, action in REMOVAL_ACTIONS.values()
        )
        page = page.replace("</form>", buttons + "</form>")
        reads = 0

        async def get(_path):
            nonlocal reads
            reads += 1
            final = (
                3 if operation == "add" and collection not in {"New", "Played"} else 2
            )
            if reads == final:
                started.set()
                await release.wait()
            return BrowserResponse(200, "text/html", page.encode(), "utf-8")

        self.sync._get_response = get

        class Content:
            async def iter_chunked(self, _size):
                yield b""

        class Response:
            async def __aenter__(self):
                members["Favorites"].append(selected)
                return SimpleNamespace(
                    status=303,
                    content_type="text/html",
                    charset="utf-8",
                    headers={"Location": "/movies"},
                    content=Content(),
                )

            async def __aexit__(self, *_args):
                pass

        self.sync.session = SimpleNamespace(
            post=Mock(return_value=Response()), detach=Mock()
        )
        task = asyncio.create_task(
            self.call(
                "library/collections/add" if legacy else "library/collections/queue",
                **data,
            )
        )
        await asyncio.wait_for(started.wait(), 3)
        return request, task, release

    @expected_log(
        "custom_components.kaleidescape_companion.library.sync",
        "Collection change could not complete:",
    )
    async def test_final_form_revocation_prevents_all_supported_writes(self):
        cases = [
            ("Favorites", "add", False),
            ("WatchSoon", "add", False),
            ("Favorites", "remove", False),
            ("WatchSoon", "remove", False),
            ("Paused", "remove", False),
            ("New", "add", False),
            ("New", "remove", False),
            ("Played", "add", False),
            ("Played", "remove", False),
            ("Favorites", "add", True),
        ]
        for collection, operation, legacy in cases:
            for revoke in (
                "inactive",
                "admin",
                "opt_in",
                "collection_sync",
                "source",
                "configuration",
                "runtime",
            ):
                with self.subTest(
                    collection=collection,
                    operation=operation,
                    legacy=legacy,
                    revoke=revoke,
                ):
                    request, caller, release = await self.prepare(
                        collection, operation, legacy
                    )
                    runtime = self.entry.runtime_data
                    if revoke == "inactive":
                        self.admin.is_active = False
                    elif revoke == "admin":
                        self.admin.is_admin = False
                    elif revoke == "runtime":
                        runtime.library = None
                    else:
                        key, value = {
                            "opt_in": ("library_allow_collection_add", False),
                            "collection_sync": ("library_sync_collections", False),
                            "source": ("library_host", "http://another.invalid"),
                            "configuration": ("library_sync_details", False),
                        }[revoke]
                        object.__setattr__(
                            self.entry, "data", {**self.entry.data, key: value}
                        )
                    release.set()
                    response = await caller
                    if not legacy:
                        await self.sync.collection_queue_task
                        jobs = await self.sync.repository.async_collection_queue(
                            "status", library.SOURCE
                        )
                        job = next(row for row in jobs if row["request_id"] == request)
                        self.assertEqual(job["status"], "failed")
                        self.assertIn(
                            job["error"],
                            {"unauthorized", "not_ready", "library_disabled"},
                        )
                    else:
                        self.assertFalse(response["success"])
                        self.assertIn(
                            response["code"],
                            {"unauthorized", "not_ready", "library_disabled"},
                        )
                        self.assertNotIn("result", response)
                    self.sync.session.post.assert_not_called()
                    intent = await self.sync.repository.async_collection_intent(
                        library.SOURCE, request
                    )
                    self.assertEqual(intent["status"], "abandoned")
                    self.assertIsNone(intent["collection"])
                    self.assertEqual(
                        (
                            await self.sync.repository.async_collection_snapshot(
                                library.SOURCE
                            )
                        )["pending"],
                        [],
                    )

    async def test_pause_drains_accepted_legacy_write_with_valid_authority(self):
        request, caller, release = await self.prepare("Favorites", "add", True)
        pause = asyncio.create_task(self.sync.async_pause())
        await asyncio.sleep(0)
        self.assertFalse(pause.done())
        release.set()
        await pause
        self.assertTrue((await caller)["success"])
        self.sync.session.post.assert_called_once()
        self.assertEqual(
            (
                await self.sync.repository.async_collection_intent(
                    library.SOURCE, request
                )
            )["status"],
            "confirmed",
        )

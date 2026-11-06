"""Exact Journal/Library references, grouped lookups and safe legacy backfills."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_metadata as metadata
import test_repository as repository

from custom_components.kaleidescape_companion.core.repository import JournalRepository


class JournalLinksTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error
    seed = metadata.MetadataTest.seed
    observed = metadata.MetadataTest.observed

    async def create(self, handle):
        return (
            await self.repository.async_create_from_library(
                str(uuid4()),
                library.SOURCE,
                {
                    "library_title_id": library.title_id(library.SOURCE, handle),
                    "started_at": "2025-01-02T12:00:00Z",
                },
                actor_id="admin",
            )
        )["viewing"]["id"]

    async def test_grouped_links_include_rewatches_and_versions_but_not_remakes(self):
        await self.seed([{**row, "duration_seconds": 7200} for row in metadata.ROWS])
        a = await self.create(metadata.HANDLE)
        b = await self.create("0-S_B123BC45")
        await self.create("0-S_C123BC45")
        title = library.title_id(library.SOURCE, metadata.HANDLE)
        link = await self.repository.async_viewing_library(library.SOURCE, a)
        self.assertEqual(link["library"]["title_id"], title)
        self.assertEqual(set(link["library"]), {"title_id", "title", "artwork_key"})
        self.assertIsNone(
            (await self.repository.async_viewing_library("other", a))["library"]
        )
        scope = (library.SOURCE, title)
        first = await self.repository.async_list(library_scope=scope, limit=1)
        second = await self.repository.async_list(
            library_scope=scope, limit=1, cursor=first["next_cursor"]
        )
        self.assertEqual({first["items"][0]["id"], second["items"][0]["id"]}, {a, b})
        with self.assert_error("refresh_required"):
            await self.repository.async_list(limit=1, cursor=first["next_cursor"])
        with self.assert_error("not_found"):
            await self.repository.async_list(library_scope=("other", title))
        with self.assert_error("invalid_request"):
            await self.repository.async_list(library_scope=(library.SOURCE, "invalid"))
        row = await self.repository.async_get(a)
        await self.repository.async_delete(
            str(uuid4()), a, row["revision"], actor_id="admin"
        )
        self.assertEqual(
            [
                row["id"]
                for row in (await self.repository.async_list(library_scope=scope))[
                    "items"
                ]
            ],
            [b],
        )

    async def test_schema_17_backfills_exact_closed_rows_preserving_unknown_and_active(
        self,
    ):
        await self.seed()
        exact, _ = await self.observed()
        unknown, _ = await self.observed("unrecognized-handle")
        active, _ = await self.observed("26-0.0-S_B123BC45", close=False)

        def old_schema():
            db = self.repository._db()
            with db:
                db.execute("UPDATE viewings SET library_title_id=NULL")
                db.execute("DROP INDEX viewings_library_title")
                db.execute("DROP TABLE playback_controls")
                db.execute("ALTER TABLE library DROP COLUMN enrichment")
                db.execute("ALTER TABLE library DROP COLUMN sort_title")
                db.execute(
                    "ALTER TABLE library DROP COLUMN purchase_information_unavailable"
                )
                db.execute("DROP TABLE calendar_managed_events")
                db.execute("DROP TABLE calendar_reconcile_candidates")
                db.execute("DROP TABLE calendar_reconcile_intents")
                db.execute("DROP TABLE purchase_records")
                db.execute(
                    "ALTER TABLE library ADD COLUMN purchase_history "
                    "TEXT NOT NULL DEFAULT '[]'"
                )
                db.execute("DROP TABLE purchase_identity_barriers")
                db.execute("DROP TABLE purchase_repair_events")
                db.execute("PRAGMA user_version=16")

        await self.repository._call(old_schema)
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(
            (await self.repository.async_viewing_library(library.SOURCE, exact))[
                "library"
            ]["title_id"],
            library.title_id(library.SOURCE, metadata.HANDLE),
        )
        for id in (unknown, active):
            self.assertIsNone(
                (await self.repository.async_viewing_library(library.SOURCE, id))[
                    "library"
                ]
            )
        self.assertTrue(list(self.path.parent.glob(f"{self.path.name}.v16.*.bak")))


class JournalLinksApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_household_links_require_library_and_active_user(
        self,
    ):
        for command, fields in (
            ("library/viewing", {"viewing_id": str(uuid4())}),
            ("library/viewings", {"title_id": "a" * 64}),
        ):
            self.assertEqual(
                (await self.call(command, **self.scope, **fields))["code"],
                "library_disabled",
            )
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(source=library.SOURCE, async_stop=AsyncMock())
        await runtime.repository.async_library_catalog(
            library.ORIGIN, metadata.ROWS, {}
        )
        title = library.title_id(library.SOURCE, metadata.HANDLE)
        viewing = (
            await runtime.repository.async_create_from_library(
                str(uuid4()),
                library.SOURCE,
                {
                    "library_title_id": title,
                    "started_at": "2025-01-02T12:00:00Z",
                    "notes": "private",
                },
                actor_id="admin",
            )
        )["viewing"]
        user = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        link = await self.call(
            "library/viewing", user=user, **self.scope, viewing_id=viewing["id"]
        )
        self.assertEqual(
            set(link["result"]["library"]), {"title_id", "title", "artwork_key"}
        )
        result = await self.call(
            "library/viewings", user=user, **self.scope, title_id=title
        )
        self.assertEqual(len(result["result"]["items"]), 1)
        self.assertNotIn("notes", result["result"]["items"][0])
        self.assertNotIn("library_metadata", result["result"]["items"][0])
        original = runtime.repository.async_viewing_library

        async def revoke(*args):
            result = await original(*args)
            user.is_active = False
            return result

        runtime.repository.async_viewing_library = revoke
        self.assertEqual(
            (
                await self.call(
                    "library/viewing", user=user, **self.scope, viewing_id=viewing["id"]
                )
            )["code"],
            "unauthorized",
        )

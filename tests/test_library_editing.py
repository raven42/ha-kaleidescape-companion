"""Fictional administrator display overrides and immutable scanned identities."""

import json
import unittest
from uuid import uuid4

import test_enrichment as enrichment

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library.importing import portable_titles


class LibraryEditingTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.EnrichmentTest.asyncSetUp
    seed = enrichment.EnrichmentTest.seed
    call = enrichment.EnrichmentTest.call

    async def test_group_edits_preserve_identity_survive_scans_and_sort_both_views(
        self,
    ):
        await self.seed()
        inspect = await self.repo.async_library_edit(self.source, self.id)
        patch = {
            "title": "The Fictional Voyage",
            "sort_title": "A Voyage",
            "actors": ["New Lead"],
            "year": 2024,
            "rating": "PG",
        }
        args = (
            self.source,
            self.id,
            self.admin.id,
            str(uuid4()),
            inspect["snapshot"],
            patch,
        )
        result = await self.repo.async_library_edit(*args)
        self.assertEqual(result["updated_count"], 2)
        self.assertEqual(await self.repo.async_library_edit(*args), result)
        with self.assertRaises(JournalError):
            await self.repo.async_library_edit(*args[:2], "other", *args[3:])
        raw = (await self.repo.async_inspect("library"))["items"]
        row = next(row for row in raw if row["id"] == self.id)
        self.assertEqual(row["title"], "Fictional Film")
        self.assertEqual(json.loads(row["data"])["year"], 2025)
        self.assertEqual(row["sort_title"], "A Voyage")
        for grouped in (False, True):
            items = (
                await self.repo.async_library_list(
                    self.source, {"sort": "name", "grouped": grouped}
                )
            )["items"]
            self.assertEqual(items[0]["title"], "The Fictional Voyage")
            self.assertEqual(items[0]["year"], 2024)
            self.assertEqual(items[0]["rating"], "PG")
        found = await self.repo.async_library_list(
            self.source,
            {"query": "New Lead", "year": ["2024"], "rating": ["PG"], "grouped": True},
        )
        self.assertEqual(found["total"], 1)
        await self.repo.async_library_catalog(
            enrichment.ORIGIN,
            [
                {
                    "source_handle": "fictional",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                }
            ],
        )
        displayed = (await self.repo.async_library_versions(self.source, self.id))[
            "items"
        ][0]
        self.assertEqual(displayed["title"], patch["title"])
        self.assertEqual(displayed["actors"], ["New Lead"])
        self.assertEqual(displayed["sort_title"], "A Voyage")
        target = await self.repo.async_enrichment("review_target", self.source, self.id)
        self.assertEqual(target["title"], "Fictional Film")
        self.assertEqual(target["year"], 2025)
        exported = await self.repo._call(lambda: list(portable_titles(self.repo._db())))
        self.assertEqual(exported[0]["sort_title"], "A Voyage")

    async def test_purchase_edits_preserve_provider_metadata_and_export(self):
        await self.seed()
        before = await self.repo.async_library_edit(self.source, self.id)
        changes = {
            "purchased_on": "2020-01-02",
            "purchase_price": "$7.99",
            "retail_price": "$19.99",
            "purchase_information_unavailable": True,
        }
        await self.repo.async_library_edit(
            self.source,
            self.id,
            self.admin.id,
            str(uuid4()),
            before["snapshot"],
            changes,
        )
        after = await self.repo.async_library_edit(self.source, self.id)
        for key, value in changes.items():
            self.assertEqual(after["values"][key], value)
        raw = next(
            row
            for row in (await self.repo.async_inspect("library"))["items"]
            if row["id"] == self.id
        )
        self.assertEqual(json.loads(raw["enrichment"]), {})
        async with self.repo.async_export_snapshot("json") as path:
            from custom_components.kaleidescape_companion.core.importing import (
                parse_bundle,
            )

            parsed = parse_bundle(path.read_bytes(), "json")
        row = next(row for row in parsed["library"] if row["id"] == self.id)
        self.assertEqual(row["purchase_price"], "$7.99")
        self.assertEqual(row["retail_price"], "$19.99")
        self.assertEqual(row["purchase_information_unavailable"], 1)
        self.assertEqual(parsed["purchases"], [])
        totals = await self.repo.async_purchase_totals(self.source)
        self.assertEqual(totals["currencies"][0]["library_cost"], "$7.99")

    async def test_stale_and_protected_fields_fail_without_writes(self):
        await self.seed()
        review = await self.repo.async_library_edit(self.source, self.id)
        for patch in (
            {"id": "x"},
            {"source_group": "x"},
            {"artwork_key": "x"},
            {"duration_seconds": 20},
            {"href": "x"},
            {"year": True},
            {"title": ""},
            {"actors": "x"},
        ):
            with self.assertRaises(JournalError) as error:
                await self.repo.async_library_edit(
                    self.source,
                    self.id,
                    self.admin.id,
                    str(uuid4()),
                    review["snapshot"],
                    patch,
                )
            self.assertEqual(error.exception.code, "invalid_request")
        await self.repo.async_library_edit(
            self.source,
            self.id,
            self.admin.id,
            str(uuid4()),
            review["snapshot"],
            {"sort_title": "Sort me"},
        )
        with self.assertRaises(JournalError) as error:
            await self.repo.async_library_edit(
                self.source,
                self.id,
                self.admin.id,
                str(uuid4()),
                review["snapshot"],
                {"synopsis": "Stale"},
            )
        self.assertEqual(error.exception.code, "refresh_required")
        current = await self.repo.async_library_edit(self.source, self.id)
        await self.repo.async_library_edit(
            self.source,
            self.id,
            self.admin.id,
            str(uuid4()),
            current["snapshot"],
            {"sort_title": None},
        )
        self.assertIsNone(
            (await self.repo.async_library_edit(self.source, self.id))["values"][
                "sort_title"
            ]
        )

    async def test_api_denies_regular_users_and_downgrade_during_read(self):
        await self.seed()
        self.admin.is_admin = False
        denied = await self.call("library/edit/get", **self.scope, title_id=self.id)
        self.assertEqual(denied["code"], "unauthorized")
        denied = await self.call(
            "library/edit/save",
            **self.scope,
            request_id=str(uuid4()),
            title_id=self.id,
            snapshot="0" * 64,
            patch={"title": "Denied"},
        )
        self.assertEqual(denied["code"], "unauthorized")

        from unittest.mock import patch

        self.admin.is_admin = True
        original = self.repo.async_library_edit

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(self.repo, "async_library_edit", side_effect=revoke):
            denied = await self.call("library/edit/get", **self.scope, title_id=self.id)
        self.assertEqual(denied["code"], "unauthorized")

    async def test_changed_source_group_invalidates_an_edit_snapshot(self):
        await self.seed()
        review = await self.repo.async_library_edit(self.source, self.id)

        def regroup():
            with self.repo._db() as db:
                db.execute(
                    "UPDATE library SET source_group='corrected-group' "
                    "WHERE source_group='movie'"
                )

        await self.repo._call(regroup)
        with self.assertRaises(JournalError) as error:
            await self.repo.async_library_edit(
                self.source,
                self.id,
                self.admin.id,
                str(uuid4()),
                review["snapshot"],
                {"sort_title": "Changed"},
            )
        self.assertEqual(error.exception.code, "refresh_required")

    async def test_source_reset_is_confirmed_replayable_and_blocks_stale_scrapers(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        stats = await self.repo.async_enrichment("statistics", self.source)
        self.assertEqual(stats["cached_groups"], 1)
        self.assertEqual(stats["by_provider"], {"tmdb": 1, "kaleidescape": 0})
        review = await self.repo.async_library_edit(self.source, self.id)
        invalid = await self.call(
            "library/edit/reset",
            **self.scope,
            title_id=self.id,
            request_id=str(uuid4()),
            snapshot=review["snapshot"],
            confirmation="",
        )
        self.assertEqual(invalid["code"], "invalid_request")
        args = (self.source, self.id, self.admin.id, str(uuid4()), review["snapshot"])
        result = await self.repo.async_library_reset(*args)
        self.assertEqual(result["updated_count"], 2)
        self.assertEqual(await self.repo.async_library_reset(*args), result)
        row = (await self.repo.async_library_versions(self.source, self.id))["items"][0]
        self.assertEqual(row["title"], "Fictional Film")
        self.assertEqual(row["enrichment"], {})
        self.assertNotIn("Expanded Actor", row["actors"])
        self.assertEqual(
            (await self.repo.async_enrichment("statistics", self.source))[
                "cached_groups"
            ],
            0,
        )
        await self.repo.async_library_catalog(
            enrichment.ORIGIN,
            [
                {
                    "source_handle": handle,
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                }
                for handle in ("fictional", "new-format")
            ],
        )
        candidates = await self.repo.async_enrichment("candidates", self.source)
        self.assertNotIn(self.id, [item["id"] for item in candidates])
        with self.assertRaises(JournalError) as error:
            await self.repo.async_enrichment(
                "save", self.source, self.id, "tmdb", self.data
            )
        self.assertEqual(error.exception.code, "refresh_required")
        self.admin.is_admin = False
        denied = await self.call(
            "library/edit/reset",
            **self.scope,
            title_id=self.id,
            request_id=str(uuid4()),
            snapshot=review["snapshot"],
            confirmation="RESTORE SOURCE",
        )
        self.assertEqual(denied["code"], "unauthorized")

    async def test_admin_footer_statistics_are_withheld_from_regular_users(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        self.entry.runtime_data.library.status = lambda: {"phase": "idle"}
        admin = await self.call("library/info", **self.scope)
        self.assertEqual(admin["result"]["metadata"]["cached_groups"], 1)
        self.admin.is_admin = False
        reader = await self.call("library/info", **self.scope)
        self.assertNotIn("metadata", reader["result"])

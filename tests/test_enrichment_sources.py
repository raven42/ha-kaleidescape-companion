"""Shared source policies change projections, never the scanned library facts."""

import hashlib
import json
import unittest
from uuid import uuid4

import test_enrichment as enrichment

from custom_components.kaleidescape_companion.enrichment import config, selection


class SourcePreferencesTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.EnrichmentTest.asyncSetUp
    seed = enrichment.EnrichmentTest.seed
    call = enrichment.EnrichmentTest.call

    async def cache(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save",
            self.source,
            self.id,
            "tmdb",
            {
                **self.data,
                "synopsis": "TMDB story",
                "genres": ["Adventure"],
            },
        )
        await self.repo.async_enrichment(
            "save",
            self.source,
            self.id,
            "kaleidescape",
            {
                **self.data,
                "provider": "kaleidescape",
                "actors": ["Store Actor"],
                "synopsis": "Store story",
                "critic_score": 81,
                "audience_score": 88,
            },
        )

    async def details(self):
        return (await self.repo.async_library_versions(self.source, self.id))["items"][
            0
        ]

    async def test_shared_sources_change_details_search_and_facets_not_raw_data(self):
        await self.cache()
        before = await self.repo.async_library_info(self.source)
        await self.repo.async_metadata_sources(
            {
                "metadata_source_actors": "tmdb",
                "metadata_source_synopsis": "tmdb",
                "metadata_source_critic_score": "kaleidescape",
            }
        )
        row = await self.details()
        self.assertEqual(row["actors"], ["Expanded Actor"])
        self.assertEqual(row["synopsis"], "TMDB story")
        self.assertEqual(row["ratings"]["critic_score"], 81)
        for query, count in (("Expanded Actor", 1), ("Store Actor", 0)):
            page = await self.repo.async_library_list(
                self.source,
                {
                    "query": query,
                    "grouped": True,
                },
            )
            self.assertEqual(page["total"], count)
        page = await self.repo.async_library_list(
            self.source,
            {
                "actor": ["Expanded Actor"],
                "grouped": True,
            },
        )
        self.assertEqual(page["total"], 1)
        after = await self.repo.async_library_info(self.source)
        self.assertGreater(after["revision"], before["revision"])
        await self.repo.async_metadata_sources({"metadata_source_actors": "original"})
        self.assertEqual((await self.details())["actors"], ["Original Actor"])
        stored = (await self.repo.async_inspect("library"))["items"]
        original = next(row for row in stored if row["id"] == self.id)
        self.assertEqual(json.loads(original["data"])["actors"], ["Original Actor"])
        self.assertEqual(original["source_group"], "movie")

    async def test_missing_provider_falls_back_but_reviewed_edit_always_wins(self):
        await self.cache()
        await self.repo.async_metadata_sources(
            {"metadata_source_producers": "kaleidescape"}
        )
        self.assertEqual((await self.details())["producers"], ["Example Producer"])
        review = await self.repo.async_library_edit(self.source, self.id)
        await self.repo.async_library_edit(
            self.source,
            self.id,
            self.admin.id,
            str(uuid4()),
            review["snapshot"],
            {"actors": ["Chosen Lead"]},
        )
        for source in ("tmdb", "original", "kaleidescape"):
            await self.repo.async_metadata_sources({"metadata_source_actors": source})
            self.assertEqual((await self.details())["actors"], ["Chosen Lead"])

    async def test_poster_policy_switches_cached_images_and_cleans_all_references(self):
        await self.cache()
        original, poster, hero = [
            b"\xff\xd8\xff" + name for name in (b"original", b"tmdb", b"hero")
        ]
        await self.repo.async_library_artwork_save(
            self.source, self.id, original, "image/jpeg", 1048576
        )
        for operation, data in (("poster", poster), ("artwork", hero)):
            await self.repo.async_enrichment(
                operation, self.source, self.id, self.data, data, 1048576
            )

        def key(data):
            return hashlib.sha256(data).hexdigest()

        self.assertEqual((await self.details())["artwork_key"], key(original))
        await self.repo.async_metadata_sources({"metadata_source_artwork": "tmdb"})
        self.assertEqual((await self.details())["artwork_key"], key(poster))
        page = await self.repo.async_library_list(self.source, {"grouped": True})
        group = next(row for row in page["items"] if row["year"] == 2025)
        self.assertEqual(group["artwork_key"], key(poster))
        self.assertEqual(
            await self.repo.async_library_artwork(self.source, key(poster)),
            (poster, "image/jpeg"),
        )
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        self.assertEqual((await self.details())["artwork_key"], key(poster))
        await self.repo.async_metadata_sources({"metadata_source_backdrop": "original"})
        row = await self.details()
        self.assertEqual(row["artwork_key"], key(original))
        self.assertIsNone(row["backdrop_key"])
        await self.repo.async_library_trim(0)
        row = await self.details()
        self.assertNotIn("poster_key", row["enrichment"]["tmdb"])
        self.assertNotIn("backdrop_key", row["enrichment"]["tmdb"])

    def test_config_validates_source_enums_without_enabling_network(self):
        value = config.validate({"metadata_source_artwork": "tmdb"}, {})
        self.assertFalse(value["metadata_tmdb_enabled"])
        self.assertEqual(
            selection.configured(value), {"artwork": "tmdb", "_enabled": []}
        )
        for field, source in (
            ("actors", "bad"),
            ("critic_score", "tmdb"),
            ("backdrop", True),
        ):
            with self.assertRaises(ValueError):
                config.validate({f"metadata_source_{field}": source}, {})

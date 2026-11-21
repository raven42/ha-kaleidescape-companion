"""Fictional cached artwork is linked only within an unambiguous source group."""

import hashlib
import json
import unittest

import test_library as library

from custom_components.kaleidescape_companion.library.store import source_id, title_id


class ArtworkLinksTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def seed_artwork(self, rows):
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        artwork = b"\xff\xd8\xfffictional-cover-and-backdrop"
        await self.repository.async_library_artwork_save(
            library.SOURCE,
            title_id(library.SOURCE, "fixture-a"),
            artwork,
            "image/jpeg",
            1024 * 1024,
        )
        key = hashlib.sha256(artwork).hexdigest()

        def backdrop():
            db = self.repository._db()
            with db:
                db.execute(
                    "UPDATE library SET enrichment=json_set(enrichment, "
                    "'$.tmdb.backdrop_key',?) WHERE id=?",
                    (key, title_id(library.SOURCE, "fixture-a")),
                )

        await self.repository._call(backdrop)
        return key

    async def rows(self):
        page = await self.repository.async_inspect("library", limit=100)
        return {row["id"]: row for row in page["items"]}

    async def test_new_edition_inherits_existing_group_images_without_network(self):
        key = await self.seed_artwork(library.ROWS[:1])
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        rows = await self.rows()
        added = rows[title_id(library.SOURCE, "fixture-a2")]
        self.assertEqual(added["artwork_key"], key)
        self.assertEqual(
            json.loads(added["enrichment"])["reviewed"]["backdrop_key"], key
        )
        self.assertIsNone(rows[title_id(library.SOURCE, "fixture-b")]["artwork_key"])
        self.assertEqual(
            (await self.repository.async_database_cleanup_preview({}))["artwork_links"],
            0,
        )
        other_origin = "http://second-fictional-source.local"
        await self.repository.async_library_catalog(other_origin, [library.ROWS[0]], {})
        other = (await self.rows())[title_id(source_id(other_origin), "fixture-a")]
        self.assertIsNone(other["artwork_key"])
        self.assertEqual(
            (await self.repository.async_database_cleanup({}))["artwork_links"], 0
        )

    async def test_missing_artwork_filter_checks_every_available_edition(self):
        await self.seed_artwork(library.ROWS)
        page = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "system_filters": ["missing_artwork"]}
        )
        self.assertEqual(
            {row["title"] for row in page["items"]},
            {library.ROWS[0]["title"], library.ROWS[1]["title"]},
        )
        # The group-level sensor still sees the first group's existing images.
        self.assertEqual(
            (await self.repository.async_library_summary(library.SOURCE))[
                "missing_artwork"
            ],
            1,
        )
        await self.repository.async_database_cleanup({})
        page = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "system_filters": ["missing_artwork"]}
        )
        self.assertEqual(
            [row["title"] for row in page["items"]], [library.ROWS[1]["title"]]
        )

        def mark_unavailable():
            db = self.repository._db()
            with db:
                db.execute(
                    "UPDATE library SET enrichment=json_set(enrichment, "
                    "'$.unavailable_artwork.poster',json('true'), "
                    "'$.unavailable_artwork.backdrop',json('true')) WHERE id=?",
                    (title_id(library.SOURCE, "fixture-b"),),
                )

        await self.repository._call(mark_unavailable)
        page = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "system_filters": ["missing_artwork"]}
        )
        self.assertEqual(page["total"], 0)

    async def test_cleanup_previews_repairs_and_is_idempotent(self):
        key = await self.seed_artwork(library.ROWS)
        before = await self.rows()
        self.assertIsNone(before[title_id(library.SOURCE, "fixture-a2")]["artwork_key"])
        review = await self.repository.async_database_cleanup_preview({})
        self.assertEqual(review["artwork_links"], 1)
        self.assertEqual(await self.rows(), before)
        result = await self.repository.async_database_cleanup(
            {}, review["as_of"], review["revision"]
        )
        self.assertEqual(result["artwork_links"], 1)
        after = await self.rows()
        target = after[title_id(library.SOURCE, "fixture-a2")]
        self.assertEqual(target["artwork_key"], key)
        self.assertEqual(
            json.loads(target["enrichment"])["reviewed"]["backdrop_key"], key
        )
        self.assertEqual(
            (await self.repository.async_database_cleanup({}))["artwork_links"], 0
        )
        with self.assert_error("conflict"):
            await self.repository.async_database_cleanup(
                {}, review["as_of"], review["revision"]
            )

    async def test_conflicting_covers_do_not_choose_an_arbitrary_edition(self):
        await self.seed_artwork([library.ROWS[0], library.ROWS[2]])
        await self.repository.async_library_artwork_save(
            library.SOURCE,
            title_id(library.SOURCE, "fixture-a2"),
            b"\xff\xd8\xffother-fictional-cover",
            "image/jpeg",
            1024 * 1024,
        )
        third = {**library.ROWS[0], "source_handle": "fixture-a3"}
        await self.repository.async_library_catalog(
            library.ORIGIN, [library.ROWS[0], library.ROWS[2], third], {}
        )
        target = (await self.rows())[title_id(library.SOURCE, "fixture-a3")]
        self.assertIsNone(target["artwork_key"])
        self.assertIn("backdrop_key", json.loads(target["enrichment"])["reviewed"])

    async def test_explicit_unavailability_and_removed_backdrop_are_not_replaced(self):
        await self.seed_artwork(library.ROWS)

        def flags():
            db = self.repository._db()
            with db:
                db.execute(
                    "UPDATE library SET enrichment=json_set(enrichment,"
                    "'$.unavailable_artwork.poster',json('true')) WHERE id=?",
                    (title_id(library.SOURCE, "fixture-a"),),
                )
                db.execute(
                    "UPDATE library SET enrichment=json_set(enrichment,"
                    "'$.reviewed.backdrop_removed',json('true')) WHERE id=?",
                    (title_id(library.SOURCE, "fixture-a2"),),
                )

        await self.repository._call(flags)
        self.assertEqual(
            (await self.repository.async_database_cleanup({}))["artwork_links"], 0
        )
        target = (await self.rows())[title_id(library.SOURCE, "fixture-a2")]
        self.assertIsNone(target["artwork_key"])
        self.assertTrue(
            json.loads(target["enrichment"])["reviewed"]["backdrop_removed"]
        )

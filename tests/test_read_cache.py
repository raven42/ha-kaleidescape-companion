"""Bounded private read memoization and reduced work over fictional credits."""

import json
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import patch

import test_enrichment_sources as enrichment
import test_library as library
import test_repository as repository

from custom_components.kaleidescape_companion.core import read_cache, search
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.enrichment.store import effective
from custom_components.kaleidescape_companion.library import browse


class ReadCacheTest(unittest.TestCase):
    def test_compact_scalars_preserve_reviewed_nulls_and_ignore_provider_facts(self):
        data = json.dumps({"year": 2025, "rating": "PG"})
        with closing(sqlite3.connect(":memory:")) as db:
            db.execute("CREATE TABLE sample(data,enrichment)")
            for reviewed in (
                {},
                {"year": 2026, "rating": "R"},
                {"year": None, "rating": ""},
            ):
                metadata = json.dumps(
                    {"tmdb": {"year": 2027, "rating": "G"}, "reviewed": reviewed}
                )
                db.execute("DELETE FROM sample")
                db.execute("INSERT INTO sample VALUES (?,?)", (data, metadata))
                expected = json.loads(effective(data, metadata))
                for key in ("year", "rating"):
                    actual = db.execute(
                        f"SELECT {browse.scalar_sql(key)} FROM sample"
                    ).fetchone()[0]
                    self.assertEqual(actual, expected[key])

    def test_byte_bound_lru_oversized_values_and_explicit_clear(self):
        cache = read_cache.Memo(max_bytes=2000)
        calls = []

        def calculate(value):
            calls.append(value)
            return value * 2

        for value in ("a" * 100, "b" * 100, "a" * 100, "c" * 100):
            cache.call(calculate, value)
            self.assertLessEqual(cache.bytes, 2000)
        self.assertEqual(len(calls), 3)
        cache.call(calculate, "b" * 100)  # Least recently used entry was evicted.
        self.assertEqual(len(calls), 4)
        cache.call(calculate, "oversized" * 1000)
        self.assertLessEqual(cache.bytes, 2000)
        cache.clear()
        self.assertEqual(cache.bytes, 0)
        self.assertFalse(cache.items)
        cache = read_cache.Memo(max_items=1)
        for value in ("one", "two", "three"):
            cache.call(calculate, value)
            self.assertEqual(len(cache.items), 1)

    def test_cached_containers_cannot_be_changed_by_a_response_consumer(self):
        cache = read_cache.Memo()
        result = cache.call(lambda: {"actors": ["Fictional Actor"]})
        function = next(iter(cache.items))[0]
        result["actors"].clear()
        self.assertEqual(cache.call(function), {"actors": ["Fictional Actor"]})

    def test_prepared_matchers_preserve_unicode_phrases_and_drop_request_state(self):
        cache = read_cache.ReadCache()
        for query, value, fuzzy, expected in (
            ('"Tom Holland"', "Tom Hollander", True, False),
            ('"\\u0054om Holland"', "Tom Holland", True, True),
            ("Straße", "STRASSE", False, True),
            ("Jose", "José Example", True, True),
            ("Exampel", "Example", True, True),
            ('""', "Example", True, False),
        ):
            with cache.search():
                self.assertEqual(cache.matches(value, query, fuzzy), expected)
                self.assertEqual(cache.matches(value, query, fuzzy), expected)
            self.assertIsNone(cache.matchers)
        with self.assertRaisesRegex(ValueError, "fictional"):
            with cache.search():
                cache.matches("Actor", "A", True)
                raise ValueError("fictional")
        self.assertIsNone(cache.matchers)


class LibraryReadCacheTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp

    async def test_facets_resolve_each_version_once_with_bounded_sorted_choices(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [
                {**row, "actors": [f"Fictional Person {i:03}" for i in range(540)]}
                for row in library.ROWS
            ],
            {},
        )
        calls = []

        def run():
            def project(data, enrichment):
                calls.append(1)
                return effective(data, enrichment)

            db = self.repository._db()
            db.create_function("companion_metadata", 2, project)
            return browse.library_facets(db, library.SOURCE, ())

        facets, truncated = await self.repository._call(run)
        self.assertEqual(len(calls), len(library.ROWS))
        self.assertEqual(len(facets["actors"]), 500)
        self.assertEqual(facets["actors"][-1], "Fictional Person 499")
        self.assertEqual(truncated, ["actors"])
        self.assertEqual(facets["year"], sorted(facets["year"], reverse=True))

    async def test_interrupted_read_clears_matchers_and_progress_handler(self):
        def run(db):
            db.execute("SELECT companion_matches('Fictional Actor','Actro',1)")
            db.execute(
                "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n "
                "WHERE x<10000) SELECT sum(x) FROM n"
            ).fetchone()

        with patch(
            "custom_components.kaleidescape_companion.core.repository.time",
            SimpleNamespace(monotonic=iter([0, 3]).__next__),
        ):
            with self.assertRaises(JournalError) as error:
                await self.repository._call(self.repository._search_read, run)
        self.assertEqual(error.exception.code, "query_limit")
        self.assertIsNone(self.repository._read_cache.matchers)
        self.assertEqual((await self.repository.async_list())["items"], [])

    async def test_repeated_credits_are_compared_once_not_per_version_or_page_query(
        self,
    ):
        rows = [
            {
                **library.ROWS[0],
                "source_handle": f"fictional-{index}",
                "source_group": f"group-{index // 2}",
                "actors": [f"Fictional Actor {person}" for person in range(40)],
            }
            for index in range(60)
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        tested = []
        original = search.Matcher._test

        def count(matcher, value):
            if value.startswith("Fictional Actor"):
                tested.append(value)
            return original(matcher, value)

        with patch.object(search.Matcher, "_test", count):
            page = await self.repository.async_library_list(
                library.SOURCE,
                {"query": "Fictional Actro", "fuzzy": True, "grouped": True},
            )
        self.assertEqual(page["total"], 30)
        self.assertEqual(len(tested), 40)

    async def test_facets_refresh_after_writes_and_hidden_label_changes(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        with patch.object(
            browse, "library_facets", wraps=browse.library_facets
        ) as facets:
            first = await self.repository.async_library_list(library.SOURCE, {})
            await self.repository.async_library_list(
                library.SOURCE, {"query": "Example"}
            )
            self.assertEqual(facets.call_count, 1)
            await self.repository.async_library_catalog(
                library.ORIGIN,
                [{**row, "actors": ["New Fictional Actor"]} for row in library.ROWS],
                {"Fictional Collection": [library.ROWS[0]["source_handle"]]},
            )
            changed = await self.repository.async_library_list(library.SOURCE, {})
            self.assertEqual(changed["facets"]["actors"], ["New Fictional Actor"])
            self.assertNotEqual(first["facets"], changed["facets"])
            self.assertEqual(facets.call_count, 2)
            hidden = await self.repository.async_library_list(
                library.SOURCE, {}, "Fictional Collection"
            )
            self.assertNotIn("Fictional Collection", hidden["facets"]["collections"])
            self.assertEqual(facets.call_count, 3)
        await self.repository.async_close()
        self.assertFalse(self.repository._read_cache.projections.items)
        self.assertFalse(self.repository._read_cache.facets.items)


class EnrichedReadCacheTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.SourcePreferencesTest.asyncSetUp
    seed = enrichment.SourcePreferencesTest.seed
    cache = enrichment.SourcePreferencesTest.cache
    call = enrichment.SourcePreferencesTest.call

    async def test_admin_and_reader_share_results_and_policy_changes_invalidate_cache(
        self,
    ):
        await self.cache()
        reader = SimpleNamespace(id="fictional-reader", is_active=True, is_admin=False)
        for fuzzy in (False, True):
            filters = {"query": "Expanded Actor", "fuzzy": fuzzy, "grouped": True}
            admin = await self.call("library/list", **self.scope, filters=filters)
            household = await self.call(
                "library/list", user=reader, **self.scope, filters=filters
            )
            self.assertTrue(admin["success"])
            self.assertTrue(household["success"])
            self.assertEqual(admin["result"], household["result"])
            self.assertEqual(household["result"]["total"], 1)
            for item in household["result"]["items"]:
                self.assertFalse(
                    set(item) & {"data", "source_id", "order_id", "purchase_history"}
                )
        await self.repo.async_metadata_sources({"metadata_source_actors": "original"})
        changed = await self.call(
            "library/list", user=reader, **self.scope, filters=filters
        )
        self.assertTrue(changed["success"])
        self.assertEqual(changed["result"]["total"], 0)
        self.assertNotIn("Expanded Actor", changed["result"]["facets"]["actors"])

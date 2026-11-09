"""Fictional exact/fuzzy reads, preference isolation and cursor-mode boundaries."""

import unittest
from uuid import uuid4

import test_library as library
import test_repository as repository

from custom_components.kaleidescape_companion.core.repository import JournalRepository


class SearchTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

    async def test_cast_billing_position_adjusts_relevance_without_filtering(self):
        actor = "Scarlett Example"
        extras = [f"Extra Person {index}" for index in range(45)]
        cases = [
            ("lead", "lead", "Leading Role", [actor], []),
            ("support", "support", "Supporting Role", extras[:5] + [actor], []),
            ("late", "late", "Late Role", extras + [actor], []),
            ("other-a", "other", "Other Version", extras + [actor], []),
            ("other-b", "other", "Other Version", [actor], []),
            ("director", "director", "Director Credit", [], [actor]),
        ]
        rows = [
            {
                **library.ROWS[0],
                "source_handle": handle,
                "source_group": group,
                "title": title,
                "actors": actors,
                "directors": directors,
                "writers": [],
                "producers": [],
                "studios": [],
            }
            for handle, group, title, actors, directors in cases
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        for fuzzy, query in ((False, '"Scarlett Example"'), (True, "scarlet")):
            filters = {"query": query, "fuzzy": fuzzy, "grouped": True}
            page = await self.repository.async_library_list(library.SOURCE, filters)
            titles = [item["title"] for item in page["items"]]
            self.assertEqual(page["total"], 5)
            self.assertLess(
                titles.index("Leading Role"), titles.index("Supporting Role")
            )
            self.assertLess(titles.index("Supporting Role"), titles.index("Late Role"))
            self.assertLess(
                titles.index("Other Version"), titles.index("Supporting Role")
            )
            self.assertLess(titles.index("Director Credit"), titles.index("Late Role"))
            first = await self.repository.async_library_list(
                library.SOURCE, {**filters, "limit": 2}
            )
            second = await self.repository.async_library_list(
                library.SOURCE, {**filters, "limit": 2, "offset": 2}
            )
            self.assertEqual(
                [item["id"] for item in first["items"] + second["items"]],
                [item["id"] for item in page["items"][:4]],
            )

    async def test_library_relevance_preserves_matches_and_ignores_sort(self):
        cases = [
            ("exact-title", "Bourne", []),
            ("title-word", "The Bourne Identity", []),
            ("fuzzy-title", "The Borne Identity", []),
            ("credit-word", "Zebra", ["Jason Bourne"]),
            ("fuzzy-credit", "Alpha", ["Jason Borne"]),
            ("irrelevant", "Other", []),
        ]
        rows = [
            {
                **library.ROWS[0],
                "source_handle": handle,
                "source_group": handle,
                "title": title,
                "actors": actors,
                "directors": [],
            }
            for handle, title, actors in cases
        ]
        # A credit on another edition must contribute to the same movie group.
        rows.append({**rows[3], "source_handle": "credit-second", "actors": []})
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        expected = [
            "Bourne",
            "The Bourne Identity",
            "Zebra",
            "The Borne Identity",
            "Alpha",
        ]
        for grouped in (True, False):
            for sort in ("name", "year", "random"):
                filters = {
                    "query": "bourne",
                    "fuzzy": True,
                    "grouped": grouped,
                    "sort": sort,
                    "descending": True,
                    "random_seed": "a" * 32,
                }
                page = await self.repository.async_library_list(library.SOURCE, filters)
                titles = [row["title"] for row in page["items"]]
                self.assertEqual(list(dict.fromkeys(titles)), expected)
                self.assertEqual(page["total"], 5 if grouped else 6)
                first = await self.repository.async_library_list(
                    library.SOURCE, {**filters, "limit": 2}
                )
                second = await self.repository.async_library_list(
                    library.SOURCE,
                    {**filters, "limit": 2, "offset": 2, "revision": first["revision"]},
                )
                self.assertEqual(
                    [r["id"] for r in first["items"] + second["items"]],
                    [r["id"] for r in page["items"][:4]],
                )
        literal = await self.repository.async_library_list(
            library.SOURCE, {"query": '"bourne"', "fuzzy": True, "grouped": True}
        )
        self.assertEqual([row["title"] for row in literal["items"]], expected[:3])
        ordinary = await self.repository.async_library_list(
            library.SOURCE, {"sort": "name", "grouped": True}
        )
        self.assertEqual(
            [row["title"] for row in ordinary["items"]],
            [
                "Alpha",
                "Bourne",
                "Other",
                "The Borne Identity",
                "The Bourne Identity",
                "Zebra",
            ],
        )

    async def test_fuzzy_word_outranks_incidental_substring(self):
        rows = [
            {
                **library.ROWS[0],
                "source_handle": str(index),
                "source_group": str(index),
                "title": title,
                "actors": actors,
                "directors": [],
            }
            for index, (title, actors) in enumerate(
                [
                    ("The Bourne Identity", []),
                    ("Other Movie", ["Example Osborne"]),
                    ("Claiborne", []),
                ]
            )
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        page = await self.repository.async_library_list(
            library.SOURCE, {"query": "borne", "fuzzy": True, "grouped": True}
        )
        self.assertEqual(
            [row["title"] for row in page["items"]],
            ["The Bourne Identity", "Claiborne", "Other Movie"],
        )

    async def test_leading_prefix_actor_outranks_late_whole_word_actor(self):
        extras = [f"Fictional Person {index}" for index in range(80)]
        rows = [
            {
                **library.ROWS[0],
                "source_handle": "late",
                "source_group": "late",
                "title": "Late Credit",
                "actors": extras + ["Scarlet Example"],
                "directors": [],
            },
            {
                **library.ROWS[0],
                "source_handle": "lead",
                "source_group": "lead",
                "title": "Leading Credit",
                "actors": ["Scarlett Example"],
                "directors": [],
            },
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        page = await self.repository.async_library_list(
            library.SOURCE, {"query": "scarlet", "fuzzy": True, "grouped": True}
        )
        self.assertEqual(
            [item["title"] for item in page["items"]],
            ["Leading Credit", "Late Credit"],
        )

    async def test_weighted_match_quality_field_and_cast_position(self):
        extras = [f"Person {i}" for i in range(35)]
        cases = [
            ("Matt Story", [], [], [], []),
            ("Early Actor", ["Matt Example"], [], [], []),
            ("Late Actor", extras + ["Matt Example"], [], [], []),
            ("Director Movie", [], ["Matt Example"], [], []),
            ("Writer Movie", [], [], ["Matt Example"], []),
            ("Producer Movie", [], [], [], ["Matt Example"]),
            ("Prefix Actor", ["Matthew Example"], [], [], []),
            ("Fuzzy Title Mat", [], [], [], []),
        ]
        rows = [
            {
                **library.ROWS[0],
                "source_handle": str(index),
                "source_group": str(index),
                "title": title,
                "actors": actors,
                "directors": directors,
                "writers": writers,
                "producers": producers,
                "studios": [],
            }
            for index, (title, actors, directors, writers, producers) in enumerate(
                cases
            )
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        page = await self.repository.async_library_list(
            library.SOURCE, {"query": "matt", "fuzzy": True, "grouped": True}
        )
        titles = [item["title"] for item in page["items"]]
        self.assertEqual(len(titles), len(cases))
        self.assertEqual(titles[0], "Matt Story")
        self.assertLess(titles.index("Early Actor"), titles.index("Late Actor"))
        self.assertLess(titles.index("Prefix Actor"), titles.index("Fuzzy Title Mat"))
        self.assertLess(titles.index("Director Movie"), titles.index("Writer Movie"))
        self.assertLess(titles.index("Director Movie"), titles.index("Producer Movie"))

    async def test_quoted_phrases_across_all_worker_searches(
        self,
    ):
        rows = [
            {
                **library.ROWS[0],
                "source_handle": f"quoted-{i}",
                "source_group": f"quoted-{i}",
                "title": title,
                "actors": [person],
            }
            for i, (title, person) in enumerate(
                [
                    ("A Fictional Journey", "Tom Holland"),
                    ("Another Fictional Journey", "Tom Hollander"),
                ]
            )
        ]
        await self.repository.async_library_catalog(library.ORIGIN, rows, {})
        for fuzzy in (False, True):
            page = await self.repository.async_library_list(
                library.SOURCE,
                {"query": '"Tom Holland"', "fuzzy": fuzzy, "grouped": True},
            )
            self.assertEqual(page["total"], 1)
            self.assertEqual(page["items"][0]["title"], "A Fictional Journey")
            self.assertEqual(
                (
                    await self.repository.async_library_list(
                        library.SOURCE, {"query": "Tom Holland", "fuzzy": fuzzy}
                    )
                )["total"],
                2,
            )
            self.assertEqual(
                len(
                    (
                        await self.repository.async_library_search(
                            library.SOURCE, '"Fictional Journey"', [], fuzzy
                        )
                    )["items"]
                ),
                2,
            )
            self.assertEqual(
                (
                    await self.repository.async_library_search(
                        library.SOURCE, '"Fictional Journe"', [], fuzzy
                    )
                )["items"],
                [],
            )
        self.assertEqual(
            (await self.repository.async_inspect("library", query='"Tom Holland"'))[
                "total"
            ],
            1,
        )
        for title in ("Tom Holland Documentary", "Tom Hollander Documentary"):
            await self.repository.async_create(
                str(uuid4()), repository.viewing(title=title)
            )
        for fuzzy in (False, True):
            self.assertEqual(
                len(
                    (
                        await self.repository.async_list(
                            query='"Tom Holland"', fuzzy=fuzzy
                        )
                    )["items"]
                ),
                1,
            )
        from custom_components.kaleidescape_companion.core.search import matches

        self.assertFalse(matches("Tom Hollander", '"Tom Holland"', True))
        self.assertTrue(
            matches("Cast: Tom Holland, Other Person", '"Tom Holland"', True)
        )
        self.assertTrue(matches("A [Literal] Title", '"[Literal]"'))
        self.assertFalse(matches("anything", '""', True))

    async def seed(self):
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [
                {
                    **library.ROWS[0],
                    "actors": ["Fictional Straße"],
                    "directors": ["Alice Example"],
                },
                library.ROWS[1],
                library.ROWS[2],
            ],
            {},
        )

    async def test_manual_completion_literal_partial_and_fuzzy_typos(self):
        await self.seed()

        async def titles(query, fuzzy):
            page = await self.repository.async_library_search(
                library.SOURCE, query, [], fuzzy
            )
            return [row["title"] for row in page["items"]]

        self.assertEqual(await titles("voyge", False), [])
        self.assertEqual(len(await titles("voyge", True)), 2)
        self.assertEqual(len(await titles("VOYAGE", False)), 2)
        self.assertEqual(await titles("Europa Voyage", False), [])
        self.assertEqual(len(await titles("Europa Voyage", True)), 2)
        self.assertEqual(await titles("", False), [])
        self.assertEqual(await titles("100%_", False), [library.ROWS[1]["title"]])
        self.assertEqual(await titles("' OR 1=1 --", False), [])
        with self.assert_error("invalid_request"):
            await self.repository.async_library_search(
                library.SOURCE, "Voyage", [], "yes"
            )

    async def test_catalog_queries_and_people_completion_share_mode(self):
        await self.seed()
        for fuzzy, expected in [(False, 0), (True, 1)]:
            page = await self.repository.async_library_list(
                library.SOURCE, {"query": "Vyoage", "fuzzy": fuzzy, "grouped": True}
            )
            self.assertEqual(page["total"], expected)
            page = await self.repository.async_library_list(
                library.SOURCE,
                {"query": "Exampel Alice", "fuzzy": fuzzy, "grouped": True},
            )
            self.assertEqual(page["total"], expected)
            names = await self.repository.async_library_suggest(
                library.SOURCE, "director", "Exampel Alice", fuzzy
            )
            self.assertEqual(names["items"], ["Alice Example"] if fuzzy else [])
        self.assertEqual(
            (
                await self.repository.async_library_suggest(
                    library.SOURCE, "actor", "STRASSE", False
                )
            )["items"],
            ["Fictional Straße"],
        )
        self.assertEqual(
            (
                await self.repository.async_library_list(
                    library.SOURCE, {"query": "' OR 1=1 --", "fuzzy": True}
                )
            )["total"],
            0,
        )
        for value in [1, "yes", None]:
            with self.assert_error("invalid_request"):
                await self.repository.async_library_list(
                    library.SOURCE, {"fuzzy": value}
                )
            with self.assert_error("invalid_request"):
                await self.repository.async_library_suggest(
                    library.SOURCE, "actor", "a", value
                )

    async def test_journal_search_modes_are_bound_into_pagination(self):
        for title in ["A Voyage to Europa", "A Voyage to Europa II", "Other movie"]:
            await self.repository.async_create(
                str(uuid4()), repository.viewing(title=title)
            )
        self.assertEqual(
            (await self.repository.async_list(query="vyoage", fuzzy=False))["items"], []
        )
        self.assertEqual(
            len(
                (await self.repository.async_list(query="vyoage", fuzzy=True))["items"]
            ),
            2,
        )
        first = await self.repository.async_list(query="Voyage", fuzzy=True, limit=1)
        with self.assert_error("refresh_required"):
            await self.repository.async_list(
                query="Voyage", fuzzy=False, limit=1, cursor=first["next_cursor"]
            )
        second = await self.repository.async_list(
            query="Voyage", fuzzy=True, limit=1, cursor=first["next_cursor"]
        )
        self.assertNotEqual(first["items"][0]["id"], second["items"][0]["id"])
        with self.assert_error("invalid_request"):
            await self.repository.async_list(fuzzy="false")

    async def test_global_personal_search_option_survives_restart(self):
        self.assertTrue(
            (await self.repository.async_ui_preferences("a", area="search"))["values"][
                "fuzzy_search"
            ]
        )
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"fuzzy_search": False}, "search"
        )
        self.assertNotIn(
            "fuzzy_search",
            (await self.repository.async_ui_preferences("a", area="library"))["values"],
        )
        self.assertTrue(
            (await self.repository.async_ui_preferences("b", area="search"))["values"][
                "fuzzy_search"
            ]
        )
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)
        self.assertFalse(
            (await self.repository.async_ui_preferences("a", area="search"))["values"][
                "fuzzy_search"
            ]
        )
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, {"fuzzy_search": 1}, "search"
            )
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences_update(
                "a", True, str(uuid4()), 0, {"fuzzy_search": False}, "search"
            )

"""Fictional exact/fuzzy reads, preference isolation and cursor-mode boundaries."""

import unittest
from uuid import uuid4

import test_library as library
import test_repository as repository

from custom_components.kaleidescape_companion.core.repository import JournalRepository


class SearchTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error

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

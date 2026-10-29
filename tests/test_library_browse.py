"""Fictional grouped browsing and display preferences; never contact devices."""

import json
import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import test_backend as backend_tests
import test_library as library_tests
from test_library import (
    ORIGIN,
    ROWS,
    SOURCE,
    catalog,
    listing,
    title_id,
)

from custom_components.kaleidescape_companion.library.config import validate


class GroupedLibraryTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library_tests.LibraryStorageTest.asyncSetUp
    seed = library_tests.LibraryStorageTest.seed
    page = library_tests.LibraryStorageTest.page
    assert_error = library_tests.LibraryStorageTest.assert_error

    async def test_grouping_preserves_versions_and_expands_all_formats(self):
        await self.seed()
        page = await self.page(grouped=True)
        self.assertEqual(page["total"], 2)
        group = next(row for row in page["items"] if row["version_count"] == 2)
        self.assertEqual(group["formats"], ["4K", "HD"])
        self.assertEqual(group["watched_status"], "watched")
        self.assertEqual(group["years"], [2025])
        versions = await self.repository.async_library_versions(SOURCE, group["id"])
        self.assertEqual(versions["total"], 2)
        self.assertEqual(
            {row["id"] for row in versions["items"]},
            {title_id(SOURCE, "fixture-a"), title_id(SOURCE, "fixture-a2")},
        )
        self.assertEqual(
            len((await self.repository.async_inspect("library_titles"))["items"]), 3
        )
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)

    async def test_source_groups_separate_same_named_remakes(
        self,
    ):
        rows = [
            *ROWS,
            {
                **ROWS[1],
                "source_handle": "remake",
                "source_group": "other-work",
                "title": ROWS[0]["title"].upper(),
                "year": 1990,
            },
        ]
        await self.repository.async_library_catalog(ORIGIN, rows, {})
        page = await self.page(grouped=True)
        self.assertEqual(page["total"], 3)
        group = next(row for row in page["items"] if row["version_count"] == 2)
        self.assertEqual(group["years"], [2025])
        versions = await self.repository.async_library_versions(SOURCE, group["id"])
        self.assertEqual(versions["total"], 2)
        self.assertEqual({row["year"] for row in versions["items"]}, {2025})
        remake = next(row for row in page["items"] if row["year"] == 1990)
        self.assertEqual(remake["version_count"], 1)
        self.assertEqual(
            (await self.repository.async_library_versions(SOURCE, remake["id"]))[
                "total"
            ],
            1,
        )

    async def test_missing_descriptions_inherit_within_source_group_only(self):
        rows = [
            {**ROWS[0], "synopsis": "Main version description"},
            {
                **ROWS[2],
                "title": "An alternate display name",
                "year": None,
                "directors": [],
                "rating": "",
                "genres": [],
                "duration_seconds": None,
            },
            {
                **ROWS[1],
                "title": ROWS[0]["title"],
                "year": 1990,
                "directors": ["Remake Director"],
            },
        ]
        await self.repository.async_library_catalog(ORIGIN, rows, {})
        group = next(
            row
            for row in (await self.page(grouped=True))["items"]
            if row["version_count"] == 2
        )
        self.assertEqual(group["year"], 2025)
        versions = await self.repository.async_library_versions(SOURCE, group["id"])
        sparse = next(
            row
            for row in versions["items"]
            if row["id"] == title_id(SOURCE, "fixture-a2")
        )
        self.assertEqual(sparse["year"], 2025)
        self.assertEqual(sparse["directors"], ["A. Director"])
        self.assertEqual(sparse["synopsis"], "Main version description")
        self.assertEqual(sparse["edition"], "HD")
        self.assertIsNone(sparse["duration_seconds"])
        self.assertNotIn("source_group", sparse)
        ungrouped = (await self.page())["items"]
        self.assertEqual(
            next(row for row in ungrouped if row["id"] == sparse["id"]), sparse
        )
        remake = next(
            row for row in ungrouped if row["id"] == title_id(SOURCE, "fixture-b")
        )
        self.assertEqual(remake["year"], 1990)
        self.assertEqual(remake["directors"], ["Remake Director"])
        # Inheritance follows fresh source data, preserving populated conflicts.
        await self.repository.async_library_catalog(
            ORIGIN, [{**rows[0], "year": 2024}, {**rows[1], "rating": "R"}, rows[2]], {}
        )
        updated = (await self.repository.async_library_versions(SOURCE, sparse["id"]))[
            "items"
        ]
        sparse = next(row for row in updated if row["id"] == sparse["id"])
        self.assertEqual(sparse["year"], 2024)
        self.assertEqual(sparse["rating"], "R")
        raw = next(
            row
            for row in (await self.repository.async_inspect("library_titles"))["items"]
            if row["id"] == sparse["id"]
        )
        self.assertIsNone(json.loads(raw["data"])["year"])
        await self.repository.async_library_catalog(ORIGIN, [rows[1], rows[2]], {})
        remaining = (
            await self.repository.async_library_versions(SOURCE, sparse["id"])
        )["items"][0]
        self.assertIsNone(remaining["year"])
        self.assertEqual(remaining["directors"], [])

    async def test_same_group_token_in_another_source_cannot_supply_metadata(self):
        await self.repository.async_library_catalog(
            ORIGIN, [{**ROWS[0], "year": None, "directors": []}], {}
        )
        await self.repository.async_library_catalog(
            "http://another-fictional.local",
            [{**ROWS[0], "year": 1990, "directors": ["Other Source Director"]}],
            {},
        )
        row = (await self.page())["items"][0]
        self.assertIsNone(row["year"])
        self.assertEqual(row["directors"], [])

    async def test_filters_match_one_version_but_details_include_all(
        self,
    ):
        await self.seed()
        result = await self.page(
            grouped=True, actor=["Zoë Example"], collection=["Favorites"]
        )
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["version_count"], 2)
        self.assertEqual(
            (
                await self.page(
                    grouped=True, collection=["Paused"], actor=["Zoë Example"]
                )
            )["total"],
            0,
        )

    async def test_grouping_precedes_pagination_and_all_heading_sorts_work(self):
        rows = [
            {
                **ROWS[0],
                "source_handle": f"version-{index}",
                "source_group": f"group-{index // 2}",
                "title": f"Title {index // 2:03}",
            }
            for index in range(124)
        ]
        await self.repository.async_library_catalog(ORIGIN, rows, {})
        first = await self.page(grouped=True)
        second = await self.page(grouped=True, offset=50, revision=first["revision"])
        self.assertEqual(first["total"], 62)
        self.assertEqual(len(first["items"]), 50)
        self.assertEqual(len(second["items"]), 12)
        self.assertFalse(
            {row["title"] for row in first["items"]}
            & {row["title"] for row in second["items"]}
        )
        self.assertTrue(
            all(row["version_count"] == 2 for row in first["items"] + second["items"])
        )
        for sort in ("name", "year", "collection", "length", "watched", "added"):
            self.assertEqual(
                (await self.page(grouped=True, sort=sort, descending=True))["total"], 62
            )

    async def test_list_limit_up_to_1000_and_sqlite_parameter_bounds(self):
        rows = [
            {
                **ROWS[0],
                "source_handle": f"v-{index}",
                "source_group": f"g-{index}",
                "title": f"Title {index:04}",
            }
            for index in range(1051)
        ]
        await self.repository.async_library_catalog(
            ORIGIN, rows, {"Played": [row["source_handle"] for row in rows]}
        )
        await self.repository._call(
            lambda: self.repository._db().setlimit(
                sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, 999
            )
        )
        for grouped in (False, True):
            first = await self.page(grouped=grouped, limit=1000)
            self.assertEqual(first["limit"], 1000)
            self.assertEqual(len(first["items"]), 1000)
            self.assertTrue(first["has_more"])
            final = await self.page(
                grouped=grouped, limit=1000, offset=1000, revision=first["revision"]
            )
            self.assertEqual(len(final["items"]), 51)
            self.assertFalse(final["has_more"])
            self.assertEqual(
                len({row["id"] for row in first["items"] + final["items"]}), 1051
            )
            self.assertTrue(
                all(row["collections"] == ["Played"] for row in first["items"])
            )
            self.assertEqual(
                len((await self.page(grouped=grouped, limit=1))["items"]), 1
            )
        for value in (True, False, 0, -1, 1001, 1.5, "1000", None):
            with self.assert_error("invalid_request"):
                await self.page(limit=value)

    async def test_group_pages_are_compact_and_oversized_responses_are_rejected(self):
        await self.seed()
        one = await self.page(grouped=True, limit=1)
        self.assertNotIn("synopsis", one["items"][0])
        self.assertNotIn("actors", one["items"][0])
        details = await self.repository.async_library_versions(
            SOURCE, one["items"][0]["id"]
        )
        self.assertIn("actors", details["items"][0])
        self.assertIn("synopsis", details["items"][0])
        budget = len(json.dumps(one, ensure_ascii=False).encode()) + 16
        with patch(
            "custom_components.kaleidescape_companion.library.browse.MAX_PAGE_BYTES",
            budget,
        ):
            with self.assert_error("library_page_too_large"):
                await self.page(grouped=True, limit=2)
            self.assertEqual(
                (await self.page(grouped=True, limit=1))["items"], one["items"]
            )
            with self.assert_error("library_page_too_large"):
                await self.repository.async_library_versions(
                    SOURCE, one["items"][0]["id"]
                )
        self.assertEqual((await self.page())["total"], 3)

    async def test_exclusions_hide_names_without_hiding_movies_or_changing_status(self):
        await self.seed()
        excluded = "favorites\npLaYeD"
        for grouped in (False, True):
            page = await self.repository.async_library_list(
                SOURCE, {"grouped": grouped, "sort": "collection"}, excluded
            )
            self.assertEqual(page["total"], 2 if grouped else 3)
            self.assertEqual(page["facets"]["collections"], ["Paused"])
            self.assertFalse(
                any(
                    set(row["collections"]) & {"Played", "Favorites"}
                    for row in page["items"]
                )
            )
        info = await self.repository.async_library_info(SOURCE, excluded)
        self.assertEqual(info["collection_count"], 1)
        page = await self.repository.async_library_list(
            SOURCE, {"grouped": True, "status": ["watched"]}, excluded
        )
        self.assertEqual(page["total"], 1)
        self.assertEqual(page["items"][0]["watched_status"], "watched")
        versions = await self.repository.async_library_versions(
            SOURCE, page["items"][0]["id"], excluded=excluded
        )
        self.assertTrue(all(not row["collections"] for row in versions["items"]))
        self.assertEqual(
            (
                await self.repository.async_library_list(
                    SOURCE, {"collection": ["Favorites"]}, excluded
                )
            )["total"],
            0,
        )
        self.assertEqual((await self.page(collection=["Favorites"]))["total"], 1)

    async def test_collection_preferences_invalidate_pagination_without_source_mutation(
        self,
    ):
        await self.seed()
        before = await self.repository.async_library_list(SOURCE, {"grouped": True})
        info = await self.repository.async_library_info(SOURCE, "Favorites")
        self.assertEqual(info["revision"], before["revision"])
        self.assertNotEqual(info["preferences_key"], before["preferences_key"])
        with self.assert_error("refresh_required"):
            await self.repository.async_library_list(
                SOURCE,
                {
                    "grouped": True,
                    "offset": 50,
                    "preferences_key": before["preferences_key"],
                },
                "Favorites",
            )

    async def test_version_pages_are_bounded_scoped_and_revision_checked(self):
        rows = [{**ROWS[0], "source_handle": f"variant-{index}"} for index in range(61)]
        await self.repository.async_library_catalog(ORIGIN, rows, {})
        group = (await self.page(grouped=True))["items"][0]
        first = await self.repository.async_library_versions(SOURCE, group["id"])
        second = await self.repository.async_library_versions(
            SOURCE, group["id"], 50, first["revision"]
        )
        self.assertEqual(len(first["items"]), 50)
        self.assertTrue(first["has_more"])
        self.assertEqual(len(second["items"]), 11)
        self.assertFalse(second["has_more"])
        with self.assert_error("not_found"):
            await self.repository.async_library_versions("f" * 64, group["id"])
        with self.assert_error("refresh_required"):
            await self.repository.async_library_versions(
                SOURCE, group["id"], revision=0
            )
        for key, offset in (
            ("../../file", 0),
            (group["id"], True),
            (group["id"], -1),
            (group["id"], 10001),
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_library_versions(SOURCE, key, offset)
        for item in first["items"]:
            self.assertFalse(
                set(item)
                & {
                    "source_handle",
                    "source_group",
                    "source_id",
                    "origin",
                    "data",
                    "artwork_path",
                }
            )

    def test_multiple_summary_does_not_hide_exact_handle_format_rows(self):
        rows = [
            {**ROWS[0], "edition": "Multiple"},
            {**ROWS[0], "edition": "4K Dolby Vision"},
            {**ROWS[2], "edition": "HD"},
        ]
        parsed, _ = catalog(listing(rows))
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["source_handle"], ROWS[0]["source_handle"])
        self.assertEqual(parsed[0]["formats"], ["4K Dolby Vision"])
        self.assertEqual(parsed[0]["edition"], "4K Dolby Vision")
        self.assertEqual(parsed[1]["formats"], ["HD"])

    def test_exclusion_setting_is_bounded_and_defaults_empty(self):
        self.assertEqual(validate({}, {})["library_excluded_collections"], [])
        for value in ([123], "a" * 257, "\n".join(["a"] * 201), "bad\x00value"):
            with self.assertRaises(ValueError):
                validate({"library_excluded_collections": value}, {})


class GroupedLibraryApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call

    async def test_version_reads_share_access_and_hide_excluded_names(self):
        object.__setattr__(
            self.entry,
            "data",
            {"library_enabled": True, "library_excluded_collections": "Favorites"},
        )
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(source=SOURCE, async_stop=AsyncMock())
        await runtime.repository.async_library_catalog(
            ORIGIN,
            ROWS,
            {"Favorites": ["fixture-a"], "Played": ["fixture-a"], "Paused": []},
        )
        reader = SimpleNamespace(id="fictional-reader", is_active=True, is_admin=False)
        message = {**self.scope, "title_id": title_id(SOURCE, "fixture-a")}
        result = await self.call("library/versions", user=reader, **message)
        self.assertEqual(result["result"]["total"], 2)
        self.assertNotIn("Favorites", str(result))
        reader.is_active = False
        with patch.object(
            runtime.repository, "async_library_versions", AsyncMock()
        ) as read:
            self.assertEqual(
                (await self.call("library/versions", user=reader, **message))["code"],
                "unauthorized",
            )
            read.assert_not_awaited()
        reader.is_active = True
        original = runtime.repository.async_library_versions

        async def opt_out(*args):
            result = await original(*args)
            object.__setattr__(self.entry, "data", {"library_enabled": False})
            return result

        with patch.object(runtime.repository, "async_library_versions", opt_out):
            result = await self.call("library/versions", user=reader, **message)
            self.assertEqual(result["code"], "library_disabled")
            self.assertNotIn("Voyage", str(result))

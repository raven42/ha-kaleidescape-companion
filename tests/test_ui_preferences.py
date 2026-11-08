"""Private UI settings, migration, authorization and exact-identity badge tests."""

import json
import sqlite3
import unittest
from contextlib import closing
from types import MappingProxyType, SimpleNamespace
from unittest.mock import patch as mock_patch
from uuid import uuid4

import test_backend as backend
import test_library as library

from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.ui.preferences import validate_library


class UISettingsStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def test_database_all_preference_is_validated_and_persisted(self):
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"limit": "all"}, "database"
        )
        value = await self.repository.async_ui_preferences("a", area="database")
        self.assertEqual(value["values"]["limit"], "all")
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, {"limit": "everything"}, "database"
            )

    async def test_recent_purchase_badges_use_all_linked_versions_and_dates(self):
        remake = {
            **library.ROWS[0],
            "source_handle": "remake",
            "source_group": "remake",
            "year": 1990,
        }
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, remake], {"New": ["fixture-b"]}
        )

        def add_purchases():
            db = self.repository._db()
            with db:
                db.execute(
                    "UPDATE library SET purchased_on=? "
                    "WHERE source_id=? AND source_handle=?",
                    ("2026-01-01", library.SOURCE, "fixture-a"),
                )
                db.execute(
                    "UPDATE library SET purchased_on=? "
                    "WHERE source_id=? AND source_handle=?",
                    ("2026-10-22", library.SOURCE, "fixture-b"),
                )
                for number, handle, purchased in (
                    (1, "fixture-a", "2026-01-01"),
                    (2, "fixture-a2", "2026-10-25"),
                    (3, "fixture-b", "2026-01-01"),
                    (4, "remake", "2026-11-06"),
                    (5, None, "2026-11-05"),
                ):
                    db.execute(
                        "INSERT INTO purchase_records "
                        "(id,title,purchased_on,order_id,imported_at,library_id) "
                        "VALUES (?,?,?,?,?,?)",
                        (
                            str(number) * 64,
                            "Fictional receipt",
                            purchased,
                            f"ORDER-{number}",
                            "2026-11-05T12:00:00+00:00",
                            library.title_id(library.SOURCE, handle)
                            if handle
                            else None,
                        ),
                    )

        await self.repository._call(add_purchases)
        today = "2026-11-05"
        grouped = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, "", 2, today
        )
        by_year = {row["year"]: row for row in grouped["items"]}
        self.assertTrue(by_year[2025]["is_recently_added"])
        self.assertTrue(by_year[2024]["is_recently_added"])
        self.assertFalse(by_year[1990]["is_recently_added"])
        self.assertIn("New", by_year[2024]["collections"])
        self.assertIn("New", grouped["facets"]["collections"])
        self.assertNotIn("2026-10-25", json.dumps(by_year[2025]))
        filtered = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "recently_added": True}, "", 2, today
        )
        self.assertEqual({row["year"] for row in filtered["items"]}, {2024, 2025})
        with self.assert_error("invalid_request"):
            await self.repository.async_library_list(
                library.SOURCE, {"recently_added": "true"}, "", 2, today
            )

        versions = await self.repository.async_library_versions(
            library.SOURCE,
            library.title_id(library.SOURCE, "fixture-a"),
            0,
            None,
            "",
            2,
            today,
        )
        self.assertTrue(all(row["is_recently_added"] for row in versions["items"]))
        search = await self.repository.async_library_search(
            library.SOURCE, "Europa", "", True, 2, today
        )
        self.assertTrue(any(row["is_recently_added"] for row in search["items"]))
        one_week = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, "", 1, today
        )
        self.assertFalse(
            next(row for row in one_week["items"] if row["year"] == 2024)[
                "is_recently_added"
            ]
        )
        disabled = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, "", 0, today
        )
        self.assertFalse(any(row["is_recently_added"] for row in disabled["items"]))
        tomorrow = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, "", 2, "2026-11-06"
        )
        self.assertTrue(
            next(row for row in tomorrow["items"] if row["year"] == 1990)[
                "is_recently_added"
            ]
        )
        added = {
            **library.ROWS[0],
            "source_handle": "new-scan",
            "source_group": "new-scan",
            "year": 2018,
        }
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, remake, added], {}
        )
        disabled = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, "", 0, today
        )
        self.assertTrue(
            next(row for row in disabled["items"] if row["year"] == 2018)[
                "is_recently_added"
            ]
        )
        recent_scan = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "recently_added": True}, "", 0, today
        )
        self.assertEqual([row["year"] for row in recent_scan["items"]], [2018])

    async def test_movie_details_and_badge_preferences_are_private_and_validated(self):
        journal = await self.repository.async_ui_preferences("a", area="journal")
        self.assertEqual(journal["values"]["movie_details"], "full")
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            journal["revision"],
            {"movie_details": "compact"},
            "journal",
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("a", area="journal"))["values"][
                "movie_details"
            ],
            "compact",
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("b", area="journal"))["values"][
                "movie_details"
            ],
            "full",
        )
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 1, {"movie_details": "other"}, "journal"
            )
        defaults = await self.repository.async_ui_preferences("a")
        self.assertEqual(defaults["values"]["movie_status_labels"], "modern")
        self.assertEqual(defaults["values"]["library_badge_style"], "icons")
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            defaults["revision"],
            {
                "movie_status_labels": "kaleidescape",
                "library_badge_style": "text",
                "recently_added": True,
                "status": ["favorite", "watch_soon", "recently_added"],
            },
        )
        saved = (await self.repository.async_ui_preferences("a"))["values"]
        self.assertEqual(saved["movie_status_labels"], "kaleidescape")
        self.assertEqual(saved["library_badge_style"], "text")
        self.assertTrue(saved["recently_added"])
        self.assertEqual(saved["status"], ["favorite", "watch_soon", "recently_added"])
        self.assertEqual(
            (await self.repository.async_ui_preferences("b"))["values"]["status"], []
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("b"))["values"][
                "library_badge_style"
            ],
            "icons",
        )

    async def test_interface_mode_validation_and_retired_library_switch(
        self,
    ):
        default = await self.repository.async_ui_preferences("a", area="interface")
        self.assertTrue(default["values"]["advanced_view"])
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"advanced_view": False}, "interface"
        )
        self.assertFalse(
            (await self.repository.async_ui_preferences("a", area="interface"))[
                "values"
            ]["advanced_view"]
        )
        self.assertTrue(
            (await self.repository.async_ui_preferences("b", area="interface"))[
                "values"
            ]["advanced_view"]
        )
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, {"advanced_view": "yes"}, "interface"
            )
        self.assertNotIn(
            "show_system_buttons", validate_library({"show_system_buttons": False})
        )
        migrated = validate_library({}, {"scraper_conflict": True})
        self.assertTrue(migrated["missing_metadata_artwork"])
        self.assertNotIn("scraper_conflict", migrated)
        self.assertFalse(
            validate_library(
                {"missing_metadata_artwork": False}, {"scraper_conflict": True}
            )["missing_metadata_artwork"]
        )

    async def test_profiles_inherit_legacy_then_isolate_all_choices_except_shuffle(
        self,
    ):
        seed = "a" * 32
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            0,
            {"view": "covers", "cover_size": 200, "random_seed": seed},
        )
        for profile in ("desktop", "tablet", "mobile"):
            values = (await self.repository.async_ui_preferences("a", profile=profile))[
                "values"
            ]
            self.assertEqual(values["view"], "covers")
            self.assertEqual(values["cover_size"], 200)
            self.assertEqual(values["random_seed"], seed)
        request = str(uuid4())
        args = (
            "a",
            False,
            request,
            0,
            {"cover_size": 120, "view": "list", "sort": "random"},
            "library",
            "mobile",
        )
        result = await self.repository.async_ui_preferences_update(*args)
        self.assertEqual(
            await self.repository.async_ui_preferences_update(*args), result
        )
        with self.assert_error("conflict"):
            await self.repository.async_ui_preferences_update(*args[:-1], "desktop")
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"random_seed": "b" * 32}, profile="desktop"
        )
        mobile = (await self.repository.async_ui_preferences("a", profile="mobile"))[
            "values"
        ]
        desktop = (await self.repository.async_ui_preferences("a", profile="desktop"))[
            "values"
        ]
        self.assertEqual(mobile["cover_size"], 120)
        self.assertEqual(desktop["cover_size"], 200)
        self.assertEqual(mobile["view"], "list")
        self.assertEqual(desktop["view"], "covers")
        self.assertEqual(mobile["random_seed"], desktop["random_seed"])
        self.assertEqual(mobile["random_seed"], "b" * 32)
        self.assertEqual(
            (await self.repository.async_ui_preferences("other", profile="mobile"))[
                "values"
            ]["random_seed"],
            "",
        )
        for area, patch in (
            ("journal", {"calendar_size": 90}),
            ("database", {"limit": 500}),
            ("search", {"fuzzy_search": False}),
            ("interface", {"advanced_view": False}),
        ):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, patch, area, "mobile"
            )
            self.assertNotEqual(
                (
                    await self.repository.async_ui_preferences(
                        "a", area=area, profile="desktop"
                    )
                )["values"],
                (
                    await self.repository.async_ui_preferences(
                        "a", area=area, profile="mobile"
                    )
                )["values"],
            )
        with self.assert_error("invalid_request"):
            await self.repository.async_ui_preferences("a", profile="arbitrary-device")

    async def test_search_preferences_consolidate_latest_legacy_choice_once(self):
        def legacy_rows(db):
            with db:
                for owner, key, values, stamp in (
                    (
                        "user:a",
                        "library",
                        {"view": "covers", "fuzzy_search": True},
                        "2025-01-01",
                    ),
                    ("user:a", "journal", {"fuzzy_search": False}, "2025-02-01"),
                    ("user:b", "journal", {"fuzzy_search": False}, "2025-01-01"),
                    ("user:b", "library", {"fuzzy_search": True}, "2025-02-01"),
                ):
                    db.execute(
                        "INSERT INTO settings VALUES (?,?,?,?,?)",
                        (owner, key, json.dumps(values), 1, stamp),
                    )

        await self.repository._call(legacy_rows, self.repository._db())
        await self.repository.async_seed_ui_preferences({})
        a = await self.repository.async_ui_preferences("a", area="search")
        b = await self.repository.async_ui_preferences("b", area="search")
        self.assertFalse(a["values"]["fuzzy_search"])
        self.assertTrue(b["values"]["fuzzy_search"])
        personal = await self.repository.async_ui_preferences("a")
        self.assertEqual(personal["values"]["view"], "covers")
        self.assertNotIn("fuzzy_search", personal["values"])
        self.assertEqual(
            await self.repository._call(
                lambda: (
                    self.repository._db()
                    .execute("SELECT count(*) FROM settings WHERE key='journal'")
                    .fetchone()[0]
                )
            ),
            0,
        )
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), a["revision"], {"fuzzy_search": True}, "search"
        )
        await self.repository.async_seed_ui_preferences({})
        self.assertTrue(
            (await self.repository.async_ui_preferences("a", area="search"))["values"][
                "fuzzy_search"
            ]
        )
        for area in ("journal", "library"):
            with self.assert_error("invalid_request"):
                await self.repository.async_ui_preferences_update(
                    "a", False, str(uuid4()), 0, {"fuzzy_search": False}, area
                )

    async def test_new_detail_filters_default_and_persist_per_user_without_migration(
        self,
    ):
        values = (await self.repository.async_ui_preferences("a"))["values"]
        for field in ("genre", "year", "format"):
            self.assertEqual(values[field], [])
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            0,
            {"query": "", "genre": ["Adventure"], "year": ["2025"], "format": ["4K"]},
        )
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)
        self.assertEqual(
            (await self.repository.async_ui_preferences("a"))["values"]["format"],
            ["4K"],
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("b"))["values"]["format"], []
        )
        for field in ("genre", "year", "format"):
            with self.assert_error("invalid_request"):
                await self.repository.async_ui_preferences_update(
                    "a", False, str(uuid4()), 0, {field: ["x"] * 101}
                )
        with self.assert_error("invalid_request"):
            validate_library({"year": ["2025 OR 1=1"]})
        for value in (0, 31, True, "8"):
            with self.assert_error("invalid_request"):
                validate_library({"cast_limit": value})
        self.assertEqual(validate_library({"cast_limit": 10})["cast_limit"], 10)

    async def test_legacy_seed_runs_once_and_users_have_independent_sticky_values(self):
        await self.repository.async_seed_ui_preferences(
            {
                "library_default_view": "covers",
                "library_default_count": 50,
                "library_excluded_collections": "Extras",
            }
        )
        await self.repository.async_seed_ui_preferences(
            {"library_default_view": "list"}
        )
        a = await self.repository.async_ui_preferences("a")
        self.assertEqual(a["values"]["view"], "covers")
        self.assertEqual(a["values"]["page_size"], 100)
        request = str(uuid4())
        args = (
            "a",
            False,
            request,
            0,
            {
                "query": "Private movie search",
                "page_size": "all",
                "sort": "year",
                "descending": True,
            },
        )
        first = await self.repository.async_ui_preferences_update(*args)
        self.assertEqual(
            await self.repository.async_ui_preferences_update(*args), first
        )
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"view": "list"}
        )
        a = await self.repository.async_ui_preferences("a")
        self.assertEqual(a["values"]["view"], "list")
        self.assertEqual(a["values"]["query"], "Private movie search")
        self.assertEqual(
            (await self.repository.async_ui_preferences("b"))["values"]["query"], ""
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("b"))["values"]["view"],
            "covers",
        )
        self.assertEqual(await self.repository.async_hidden_collections(), ["Extras"])
        with self.assert_error("conflict"):
            await self.repository.async_ui_preferences_update(
                "b", False, request, 0, args[-1]
            )
        receipts = (await self.repository.async_inspect("requests"))["items"]
        self.assertNotIn("Private movie search", json.dumps(receipts))

    async def test_ui_revisions_preserve_content_and_guard_settings_pages(
        self,
    ):
        await self.repository.async_seed_ui_preferences({})
        content = await self.repository.async_info()
        settings = await self.repository.async_inspect("settings")
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"page_size": 1000}
        )
        self.assertEqual(
            (await self.repository.async_info())["revision"], content["revision"]
        )
        with self.assert_error("refresh_required"):
            await self.repository.async_inspect(
                "settings", revision=settings["revision"]
            )
        self.assertGreater(
            (await self.repository.async_inspect("settings"))["revision"],
            settings["revision"],
        )

    async def test_validation_backup_and_failed_write_leave_settings_unchanged(self):
        for patch in (
            {"owner": "another-user"},
            {"page_size": 50},
            {"page_size": True},
            {"view": []},
            {"sort": "SQL"},
            {"widths": [10] * 6},
            {"cover_size": 9999},
            {"show_titles": "false"},
            {"show_format": 1},
            {"show_audio_format": 1},
            {"show_badges": None},
            {"movie_status_labels": "other"},
            {"library_badge_style": "other"},
            {"library_badge_style": None},
            {"recently_added": 1},
            {"status": ["invalid"]},
            {"actor": [1]},
            {"actor": ["x" * 500] * 201},
            {"query": "x" * 501},
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_ui_preferences_update(
                    "a", False, str(uuid4()), 0, patch
                )
        self.assertEqual(validate_library({"page_size": "all"})["page_size"], "all")
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, {"view": "covers"}
            )
        await self.repository.async_resume()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_ui BEFORE INSERT ON settings "
                "BEGIN SELECT RAISE(ABORT,'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.repository.async_ui_preferences_update(
                "a", False, str(uuid4()), 0, {"view": "covers"}
            )
        self.assertEqual(
            (await self.repository.async_ui_preferences("a"))["revision"], 0
        )
        self.assertEqual((await self.repository.async_info())["revision"], 0)

    async def test_old_rows_get_new_toggle_defaults_without_rewriting_user_choices(
        self,
    ):
        await self.repository.async_seed_ui_preferences({})
        before = await self.repository.async_info()
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), 0, {"view": "covers", "page_size": 25}
        )
        # Model a preference row written before the overlay toggles existed.
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "UPDATE settings SET value=json_remove(value, '$.show_titles', "
                "'$.show_format', '$.show_audio_format', '$.show_badges', "
                "'$.library_badge_style') "
                "WHERE owner='user:a'"
            )
            db.commit()
        old = await self.repository.async_ui_preferences("a")
        self.assertTrue(old["values"]["show_titles"])
        self.assertTrue(old["values"]["show_format"])
        self.assertTrue(old["values"]["show_audio_format"])
        self.assertTrue(old["values"]["show_badges"])
        self.assertEqual(old["values"]["library_badge_style"], "icons")
        self.assertEqual(old["values"]["view"], "covers")
        await self.repository.async_ui_preferences_update(
            "a",
            False,
            str(uuid4()),
            old["revision"],
            {"show_titles": False, "show_format": False, "show_badges": False},
        )
        saved = (await self.repository.async_ui_preferences("a"))["values"]
        self.assertFalse(saved["show_titles"])
        self.assertFalse(saved["show_format"])
        self.assertFalse(saved["show_badges"])
        self.assertEqual(saved["page_size"], 25)
        self.assertTrue(
            (await self.repository.async_ui_preferences("b"))["values"]["show_titles"]
        )
        self.assertEqual(
            (await self.repository.async_info())["revision"], before["revision"]
        )

    async def test_audio_toggle_inherits_legacy_format_setting_then_is_independent(
        self,
    ):
        await self.repository.async_seed_ui_preferences({})
        for actor, enabled in (("a", False), ("b", True)):
            await self.repository.async_ui_preferences_update(
                actor, False, str(uuid4()), 0, {"show_format": enabled}
            )
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "UPDATE settings SET value=json_remove(value, '$.show_audio_format') "
                "WHERE owner IN ('user:a', 'user:b') AND key='library'"
            )
            db.commit()
        old = await self.repository.async_ui_preferences("a")
        self.assertFalse(old["values"]["show_audio_format"])
        self.assertFalse(
            (await self.repository.async_ui_preferences("a", profile="mobile"))[
                "values"
            ]["show_audio_format"]
        )
        self.assertTrue(
            (await self.repository.async_ui_preferences("b"))["values"][
                "show_audio_format"
            ]
        )
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), old["revision"], {"show_format": True}
        )
        updated = await self.repository.async_ui_preferences("a")
        self.assertTrue(updated["values"]["show_format"])
        self.assertFalse(updated["values"]["show_audio_format"])
        await self.repository.async_ui_preferences_update(
            "a", False, str(uuid4()), updated["revision"], {"show_audio_format": True}
        )
        self.assertTrue(
            (await self.repository.async_ui_preferences("a"))["values"][
                "show_audio_format"
            ]
        )

    async def test_group_badges_distinguish_remakes_and_replacement_formats(
        self,
    ):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        remake = {
            **library.ROWS[0],
            "source_handle": "remake",
            "source_group": "remake-group",
            "year": 1990,
        }
        await self.repository.async_library_catalog(
            library.ORIGIN,
            [*library.ROWS, remake],
            {"Favorites": ["remake"], "Played": ["remake"]},
        )
        result = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}, ["Favorites"]
        )
        original = next(row for row in result["items"] if row["year"] == 2025)
        recent = next(row for row in result["items"] if row["year"] == 1990)
        self.assertFalse(original["is_recently_added"])
        self.assertFalse(original["is_favorite"])
        self.assertTrue(recent["is_recently_added"])
        self.assertTrue(recent["is_favorite"])
        self.assertNotIn("Favorites", recent["collections"])
        replacement = {**remake, "source_handle": "replacement"}
        await self.repository.async_library_catalog(
            library.ORIGIN, [*library.ROWS, replacement], {}
        )
        result = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True}
        )
        self.assertTrue(
            next(row for row in result["items"] if row["year"] == 1990)[
                "is_recently_added"
            ]
        )
        self.assertNotIn("addition_batch", json.dumps(result))


class UISettingsApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_random_pages_resolve_the_shared_user_seed_across_profiles(self):
        await backend.BackendTest.create(self)
        first = "a" * 32
        saved = await self.call(
            "ui/preferences/update",
            **self.scope,
            profile="desktop",
            request_id=str(uuid4()),
            revision=0,
            patch={"sort": "random", "random_seed": first},
        )
        self.assertTrue(saved["success"])
        page = await self.call(
            "library/list",
            **self.scope,
            filters={"sort": "random", "random_seed": "b" * 32, "grouped": True},
        )
        self.assertTrue(page["success"])
        self.assertEqual(page["result"]["random_seed"], first)
        stale = await self.call(
            "library/list",
            **self.scope,
            filters={"sort": "random", "random_seed": "b" * 32, "offset": 1},
        )
        self.assertEqual(stale["code"], "refresh_required")
        self.admin.is_admin = False
        mobile = await self.call("ui/preferences/get", **self.scope, profile="mobile")
        self.assertEqual(mobile["result"]["values"]["random_seed"], first)
        self.assertEqual(mobile["result"]["values"]["sort"], "name")

    async def test_setup_seeds_legacy_ui_options_and_removes_only_those_ha_fields(self):
        await backend.async_unload_entry(self.hass, self.entry)
        # Simulate an existing journal before the first preference seed. Only
        # this test's temporary database and synthetic HA entry are modified.
        path = self.hass.config.path(backend.DOMAIN, "journal.sqlite3")
        with closing(sqlite3.connect(path)) as db:
            db.execute("DELETE FROM settings")
            db.commit()
        values = {
            "library_default_view": "covers",
            "library_default_count": 50,
            "library_excluded_collections": ["Extras"],
            "default_landing_page": "library",
            "minimum_runtime_minutes": 12,
        }
        object.__setattr__(self.entry, "data", MappingProxyType(values))
        object.__setattr__(self.entry, "options", MappingProxyType(values))

        def update(entry, **changes):
            for key, value in changes.items():
                object.__setattr__(entry, key, MappingProxyType(value))
            return True

        self.hass.config_entries.async_update_entry.side_effect = update
        await backend.async_setup_entry(self.hass, self.entry)
        repository = self.entry.runtime_data.repository
        self.addAsyncCleanup(repository.async_close)
        expected = {"default_landing_page": "library", "minimum_runtime_minutes": 12}
        self.assertEqual(dict(self.entry.data), expected)
        self.assertEqual(dict(self.entry.options), expected)
        preferences = await repository.async_ui_preferences("new-user")
        self.assertEqual(preferences["values"]["view"], "covers")
        self.assertEqual(preferences["values"]["page_size"], 100)
        self.assertEqual(await repository.async_hidden_collections(), ["Extras"])

    async def test_access_changes_across_await_withhold_private_ui_response(self):
        repository = self.entry.runtime_data.repository
        original = repository.async_ui_preferences

        async def revoked(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_active = False
            return result

        with mock_patch.object(repository, "async_ui_preferences", revoked):
            response = await self.call("ui/preferences/get", **self.scope)
        self.assertEqual(response["code"], "unauthorized")
        self.assertNotIn("result", response)
        self.admin.is_active = True
        original_write = repository.async_ui_preferences_update

        async def downgraded(*args, **kwargs):
            result = await original_write(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with mock_patch.object(repository, "async_ui_preferences_update", downgraded):
            response = await self.call(
                "ui/shared/update",
                **self.scope,
                request_id=str(uuid4()),
                revision=1,
                patch={"hidden_collections": ["Extras"]},
            )
        self.assertEqual(response["code"], "unauthorized")
        # Accepted work can commit; its private response is withheld after role loss.
        self.assertEqual(await repository.async_hidden_collections(), ["Extras"])

    async def test_regular_users_only_write_own_display_preferences(self):
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        result = await self.call(
            "ui/preferences/update",
            user=reader,
            **self.scope,
            request_id=str(uuid4()),
            revision=0,
            patch={"view": "covers", "collection": ["Favorites"]},
        )
        self.assertTrue(result["success"])
        own = (await self.call("ui/preferences/get", user=reader, **self.scope))[
            "result"
        ]
        self.assertEqual(own["values"]["view"], "covers")
        admin = (await self.call("ui/preferences/get", **self.scope))["result"]
        self.assertEqual(admin["values"]["view"], "list")
        for op, data in (
            ("ui/shared/get", {}),
            (
                "ui/shared/update",
                {
                    "request_id": str(uuid4()),
                    "revision": 1,
                    "patch": {"hidden_collections": ["Extras"]},
                },
            ),
        ):
            self.assertEqual(
                (await self.call(op, user=reader, **self.scope, **data))["code"],
                "unauthorized",
            )
        reader.is_active = False
        self.assertEqual(
            (await self.call("ui/preferences/get", user=reader, **self.scope))["code"],
            "unauthorized",
        )
        reader.is_active = True
        self.assertEqual(
            (
                await self.call(
                    "ui/preferences/get",
                    user=reader,
                    entry_id=self.scope["entry_id"],
                    dataset_id=str(uuid4()),
                )
            )["code"],
            "not_found",
        )
        result = await self.call(
            "ui/shared/update",
            **self.scope,
            request_id=str(uuid4()),
            revision=1,
            patch={"hidden_collections": ["Extras"]},
        )
        self.assertTrue(result["success"])
        self.assertEqual(
            await self.entry.runtime_data.repository.async_hidden_collections(),
            ["Extras"],
        )

    async def test_reader_journal_search_preference_is_personal_and_scope_checked(self):
        reader = SimpleNamespace(id="journal-reader", is_active=True, is_admin=False)
        result = await self.call(
            "ui/preferences/update",
            user=reader,
            **self.scope,
            area="search",
            request_id=str(uuid4()),
            revision=0,
            patch={"fuzzy_search": False},
        )
        self.assertTrue(result["success"])
        own = (
            await self.call(
                "ui/preferences/get", user=reader, **self.scope, area="search"
            )
        )["result"]
        self.assertFalse(own["values"]["fuzzy_search"])
        admin = (await self.call("ui/preferences/get", **self.scope, area="search"))[
            "result"
        ]
        self.assertTrue(admin["values"]["fuzzy_search"])
        reader.is_active = False
        self.assertEqual(
            (
                await self.call(
                    "ui/preferences/get", user=reader, **self.scope, area="search"
                )
            )["code"],
            "unauthorized",
        )

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
            {"show_badges": None},
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
                "'$.show_format', '$.show_badges') WHERE owner='user:a'"
            )
            db.commit()
        old = await self.repository.async_ui_preferences("a")
        self.assertTrue(old["values"]["show_titles"])
        self.assertTrue(old["values"]["show_format"])
        self.assertTrue(old["values"]["show_badges"])
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
            area="journal",
            request_id=str(uuid4()),
            revision=0,
            patch={"fuzzy_search": False},
        )
        self.assertTrue(result["success"])
        own = (
            await self.call(
                "ui/preferences/get", user=reader, **self.scope, area="journal"
            )
        )["result"]
        self.assertFalse(own["values"]["fuzzy_search"])
        admin = (await self.call("ui/preferences/get", **self.scope, area="journal"))[
            "result"
        ]
        self.assertTrue(admin["values"]["fuzzy_search"])
        reader.is_active = False
        self.assertEqual(
            (
                await self.call(
                    "ui/preferences/get", user=reader, **self.scope, area="journal"
                )
            )["code"],
            "unauthorized",
        )

"""Source-scoped sensor counts, atomic addition batches and HA entity contracts."""

import json
import sqlite3
import unittest
from contextlib import closing
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock, patch

import test_backend as backend
import test_library as library
from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EntityCategory, UnitOfInformation
from homeassistant.core import HomeAssistant

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.store import source_id, title_id
from custom_components.kaleidescape_companion.sensor import async_setup_entry


def movie(group="new-group", handle="new-handle", **fields):
    return {
        **library.ROWS[0],
        "source_group": group,
        "source_handle": handle,
        "title": "Fictional new movie",
        **fields,
    }


class LibrarySummaryTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    assert_error = library.LibraryStorageTest.assert_error

    async def scan(self, rows=library.ROWS, collections=None):
        await self.repository.async_library_catalog(library.ORIGIN, rows, collections)
        return await self.summary()

    async def summary(self):
        return await self.repository.async_library_summary(library.SOURCE)

    async def test_baseline_unique_groups_and_empty_catalog_are_not_initial_additions(
        self,
    ):
        empty = await self.summary()
        self.assertIsNone(empty["total_movies"])
        self.assertIsNone(empty["watched_movies"])
        self.assertGreater(empty["database_bytes"], 0)
        self.assertEqual(empty["artwork_cache_bytes"], 0)
        result = await self.scan(collections={})
        self.assertEqual(result["total_movies"], 2)
        self.assertEqual(result["unwatched_movies"], 2)
        self.assertEqual(result["watched_movies"], 0)
        self.assertEqual(result["recently_added"], 0)
        self.assertEqual(result["recently_added_movies"], [])
        self.assertIsNone(result["recently_added_at"])
        self.assertIsNotNone(result["last_library_sync"])
        result = await self.scan([], {})
        self.assertEqual(result["total_movies"], 0)
        self.assertEqual(result["unwatched_movies"], 0)
        self.assertEqual(result["watched_movies"], 0)
        await self.scan(library.ROWS, {})
        self.assertEqual((await self.summary())["recently_added"], 0)

    async def test_new_groups_not_new_formats_and_batch_survives_noops_and_removal(
        self,
    ):
        await self.scan(collections={})
        additions = [movie(), movie(handle="another-format", edition="HD")]
        rows = [*library.ROWS, *additions]
        batch = await self.scan(rows, {})
        self.assertEqual(batch["total_movies"], 3)
        self.assertEqual(batch["recently_added"], 1)
        self.assertEqual(batch["recently_added_movies"], ["Fictional new movie"])
        for next_rows in (
            rows,
            [library.ROWS[0]],
            rows,
            [*rows, movie("group-a", "yet-another-format")],
        ):
            result = await self.scan(next_rows, {})
            for key in ("recently_added", "recently_added_movies", "recently_added_at"):
                self.assertEqual(result[key], batch[key])
        result = await self.scan(
            [
                *rows,
                movie("remake", "remake", title=library.ROWS[0]["title"], year=1990),
            ],
            {},
        )
        self.assertEqual(result["total_movies"], 4)
        self.assertEqual(result["recently_added"], 1)
        self.assertEqual(result["recently_added_movies"], [library.ROWS[0]["title"]])

    async def test_group_status_matches_browse_and_unknown_is_not_unwatched(
        self,
    ):
        result = await self.scan()
        self.assertIsNone(result["unwatched_movies"])
        self.assertIsNone(result["watched_movies"])
        self.assertEqual(result["unknown_movies"], 2)
        for memberships in (
            {"Played": ["fixture-a"], "Paused": ["fixture-a2"]},
            {"Played": ["fixture-a"]},
            {},
        ):
            result = await self.scan(collections=memberships)
            page = await self.repository.async_library_list(
                library.SOURCE, {"grouped": True}
            )
            self.assertEqual(
                result["unwatched_movies"],
                sum(row["watched_status"] == "unwatched" for row in page["items"]),
            )
            self.assertEqual(
                result["watched_movies"],
                sum(row["watched_status"] == "watched" for row in page["items"]),
            )
        result = await self.scan([*library.ROWS, movie()])
        self.assertEqual(result["total_movies"], 3)
        self.assertIsNone(result["unwatched_movies"])
        self.assertIsNone(result["watched_movies"])
        self.assertEqual(result["unknown_movies"], 1)
        result = await self.scan([*library.ROWS, movie()], {})
        self.assertEqual(result["unwatched_movies"], 3)
        self.assertEqual(result["watched_movies"], 0)

    async def test_watched_counts_groups_excludes_paused_and_uses_current_source(self):
        remake = movie("remake", "remake", title=library.ROWS[0]["title"], year=1990)
        rows = [*library.ROWS, remake]
        played = [row["source_handle"] for row in rows]
        result = await self.scan(rows, {"Played": played})
        self.assertEqual(result["watched_movies"], 3)
        result = await self.scan(rows, {"Played": played, "Paused": ["fixture-a2"]})
        self.assertEqual(result["watched_movies"], 2)
        await self.repository.async_library_catalog(
            "http://other-fictional.local", [movie()], {"Played": ["new-handle"]}
        )
        self.assertEqual((await self.summary())["watched_movies"], 2)
        result = await self.scan([remake], {"Played": ["remake"]})
        self.assertEqual(result["watched_movies"], 1)

    async def test_batches_are_atomic_persistent_and_source_scoped(self):
        await self.scan(collections={})
        batch = await self.scan([*library.ROWS, movie()], {})
        with self.assert_error("library_changed"):
            await self.scan(
                [*library.ROWS, movie("bad", "bad")], {"Fictional": ["missing"]}
            )
        self.assertEqual(await self.summary(), batch)
        await self.repository.async_library_catalog(
            "http://other-fictional.local", [movie()], {}
        )
        other = await self.repository.async_library_summary(
            source_id("http://other-fictional.local")
        )
        self.assertEqual(other["total_movies"], 1)
        self.assertEqual(other["recently_added"], 0)
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        result = await self.summary()
        for key in ("recently_added", "recently_added_movies", "recently_added_at"):
            self.assertEqual(result[key], batch[key])
        self.assertNotIn(library.ORIGIN, json.dumps(result))
        self.assertNotIn("source_group", json.dumps(result))
        self.assertNotIn("source_handle", json.dumps(result))

    async def test_schema_nine_upgrade_keeps_catalog_as_baseline(self):
        await self.scan(collections={})
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("DROP INDEX library_purchase_matches")
            for column in (
                "recently_added_count",
                "recently_added_movies",
                "recently_added_at",
            ):
                db.execute(f"ALTER TABLE library_sources DROP COLUMN {column}")
            db.execute("DROP TABLE settings")
            db.execute("DROP TABLE database_audit")
            db.execute("DROP INDEX library_title_groups")
            db.execute("ALTER TABLE library_sources DROP COLUMN recently_added_batch")
            db.execute("ALTER TABLE library DROP COLUMN addition_batch")
            db.execute("ALTER TABLE schema_metadata DROP COLUMN settings_revision")
            db.execute("DROP TABLE calendar_sync_items")
            db.execute("DROP TABLE calendar_sync_jobs")
            db.execute("DROP TABLE calendar_publications")
            db.execute("DROP INDEX viewings_completed")
            db.execute("DROP INDEX viewings_library_title")
            db.execute("ALTER TABLE viewings DROP COLUMN library_title_id")
            db.execute("ALTER TABLE viewings DROP COLUMN library_metadata")
            db.execute("ALTER TABLE library RENAME TO library_titles")
            for column in (
                "sort_title",
                "enrichment",
                "purchase_history",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
                "purchase_match_pending",
            ):
                db.execute(f"ALTER TABLE library_titles DROP COLUMN {column}")
            db.execute("DROP TABLE playback_controls")
            db.execute("DROP TABLE calendar_managed_events")
            db.execute("DROP TABLE calendar_reconcile_candidates")
            db.execute("DROP TABLE calendar_reconcile_intents")
            db.execute("DROP TABLE IF EXISTS operation_logs")
            db.execute("DROP TABLE IF EXISTS log_state")
            db.execute("PRAGMA user_version=9")
            db.commit()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual((await self.summary())["recently_added"], 0)
        self.assertEqual((await self.summary())["total_movies"], 2)
        self.assertTrue(list(self.path.parent.glob("*.v9.*.bak")))
        batch = await self.scan([*library.ROWS, movie()], {})
        self.assertEqual(batch["recently_added"], 1)
        metadata = await self.repository.async_library_info(library.SOURCE)
        self.assertFalse(any(key.startswith("recently_added") for key in metadata))

    async def test_thousands_of_additions_keep_exact_count_and_bounded_attributes(self):
        await self.scan(collections={})
        added = [
            movie(f"new-{i}", f"handle-{i}", title=f"{i:04} " + "🎬" * 490)
            for i in range(1000)
        ]
        result = await self.scan([*library.ROWS, *added], {})
        self.assertEqual(result["total_movies"], 1002)
        self.assertEqual(result["recently_added"], 1000)
        self.assertTrue(result["recently_added_truncated"])
        self.assertLessEqual(len(result["recently_added_movies"]), 50)
        self.assertLessEqual(
            len(
                json.dumps(result["recently_added_movies"], ensure_ascii=False).encode()
            ),
            8192,
        )

    async def test_sizes_are_main_database_and_deduplicated_indexed_artwork_bytes(self):
        await self.scan(collections={})
        image = b"\xff\xd8\xfffictional cover"
        for row in library.ROWS[:2]:
            await self.repository.async_library_artwork_save(
                library.SOURCE,
                title_id(library.SOURCE, row["source_handle"]),
                image,
                "image/jpeg",
                100,
            )
        result = await self.summary()
        self.assertEqual(result["database_bytes"], self.path.stat().st_size)
        self.assertEqual(result["artwork_cache_bytes"], len(image))
        disabled = await self.repository.async_library_summary(None)
        self.assertEqual(disabled["artwork_cache_bytes"], len(image))
        self.assertIsNone(disabled["recently_added"])


class LibrarySensorTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp

    async def setup_sensors(self, enabled=True):
        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        entry = backend.entry()
        object.__setattr__(entry, "state", ConfigEntryState.SETUP_IN_PROGRESS)
        object.__setattr__(
            entry, "data", {"library_enabled": enabled, "library_host": library.ORIGIN}
        )
        entry.runtime_data = SimpleNamespace(
            repository=self.repository,
            dataset_id=(await self.repository.async_info())["dataset_id"],
        )
        added = Mock()
        await async_setup_entry(hass, entry, added)
        entities = added.call_args.args[0]
        for coordinator in {entity.coordinator for entity in entities}:
            self.addAsyncCleanup(coordinator.async_shutdown)
        return entry, {entity.entity_description.key: entity for entity in entities}

    async def test_sensor_metadata_native_values_scope_and_disabled_sizes(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        entry, sensors = await self.setup_sensors()
        total = sensors["total_movies"]
        self.assertEqual(total.native_value, 2)
        watched = sensors["watched_movies"]
        self.assertEqual(watched.native_value, 0)
        self.assertEqual(watched.extra_state_attributes["unknown_movies"], 0)
        self.assertEqual(watched.suggested_display_precision, 0)
        await self.repository.async_library_catalog(
            library.ORIGIN, library.ROWS, {"Played": ["fixture-a", "fixture-a2"]}
        )
        await watched.coordinator.async_refresh()
        self.assertEqual(watched.native_value, 1)
        self.assertEqual(sensors["recently_added"].native_value, 0)
        stamp = sensors["last_library_sync"]
        self.assertEqual(stamp.device_class, SensorDeviceClass.TIMESTAMP)
        self.assertIsInstance(stamp.native_value, datetime)
        self.assertEqual(stamp.native_value.utcoffset(), UTC.utcoffset(None))
        size = sensors["database_size"]
        self.assertEqual(size.native_unit_of_measurement, UnitOfInformation.MEBIBYTES)
        self.assertEqual(size.device_class, SensorDeviceClass.DATA_SIZE)
        self.assertEqual(size.state_class, SensorStateClass.MEASUREMENT)
        self.assertEqual(size.entity_category, EntityCategory.DIAGNOSTIC)
        self.assertEqual(size.native_value, self.path.stat().st_size / 1024**2)
        self.assertNotEqual(
            total.coordinator, sensors["last_watched_movie"].coordinator
        )
        self.assertTrue(
            all(
                sensors[key].coordinator is total.coordinator
                for key in (
                    "database_size",
                    "watched_movies",
                    "unwatched_movies",
                    "recently_added",
                )
            )
        )
        object.__setattr__(entry, "data", {"library_enabled": False})
        self.assertFalse(total.available)
        self.assertFalse(watched.available)
        self.assertIsNone(watched.native_value)
        self.assertEqual(watched.extra_state_attributes, {})
        self.assertIsNone(total.native_value)
        self.assertEqual(sensors["recently_added"].extra_state_attributes, {})
        self.assertTrue(size.available)
        await total.coordinator.async_refresh()
        self.assertTrue(size.available)
        self.assertEqual(sensors["artwork_cache_size"].native_value, 0)

    async def test_unknown_before_sync_and_failures_do_not_publish_zeros(self):
        _, sensors = await self.setup_sensors()
        total = sensors["total_movies"]
        self.assertTrue(total.available)
        self.assertIsNone(total.native_value)
        with (
            patch.object(
                self.repository,
                "async_library_summary",
                side_effect=JournalError("storage_error", "fixture"),
            ),
            self.assertLogs(
                "custom_components.kaleidescape_companion.sensor", level="ERROR"
            ),
        ):
            await total.coordinator.async_refresh()
        self.assertFalse(total.available)
        self.assertIsNone(total.native_value)
        self.assertFalse(sensors["database_size"].available)
        await total.coordinator.async_refresh()
        self.assertTrue(total.available)
        remove = total.coordinator.async_add_listener(Mock())
        self.assertIsNotNone(total.coordinator._unsub_refresh)
        remove()
        self.assertIsNone(total.coordinator._unsub_refresh)

    async def test_source_change_during_refresh_withholds_the_old_source(self):
        await self.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        entry, sensors = await self.setup_sensors()
        total = sensors["total_movies"]
        original = self.repository.async_library_summary

        async def change_source(*args):
            result = await original(*args)
            object.__setattr__(
                entry,
                "data",
                {
                    "library_enabled": True,
                    "library_host": "http://other-fictional.local",
                },
            )
            return result

        with (
            patch.object(
                self.repository, "async_library_summary", side_effect=change_source
            ),
            self.assertLogs(
                "custom_components.kaleidescape_companion.sensor", level="ERROR"
            ),
        ):
            await total.coordinator.async_refresh()
        self.assertFalse(total.available)
        self.assertIsNone(total.native_value)
        self.assertEqual(sensors["recently_added"].extra_state_attributes, {})
        await total.coordinator.async_refresh()
        self.assertTrue(total.available)
        self.assertIsNone(total.native_value)

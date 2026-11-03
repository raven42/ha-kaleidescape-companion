"""HA event adapter and configuration tests using fictional source entities."""

import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from _expected_logs import expected_log
from homeassistant import bootstrap, loader
from homeassistant.config_entries import ConfigEntries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.core.settings import (
    entity_ids,
    form,
    validate,
)
from custom_components.kaleidescape_companion.playback.observer import PlaybackObserver


class ObserverTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(self.hass.async_stop, force=True)
        loader.async_setup(self.hass)
        self.hass.config_entries = ConfigEntries(self.hass, {})
        await bootstrap.async_load_base_functionality(self.hass)
        self.time = 0
        self.hass.states.async_set(
            "media_player.example",
            "playing",
            {
                "media_title": "Example Film",
                "media_content_id": "raw-version",
                "media_duration": 1000,
                "media_content_type": "stream",
            },
        )
        self.hass.states.async_set("sensor.example_status", "playing")
        self.hass.states.async_set("sensor.example_location", "content")
        await self.hass.async_block_till_done()
        self.input = {
            "tracking_enabled": True,
            "media_player": "media_player.example",
            "play_status": "sensor.example_status",
            "media_location": "sensor.example_location",
            "minimum_seconds": 5,
            "resume_hours": 24,
        }
        self.config = validate(self.hass, self.input, {})
        self.repository = JournalRepository(
            Path(self.directory.name) / "journal.sqlite3"
        )
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)
        self.observer = PlaybackObserver(
            self.hass, self.repository, self.config, clock=self.clock
        )
        await self.observer.async_start()
        self.addAsyncCleanup(self.observer.async_stop)

    def clock(self):
        return (
            (
                datetime(2026, 10, 25, tzinfo=UTC) + timedelta(seconds=self.time)
            ).isoformat(timespec="microseconds"),
            self.time,
        )

    async def tick(self, time):
        self.time = time
        self.observer._enqueue(self.observer._capture())
        await self.observer.async_flush()

    async def change(self, time, entity, state, attributes=None):
        self.time = time
        self.hass.states.async_set(entity, state, attributes)
        await self.hass.async_block_till_done()
        await self.observer.async_flush()

    async def test_entity_events_record_stream_content_and_preserve_pause_edges(self):
        await self.tick(0.5)
        await self.change(10, "sensor.example_status", "paused")
        await self.change(20, "sensor.example_status", "playing")
        await self.change(30, "sensor.example_location", "credits")
        record = (await self.repository.async_list())["items"][0]
        self.assertEqual(record["status"], "completed")
        self.assertAlmostEqual(record["watched_seconds"], 19.5)
        self.assertEqual(record["raw_content_id"], "raw-version")
        self.assertTrue(self.observer.live_state()["available"])
        await self.observer.async_stop()
        before = (await self.repository.async_info())["revision"]
        await self.change(40, "sensor.example_location", "content")
        self.assertEqual((await self.repository.async_info())["revision"], before)

    async def test_backup_buffers_edges_and_replays_in_order(self):
        await self.tick(0.5)
        await self.observer.async_pause()
        await self.repository.async_pause()
        await self.change(10, "sensor.example_status", "paused")
        await self.change(20, "sensor.example_status", "playing")
        await self.change(30, "sensor.example_location", "credits")
        self.assertGreater(self.observer.live_state()["buffered_observations"], 0)
        await self.repository.async_resume()
        await self.observer.async_resume()
        record = (await self.repository.async_list())["items"][0]
        self.assertAlmostEqual(record["watched_seconds"], 19.5)
        self.assertEqual(record["status"], "completed")

    @expected_log(
        "custom_components.kaleidescape_companion.playback.observer",
        "Playback observation buffer overflowed",
    )
    async def test_buffer_overflow_records_a_gap_instead_of_counting_lost_edges(self):
        await self.tick(0.5)
        await self.observer.async_pause()
        await self.repository.async_pause()
        with patch(
            "custom_components.kaleidescape_companion.playback.observer.MAX_OBSERVATIONS",
            2,
        ):
            await self.change(10, "sensor.example_status", "paused")
            await self.change(20, "sensor.example_status", "playing")
            await self.change(30, "sensor.example_location", "credits")
        await self.repository.async_resume()
        await self.observer.async_resume()
        record = (await self.repository.async_list())["items"][0]
        self.assertEqual(record["watched_seconds"], 0)
        self.assertEqual(record["status"], "partial")
        self.assertGreater(self.observer.overflow_count, 0)
        self.assertGreater(self.observer.tracker.session.gap_count, 0)

    @expected_log(
        "custom_components.kaleidescape_companion.playback.observer",
        "Playback checkpoint could not be saved",
    )
    async def test_storage_failure_retains_checkpoint_for_retry(self):
        with patch.object(
            self.repository,
            "async_save_session",
            side_effect=JournalError("storage_error", "test"),
        ):
            with self.assertRaises(JournalError):
                await self.tick(0.5)
            self.assertEqual(self.observer.last_error, "storage_error")
        await self.tick(1)
        self.assertIsNone(self.observer.last_error)
        self.assertEqual(len((await self.repository.async_list())["items"]), 1)

    async def test_unavailable_player_does_not_create_a_record(self):
        await self.change(1, "media_player.example", "unavailable")
        await self.tick(100)
        self.assertEqual((await self.repository.async_list())["items"], [])
        self.assertFalse(self.observer.live_state()["available"])

    async def test_disabling_tracking_finalizes_the_source_session(self):
        await self.tick(0.5)
        self.time = 10
        await self.observer.async_stop("tracking_disabled")
        self.assertIsNone(
            await self.repository.async_open_session(self.config["player_id"])
        )
        record = (await self.repository.async_list())["items"][0]
        session = (await self.repository.async_sessions(record["id"]))["items"][0]
        self.assertEqual(session["end_reason"], "tracking_disabled")
        self.assertAlmostEqual(record["watched_seconds"], 9.5)

    async def test_shutdown_does_not_count_time_spent_draining_storage(self):
        await self.tick(0.5)
        self.time = 10
        flush = self.observer.async_flush

        async def delayed_flush():
            self.time = 100
            await flush()

        with patch.object(self.observer, "async_flush", delayed_flush):
            await self.observer.async_stop()
        record = (await self.repository.async_list())["items"][0]
        self.assertAlmostEqual(record["watched_seconds"], 9.5)

    async def test_settings_reject_bad_mappings_and_preserve_player_identity(self):
        same = validate(self.hass, self.input, self.config)
        self.assertEqual(same["player_id"], self.config["player_id"])
        for changes, message in (
            ({"play_status": "sensor.example_location"}, "duplicate_entities"),
            ({"media_player": "sensor.example_status"}, "invalid_entities"),
            ({"media_location": None}, "missing_entities"),
        ):
            with self.assertRaisesRegex(ValueError, message):
                validate(self.hass, {**self.input, **changes}, {})

    async def test_runtime_option_defaults_bounds_and_preserved_values(self):
        self.assertEqual(self.config["minimum_runtime_minutes"], 10)
        self.assertEqual(
            form(self.hass, {})({"tracking_enabled": False})["minimum_runtime_minutes"],
            10,
        )
        configured = validate(
            self.hass, {**self.input, "minimum_runtime_minutes": 20}, {}
        )
        observer = PlaybackObserver(self.hass, self.repository, configured)
        self.assertEqual(observer.tracker.minimum_runtime_seconds, 1200)
        self.assertEqual(
            form(self.hass, configured)({"tracking_enabled": False})[
                "minimum_runtime_minutes"
            ],
            20,
        )
        self.assertEqual(
            validate(self.hass, self.input, configured)["minimum_runtime_minutes"], 20
        )
        self.assertEqual(
            validate(self.hass, {**self.input, "minimum_runtime_minutes": 0}, {})[
                "minimum_runtime_minutes"
            ],
            0,
        )
        for invalid in (-1, 1441, True, None, "10", float("nan"), float("inf")):
            with (
                self.subTest(value=invalid),
                self.assertRaisesRegex(ValueError, "invalid_rules"),
            ):
                validate(
                    self.hass, {**self.input, "minimum_runtime_minutes": invalid}, {}
                )

    async def test_short_playback_stays_live_but_creates_no_journal_entry(self):
        attributes = {
            **self.hass.states.get("media_player.example").attributes,
            "media_duration": 120,
        }
        await self.change(0, "media_player.example", "playing", attributes)
        await self.tick(0.5)
        await self.change(120, "sensor.example_location", "credits")
        live = self.observer.live_state()
        self.assertEqual(live["minimum_runtime_minutes"], 10)
        self.assertEqual(live["recording_exclusion"], "below_minimum_runtime")
        self.assertEqual(live["title"], "Example Film")
        self.assertIsNone(live["session"])
        self.assertEqual((await self.repository.async_list())["items"], [])

    async def test_legacy_config_uses_default_runtime_filter_and_missing_runtime_waits(
        self,
    ):
        await self.observer.async_stop()
        legacy = {
            key: value
            for key, value in self.config.items()
            if key != "minimum_runtime_minutes"
        }
        self.observer = PlaybackObserver(
            self.hass, self.repository, legacy, clock=self.clock
        )
        self.addAsyncCleanup(self.observer.async_stop)
        attributes = {
            **self.hass.states.get("media_player.example").attributes,
            "media_duration": None,
        }
        self.hass.states.async_set("media_player.example", "playing", attributes)
        await self.hass.async_block_till_done()
        await self.observer.async_start()
        await self.tick(30)
        self.assertEqual(
            self.observer.live_state()["recording_exclusion"], "runtime_unknown"
        )
        self.assertEqual((await self.repository.async_list())["items"], [])
        await self.change(
            31, "media_player.example", "playing", {**attributes, "media_duration": 600}
        )
        await self.tick(31.5)
        self.assertEqual(len((await self.repository.async_list())["items"]), 1)

    async def test_registered_entity_reference_survives_rename(self):
        registry = er.async_get(self.hass)
        registered = registry.async_get_or_create(
            "media_player", "example", "stable-id", suggested_object_id="registered"
        )
        self.hass.states.async_set(registered.entity_id, "unavailable")
        config = validate(
            self.hass, {**self.input, "media_player": registered.entity_id}, {}
        )
        registry.async_update_entity(
            registered.entity_id, new_entity_id="media_player.renamed"
        )
        self.assertEqual(
            entity_ids(self.hass, config)["media_player"], "media_player.renamed"
        )
        same = validate(
            self.hass, {**self.input, "media_player": "media_player.renamed"}, config
        )
        self.assertEqual(same["player_id"], config["player_id"])

    async def test_live_snapshot_exposes_context_without_artwork_urls_or_tokens(self):
        await self.tick(0.5)
        attributes = {
            **self.hass.states.get("media_player.example").attributes,
            "friendly_name": "Fictional cinema",
            "entity_picture": (
                "/api/media_player_proxy/media_player.example"
                "?token=fictional-secret&cache=example"
            ),
        }
        await self.change(10, "media_player.example", "playing", attributes)
        live = self.observer.live_state()
        self.assertEqual(live["name"], "Fictional cinema")
        self.assertEqual(len(live["artwork_key"]), 16)
        self.assertAlmostEqual(live["session"]["watched_seconds"], 9.5)
        self.assertFalse(live["session"]["credits_confirmed"])
        self.assertNotIn("fictional-secret", str(live))
        self.assertNotIn("/api/media_player_proxy", str(live))
        for picture in (
            "https://untrusted.example/cover.jpg",
            "//untrusted.example/cover.jpg",
            "/api/media_player_proxy/media_player.other?token=fictional-secret",
            "javascript:alert(1)",
            None,
        ):
            await self.change(
                11,
                "media_player.example",
                "playing",
                {**attributes, "entity_picture": picture},
            )
            self.assertIsNone(self.observer.live_state()["artwork_key"])
        await self.change(
            12,
            "media_player.example",
            "playing",
            {**attributes, "media_content_id": "different-version"},
        )
        self.assertIsNone(self.observer.live_state()["session"])
        await self.change(13, "media_player.example", "unavailable", attributes)
        self.assertIsNone(self.observer.live_state()["artwork_key"])

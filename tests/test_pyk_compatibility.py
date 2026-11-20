"""Exercise the patched pyk Device surface without connecting to a player."""

import json
import re
import unittest
from pathlib import Path
from types import SimpleNamespace

import homeassistant

from custom_components.kaleidescape_companion.kaleidescape_browser import (
    LocalLibrary,
)
from custom_components.kaleidescape_companion.playback.control_config import COMMANDS
from custom_components.kaleidescape_companion.playback.controls import (
    PlaybackControls,
    PlaybackState,
)
from custom_components.kaleidescape_companion.playback.identity import normalize_serial
from custom_components.kaleidescape_companion.playback.live_player import LivePlayer
from custom_components.kaleidescape_companion.vendor.kaleidescape import Device


class PykCompatibilityTest(unittest.TestCase):
    def test_manifest_matches_ha_packaged_dependency(self):
        root = Path(__file__).resolve().parents[1]
        manifest = json.loads(
            (
                root / "custom_components/kaleidescape_companion/manifest.json"
            ).read_text()
        )
        ha_manifest = json.loads(
            (
                Path(homeassistant.__file__).parent
                / "components/kaleidescape/manifest.json"
            ).read_text()
        )
        self.assertEqual(len(ha_manifest["requirements"]), 1)
        matched = re.fullmatch(r"pykaleidescape==(.+)", ha_manifest["requirements"][0])
        self.assertIsNotNone(matched)
        self.assertEqual(manifest["requirements"], [f"pykaleidescape>={matched[1]}"])
        self.assertIs(LivePlayer.__base__, Device)
        self.assertTrue(callable(LivePlayer.prepare_movie_launch))
        self.assertFalse(hasattr(Device, "prepare_movie_launch"))
        self.assertTrue(callable(LocalLibrary.add_to_collection))

    def test_pyk_commands_use_explicit_device_methods(self):
        for method in COMMANDS.values():
            self.assertIs(getattr(LivePlayer, method), getattr(Device, method))
        self.assertEqual(COMMANDS["pause"], "pause_on")
        self.assertEqual(COMMANDS["resume"], "pause_off")
        self.assertEqual(COMMANDS["back"], "back")
        self.assertTrue(callable(LocalLibrary.movies))

    def test_serial_normalization_retains_existing_validation(self):
        self.assertEqual(normalize_serial("00001a2b"), "1A2B")
        self.assertEqual(normalize_serial("1234567890abcdef"), "1234567890ABCDEF")
        for value in ("", "0", "#1234", "1" * 17, "１２３", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_serial(value)


class PykStateTest(unittest.IsolatedAsyncioTestCase):
    async def test_state_reads_use_live_player_snapshot(self):
        controls = object.__new__(PlaybackControls)

        class Client:
            async def read_playback_state(self):
                return SimpleNamespace(
                    identity=SimpleNamespace(
                        serial_number="000000001A2B", movie_zones=1
                    ),
                    power="on",
                    readiness="ready",
                    zone_available=True,
                    playing_title="Fictional",
                    play_status="playing",
                    duration_seconds=7200,
                    position_seconds=100,
                )

        power, state = await controls._state(Client(), "1A2B", "status")
        self.assertEqual(
            power, {"power_state": "on", "readiness": "ready", "ready": True}
        )
        self.assertEqual(state, PlaybackState("Fictional", 2, 7200, 100))

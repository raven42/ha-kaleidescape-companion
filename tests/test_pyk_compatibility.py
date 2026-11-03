"""Exercise the HA-packaged pyk definitions without connecting to a player."""

import json
import unittest
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace

import homeassistant
from kaleidescape import message as pyk

from custom_components.kaleidescape_companion.playback.control_config import COMMANDS
from custom_components.kaleidescape_companion.playback.controls import (
    PlaybackControls,
    PlaybackState,
)
from custom_components.kaleidescape_companion.playback.identity import normalize_serial


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
        expected = f"pykaleidescape=={version('pykaleidescape')}"
        self.assertIn(expected, manifest["requirements"])
        self.assertIn(expected, ha_manifest["requirements"])

    def test_pyk_commands_and_explicit_fallbacks_preserve_control_intent(self):
        self.assertEqual(COMMANDS["play"], pyk.Play.name)
        self.assertEqual(COMMANDS["stop"], pyk.Stop.name)
        self.assertEqual(COMMANDS["power_on"], pyk.LeaveStandby.name)
        self.assertEqual(COMMANDS["pause"], "PAUSE_ON")
        self.assertEqual(COMMANDS["resume"], "PAUSE_OFF")
        self.assertEqual(COMMANDS["back"], "BACK")

    def test_serial_normalization_retains_existing_validation(self):
        self.assertEqual(normalize_serial("00001a2b"), "1A2B")
        self.assertEqual(normalize_serial("1234567890abcdef"), "1234567890ABCDEF")
        for value in ("", "0", "#1234", "1" * 17, "１２３", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_serial(value)


class PykStateTest(unittest.IsolatedAsyncioTestCase):
    async def test_state_reads_use_pyk_names_on_guarded_client(self):
        controls = object.__new__(PlaybackControls)
        responses = {
            pyk.GetDevicePowerState.name: SimpleNamespace(
                values={"power_state": "1"}, extra_fields=("1",)
            ),
            pyk.GetSystemReadinessState.name: SimpleNamespace(values={"state": "0"}),
            pyk.GetPlayStatus.name: SimpleNamespace(
                mode=2, duration_seconds=7200, position_seconds=100
            ),
            pyk.GetPlayingTitleName.name: SimpleNamespace(
                values={"title": "Fictional"}
            ),
        }

        class Client:
            def __init__(self):
                self.queries = []

            async def query(self, name, *, target):
                self.queries.append((name, target))
                return responses[name]

        client = Client()
        target = object()
        with self.assertNoLogs("kaleidescape", level="DEBUG"):
            power, state = await controls._state(client, target, "status")
        self.assertEqual(
            power, {"power_state": "on", "readiness": "ready", "ready": True}
        )
        self.assertEqual(state, PlaybackState("Fictional", 2, 7200, 100))
        self.assertEqual(
            [name for name, _ in client.queries],
            [
                pyk.GetDevicePowerState.name,
                pyk.GetSystemReadinessState.name,
                pyk.GetPlayStatus.name,
                pyk.GetPlayingTitleName.name,
            ],
        )

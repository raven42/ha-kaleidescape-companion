"""Exercise the patched pyk Device surface without connecting to a player."""

import json
import unittest
from pathlib import Path
from types import SimpleNamespace

import homeassistant

from custom_components.kaleidescape_companion.playback.control_config import COMMANDS
from custom_components.kaleidescape_companion.playback.controls import (
    PlaybackControls,
    PlaybackState,
)
from custom_components.kaleidescape_companion.playback.identity import normalize_serial
from custom_components.kaleidescape_companion.vendor.kaleidescape import Device
from custom_components.kaleidescape_companion.vendor.kaleidescape import message as pyk
from custom_components.kaleidescape_companion.vendor.kaleidescape.local_browser import (
    LocalLibrary,
)


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
        self.assertEqual(manifest["requirements"], ha_manifest["requirements"])
        self.assertTrue(callable(Device.prepare_movie_launch))
        self.assertTrue(callable(LocalLibrary.add_to_collection))

    def test_pyk_commands_use_explicit_device_methods(self):
        for method in COMMANDS.values():
            self.assertTrue(callable(getattr(Device, method)))
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
    async def test_state_reads_use_pyk_names_on_guarded_client(self):
        controls = object.__new__(PlaybackControls)
        responses = {
            pyk.GetDevicePowerState: SimpleNamespace(field_zone=[]),
            pyk.GetPlayStatus: SimpleNamespace(
                field_play_status="playing",
                field_title_length=7200,
                field_title_location=100,
            ),
        }

        class Client:
            def __init__(self):
                self.queries = []

            connection = SimpleNamespace(generation=1)

            async def read_control_state(self):
                return SimpleNamespace(
                    identity=SimpleNamespace(generation=1),
                    power="on",
                    readiness="ready",
                    playing_title="Fictional",
                )

        client = Client()

        async def response(device, request, *, serial=None):
            client.queries.append(request)
            return responses[request]

        from unittest.mock import patch

        with patch(
            "custom_components.kaleidescape_companion.playback.controls.one_response",
            response,
        ):
            power, state = await controls._state(client, "status")
        self.assertEqual(
            power, {"power_state": "on", "readiness": "ready", "ready": True}
        )
        self.assertEqual(state, PlaybackState("Fictional", 2, 7200, 100))
        self.assertEqual(
            client.queries,
            [pyk.GetDevicePowerState, pyk.GetPlayStatus],
        )

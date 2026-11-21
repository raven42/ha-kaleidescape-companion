"""Explicit operator checks of one owned player or server."""

import os
import unittest

from custom_components.kaleidescape_companion.playback.live_player import LivePlayer


@unittest.skipUnless(os.getenv("PYK_HARDWARE") == "1", "Hardware checks are opt-in")
class DeviceChecks(unittest.IsolatedAsyncioTestCase):
    async def selected(self, role):
        host = os.getenv(f"PYK_{role}_HOST")
        serial = os.getenv(f"PYK_{role}_SERIAL")
        if not host or not serial:
            self.skipTest(f"Select one {role.lower()} host and serial")
        device = LivePlayer(host, reconnect=False)
        self.addAsyncCleanup(device.disconnect)
        await device.connect()
        identity = await device.read_identity()
        self.assertEqual(identity.serial_number, serial.upper().zfill(12))
        self.assertEqual(identity.movie_zones > 0, role == "PLAYER")
        return device, identity

    async def test_player_reads(self):
        device, identity = await self.selected("PLAYER")
        state = await device.read_playback_state()
        self.assertEqual(state.identity, identity)
        discovered = await device.discover_devices()
        self.assertIn(
            identity.serial_number, {item.serial_number for item in discovered}
        )

    async def test_server_reads(self):
        device, identity = await self.selected("SERVER")
        self.assertEqual((await device.read_playback_state()).identity, identity)

    @unittest.skipUnless(
        os.getenv("PYK_HARDWARE_CONTROLS") == "1", "Enable pause/resume"
    )
    async def test_selected_player_pause_and_resume(self):
        device, _ = await self.selected("PLAYER")
        if (await device.read_playback_state()).play_status != "playing":
            self.skipTest("Select an active playback session")
        for action, expected in [
            (device.pause_on, "paused"),
            (device.pause_off, "playing"),
        ]:
            for _ in range(2):
                await action()
            self.assertEqual((await device.read_playback_state()).play_status, expected)

    @unittest.skipUnless(
        os.getenv("PYK_HARDWARE_BACK") == "1", "Enable BACK in a safe menu"
    )
    async def test_selected_player_back(self):
        device, _ = await self.selected("PLAYER")
        await device.back()

    async def prepare(self):
        handle = os.getenv("PYK_HARDWARE_LAUNCH_HANDLE")
        if not handle:
            self.skipTest("Select a known qualified launch handle")
        device, identity = await self.selected("PLAYER")
        prepared = await device.prepare_movie_launch(
            handle, serial=identity.serial_number
        )
        self.assertEqual(prepared.handle, handle)
        self.assertTrue(prepared.title)
        return device, prepared

    async def test_launch_read_only(self):
        await self.prepare()

    @unittest.skipUnless(
        os.getenv("PYK_HARDWARE_LAUNCH") == "1", "Explicit launch opt-in required"
    )
    async def test_one_launch(self):
        device, prepared = await self.prepare()
        ack = await device.send_movie_launch(prepared)
        self.assertEqual(ack.status, 0)

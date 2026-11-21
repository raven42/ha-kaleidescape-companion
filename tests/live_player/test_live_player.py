"""Exercise LivePlayer using only pyk and an in-memory protocol peer."""

import unittest
from dataclasses import FrozenInstanceError
from inspect import signature
from unittest.mock import patch

from kaleidescape import KaleidescapeError, const, message
from live_player import DeviceIdentity, LivePlayer

ROUTING = "device_id" in signature(message.Request).parameters


class LivePlayerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.player = LivePlayer("127.0.0.1")
        self.commands = []
        self.replies = {
            "GET_DEVICE_INFO": "DEVICE_INFO::0000000000001a2b:00:010.000.000.025:",
            "GET_NUM_ZONES": "NUM_ZONES:01:01:",
            "GET_DEVICE_TYPE_NAME": "DEVICE_TYPE_NAME:Example player:",
            "GET_DEVICE_POWER_STATE": "DEVICE_POWER_STATE:1:1:",
            "GET_SYSTEM_READINESS_STATE": "SYSTEM_READINESS_STATE:0:",
            "GET_PLAY_STATUS": "PLAY_STATUS:2:1:1:7200:101:1:2:0:",
            "GET_PLAYING_TITLE_NAME": "TITLE_NAME:Feature:",
            "GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER": (
                "AVAILABLE_DEVICES_BY_SERIAL_NUMBER:1a2b:00001A2B:"
            ),
            "GET_FRIENDLY_NAME": "FRIENDLY_NAME:Screening room:",
            "GET_HIGHLIGHTED_SELECTION": "HIGHLIGHTED_SELECTION:26-1.Other:",
            "GET_CONTENT_DETAILS": [
                "CONTENT_DETAILS_OVERVIEW:2:26-1.Feature:movies:",
                "CONTENT_DETAILS:2:Title:Feature:",
                "CONTENT_DETAILS:1:Year:2025:",
            ],
            "PAUSE": "",
            "PLAY_MOVIE": "",
        }
        self.enterContext(patch.object(self.player.connection, "send", self.respond))

    async def respond(self, request):
        self.commands.append(request.name)
        frames = self.replies[request.name]
        for frame in [frames] if isinstance(frames, str) else frames:
            request.set(message.Response.factory(f"01/0/000:{frame}/1"))
        return await request.wait()

    async def test_fresh_snapshot_and_event_state_can_be_read_separately(self):
        self.player.movie.title = "Previously observed"
        before = await self.player.read_playback_state()
        self.replies["GET_PLAYING_TITLE_NAME"] = "TITLE_NAME:Next feature:"
        self.replies["GET_PLAY_STATUS"] = "PLAY_STATUS:1:1:1:6400:200:1:2:0:"
        after = await self.player.read_playback_state()

        self.assertEqual(
            before.identity,
            DeviceIdentity("000000001A2B", "Example player", "10.0.0.25", 1),
        )
        self.assertEqual(before.playing_title, "Feature")
        self.assertEqual(
            (before.play_status, before.position_seconds), ("playing", 101)
        )
        self.assertEqual(
            (
                after.playing_title,
                after.play_status,
                after.duration_seconds,
                after.position_seconds,
            ),
            ("Next feature", "paused", 6400, 200),
        )
        self.assertEqual(self.player.movie.title, "Previously observed")
        with self.assertRaises(FrozenInstanceError):
            after.playing_title = "Other"

    async def test_standby_and_server_only_targets_skip_movie_queries(self):
        for power, zones, state in [
            ("0:0", "1:1", "standby"),
            ("1", "0:1", "on"),
        ]:
            with self.subTest(power=power, zones=zones):
                self.replies["GET_DEVICE_POWER_STATE"] = f"DEVICE_POWER_STATE:{power}:"
                self.replies["GET_NUM_ZONES"] = f"NUM_ZONES:{zones}:"
                self.replies["GET_SYSTEM_READINESS_STATE"] = "SYSTEM_READINESS_STATE:1:"
                self.commands.clear()
                snapshot = await self.player.read_playback_state()
                self.assertEqual(
                    (snapshot.power, snapshot.readiness), (state, "becoming_ready")
                )
                self.assertFalse(snapshot.zone_available)
                self.assertIsNone(snapshot.play_status)
                self.assertEqual(
                    (
                        snapshot.playing_title,
                        snapshot.duration_seconds,
                        snapshot.position_seconds,
                    ),
                    ("", 0, 0),
                )
                self.assertNotIn("GET_PLAY_STATUS", self.commands)
                self.assertNotIn("GET_PLAYING_TITLE_NAME", self.commands)
                self.assertNotIn("LEAVE_STANDBY", self.commands)

    async def test_replacement_identity_is_read_from_the_full_wire_serial(self):
        before = await self.player.read_identity()
        self.replies["GET_DEVICE_INFO"] = (
            "DEVICE_INFO::F000000000001A2B:00:010.000.000.025:"
        )
        with self.assertRaisesRegex(KaleidescapeError, "identity"):
            await self.player.read_identity()
        self.replies["GET_DEVICE_INFO"] = (
            "DEVICE_INFO::0000000000002C3D:00:010.000.000.025:"
        )
        after = await self.player.read_identity()
        self.assertEqual(
            (before.serial_number, after.serial_number),
            ("000000001A2B", "000000002C3D"),
        )

    async def test_serial_routing_uses_the_same_target_for_every_read(self):
        with patch.object(self.player.connection, "send", wraps=self.respond) as send:
            if not ROUTING:
                with self.assertRaisesRegex(KaleidescapeError, "routing"):
                    await self.player.read_playback_state("1a2b")
                send.assert_not_awaited()
                return
            snapshot = await self.player.read_playback_state("1a2b")
        target = "#" + snapshot.identity.serial_number
        self.assertEqual(
            {call.args[0].device_id for call in send.await_args_list}, {target}
        )

    async def test_invalid_readiness_or_unrelated_reply_fails_only_that_read(self):
        for reply in ("SYSTEM_READINESS_STATE:99:", "TITLE_NAME:Other:"):
            with self.subTest(reply=reply):
                self.replies["GET_SYSTEM_READINESS_STATE"] = reply
                with self.assertRaises(KaleidescapeError):
                    await self.player.read_playback_state()
        self.replies["GET_SYSTEM_READINESS_STATE"] = "SYSTEM_READINESS_STATE:2:"
        self.assertEqual((await self.player.read_playback_state()).readiness, "idle")

    async def test_snapshot_cannot_span_a_reconnect(self):
        async def reconnect_during_read(request):
            if request.name == "GET_DEVICE_POWER_STATE":
                self.player.dispatcher.send(const.STATE_DISCONNECTED)
                self.player.dispatcher.send(const.STATE_CONNECTED)
            return await self.respond(request)

        with patch.object(self.player.connection, "send", reconnect_during_read):
            with self.assertRaisesRegex(KaleidescapeError, "Connection changed"):
                await self.player.read_playback_state()
        self.assertEqual(
            (await self.player.read_playback_state()).playing_title, "Feature"
        )

    async def test_ready_movie_zone_and_optional_title(self):
        self.replies["GET_DEVICE_POWER_STATE"] = "DEVICE_POWER_STATE:1:01:98:"
        self.replies["GET_PLAYING_TITLE_NAME"] = "TITLE_NAME:"
        state = await self.player.read_playback_state()
        self.assertTrue(state.zone_available)
        self.assertEqual((state.play_status, state.playing_title), ("playing", ""))
        for power, readiness in [("1:0", "0"), ("1:unknown", "0"), ("1", "1")]:
            with self.subTest(power=power, readiness=readiness):
                self.replies["GET_DEVICE_POWER_STATE"] = f"DEVICE_POWER_STATE:{power}:"
                self.replies["GET_SYSTEM_READINESS_STATE"] = (
                    f"SYSTEM_READINESS_STATE:{readiness}:"
                )
                self.commands.clear()
                self.assertIsNone((await self.player.read_playback_state()).play_status)
                self.assertNotIn("GET_PLAY_STATUS", self.commands)

    async def test_inherited_control_needs_only_its_pyk_request(self):
        await self.player.pause()
        self.assertEqual(self.commands, ["PAUSE"])

    @unittest.skipUnless(ROUTING, "Discovery needs pyk serial routing")
    async def test_discovery_reads_each_advertised_player_once(self):
        (identity,) = await self.player.discover_devices()
        self.assertEqual(identity.serial_number, "000000001A2B")
        self.assertEqual(identity.friendly_name, "Screening room")
        self.assertEqual(self.commands.count("GET_DEVICE_INFO"), 1)

    @unittest.skipUnless(ROUTING, "Movie launch needs pyk serial routing")
    async def test_reviewed_movie_uses_its_own_handle_and_can_only_be_sent_once(self):
        prepared = await self.player.prepare_movie_launch("Feature")
        self.assertEqual((prepared.title, prepared.year), ("Feature", "2025"))
        self.assertNotIn("PLAY_MOVIE", self.commands)
        with patch.object(self.player.connection, "send", wraps=self.respond) as send:
            self.assertIsInstance(
                await self.player.send_movie_launch(prepared), message.Ack
            )
        request = send.await_args.args[0]
        self.assertEqual(request.device_id, "#000000001A2B")
        self.assertEqual(request.fields, ["26-1.Feature", "26-1.NUL;158-0=1", ""])
        with self.assertRaisesRegex(KaleidescapeError, "prepared again"):
            await self.player.send_movie_launch(prepared)
        self.assertEqual(self.commands.count("PLAY_MOVIE"), 1)

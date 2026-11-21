"""Exercise the packaged LivePlayer against a fictional TCP player."""

import asyncio
import unittest
from contextlib import suppress

from custom_components.kaleidescape_companion.playback._pyk import (
    KaleidescapeError,
    RequestNotSentError,
    RequestOutcomeUnknownError,
    const,
    kaleidescape,
    message,
)
from custom_components.kaleidescape_companion.playback.live_player import LivePlayer
from tests._expected_logs import expected_log

SERIAL = "000000001A2B"
TARGET = "#" + SERIAL
HANDLE = "26-1.0-S_1234abcd"

expected_peer_disconnect = expected_log(
    f"{kaleidescape.__name__}.connection",
    "Disconnected from 127.0.0.1 IncompleteReadError(",
)


class Player:
    """Reply to initialization and selected commands using protocol frames."""

    def __init__(self):
        self.requests = []
        self.connections = 0
        self.last_writer = None
        self.replies = {
            "GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER": [
                f"AVAILABLE_DEVICES_BY_SERIAL_NUMBER:{SERIAL}:"
            ],
            "GET_DEVICE_INFO": [f"DEVICE_INFO::0000{SERIAL}:00:010.000.000.025:"],
            "GET_NUM_ZONES": ["NUM_ZONES:01:01:"],
            "GET_SYSTEM_VERSION": ["SYSTEM_VERSION:16:1.0:"],
            "GET_DEVICE_TYPE_NAME": ["DEVICE_TYPE_NAME:Fictional player:"],
            "GET_FRIENDLY_NAME": ["FRIENDLY_NAME:Cinema:"],
            "GET_DEVICE_POWER_STATE": ["DEVICE_POWER_STATE:0:0:"],
            "GET_SYSTEM_READINESS_STATE": ["SYSTEM_READINESS_STATE:0:"],
            "GET_HIGHLIGHTED_SELECTION": ["HIGHLIGHTED_SELECTION:26-1.Other:"],
            "GET_CONTENT_DETAILS": [
                f"CONTENT_DETAILS_OVERVIEW:2:{HANDLE}:movies:",
                "CONTENT_DETAILS:2:Year:2025:",
                "CONTENT_DETAILS:1:Title:A Film:",
            ],
            "GET_PLAY_STATUS": ["PLAY_STATUS:2:1:1:7200:102:1:2:0:"],
            "GET_PLAYING_TITLE_NAME": ["TITLE_NAME:Feature:"],
            "SEND_TO_SYSLOG": [""],
            "PLAY_MOVIE": [""],
            "PAUSE_ON": [""],
            "GO_SCREEN_SAVER": [""],
            "GO_MOVIE_COLLECTION": [""],
            "GO_MOVIE_STORE": [""],
        }
        self.received_write = asyncio.Event()

    async def serve(self, reader, writer):
        self.connections += 1
        self.last_writer = writer
        try:
            while line := await reader.readline():
                req = message.MessageParser(line.decode("latin-1").rstrip("\n"), True)
                self.requests.append(req)
                if req.name in ("PLAY_MOVIE", "PAUSE_ON"):
                    self.received_write.set()
                replies = self.replies.get(req.name)
                if replies is None:
                    writer.write(f"01/{req.seq}/020:/1\n".encode())
                else:
                    # The server can acknowledge a serial route with its numeric ID.
                    for reply in replies:
                        writer.write(f"01/{req.seq}/000:{reply}/1\n".encode("latin-1"))
                await writer.drain()
        finally:
            writer.close()
            with suppress(ConnectionError):
                await writer.wait_closed()

    def named(self, command):
        return [req for req in self.requests if req.name == command]


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.peer = Player()
        server = await asyncio.start_server(self.peer.serve, "127.0.0.1", 0)
        self.addAsyncCleanup(server.wait_closed)
        self.addCleanup(server.close)
        self.port = server.sockets[0].getsockname()[1]
        self.device = LivePlayer(
            "127.0.0.1", port=self.port, timeout=1, reconnect=False
        )
        self.addAsyncCleanup(self.device.disconnect)
        await self.device.connect()

    async def test_user_input_protocol_logs_do_not_include_search_text(self):
        self.peer.replies["GET_USER_INPUT"] = ["USER_INPUT:01:Search:fictional-secret:"]
        self.peer.replies["SET_USER_INPUT_ENTRY"] = [""]
        with self.assertLogs(
            f"{kaleidescape.__name__}.connection", level="DEBUG"
        ) as logs:
            response = await self.device.get_user_input()
            await self.device.set_user_input_entry("fictional-secret")
            await self.device._get_device_info()
        self.assertEqual(response.field_entry, "fictional-secret")
        self.assertNotIn("fictional-secret", " ".join(logs.output))
        self.assertEqual(
            self.peer.named("SET_USER_INPUT_ENTRY")[-1].fields, ["fictional-secret"]
        )

    async def test_named_collection_and_store_commands(self):
        await self.device.go_movie_collection("Watch Soon")
        await self.device.go_movie_store()
        self.assertEqual(
            self.peer.named("GO_MOVIE_COLLECTION")[-1].fields, ["Watch Soon"]
        )
        self.assertEqual(len(self.peer.named("GO_MOVIE_STORE")), 1)

    async def test_screensaver_sends_one_documented_command(self):
        await self.device.go_screen_saver()
        self.assertEqual(len(self.peer.named("GO_SCREEN_SAVER")), 1)

    async def test_discovery_and_fresh_state_share_one_routed_connection(self):
        (identity,) = await self.device.discover_devices()
        self.assertEqual(
            (identity.serial_number, identity.ip_address), (SERIAL, "10.0.0.25")
        )
        self.assertEqual(identity.friendly_name, "Cinema")
        self.assertEqual(self.peer.named("GET_FRIENDLY_NAME")[-1].device_id, TARGET)
        self.assertEqual(self.peer.named("GET_DEVICE_INFO")[-1].device_id, TARGET)
        self.peer.replies["GET_DEVICE_POWER_STATE"] = ["DEVICE_POWER_STATE:1:1:"]
        state = await self.device.read_playback_state(SERIAL)
        self.assertEqual(state.playing_title, "Feature")
        self.assertEqual(state.play_status, const.PLAY_STATUS_PLAYING)
        self.assertEqual((state.position_seconds, state.duration_seconds), (102, 7200))
        self.assertTrue(state.zone_available)
        self.assertFalse(self.peer.named("GET_HIGHLIGHTED_SELECTION"))
        self.assertEqual(self.peer.connections, 1)
        self.peer.replies["GET_SYSTEM_READINESS_STATE"] = ["SYSTEM_READINESS_STATE:99:"]
        with self.assertRaises(KaleidescapeError):
            await self.device.read_playback_state(SERIAL)

    @expected_log(f"{kaleidescape.__name__}.message", "Request GetFriendlyName(")
    async def test_discovery_queries_each_serial_once_and_accepts_missing_names(self):
        self.peer.replies["GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER"] = [
            f"AVAILABLE_DEVICES_BY_SERIAL_NUMBER:{SERIAL}:0000{SERIAL.lower()}:"
        ]
        self.peer.replies["GET_FRIENDLY_NAME"] = ["FRIENDLY_NAME:   :"]
        before = len(self.peer.named("GET_DEVICE_INFO"))
        (device,) = await self.device.discover_devices(max_devices=1)
        self.assertEqual((device.model, device.friendly_name), ("Fictional player", ""))
        self.assertEqual(len(self.peer.named("GET_DEVICE_INFO")), before + 1)
        del self.peer.replies["GET_FRIENDLY_NAME"]
        (unnamed,) = await self.device.discover_devices()
        self.assertEqual(unnamed, device)

    async def test_discovery_rejects_aliased_over_limit_and_mismatched_identities(self):
        self.peer.replies["GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER"] = [
            "AVAILABLE_DEVICES_BY_SERIAL_NUMBER:1000000001A2B:"
        ]
        with self.assertRaisesRegex(ValueError, "serial"):
            await self.device.discover_devices()
        self.peer.replies["GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER"] = [
            "AVAILABLE_DEVICES_BY_SERIAL_NUMBER:1:2:"
        ]
        with self.assertRaisesRegex(KaleidescapeError, "limit"):
            await self.device.discover_devices(max_devices=1)
        self.peer.replies["GET_DEVICE_INFO"] = [
            "DEVICE_INFO::00000000FFFF:00:127.0.0.1:"
        ]
        with self.assertRaisesRegex(KaleidescapeError, "identity mismatch"):
            await self.device.read_identity(SERIAL)

    async def test_read_only_preparation_and_exactly_one_launch(self):
        prepared = await self.device.prepare_movie_launch("0-S_1234abcd", serial=SERIAL)
        self.assertEqual(
            (prepared.handle, prepared.title, prepared.year), (HANDLE, "A Film", "2025")
        )
        self.assertEqual(self.peer.named("GET_CONTENT_DETAILS")[-1].device_id, TARGET)
        self.assertFalse(self.peer.named("PLAY_MOVIE"))
        ack = await self.device.send_movie_launch(prepared)
        self.assertIsInstance(ack, message.Ack)
        with self.assertRaises(RequestNotSentError):
            await self.device.send_movie_launch(prepared)
        (req,) = self.peer.named("PLAY_MOVIE")
        self.assertEqual(req.device_id, TARGET)
        self.assertEqual(req.fields, [HANDLE, "26-1.NUL;158-0=1", ""])

    async def test_launch_uses_title_and_optional_year_from_varied_detail_rows(self):
        self.peer.replies["GET_CONTENT_DETAILS"] = [
            f"CONTENT_DETAILS_OVERVIEW:5:{HANDLE}:Movies :",
            "CONTENT_DETAILS:5:Actor:First:",
            "CONTENT_DETAILS:1:TITLE:A Film:extra:",
            "CONTENT_DETAILS:1:Actor:Second:",
            "CONTENT_DETAILS:0:Title:A Film:",
            "CONTENT_DETAILS:3:Other:",
        ]
        prepared = await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        self.assertEqual((prepared.title, prepared.year), ("A Film", ""))
        self.assertFalse(self.peer.named("GET_HIGHLIGHTED_SELECTION"))
        self.assertFalse(self.peer.named("PLAY_MOVIE"))

    async def test_launch_requires_matching_unambiguous_metadata_and_movie_zone(self):
        for header, rows in [
            (f"1:{HANDLE}:music", ["1:Title:Film"]),
            ("1:Other:movies", ["1:Title:Film"]),
            (f"2:{HANDLE}:movies", ["1:Title:Film", "2:Title:Other"]),
            (f"3:{HANDLE}:movies", ["1:Title:Film", "2:Year:1990", "3:Year:2025"]),
            (f"1:{HANDLE}:movies", ["1:Year:2025"]),
        ]:
            with self.subTest(header=header, rows=rows):
                self.peer.replies["GET_CONTENT_DETAILS"] = [
                    f"CONTENT_DETAILS_OVERVIEW:{header}:",
                    *(f"CONTENT_DETAILS:{row}:" for row in rows),
                ]
                with self.assertRaises(KaleidescapeError):
                    await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        self.peer.replies["GET_NUM_ZONES"] = ["NUM_ZONES:0:0:"]
        with self.assertRaisesRegex(KaleidescapeError, "no movie zone"):
            await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        self.assertTrue(self.device.is_connected)
        self.assertFalse(self.peer.named("PLAY_MOVIE"))

    @expected_peer_disconnect
    async def test_reconnection_requires_a_new_movie_preparation(self):
        prepared = await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        disconnected = asyncio.Event()
        self.device.dispatcher.connect(
            lambda event, *_: (
                disconnected.set() if event == const.STATE_DISCONNECTED else None
            )
        )
        self.peer.last_writer.close()
        await asyncio.wait_for(disconnected.wait(), 1)
        await self.device.connect()
        with self.assertRaises(RequestNotSentError):
            await self.device.send_movie_launch(prepared)
        self.assertFalse(self.peer.named("PLAY_MOVIE"))
        await self.device.send_movie_launch(
            await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        )
        self.assertEqual(len(self.peer.named("PLAY_MOVIE")), 1)

    async def test_power_event_after_disconnect_does_not_reopen_the_player(self):
        await self.device.disconnect()
        event = message.Response.factory("01/!/000:DEVICE_POWER_STATE:1:1:/1")
        await self.device._handle_event(event)
        self.assertFalse(self.device.is_connected)
        self.assertEqual(self.peer.connections, 1)

    async def test_bad_metadata_header_fails_the_read_and_keeps_the_connection(self):
        self.peer.replies["GET_CONTENT_DETAILS"] = [
            f"CONTENT_DETAILS_OVERVIEW:invalid:{HANDLE}:movies:",
        ]
        with self.assertRaisesRegex(KaleidescapeError, "metadata"):
            await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        self.assertEqual((await self.device.read_identity()).serial_number, SERIAL)
        self.assertEqual(self.peer.connections, 1)
        self.assertFalse(self.peer.named("PLAY_MOVIE"))

    @expected_peer_disconnect
    async def test_queued_control_is_not_sent_after_the_connection_drops(self):
        self.peer.replies["GET_DEVICE_INFO"] = []
        before = len(self.peer.named("GET_DEVICE_INFO"))
        reads = [asyncio.create_task(self.device.read_identity()) for _ in range(10)]
        async with asyncio.timeout(1):
            while len(self.peer.named("GET_DEVICE_INFO")) < before + len(reads):
                await asyncio.sleep(0.001)
        control = asyncio.create_task(self.device.pause_on())
        await asyncio.sleep(0)
        self.peer.last_writer.close()
        *read_results, control_result = await asyncio.gather(
            *reads, control, return_exceptions=True
        )
        self.assertTrue(
            all(isinstance(r, RequestOutcomeUnknownError) for r in read_results)
        )
        self.assertIsInstance(control_result, RequestNotSentError)
        self.assertFalse(self.device.is_connected)
        self.assertFalse(self.peer.named("PAUSE_ON"))

    async def test_cancelled_write_and_unrelated_reply_cannot_acknowledge_a_control(
        self,
    ):
        self.peer.replies["PAUSE_ON"] = []
        task = asyncio.create_task(self.device.pause_on())
        await asyncio.wait_for(self.peer.received_write.wait(), 1)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertFalse(self.device.is_connected)
        await self.device.connect()
        self.peer.replies["PAUSE_ON"] = ["TITLE_NAME:Other:"]
        with self.assertRaises(RequestOutcomeUnknownError):
            await self.device.pause_on()
        self.assertFalse(self.device.is_connected)
        self.assertEqual(len(self.peer.named("PAUSE_ON")), 2)

    @expected_log(f"{kaleidescape.__name__}.connection", "Request '")
    async def test_lost_launch_ack_is_never_replayed(self):
        prepared = await self.device.prepare_movie_launch(HANDLE, serial=SERIAL)
        self.peer.replies["PLAY_MOVIE"] = []
        with self.assertRaises(RequestOutcomeUnknownError):
            await self.device.send_movie_launch(prepared)
        self.assertFalse(self.device.is_connected)
        await self.device.connect()
        with self.assertRaises(RequestNotSentError):
            await self.device.send_movie_launch(prepared)
        self.assertEqual(len(self.peer.named("PLAY_MOVIE")), 1)

"""Fictional loopback player; no household addresses or device connections."""

import asyncio
import io
import json
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import AsyncMock, patch

from dev import playback_control as cli

protocol = cli.protocol
SERIAL = "000000001A2B"
ADDRESS = "#1A2B"
HANDLE = "26-7.0-S_AB12CD34"
TITLE = "Voyage: Part One"


def packet(address, sequence, body):
    prefix = f"{address}/{sequence}/{body}/".encode("latin-1")
    return prefix + f"{sum(prefix) % 100:02d}\r\n".encode("ascii")


def field(value):
    return value.replace("\\", "\\\\").replace(":", "\\:").replace("/", "\\/")


class ParserTest(unittest.TestCase):
    def test_known_checksum_and_escaped_fields(self):
        ack = protocol.parse_response(b"01/1/000:/89")
        self.assertEqual((ack.name, ack.fields), ("", ()))
        raw = packet(
            "#000000001a2b",
            "!",
            r"000:CONTENT_DETAILS:2:Title:Voyage\: Part One\/Two\\Three\r\n\t\d233:",
        )
        response = protocol.parse_response(raw.rstrip(b"\r\n"))
        self.assertEqual(response.address, ADDRESS)
        self.assertEqual(response.sequence, "!")
        self.assertEqual(response.fields[2], "Voyage: Part One/Two\\Three\r\n\té")

    def test_malformed_frames_are_rejected(self):
        for body in (
            r"000:TITLE_NAME:bad\x:",
            r"000:TITLE_NAME:bad\d999:",
            "000:TITLE_NAME:unterminated",
            "000:TITLE_NAME:raw\tcontrol:",
        ):
            with self.subTest(body=body), self.assertRaises(protocol.ProtocolError):
                protocol.parse_response(packet(ADDRESS, "1", body).rstrip(b"\r\n"))
        for raw in (b"01/1/000:/00", b"01/1/000:", b"x" * (protocol.MAX_FRAME + 1)):
            with self.subTest(raw=raw[:30]), self.assertRaises(protocol.ProtocolError):
                protocol.parse_response(raw)

    def test_unsafe_targets_and_command_fragments_are_rejected(self):
        for address in (
            "127.0.0.1",
            "169.254.169.254",
            "8.8.8.8",
            "player.local",
            "::1",
        ):
            with (
                self.subTest(address=address),
                self.assertRaises(protocol.ProtocolError),
            ):
                protocol.Player(address, SERIAL)
        for serial in ("0", "#1A2B", "1A2B/1/STOP:", "Z123", "A" * 17):
            with self.subTest(serial=serial), self.assertRaises(protocol.ProtocolError):
                protocol.Player("10.0.0.25", serial)
        for handle in ("movie\r\n01/1/STOP:", "x:y", "x;1=1", "x/y", "", "x" * 257):
            with self.subTest(handle=handle), self.assertRaises(protocol.ProtocolError):
                protocol.content_handle(handle)
        self.assertEqual(protocol.player_address("fd00::25"), "fd00::25")


class PlayerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.commands = []
        self.writers = set()
        self.tasks = set()
        self.mode, self.title, self.position = 0, "", 0
        self.highlight = HANDLE
        self.serial = SERIAL
        self.zones = "01"
        self.reject = None
        self.drop = False
        self.hang = False
        self.wrong_ack = False
        self.ignore_launch = False
        self.bad_details = False
        self.corrupt = False
        self.large = False
        self.status_reject_after_play = False
        self.open_connection = asyncio.open_connection
        self.server = await asyncio.start_server(self.respond, "127.0.0.1", 0)
        port = self.server.sockets[0].getsockname()[1]

        async def connect(address, target_port):
            self.assertEqual((address, target_port), ("10.0.0.25", 10000))
            return await self.open_connection("127.0.0.1", port)

        self.connector = patch.object(protocol.asyncio, "open_connection", connect)
        self.connector.start()
        self.addCleanup(self.connector.stop)
        self.player = protocol.Player("10.0.0.25", SERIAL, timeout=0.15)

    async def asyncTearDown(self):
        self.server.close()
        await self.server.wait_closed()
        for writer in list(self.writers):
            writer.close()
        if self.tasks:
            await asyncio.wait_for(asyncio.gather(*list(self.tasks)), 1)

    async def respond(self, reader, writer):
        self.writers.add(writer)
        self.tasks.add(asyncio.current_task())
        try:
            while line := await reader.readline():
                address, sequence, command = line.decode().strip().split("/", 2)
                self.commands.append(command)
                name = command.split(":", 1)[0]
                self.assertEqual(
                    address, "01" if name == "GET_DEVICE_INFO" else ADDRESS
                )
                reply_address = "01" if address == "01" else "#000000001A2B"
                if self.large:
                    writer.write(b"x" * (protocol.MAX_FRAME + 1))
                    await writer.drain()
                    continue
                if name == "GET_DEVICE_INFO":
                    body = f"DEVICE_INFO:11:{self.serial}:00:010.000.000.025:"
                elif name == "GET_NUM_ZONES":
                    body = f"NUM_ZONES:{self.zones}:01:"
                elif name == "GET_HIGHLIGHTED_SELECTION":
                    body = f"HIGHLIGHTED_SELECTION:{self.highlight}:"
                elif name == "GET_PLAY_STATUS":
                    body = (
                        f"PLAY_STATUS:{self.mode}:0:01:07200:{self.position}:"
                        "001:07200:00000:"
                    )
                    if self.status_reject_after_play and self.mode == 2:
                        writer.write(
                            packet(reply_address, sequence, "999:Unavailable:")
                        )
                        await writer.drain()
                        continue
                elif name == "GET_PLAYING_TITLE_NAME":
                    body = f"TITLE_NAME:{field(self.title)}:"
                elif name == "GET_CONTENT_DETAILS":
                    handle = command.split(":")[1]
                    self.assertEqual(command, f"GET_CONTENT_DETAILS:{handle}::")
                    returned = "another-handle" if self.bad_details else handle
                    payload = packet(
                        reply_address,
                        sequence,
                        f"000:CONTENT_DETAILS_OVERVIEW:3:{returned}:movies:",
                    )
                    for index, key, value in (
                        (3, "Year", "2025"),
                        (1, "Content_handle", handle),
                        (2, "Title", TITLE),
                    ):
                        payload += packet(
                            reply_address,
                            sequence,
                            f"000:CONTENT_DETAILS:{index}:{key}:{field(value)}:",
                        )
                    writer.write(payload)  # Coalesced, out-of-order multipart rows.
                    await writer.drain()
                    continue
                else:
                    self.assertIn(name, {"PLAY", "PLAY_MOVIE", "STOP"})
                    if self.reject:
                        writer.write(
                            packet(
                                reply_address, sequence, f"{self.reject:03d}:Rejected:"
                            )
                        )
                        await writer.drain()
                        continue
                    if not self.ignore_launch:
                        self.mode = 0 if name == "STOP" else 2
                        self.title = "" if name == "STOP" else TITLE
                        self.position = 1
                    if self.drop:
                        return  # Write happened, acknowledgement was lost.
                    if self.hang:
                        continue
                    if self.wrong_ack:
                        sequence = str(int(sequence) % 9 + 1)
                    body = ""
                payload = packet("#FFFF", sequence, "000:")
                payload += packet(reply_address, "!", "000:TITLE_NAME:Unrelated event:")
                payload += packet(reply_address, sequence, "000:" + body)
                if self.corrupt:
                    payload = payload[:-4] + b"xx\r\n"
                for chunk in (payload[:3], payload[3:17], payload[17:]):
                    writer.write(chunk)
                    await writer.drain()
                    await asyncio.sleep(0)
        except ConnectionError, BrokenPipeError:
            pass
        finally:
            writer.close()
            await writer.wait_closed()
            self.writers.discard(writer)
            self.tasks.discard(asyncio.current_task())

    async def test_probe_is_read_only_and_understands_split_and_unrelated_frames(self):
        result = await self.player.probe()
        self.assertEqual(result["serial_number"], "1A2B")
        self.assertEqual(result["highlighted_handle"], HANDLE)
        self.assertEqual(result["state"].mode, 0)
        self.assertTrue(all(command.startswith("GET_") for command in self.commands))

    async def test_resume_and_stop_send_once_then_read_state(self):
        result = await self.player.play()
        self.assertEqual(result["outcome"], "state_observed")
        self.assertEqual(result["after"].title, TITLE)
        await self.player.stop()
        self.assertEqual(self.commands.count("PLAY:"), 1)
        self.assertEqual(self.commands.count("STOP:"), 1)

    async def test_qualified_movie_uses_exact_serial_handle_and_experimental_fields(
        self,
    ):
        result = await self.player.play(HANDLE)
        self.assertEqual(result["movie"]["Title"], TITLE)
        self.assertEqual(result["outcome"], "state_observed")
        self.assertFalse(result["exact_version_confirmed"])
        self.assertIn(f"PLAY_MOVIE:{HANDLE}:26-7.NUL;158-0=1::", self.commands)
        self.assertEqual(sum(c.startswith("PLAY_MOVIE:") for c in self.commands), 1)

    async def test_bare_handle_uses_observed_namespace_and_never_a_fallback(self):
        result = await self.player.play("0-S_AB12CD34", dry_run=True)
        self.assertEqual(result["handle"], HANDLE)
        self.assertEqual(result["outcome"], "dry_run")
        self.assertTrue(all(command.startswith("GET_") for command in self.commands))
        self.highlight = ""
        with self.assertRaisesRegex(protocol.ProtocolError, "qualified handle"):
            await self.player.play("0-S_AB12CD34")

    async def test_wrong_serial_or_nonplayer_never_receives_controls(self):
        self.serial = "FFFF"
        with self.assertRaisesRegex(protocol.ProtocolError, "serial"):
            await self.player.stop()
        self.assertEqual(self.commands, ["GET_DEVICE_INFO:"])
        self.serial, self.zones = SERIAL, "00"
        with self.assertRaisesRegex(protocol.ProtocolError, "movie zone"):
            await self.player.play()
        self.assertTrue(all(command.startswith("GET_") for command in self.commands))

    async def test_mismatched_metadata_prevents_launch(self):
        self.bad_details = True
        with self.assertRaisesRegex(protocol.ProtocolError, "requested handle"):
            await self.player.play(HANDLE)
        self.assertTrue(all(command.startswith("GET_") for command in self.commands))

    async def test_rejection_does_not_wake_or_retry(self):
        self.reject = 20
        with self.assertRaises(protocol.Rejected) as raised:
            await self.player.play()
        self.assertEqual(raised.exception.status, 20)
        self.assertEqual(self.commands.count("PLAY:"), 1)
        self.assertFalse(any("STANDBY" in command for command in self.commands))

    async def test_lost_acknowledgement_is_uncertain_and_not_replayed(self):
        self.drop = True
        with self.assertRaises(protocol.Unconfirmed):
            await self.player.play()
        self.assertEqual(self.commands.count("PLAY:"), 1)

    async def test_timeout_and_wrong_sequence_never_acknowledge_or_replay(self):
        for attribute in ("hang", "wrong_ack"):
            with self.subTest(attribute=attribute):
                self.commands.clear()
                setattr(self, attribute, True)
                self.player.timeout = 0.03
                with self.assertRaises(protocol.Unconfirmed) as raised:
                    await self.player.stop()
                self.assertNotIn("acknowledged", raised.exception.evidence)
                self.assertEqual(self.commands.count("STOP:"), 1)
                setattr(self, attribute, False)

    async def test_cancel_closes_connection_without_retry(self):
        self.hang = True
        task = asyncio.create_task(self.player.play())
        async with asyncio.timeout(1):
            while "PLAY:" not in self.commands:
                await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(self.commands.count("PLAY:"), 1)

    async def test_operations_on_one_player_are_serialized(self):
        play, stop = await asyncio.gather(self.player.play(), self.player.stop())
        self.assertEqual(play["after"].mode, 2)
        self.assertEqual(stop["before"].mode, 2)
        self.assertEqual(stop["after"].mode, 0)
        second_identity = self.commands.index("GET_DEVICE_INFO:", 1)
        self.assertLess(self.commands.index("PLAY:"), second_identity)
        self.assertLess(second_identity, self.commands.index("STOP:"))

    async def test_acknowledgement_and_existing_movie_are_not_new_launch_evidence(self):
        self.mode, self.title, self.position = 2, TITLE, 100
        self.ignore_launch = True
        with patch.object(protocol, "OBSERVATION_TIMEOUT", 0.03):
            with self.assertRaises(protocol.Unconfirmed) as raised:
                await self.player.play(HANDLE)
        self.assertTrue(raised.exception.evidence["acknowledged"])
        self.assertEqual(raised.exception.evidence["after"].position_seconds, 100)
        self.assertEqual(sum(c.startswith("PLAY_MOVIE:") for c in self.commands), 1)

    async def test_failed_observation_is_not_reported_as_launch_rejection(self):
        self.status_reject_after_play = True
        with self.assertRaises(protocol.Unconfirmed) as raised:
            await self.player.play()
        self.assertTrue(raised.exception.evidence["acknowledged"])

    async def test_invalid_or_oversized_replies_fail_before_controls(self):
        for attribute in ("corrupt", "large"):
            with self.subTest(attribute=attribute):
                setattr(self, attribute, True)
                with self.assertRaises(protocol.ProtocolError):
                    await self.player.stop()
                setattr(self, attribute, False)
        self.assertTrue(all(command.startswith("GET_") for command in self.commands))


class HarnessTest(unittest.TestCase):
    def test_operands_and_exclusive_operations(self):
        base = ["--ipaddress", "10.0.0.25", "--serial-number", SERIAL]
        self.assertIsNone(cli.arguments(base).play)
        self.assertEqual(cli.arguments([*base, "--play"]).play, "")
        self.assertEqual(cli.arguments([*base, "--play", HANDLE]).play, HANDLE)
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            cli.arguments([*base, "--play", "--stop"])

    def test_harness_runs_without_home_assistant_or_site_packages(self):
        result = subprocess.run(
            [sys.executable, "-S", str(Path(cli.__file__)), "--help"],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("--play [HANDLE]", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_uncertain_exit_code_preserves_evidence(self):
        output = io.StringIO()
        with (
            patch.object(
                cli,
                "run",
                AsyncMock(side_effect=protocol.Unconfirmed({"acknowledged": True})),
            ),
            redirect_stdout(output),
        ):
            code = cli.main(
                ["--ipaddress", "10.0.0.25", "--serial-number", SERIAL, "--play"]
            )
        self.assertEqual(code, 3)
        self.assertEqual(json.loads(output.getvalue())["outcome"], "unconfirmed")
        self.assertTrue(json.loads(output.getvalue())["acknowledged"])

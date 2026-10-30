"""Bounded, one-operation TCP sessions; no HA objects or automatic command replay.

PLAY_MOVIE is experimental. Its bookmark/options profile comes from the pinned
voice-project investigation in docs/playback-controls.md, not a vendor contract.
"""

import asyncio
import ipaddress
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass

PORT = 10000
MAX_FRAME = 4096
MAX_RESPONSE = 128 * 1024
MAX_MESSAGES = 256
MAX_DETAILS = 128
OBSERVATION_TIMEOUT = 10


class ProtocolError(Exception):
    """A safe diagnostic without raw device replies or household identifiers."""


class Rejected(ProtocolError):
    """An explicit negative response; unlike a timeout, the rejection is known."""

    def __init__(self, status: int):
        self.status = status
        super().__init__(f"Device rejected the command (status {status:03d})")


class Unconfirmed(ProtocolError):
    """A write may have arrived; do not reconnect and resend it automatically."""

    def __init__(self, evidence):
        self.evidence = evidence
        super().__init__(
            "Command may have reached the player; outcome is unconfirmed. "
            "Inspect the player before issuing another command."
        )


def serial_number(value: str) -> str:
    """Compare hexadecimal serials independent of leading zeros and case."""
    if not isinstance(value, str) or not re.fullmatch(r"[0-9A-Fa-f]{1,16}", value):
        raise ProtocolError("Serial number must contain 1–16 hexadecimal digits")
    result = value.upper().lstrip("0")
    if not result:
        raise ProtocolError("Serial number cannot be zero")
    return result


def player_address(value: str) -> str:
    """The proof of concept accepts literal LAN addresses, without DNS or scans."""
    try:
        address = ipaddress.ip_address(value)
    except ValueError as error:
        raise ProtocolError("Provide a literal private LAN IP address") from error
    networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7")
    if "%" in value or not any(
        address in ipaddress.ip_network(network)
        for network in networks
        if address.version == ipaddress.ip_network(network).version
    ):
        raise ProtocolError("Only private LAN player addresses are permitted")
    return str(address)


def content_handle(value: str) -> str:
    """Accept bounded opaque movie identifiers, never protocol/action fragments."""
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,256}", value):
        raise ProtocolError("Invalid movie handle; use its exact opaque identifier")
    return value


def _field(value: str) -> str:
    encoded = []
    for char in value:
        if char in "\\:/":
            encoded.append("\\" + char)
        elif not 32 <= ord(char) <= 126:
            if ord(char) > 255:
                raise ProtocolError("Protocol fields must fit the device character set")
            encoded.append(f"\\d{ord(char):03d}")
        else:
            encoded.append(char)
    return "".join(encoded)


def _fields(value: str) -> tuple[str, ...]:
    """Decode delimiters only after recognizing escaped character sequences."""
    fields, current = [], []
    index = 0
    escapes = {"r": "\r", "n": "\n", "t": "\t", "\\": "\\", ":": ":", "/": "/"}
    while index < len(value):
        char = value[index]
        index += 1
        if char == "\\":
            if index == len(value):
                raise ProtocolError("Incomplete protocol escape")
            char = value[index]
            index += 1
            if char == "d":
                number = value[index : index + 3]
                if not re.fullmatch(r"[0-9]{3}", number) or int(number) > 255:
                    raise ProtocolError("Invalid decimal protocol escape")
                current.append(chr(int(number)))
                index += 3
            elif char in escapes:
                current.append(escapes[char])
            else:
                raise ProtocolError("Unknown protocol escape")
        elif char == ":":
            fields.append("".join(current))
            current = []
        elif char == "/" or ord(char) < 32 or ord(char) == 127:
            raise ProtocolError("Invalid character in protocol field")
        else:
            current.append(char)
    if current or (value and not value.endswith(":")):
        raise ProtocolError("Unterminated protocol field")
    return tuple(fields)


@dataclass(frozen=True)
class Response:
    address: str
    sequence: str
    status: int
    name: str
    fields: tuple[str, ...]


def parse_response(frame: bytes) -> Response:
    """Validate an ASCII/Latin-1 frame and checksum before using any values."""
    if len(frame) > MAX_FRAME:
        raise ProtocolError("Protocol frame exceeds the size limit")
    prefix, separator, checksum = frame.rpartition(b"/")
    if (
        not separator
        or not re.fullmatch(rb"[0-9]{2}", checksum)
        or sum(prefix + b"/") % 100 != int(checksum)
    ):
        raise ProtocolError("Invalid protocol checksum")
    match = re.fullmatch(
        rb"(?P<address>(?:[0-9]{2}|#[0-9A-Fa-f]{1,16})(?:\.[0-9]{2})?)/"
        rb"(?P<sequence>[0-9!])/(?P<status>[0-9]{3}):(?P<body>.*)",
        prefix,
    )
    if not match:
        raise ProtocolError("Malformed protocol response")
    address = match["address"].decode("ascii")
    if address.startswith("#"):
        serial, dot, zone = address[1:].partition(".")
        address = "#" + serial_number(serial) + (dot + zone if dot else "")
    values = _fields(match["body"].decode("latin-1"))
    return Response(
        address,
        match["sequence"].decode("ascii"),
        int(match["status"]),
        values[0] if values else "",
        values[1:],
    )


class _Channel:
    """One serialized session; partial/coalesced reads never alter message meaning."""

    def __init__(self, reader, writer, address: str, timeout: float):
        self.reader, self.writer = reader, writer
        self.address, self.timeout = address, timeout
        self.buffer = bytearray()
        self.sequence = 0
        self.received = 0

    async def _frame(self) -> bytes:
        while True:
            delimiter = re.search(rb"[\r\n]", self.buffer)
            if delimiter:
                frame = bytes(self.buffer[: delimiter.start()])
                del self.buffer[: delimiter.end()]
                if len(frame) > MAX_FRAME:
                    raise ProtocolError("Protocol frame exceeds the size limit")
                if frame:
                    return frame
            elif len(self.buffer) > MAX_FRAME:
                raise ProtocolError(
                    "Unterminated protocol frame exceeds the size limit"
                )
            else:
                chunk = await self.reader.read(1024)
                if not chunk:
                    raise ProtocolError("Player closed the protocol connection")
                self.received += len(chunk)
                if self.received > MAX_RESPONSE:
                    raise ProtocolError("Protocol response exceeds the size limit")
                self.buffer.extend(chunk)

    async def request(self, command, fields=(), *, name="", local=False, details=False):
        self.sequence = self.sequence % 9 + 1
        sequence = str(self.sequence)
        address = "01" if local else self.address
        body = command + ":" + "".join(_field(value) + ":" for value in fields)
        wire = f"{address}/{sequence}/{body}".encode("ascii")
        if len(wire) > 1024:
            raise ProtocolError("Command exceeds the protocol size limit")
        self.received = len(self.buffer)
        async with asyncio.timeout(self.timeout):
            self.writer.write(wire + b"\r\n")
            await self.writer.drain()
            total, rows, overview = 0, {}, None
            for _ in range(MAX_MESSAGES):
                frame = await self._frame()
                total += len(frame)
                if total > MAX_RESPONSE:
                    raise ProtocolError("Protocol response exceeds the size limit")
                response = parse_response(frame)
                if response.address != address or response.sequence != sequence:
                    # Events/unrelated replies cannot acknowledge a request.
                    continue
                if response.status:
                    raise Rejected(response.status)
                if not details:
                    if response.name != name:
                        raise ProtocolError("Unexpected response to protocol command")
                    return response.fields
                if response.name == "CONTENT_DETAILS_OVERVIEW" and overview is None:
                    if (
                        len(response.fields) != 3
                        or not response.fields[0].isascii()
                        or not response.fields[0].isdigit()
                        or not 1 <= int(response.fields[0]) <= MAX_DETAILS
                        or response.fields[1] != fields[0]
                        or response.fields[2] != "movies"
                    ):
                        raise ProtocolError(
                            "Movie details did not identify the requested handle"
                        )
                    overview = int(response.fields[0])
                elif response.name == "CONTENT_DETAILS" and overview is not None:
                    if len(response.fields) != 3 or not re.fullmatch(
                        r"[0-9]{1,3}", response.fields[0]
                    ):
                        raise ProtocolError("Malformed content detail")
                    index = int(response.fields[0])
                    if not 1 <= index <= overview or index in rows:
                        raise ProtocolError("Duplicate or invalid content detail line")
                    rows[index] = response.fields[1:]
                    if len(rows) == overview:
                        result = dict(rows[index] for index in sorted(rows))
                        if len(result) != overview or not result.get("Title"):
                            raise ProtocolError(
                                "Incomplete or duplicate movie detail keys"
                            )
                        if result.get("Content_handle", fields[0]) != fields[0]:
                            raise ProtocolError(
                                "Movie details returned another content handle"
                            )
                        return result
                else:
                    raise ProtocolError("Unexpected multipart content response")
        raise ProtocolError("Too many unrelated protocol messages")


@dataclass(frozen=True)
class PlaybackState:
    title: str
    mode: int
    duration_seconds: int
    position_seconds: int


class Player:
    """Direct-player proof of concept with explicit, non-retried operations only."""

    def __init__(self, ipaddress: str, serial: str, *, timeout: float = 5):
        self.ipaddress = player_address(ipaddress)
        self.serial = serial_number(serial)
        if not 0 < timeout <= 15:
            raise ProtocolError("Timeout must be between zero and 15 seconds")
        self.timeout = timeout
        self.lock = asyncio.Lock()

    @asynccontextmanager
    async def _session(self):
        async with self.lock:
            writer = None
            try:
                async with asyncio.timeout(self.timeout):
                    reader, writer = await asyncio.open_connection(self.ipaddress, PORT)
                yield _Channel(reader, writer, "#" + self.serial, self.timeout)
            except TimeoutError as error:
                raise ProtocolError("Player protocol operation timed out") from error
            except OSError as error:
                raise ProtocolError("Player protocol connection failed") from error
            finally:
                if writer:
                    writer.close()
                    try:
                        async with asyncio.timeout(1):
                            await writer.wait_closed()
                    except OSError, TimeoutError:
                        pass

    async def _identity(self, channel):
        values = await channel.request(
            "GET_DEVICE_INFO", name="DEVICE_INFO", local=True
        )
        if len(values) != 4 or serial_number(values[1]) != self.serial:
            raise ProtocolError(
                "The supplied serial does not match the directly connected player"
            )
        zones = await channel.request("GET_NUM_ZONES", name="NUM_ZONES")
        if (
            len(zones) != 2
            or not re.fullmatch(r"[0-9]{1,2}", zones[0])
            or int(zones[0]) < 1
        ):
            raise ProtocolError("The target does not report a movie zone")
        return {"serial_number": self.serial, "ipaddress": self.ipaddress}

    async def _state(self, channel) -> PlaybackState:
        values = await channel.request("GET_PLAY_STATUS", name="PLAY_STATUS")
        title = await channel.request("GET_PLAYING_TITLE_NAME", name="TITLE_NAME")
        if (
            len(values) != 8
            or len(title) != 1
            or any(not re.fullmatch(r"[0-9]{1,8}", values[i]) for i in (0, 3, 4))
        ):
            raise ProtocolError("Malformed player status")
        return PlaybackState(title[0], int(values[0]), int(values[3]), int(values[4]))

    async def probe(self):
        """Read identity, current state and a candidate handle without device writes."""
        async with self._session() as channel:
            identity = await self._identity(channel)
            identity["state"] = await self._state(channel)
            highlighted = await channel.request(
                "GET_HIGHLIGHTED_SELECTION", name="HIGHLIGHTED_SELECTION"
            )
            if len(highlighted) != 1:
                raise ProtocolError("Malformed highlighted selection")
            identity["highlighted_handle"] = highlighted[0]
            return identity

    async def _launch_handle(self, channel, handle):
        handle = content_handle(handle)
        if "." not in handle:
            highlighted = await channel.request(
                "GET_HIGHLIGHTED_SELECTION", name="HIGHLIGHTED_SELECTION"
            )
            if len(highlighted) != 1 or "." not in highlighted[0]:
                raise ProtocolError(
                    "Supply a qualified handle, or highlight a movie on the player"
                )
            namespace = content_handle(highlighted[0]).split(".", 1)[0]
            handle = namespace + "." + handle
        namespace, _, suffix = handle.partition(".")
        if not namespace or not suffix:
            raise ProtocolError("Movie handle has no usable namespace")
        metadata = await channel.request(
            "GET_CONTENT_DETAILS", (handle, ""), details=True
        )
        return handle, namespace, metadata

    async def play(self, handle: str | None = None, *, dry_run: bool = False):
        """PLAY current selection, or experimental PLAY_MOVIE of a validated handle."""
        if handle is not None:
            content_handle(handle)
        return await self._operate("play", handle, dry_run)

    async def stop(self, *, dry_run: bool = False):
        """Send STOP once; a screen saver can consume it, so inspect the result."""
        return await self._operate("stop", None, dry_run)

    async def _operate(self, operation, handle, dry_run):
        async with self._session() as channel:
            result = await self._identity(channel)
            before = await self._state(channel)
            command, fields, expected_title = operation.upper(), (), None
            if handle is not None:
                handle, namespace, metadata = await self._launch_handle(channel, handle)
                command = "PLAY_MOVIE"
                fields = (handle, f"{namespace}.NUL;158-0=1", "")
                expected_title = metadata["Title"]
                result.update(
                    handle=handle,
                    movie=metadata,
                    bookmark=f"{namespace}.NUL",
                    play_options="158-0=1",
                )
            result.update(command=command, before=before, exact_version_confirmed=False)
            if dry_run:
                return {**result, "outcome": "dry_run"}
            # Explicit CLI operations authorize interruption. There is no automatic
            # wake, retry, fallback handle, STOP-then-PLAY sequence or journal write.
            try:
                await channel.request(command, fields)
            except Rejected:
                raise
            except (ProtocolError, TimeoutError, OSError) as error:
                raise Unconfirmed(result) from error
            result["acknowledged"] = True
            try:
                async with asyncio.timeout(OBSERVATION_TIMEOUT):
                    while True:
                        after = await self._state(channel)
                        result["after"] = after
                        desired = after.mode == (0 if operation == "stop" else 2)
                        if expected_title is not None:
                            desired = (
                                desired
                                and after.title == expected_title
                                and (
                                    before.title != after.title
                                    or before.mode != after.mode
                                    or after.position_seconds + 2
                                    < before.position_seconds
                                )
                            )
                        if desired:
                            return {**result, "outcome": "state_observed"}
                        await asyncio.sleep(0.5)
            except (ProtocolError, TimeoutError, OSError) as error:
                raise Unconfirmed(result) from error

"""Rev 17 printable commands, printable/binary responses and incremental framing."""

import ipaddress
import re
from dataclasses import dataclass

from .errors import ProtocolError

MAX_FRAME = 4096
MAX_COMMAND = 1024


def serial_number(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9A-Fa-f]{1,16}", value):
        raise ProtocolError("Serial number must contain 1-16 hexadecimal digits")
    value = value.upper().lstrip("0")
    if not value:
        raise ProtocolError("Serial number cannot be zero")
    return value


def device_address(value: str) -> str:
    """Pin literal LAN destinations; never follow a device-reported host implicitly."""
    if not isinstance(value, str):
        raise ProtocolError("Provide a literal private LAN IP address")
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
        raise ProtocolError("Only private LAN component addresses are permitted")
    return str(address)


@dataclass(frozen=True)
class Address:
    """A CPDID or serial with an optional explicit Premiere music zone."""

    device: str = "01"
    zone: int | None = None

    def __post_init__(self):
        if not isinstance(self.device, str):
            raise ProtocolError("Invalid control protocol device address")
        if self.device.startswith("#"):
            object.__setattr__(self, "device", "#" + serial_number(self.device[1:]))
        elif not re.fullmatch(r"(?:0[1-9]|[1-9][0-9]|\?\?)", self.device):
            raise ProtocolError("Invalid control protocol device address")
        if self.zone is not None and (
            type(self.zone) is not int or not 1 <= self.zone <= 99
        ):
            raise ProtocolError("Music zone must be between 1 and 99")

    @classmethod
    def parse(cls, value: str):
        if not isinstance(value, str):
            raise ProtocolError("Invalid control protocol device address")
        match = re.fullmatch(
            r"(#[0-9A-Fa-f]{1,16}|[0-9]{2}|\?\?)(?:\.([0-9]{2}))?", value
        )
        if not match:
            raise ProtocolError("Invalid control protocol device address")
        return cls(match[1], int(match[2]) if match[2] else None)

    @classmethod
    def serial(cls, value: str, zone: int | None = None):
        return cls("#" + serial_number(value), zone)

    def __str__(self):
        return self.device + (f".{self.zone:02d}" if self.zone is not None else "")


def encode_field(value: str) -> str:
    if not isinstance(value, str):
        raise ProtocolError("Protocol fields must be strings")
    result = []
    for char in value:
        if char in "\\:/":
            result.append("\\" + char)
        elif not 32 <= ord(char) <= 126:
            if ord(char) > 255:
                raise ProtocolError("Protocol fields must fit the device character set")
            result.append(f"\\d{ord(char):03d}")
        else:
            result.append(char)
    return "".join(result)


def decode_fields(value: str) -> tuple[str, ...]:
    result, current, index = [], [], 0
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
            result.append("".join(current))
            current = []
        elif char == "/" or ord(char) < 32 or ord(char) == 127:
            raise ProtocolError("Invalid character in protocol field")
        else:
            current.append(char)
    if current or (value and not value.endswith(":")):
        raise ProtocolError("Unterminated protocol field")
    return tuple(result)


def encode_command(
    address: Address, sequence: int, name: str, fields=(), *, checksum=False
) -> bytes:
    if address.device == "??" or type(sequence) is not int or not 0 <= sequence <= 9:
        raise ProtocolError("Invalid command address or sequence")
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        raise ProtocolError("Invalid command name")
    wire = f"{address}/{sequence}/{name}:" + "".join(
        encode_field(value) + ":" for value in fields
    )
    body = wire.encode("ascii")
    if checksum:
        body += b"/"
        body += f"{sum(body) % 100:02d}".encode("ascii")
    if len(body) > MAX_COMMAND:
        raise ProtocolError("Command exceeds the protocol size limit")
    return body + b"\r\n"


@dataclass(frozen=True)
class Response:
    address: Address
    sequence: str
    status: int
    name: str
    fields: tuple[str, ...]

    @property
    def is_event(self):
        return self.sequence == "!"


def parse_response(frame: bytes) -> Response:
    if not frame or len(frame) > MAX_FRAME:
        raise ProtocolError("Empty or oversized protocol frame")
    binary = b"\x01" in frame.split(b"/", 1)[0]
    if binary:
        parts = frame.split(b"\x01")
        if len(parts) != 3:
            raise ProtocolError("Malformed binary response")
        address, sequence, body = parts
        values = body.decode("latin-1").split("\x02")
        if values.pop() != "":
            raise ProtocolError("Unterminated binary field")
        if not values or not re.fullmatch(r"[0-9]{3}", values[0]):
            raise ProtocolError("Invalid response status")
        status, values = int(values[0]), values[1:]
    else:
        prefix, slash, checksum = frame.rpartition(b"/")
        if (
            not slash
            or not re.fullmatch(rb"[0-9]{2}", checksum)
            or sum(prefix + b"/") % 100 != int(checksum)
        ):
            raise ProtocolError("Invalid protocol checksum")
        parts = prefix.split(b"/", 2)
        if len(parts) != 3:
            raise ProtocolError("Malformed protocol response")
        address, sequence, body = parts
        if not re.match(rb"[0-9]{3}:", body):
            raise ProtocolError("Invalid response status")
        status, values = int(body[:3]), list(decode_fields(body[4:].decode("latin-1")))
    if not re.fullmatch(rb"[0-9!?]", sequence):
        raise ProtocolError("Invalid response sequence")
    try:
        target = Address.parse(address.decode("ascii"))
    except UnicodeError as error:
        raise ProtocolError("Invalid response address") from error
    return Response(
        target,
        sequence.decode("ascii"),
        status,
        values[0] if values else "",
        tuple(values[1:]),
    )


class FrameDecoder:
    """Auto-detect response delimiters, including the protocol-setting transition.

    Binary bodies may contain literal CR/LF. The header's first segment delimiter
    determines framing; do not split binary text using printable line endings.
    """

    def __init__(self):
        self.buffer = bytearray()

    def feed(self, chunk: bytes) -> list[bytes]:
        self.buffer.extend(chunk)
        result = []
        while self.buffer:
            if self.buffer[0] in (10, 13, 4):
                del self.buffer[0]
                continue
            header = re.search(rb"[/\x01\r\n\x04]", self.buffer)
            delimiter = None
            if header:
                binary = self.buffer[header.start()] == 1
                delimiter = re.search(rb"\x04" if binary else rb"[\r\n]", self.buffer)
            if delimiter:
                frame = bytes(self.buffer[: delimiter.start()])
                del self.buffer[: delimiter.end()]
                if len(frame) > MAX_FRAME:
                    raise ProtocolError("Protocol frame exceeds the size limit")
                result.append(frame)
            elif len(self.buffer) > MAX_FRAME:
                raise ProtocolError(
                    "Unterminated protocol frame exceeds the size limit"
                )
            else:
                break
        return result

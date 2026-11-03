"""Public transport errors; device-supplied text never becomes an error message."""

from enum import IntEnum


class Status(IntEnum):
    SUCCESS = 0
    MESSAGE_TOO_LONG = 1
    INVALID_CHARACTER = 2
    CHECKSUM_ERROR = 3
    INVALID_DEVICE = 4
    DEVICE_UNAVAILABLE = 5
    INVALID_ZONE_SYNTAX = 6
    INVALID_ZONE = 7
    INVALID_REQUEST = 10
    INVALID_PARAMETER_COUNT = 11
    INVALID_PARAMETER = 12
    DEVICE_CONFLICT = 13
    INVALID_SEQUENCE = 14
    INVALID_PASSCODE = 16
    INVALID_CONTENT_HANDLE = 17
    NETWORK_ERROR = 18
    INVALID_SERIAL_SYNTAX = 19
    STANDBY = 20
    OTHER_ERROR = 999


class ProtocolError(Exception):
    """Base error for validation, wire, lifecycle and device rejection failures."""


class Rejected(ProtocolError):
    def __init__(self, status: int, command: str = "command"):
        self.status, self.command = status, command
        super().__init__(f"Device rejected {command} (status {status:03d})")


class ConnectionClosed(ProtocolError):
    """The caller must explicitly connect again; no command is replayed."""


class RequestTimeout(ProtocolError):
    """A read or a queued operation timed out, without an uncertain device write."""


class CommandUncertain(ProtocolError):
    """A mutating command may have arrived but its full reply was not received."""


class EventOverflow(ProtocolError):
    """An event consumer fell behind and must explicitly resynchronize."""

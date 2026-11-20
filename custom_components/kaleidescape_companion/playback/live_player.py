"""Live discovery, playback state and movie launch for Kaleidescape players."""

from __future__ import annotations

import asyncio
import re
from contextlib import suppress
from dataclasses import dataclass, replace
from importlib.util import find_spec
from typing import override

# An embedding package can select its pyk build through a sibling _pyk module.
if __package__ and find_spec(f"{__package__}._pyk") is not None:
    from ._pyk import Device, KaleidescapeError, const, error, message
else:
    from kaleidescape import Device, KaleidescapeError, const, error, message

# Released pyk 1.2.0 uses the common error for both outcomes.
RequestNotSentError = getattr(error, "RequestNotSentError", KaleidescapeError)
RequestOutcomeUnknownError = getattr(
    error, "RequestOutcomeUnknownError", KaleidescapeError
)


@dataclass(frozen=True)
class DeviceIdentity:
    """Identity and movie capability, with a display name when discovered."""

    serial_number: str
    model: str
    ip_address: str
    movie_zones: int
    friendly_name: str = ""


@dataclass(frozen=True)
class PlaybackState:
    """Identity, power, readiness and playback observed on one connection."""

    identity: DeviceIdentity
    power: str
    readiness: str
    playing_title: str
    play_status: str | None
    zone_available: bool
    duration_seconds: int
    position_seconds: int


@dataclass(frozen=True)
class PreparedMovieLaunch:
    """The addressed player and movie it identified during a read-only preparation."""

    serial_number: str
    handle: str
    title: str
    year: str


class PlayMovie(message.Request):
    """Experimental movie launch with a namespace-scoped bookmark."""

    name = "PLAY_MOVIE"


def wire_serial(value: str) -> str:
    """Normalize a full device-info or discovery serial to a 12-digit route."""
    significant = value.removeprefix("#").lstrip("0") if isinstance(value, str) else ""
    if not re.fullmatch(r"[0-9a-fA-F]{1,12}", significant):
        raise ValueError("Invalid device serial")
    return significant.upper().zfill(12)


def _request(
    command: type[message.Request], serial: str | None, fields: list[str] | None = None
) -> message.Request:
    """Use pyk's local address by default or route the request to the given serial."""
    if serial is None:
        return command(fields=fields)
    target = "#" + wire_serial(serial)
    try:
        return command(device_id=target, fields=fields)
    except TypeError as exc:
        raise KaleidescapeError(
            "Serial routing requires pyk's device_id support"
        ) from exc


class LivePlayer(Device):
    """A pyk Device with fresh observations, routed discovery and movie launch."""

    @override
    def __init__(self, host: str, **kwargs) -> None:
        """Accept Device's connection options and expire verified data on disconnect."""
        super().__init__(host, **kwargs)
        self._session = object()
        self._prepared: PreparedMovieLaunch | None = None
        self.dispatcher.connect(self._connection_event)

    def _connection_event(self, event: str, *_args) -> None:
        """Expire observations and pending launches when pyk disconnects."""
        if event == const.STATE_DISCONNECTED:
            self._session = object()
            self._prepared = None

    def _check_session(self, session: object) -> None:
        """Discard a multi-request observation if the player reconnected mid-read."""
        if session is not self._session:
            raise KaleidescapeError("Connection changed during player read")

    @override
    async def _handle_event(self, response: message.Response) -> None:
        """Ignore late events so a power refresh cannot reopen a disconnected player."""
        if self.is_connected:
            await super()._handle_event(response)

    async def _query[Reply: message.Response](
        self,
        command: type[message.Request],
        reply: type[Reply],
        serial: str | None = None,
    ) -> Reply:
        """Read a typed value from the connected player or an addressed peer."""
        rows = await _request(command, serial).send(self.connection)
        if not isinstance(rows[0], reply):
            raise KaleidescapeError(f"Expected a {reply.name} response")
        return rows[0]

    async def read_identity(self, serial: str | None = None) -> DeviceIdentity:
        """Read the device's full serial, model, address and movie zone count."""
        session = self._session
        info = await self._query(message.GetDeviceInfo, message.DeviceInfo, serial)
        zones = await self._query(message.GetNumZones, message.NumZones, serial)
        model = await self._query(
            message.GetDeviceTypeName, message.DeviceTypeName, serial
        )
        self._check_session(session)
        try:
            actual = wire_serial(info.fields[1])
            if serial is not None and actual != wire_serial(serial):
                raise KaleidescapeError("Addressed device identity mismatch")
            return DeviceIdentity(
                actual, model.field, info.field_ip, zones.field_movie_zones
            )
        except (IndexError, ValueError) as exc:
            raise KaleidescapeError("Invalid device identity response") from exc

    async def discover_devices(self, *, max_devices: int = 64) -> list[DeviceIdentity]:
        """Resolve each advertised device and look up player display names."""
        session = self._session
        available = await self._query(
            message.GetAvailableDevicesBySerialNumber,
            message.AvailableDevicesBySerialNumber,
        )
        # Pyk's convenience accessor truncates significant digits as well as padding.
        serials = dict.fromkeys(wire_serial(raw) for raw in available.fields)
        if len(serials) > max_devices:
            raise KaleidescapeError("Discovery exceeds configured device limit")
        devices = []
        for serial in serials:
            identity = await self.read_identity(serial)
            if identity.movie_zones > 0:
                request = _request(message.GetFriendlyName, serial)
                request.log_invalid_request = False
                # A standby or older player can decline the optional label.
                with suppress(error.MessageError):
                    reply = (await request.send(self.connection))[0]
                    if isinstance(reply, message.FriendlyName) and reply.fields:
                        identity = replace(identity, friendly_name=reply.field.strip())
            devices.append(identity)
        self._check_session(session)
        return devices

    async def read_playback_state(self, serial: str | None = None) -> PlaybackState:
        """Read identity and power, then playback when the movie zone is ready."""
        session = self._session
        identity = await self.read_identity(serial)
        power = await self._query(
            message.GetDevicePowerState, message.DevicePowerState, serial
        )
        readiness = await self._query(
            message.GetSystemReadinessState, message.SystemReadinessState, serial
        )
        try:
            power_state = power.field_power
            ready_state = readiness.field
            # Only the first movie zone is used. Older replies omit zone power.
            zone = power.fields[1] if len(power.fields) > 1 else "1"
            available = identity.movie_zones > 0 and zone.lstrip("0") == "1"
            title, mode, duration, position = "", None, 0, 0
            if (
                power_state == const.DEVICE_POWER_STATE_ON
                and available
                and ready_state == const.SYSTEM_READINESS_STATE_READY
            ):
                play = await self._query(
                    message.GetPlayStatus, message.PlayStatus, serial
                )
                playing = await self._query(
                    message.GetPlayingTitleName, message.PlayingTitleName, serial
                )
                title = playing.field if playing.fields else ""
                mode = play.field_play_status
                duration, position = play.field_title_length, play.field_title_location
        except (IndexError, KeyError, ValueError) as exc:
            raise KaleidescapeError("Invalid playback state response") from exc
        self._check_session(session)
        return PlaybackState(
            identity,
            power_state,
            ready_state,
            title,
            mode,
            available,
            duration,
            position,
        )

    async def prepare_movie_launch(
        self, handle: str, *, serial: str | None = None
    ) -> PreparedMovieLaunch:
        """Read the addressed movie's title and year for review before launch."""
        self._prepared = None
        if not isinstance(handle, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_.-]+)?", handle
        ):
            raise ValueError("Invalid movie handle")
        session = self._session
        identity = await self.read_identity(serial)
        if identity.movie_zones < 1:
            raise KaleidescapeError("Movie launch target has no movie zone")
        serial = identity.serial_number
        if "." not in handle:
            selected = await self._query(
                message.GetHighlightedSelection, message.HighlightedSelection, serial
            )
            highlighted = selected.field if selected.fields else ""
            namespace, _, selection = highlighted.partition(".")
            if not selection or not re.fullmatch(r"[A-Za-z0-9_-]+", namespace):
                raise KaleidescapeError("A qualified movie handle is required")
            handle = f"{namespace}.{handle}"
        request = _request(message.GetContentDetails, serial, [handle, ""])
        try:
            overview, *details = await request.send(self.connection)
            if (
                not isinstance(overview, message.ContentDetailsOverview)
                or overview.field_handle != handle
                or overview.field_table.strip().casefold() != "movies"
            ):
                raise KaleidescapeError("Content details do not identify this movie")
        except (IndexError, ValueError) as exc:
            raise KaleidescapeError("Invalid movie metadata") from exc
        metadata = {}
        for row in details:
            if not isinstance(row, message.ContentDetails) or len(row.fields) < 3:
                continue
            key = row.fields[1].strip().casefold()
            value = " ".join(row.fields[2].split())
            if key not in {"title", "year"} or not value:
                continue
            if key in metadata and metadata[key].casefold() != value.casefold():
                raise KaleidescapeError(f"Conflicting movie {key}")
            metadata[key] = value
        if "title" not in metadata:
            raise KaleidescapeError("Content details have no movie title")
        self._check_session(session)
        self._prepared = PreparedMovieLaunch(
            identity.serial_number, handle, metadata["title"], metadata.get("year", "")
        )
        return self._prepared

    async def send_movie_launch(self, prepared: PreparedMovieLaunch) -> message.Ack:
        """Send the verified movie once and return the player's acknowledgement."""
        if self._prepared is None or prepared is not self._prepared:
            raise RequestNotSentError("Movie launch must be prepared again")
        self._prepared = None
        namespace = prepared.handle.split(".", 1)[0]
        return await self._send_command(
            _request(
                PlayMovie,
                prepared.serial_number,
                [prepared.handle, f"{namespace}.NUL;158-0=1", ""],
            )
        )

    @override
    async def _send(self, request, zone=0, fields=None) -> message.Response:
        """Require a protocol acknowledgement for Device's ordinary controls."""
        if request.name.startswith("GET_") or request is message.SendToSyslog:
            return await super()._send(request, zone, fields)
        return await self._send_command(request(zone, fields))

    async def _send_command(self, request: message.Request) -> message.Ack:
        """Close after an uncertain write so a late reply cannot confirm another."""
        session = self._session
        try:
            rows = await request.send(self.connection)
            if session is not self._session or not isinstance(rows[0], message.Ack):
                raise RequestOutcomeUnknownError("Expected a device acknowledgement")
            return rows[0]
        except error.MessageError:
            raise
        except KaleidescapeError, TimeoutError, asyncio.CancelledError:
            if request.seq >= 0 and session is self._session:
                await self.disconnect()
            raise

"""Decoded response models; preserve reserved/future fields without inventing data."""

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Self

from .codec import Address, Response, serial_number
from .errors import ProtocolError

if TYPE_CHECKING:
    from .session import Reply


def integer(value: str, *, signed: bool = False) -> int:
    if not re.fullmatch(r"[+-]?[0-9]{1,10}" if signed else r"[0-9]{1,10}", value):
        raise ProtocolError("Invalid numeric response field")
    return int(value)


@dataclass(frozen=True)
class DeviceInfo:
    device_type: str
    serial: str
    cpdid: str
    ipaddress: str


@dataclass(frozen=True)
class Zones:
    movie: int
    music: int


@dataclass(frozen=True)
class PlayStatus:
    mode: int
    speed: int
    title_number: int
    duration_seconds: int
    position_seconds: int
    chapter_number: int
    chapter_duration_seconds: int
    chapter_position_seconds: int


@dataclass(frozen=True)
class PlaybackState:
    title: str
    mode: int
    duration_seconds: int
    position_seconds: int


# Empty names are reserved fields. Variable-length responses keep their tail.
RESPONSE_FIELDS = {
    "DEVICE_POWER_STATE": "power_state",
    "DEVICE_TYPE_NAME": "device_name",
    "SYSTEM_READINESS_STATE": "state",
    "SYSTEM_VERSION": "control_protocol_version kos_version",
    "PROTOCOL": "version",
    "ACTIVE_PROTOCOL": "version",
    "FRIENDLY_NAME": "name",
    "FRIENDLY_SYSTEM_NAME": "name",
    "UI_STATE": "screen popup dialog saver",
    "USER_INPUT": "type prompt entry",
    "USER_INPUT_PROMPT": "type icon prompt displayed char_limit valid",
    "PARENTAL_CONTROL_LEVEL": "rating_level description",
    "HIGHLIGHTED_SELECTION": "handle",
    "TITLE_NAME": "title",
    "STATUS_CUE_PERIOD": "period",
    "MUSIC_NOW_PLAYING_STATUS": "total location repeat random "
    "generation now_playing_handle",
    "MUSIC_PLAY_STATUS": "mode speed length position progress",
    "MUSIC_TITLE": "track artist album track_handle album_handle now_playing_handle",
    "CONTROLLED_ZONE": "zone",
    "CAMERA_ANGLE": "cur_angle num_angles in_angle_block",
    "MOVIE_MEDIA_TYPE": "media_type",
    "ACTION_PERFORMED": "text",
    "MUSIC_PRESET_INFORMATION": "tag handle label",
    "PLAYING_MUSIC_INFORMATION": "handle label",
    "MOVIE_LOCATION": "location",
    "CINEMASCAPE_MASK": "frame_ratio",
    "SCREEN_MASK": "image_ratio top_trim_rel bottom_trim_rel "
    "conservative_ratio top_mask_abs bottom_mask_abs",
    "SCREEN_MASK2": "top_mask_abs bottom_mask_abs top_calibrated bottom_calibrated",
    "VIDEO_MODE": "composite component hdmi",
    "VIDEO_MODE2": "width height scan_mode refresh_rate "
    "aspect_numerator aspect_denominator",
    "VIDEO_COLOR": "eotf color_space color_depth color_sampling",
    "CONTENT_COLOR": "eotf color_space color_depth color_sampling",
    "CINEMASCAPE_MODE": "mode",
    "SCALE_MODE": "mode",
    "CHILD_MODE_STATE": "child_mode",
    "NETWORK_SETTINGS": "static ip_address subnet_mask gateway dns1 dns2",
    # Signature/examples disagree on product-line position; retain the raw suffix.
    "SYSTEM_CAPABILITIES": "movies music",
    "ZONE_CAPABILITIES": "osd movies music store search library_type osd_generation",
    "TIME": "year month day hour minute second timezone",
    "USER_DEFINED_EVENT": "message",
    "PLAYER_RESTART": "",
}


@dataclass(frozen=True)
class NamedResponse:
    name: str
    values: dict[str, str]
    extra_fields: tuple[str, ...] = ()


def decode_response(
    message: Response,
) -> DeviceInfo | Zones | PlayStatus | NamedResponse | tuple[Address, ...]:
    fields = message.fields
    if message.name == "DEVICE_INFO":
        if len(fields) != 4:
            raise ProtocolError("Malformed device information")
        return DeviceInfo(fields[0], serial_number(fields[1]), fields[2], fields[3])
    if message.name == "NUM_ZONES":
        if len(fields) != 2:
            raise ProtocolError("Malformed zone information")
        return Zones(*(integer(value) for value in fields))
    if message.name == "PLAY_STATUS":
        if len(fields) != 8:
            raise ProtocolError("Malformed playback status")
        return PlayStatus(*(integer(value) for value in fields))
    if message.name in {"AVAILABLE_DEVICES", "AVAILABLE_DEVICES_BY_SERIAL_NUMBER"}:
        if len(fields) > 64:
            raise ProtocolError("Too many discovered devices")
        return tuple(
            Address.serial(value)
            if message.name.endswith("SERIAL_NUMBER")
            else Address.parse(value)
            for value in fields
        )
    names = RESPONSE_FIELDS.get(message.name, "").split()
    if len(fields) < len(names):
        raise ProtocolError("Missing named response fields")
    # Pair only known slots; preserve the remaining values for future protocol fields.
    known = dict(zip(names, fields[: len(names)], strict=True))
    return NamedResponse(message.name, known, fields[len(names) :])


@dataclass(frozen=True)
class ContentDetails:
    handle: str
    table: str
    values: dict[str, str]

    @classmethod
    def from_reply(cls, reply: "Reply") -> Self:
        if not reply.messages:
            raise ProtocolError("Missing content overview")
        overview = reply.messages[0].fields
        if len(overview) != 3:
            raise ProtocolError("Malformed content overview")
        values: dict[str, str] = {}
        rows = reply.messages[1:]
        if any(len(message.fields) != 3 for message in rows):
            raise ProtocolError("Malformed content detail")
        for message in sorted(rows, key=lambda row: integer(row.fields[0])):
            if message.fields[1] in values:
                raise ProtocolError("Duplicate or malformed content detail")
            values[message.fields[1]] = message.fields[2]
        if values.get("Content_handle", overview[1]) != overview[1]:
            raise ProtocolError("Content details returned another handle")
        return cls(overview[1], overview[2], values)


@dataclass(frozen=True)
class BrowseAction:
    label: str
    behavior: str
    handle: str
    pop: str


@dataclass(frozen=True)
class BrowseRow:
    relative_line: int
    absolute_line: int
    text: str
    play_status: str
    actions: tuple[BrowseAction, ...]


@dataclass(frozen=True)
class BrowsePage:
    handle: str
    title: str
    total_lines: int
    first_line_index: int | None
    playing_line_index: int | None
    rows: tuple[BrowseRow, ...]

    @classmethod
    def from_reply(cls, reply: "Reply") -> Self:
        if not reply.messages:
            raise ProtocolError("Missing browse overview")
        overview = reply.fields
        if len(overview) not in (4, 6):
            raise ProtocolError("Malformed browse overview")
        rows = []
        for message in reply.messages[1:]:
            fields = message.fields
            if len(fields) < 8 or len(fields) > 24 or (len(fields) - 4) % 4:
                raise ProtocolError("Malformed browse row actions")
            rows.append(
                BrowseRow(
                    integer(fields[0]),
                    integer(fields[1]),
                    fields[2],
                    fields[3],
                    tuple(
                        BrowseAction(*fields[i : i + 4])
                        for i in range(4, len(fields), 4)
                    ),
                )
            )
        return cls(
            overview[0],
            overview[1],
            integer(overview[3]),
            integer(overview[4]) if len(overview) == 6 else None,
            integer(overview[5]) if len(overview) == 6 else None,
            tuple(sorted(rows, key=lambda row: row.relative_line)),
        )


@dataclass(frozen=True)
class DiscoveredDevice:
    address: Address
    info: DeviceInfo
    zones: Zones
    model: str
    name: str

    @property
    def is_player(self) -> bool:
        return self.zones.movie > 0

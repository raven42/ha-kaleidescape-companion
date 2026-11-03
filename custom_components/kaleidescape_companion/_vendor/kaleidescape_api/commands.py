"""Executable request catalog for the Rev 17 manual (June 2026).

Names, field signatures and printed page references are protocol facts. Keep
experimental messages outside this catalog. Historical revision-history aliases
and unsolicited events are not requests. Device/model support is decided by the
device; catalog presence is not a claim that every model supports an operation.
"""

import ipaddress
import re
from dataclasses import dataclass
from types import MappingProxyType

from ._command import Command as Command
from .codec import Address
from .errors import ProtocolError


@dataclass(frozen=True)
class Parameter:
    name: str
    kind: str = "text"
    minimum: int = 0
    maximum: int = 1024
    choices: tuple[str, ...] = ()
    blank: bool = False
    width: int = 0

    def encode(self, value) -> str:
        if value == "" and self.blank:
            return ""
        if self.kind == "integer":
            if type(value) is int:
                number = value
            elif isinstance(value, str) and re.fullmatch(r"[0-9]{1,10}", value):
                number = int(value)
            else:
                raise ProtocolError(f"{self.name} must be an integer")
            if not self.minimum <= number <= self.maximum:
                raise ProtocolError(f"{self.name} is outside its allowed range")
            return f"{number:0{self.width}d}" if self.width else str(number)
        if not isinstance(value, str) or len(value) > self.maximum:
            raise ProtocolError(f"Invalid {self.name}")
        if self.choices and value not in self.choices:
            raise ProtocolError(f"Unsupported {self.name}")
        if self.kind == "address":
            address = Address.parse(value)
            if address.device == "??":
                raise ProtocolError("Unknown device cannot be a command target")
            return str(address)
        if self.kind == "character" and (len(value) != 1 or ord(value) < 32):
            raise ProtocolError(f"{self.name} must be one printable character")
        if self.kind == "ipv4":
            try:
                ipaddress.IPv4Address(value)
            except ValueError as error:
                raise ProtocolError(f"Invalid {self.name}") from error
        if self.kind == "window":
            match = re.fullmatch(r"([0-9]{1,9})-([0-9]{1,9})", value)
            if (
                not match
                or not 1 <= int(match[1]) <= int(match[2])
                or int(match[2]) - int(match[1]) >= 100
            ):
                raise ProtocolError("Browse window must contain 1-100 ascending lines")
        return value


@dataclass(frozen=True)
class CommandSpec:
    name: str
    parameters: tuple[Parameter, ...] = ()
    response: str = ""
    page: int = 0
    family: str = ""
    read_only: bool = False
    multipart: str = ""
    local_only: bool = False

    def fields(self, values) -> tuple[str, ...]:
        if len(values) != len(self.parameters):
            raise ProtocolError(f"{self.name} requires {len(self.parameters)} fields")
        return tuple(
            parameter.encode(value)
            for parameter, value in zip(self.parameters, values, strict=True)
        )


_commands: dict[str, CommandSpec] = {}


def _add(names, page, family, parameters=(), response="", *, multipart="", local=False):
    for name in names.split():
        if name in _commands:
            raise RuntimeError(f"Duplicate protocol command: {name}")
        _commands[name] = CommandSpec(
            name,
            tuple(parameters),
            response,
            page,
            family,
            name.startswith("GET_") or name == "BROWSE",
            multipart,
            local,
        )


# Fieldless commands grouped by their documented command families.
_add("ENTER_STANDBY", 45, "power")
_add("LEAVE_STANDBY", 46, "power")
_add("LEAVE_IDLE_MODE", 48, "power")
for _direction in ("UP", "DOWN", "LEFT", "RIGHT"):
    _add(
        f"{_direction} {_direction}_PRESS {_direction}_RELEASE "
        f"CHILD_{_direction} CHILD_{_direction}_PRESS CHILD_{_direction}_RELEASE",
        65,
        "navigation",
    )
for _page in ("UP", "DOWN"):
    _add(f"PAGE_{_page} PAGE_{_page}_PRESS PAGE_{_page}_RELEASE", 66, "navigation")
_add("SELECT", 67, "navigation")
_add("BACK CANCEL", 68, "navigation")
_add("CHILD_SELECT KALEIDESCAPE_MENU_ON", 70, "navigation")
_add("KALEIDESCAPE_MENU_OFF KALEIDESCAPE_MENU_TOGGLE", 71, "navigation")
for _name, _number in (
    ("GO_MOVIES", 74),
    ("GO_MOVIE_LIST", 75),
    ("GO_MOVIE_COVERS", 76),
    ("GO_MOVIE_COLLECTIONS", 77),
    ("GO_MUSIC", 78),
    ("GO_MUSIC_LIST GO_MUSIC_COVERS", 79),
    ("GO_MUSIC_COLLECTIONS", 80),
    ("GO_NOW_PLAYING GO_MOVIE_STORE", 81),
    ("GO_SYSTEM_STATUS GO_PARENTAL_CONTROL", 82),
    ("GO_VAULT_SUMMARY", 83),
    ("BACKSPACE", 87),
    ("FILTER_LIST", 88),
    ("GO_SEARCH", 89),
    ("SHUFFLE_COVER_ART", 90),
    ("CHILD_SHUFFLE_COVER_ART ALPHABETIZE_COVER_ART", 91),
    ("DEFAULT_LEVEL SAFE_LEVEL", 92),
    ("DETAILS DISC_IN_TRAY_TOGGLE", 95),
    ("GO_SCREEN_SAVER", 101),
    ("STOP_SCREEN_SAVER", 102),
):
    _add(_name, _number, "views")
for _name, _number in (
    ("PLAY", 105),
    ("PAUSE PAUSE_ON PAUSE_OFF PLAY_OR_PAUSE", 107),
    ("STOP", 108),
    ("NEXT PREVIOUS", 109),
    ("SCAN_FORWARD SCAN_REVERSE REPLAY", 110),
    ("CHILD_PLAY CHILD_PAUSE CHILD_PAUSE_ON CHILD_PAUSE_OFF CHILD_STOP", 111),
    ("MUSIC_RANDOM_ON MUSIC_RANDOM_OFF", 118),
    ("MUSIC_RANDOM_TOGGLE MUSIC_REPEAT_ON", 119),
    ("MUSIC_REPEAT_OFF MUSIC_REPEAT_TOGGLE", 120),
    ("DISC_MENU", 122),
    ("DISC_TOP_MENU", 123),
    ("DISC_RESUME START_CHAPTER_ENTRY", 124),
    ("START_DISC_TITLE_ENTRY", 125),
    ("SHOW_NAVIGATION_OVERLAY", 126),
    ("STATUS_AND_SETTINGS", 127),
    ("INTERMISSION_ON INTERMISSION_OFF", 128),
    ("INTERMISSION_TOGGLE SET_FAVORITE_SCENE_START", 129),
    ("SET_FAVORITE_SCENE_END", 130),
    ("START_SEND_NUMBER_TO_DISC_ENTRY", 131),
    ("ANGLE_NEXT ANGLE_PREVIOUS AUDIO_NEXT", 132),
    ("SUBTITLES_NEXT", 133),
    ("BLURAY_SPECIAL_STOP", 135),
    ("BLURAY_POPUP_MENU_TOGGLE", 136),
    ("STOP_OR_CANCEL", 137),
    ("DISC_OR_KALEIDESCAPE_MENU", 138),
    ("GO_CALIBRATE_MASKING", 173),
    ("GO_CALIBRATE_MASKING_OVERSCAN", 174),
    ("ENTER_CHILD_MODE", 193),
    ("LEAVE_CHILD_MODE", 194),
):
    _add(_name, _number, "playback")
for _color in ("RED", "GREEN", "BLUE", "YELLOW"):
    _add(f"{_color} {_color}_PRESS {_color}_RELEASE", 134, "disc")
for _page in ("UP", "DOWN"):
    for _track in ("NEXT", "PREVIOUS"):
        _base = f"PAGE_{_page}_OR_{_track}"
        _add(f"{_base} {_base}_PRESS {_base}_RELEASE", 139, "navigation")

# Queries retain their named response; unknown future fields remain available.
for _name, _response, _number in (
    ("GET_DEVICE_POWER_STATE", "DEVICE_POWER_STATE", 43),
    ("GET_SYSTEM_READINESS_STATE", "SYSTEM_READINESS_STATE", 47),
    ("GET_AVAILABLE_DEVICES", "AVAILABLE_DEVICES", 49),
    (
        "GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER",
        "AVAILABLE_DEVICES_BY_SERIAL_NUMBER",
        50,
    ),
    ("GET_DEVICE_TYPE_NAME", "DEVICE_TYPE_NAME", 50),
    ("GET_NUM_ZONES", "NUM_ZONES", 51),
    ("GET_SYSTEM_VERSION", "SYSTEM_VERSION", 51),
    ("GET_PROTOCOL", "PROTOCOL", 52),
    ("GET_ACTIVE_PROTOCOL", "ACTIVE_PROTOCOL", 55),
    ("GET_DEVICE_INFO", "DEVICE_INFO", 58),
    ("GET_FRIENDLY_NAME", "FRIENDLY_NAME", 59),
    ("GET_FRIENDLY_SYSTEM_NAME", "FRIENDLY_SYSTEM_NAME", 61),
    ("GET_UI_STATE", "UI_STATE", 72),
    ("GET_USER_INPUT", "USER_INPUT", 83),
    ("GET_USER_INPUT_PROMPT", "USER_INPUT_PROMPT", 87),
    ("GET_PARENTAL_CONTROL_LEVEL", "PARENTAL_CONTROL_LEVEL", 92),
    ("GET_HIGHLIGHTED_SELECTION", "HIGHLIGHTED_SELECTION", 100),
    ("GET_PLAY_STATUS", "PLAY_STATUS", 113),
    ("GET_PLAYING_TITLE_NAME", "TITLE_NAME", 114),
    ("GET_MUSIC_NOW_PLAYING_STATUS", "MUSIC_NOW_PLAYING_STATUS", 115),
    ("GET_MUSIC_PLAY_STATUS", "MUSIC_PLAY_STATUS", 116),
    ("GET_MUSIC_TITLE", "MUSIC_TITLE", 117),
    ("GET_CONTROLLED_ZONE", "CONTROLLED_ZONE", 121),
    ("GET_CAMERA_ANGLE", "CAMERA_ANGLE", 133),
    ("GET_MOVIE_MEDIA_TYPE", "MOVIE_MEDIA_TYPE", 134),
    ("GET_PLAYING_MUSIC_INFORMATION", "PLAYING_MUSIC_INFORMATION", 169),
    ("GET_MOVIE_LOCATION", "MOVIE_LOCATION", 172),
    ("GET_CINEMASCAPE_MASK", "CINEMASCAPE_MASK", 175),
    ("GET_SCREEN_MASK", "SCREEN_MASK", 176),
    ("GET_SCREEN_MASK2", "SCREEN_MASK2", 178),
    ("GET_VIDEO_MODE", "VIDEO_MODE", 180),
    ("GET_VIDEO_MODE2", "VIDEO_MODE2", 182),
    ("GET_VIDEO_COLOR", "VIDEO_COLOR", 183),
    ("GET_CONTENT_COLOR", "CONTENT_COLOR", 185),
    ("GET_CINEMASCAPE_MODE", "CINEMASCAPE_MODE", 186),
    ("GET_SCALE_MODE", "SCALE_MODE", 187),
    ("GET_CHILD_MODE_STATE", "CHILD_MODE_STATE", 193),
    ("GET_NETWORK_SETTINGS", "NETWORK_SETTINGS", 195),
    ("GET_SYSTEM_CAPABILITIES", "SYSTEM_CAPABILITIES", 197),
    ("GET_ZONE_CAPABILITIES", "ZONE_CAPABILITIES", 198),
    ("GET_TIME", "TIME", 199),
):
    _add(_name, _number, "query", response=_response)

_address = Parameter("target_device_id", "address")


def _text(name, **kwargs):
    return Parameter(name, **kwargs)


def _integer(name, lo, hi, **kwargs):
    return Parameter(name, "integer", lo, hi, **kwargs)


_add("ENABLE_EVENTS", 55, "session", (_address,), local=True)
_add("DISABLE_EVENTS", 57, "session", (_address,), local=True)
_add(
    "SET_PROTOCOL_SETTINGS",
    53,
    "session",
    (
        Parameter(
            "delimiter_type", choices=("PRINTABLE_DELIMITERS", "BINARY_DELIMITERS")
        ),
        Parameter("character_set", choices=("LATIN-1",)),
    ),
    local=True,
)
_add(
    "SET_SUPPORTED_PROTOCOL",
    54,
    "session",
    (_integer("version", 0, 99, width=2),),
    local=True,
)
_add(
    "SEND_TO_SYSLOG",
    59,
    "system",
    (Parameter("level", choices=("INFORMATION",)), _text("message")),
)
_add("SET_FRIENDLY_NAME", 60, "system", (_text("name"),), "FRIENDLY_NAME")
_add(
    "POSITION_SELECT",
    69,
    "navigation",
    (_integer("x_loc", 0, 2_000_000_000), _integer("y_loc", 0, 2_000_000_000)),
)
_add("GO_MOVIE_COLLECTION", 77, "views", (_text("collection_name"),))
_add("GO_MUSIC_COLLECTION", 80, "views", (_text("collection_name"),))
_add("KEYBOARD_CHARACTER", 84, "input", (Parameter("character", "character"),))
_add("KEYBOARD_LITERAL", 85, "input", (Parameter("character", "character"),))
_add("SET_USER_INPUT_ENTRY", 88, "input", (_text("string"),))
_add(
    "SET_PARENTAL_CONTROL_LEVEL",
    93,
    "parental",
    (_integer("rating_level", 1, 8), _text("passcode", blank=True)),
)
_add(
    "GET_CONTENT_DETAILS",
    96,
    "content",
    (_text("handle"), _text("passcode", blank=True)),
    "CONTENT_DETAILS_OVERVIEW",
    multipart="details",
)
_add(
    "SET_STATUS_CUE_PERIOD",
    112,
    "session",
    (_integer("period", 0, 1),),
    "STATUS_CUE_PERIOD",
)
_add("SET_CONTROLLED_ZONE", 122, "music", (_address,))
_add(
    "BROWSE",
    144,
    "music",
    (
        _text("browse_handle", blank=True),
        Parameter("passcode", choices=("",)),
        Parameter("lines", "window"),
        _text("flags", blank=True),
    ),
    "BROWSE_RESULTS_OVERVIEW",
    multipart="browse",
)
_add(
    "PERFORM_ACTION",
    150,
    "music",
    (
        _text("handle"),
        Parameter("passcode", choices=("",)),
        _text("action", blank=True),
    ),
    "ACTION_PERFORMED",
)
_add("PLAY_FIRST_IN_MUSIC_COLLECTION", 165, "music", (_text("collection"),))
_add("PLAY_NEXT_IN_MUSIC_COLLECTION", 166, "music", (_text("collection"),))
_add("PLAY_PREVIOUS_IN_MUSIC_COLLECTION", 166, "music", (_text("collection"),))
_add("ASSIGN_PLAYING_MUSIC_TO_PRESET", 167, "music", (_text("tag"),))
_add("PLAY_MUSIC_PRESET", 168, "music", (_text("tag"),))
_add(
    "GET_MUSIC_PRESET_INFORMATION",
    168,
    "music",
    (_text("tag"),),
    "MUSIC_PRESET_INFORMATION",
)
_add("SET_SCREEN_MASK", 179, "video", (_integer("flag", 0, 1),), "SCREEN_MASK")
_add(
    "SET_CINEMASCAPE_MODE", 187, "video", (_integer("mode", 0, 3),), "CINEMASCAPE_MODE"
)
_add("PLAY_SCRIPT", 188, "automation", (_text("script_name"),))
_add("SEND_EVENT", 188, "automation", (_text("message"),))
_add(
    "SET_NETWORK_SETTINGS",
    196,
    "system",
    (
        _integer("static", 0, 1),
        *(
            Parameter(name, "ipv4", blank=True)
            for name in ("ip_address", "subnet", "gateway", "dns1", "dns2")
        ),
    ),
    "NETWORK_SETTINGS",
)

COMMANDS = MappingProxyType(_commands)


def command_spec(name: str | Command) -> CommandSpec:
    try:
        return COMMANDS[name]
    except (KeyError, TypeError) as error:
        raise ProtocolError(
            "Unknown documented command; extensions require their own client"
        ) from error

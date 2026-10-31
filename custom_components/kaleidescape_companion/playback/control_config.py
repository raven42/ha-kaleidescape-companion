"""Explicit playback opt-ins and serial-based target selection; no network IO."""

import hashlib
import json
from urllib.parse import urlsplit

from kaleidescape_api import ProtocolError, serial_number

from ..library.config import origin

DEFAULTS = {
    "control_enabled": False,
    "control_host": "",
    "control_player": "",
    "control_allow_launch": False,
}
COMMANDS = {
    "play": "PLAY",
    "pause": "PAUSE_ON",
    "resume": "PAUSE_OFF",
    "stop": "STOP",
    "next": "NEXT",
    "previous": "PREVIOUS",
    "up": "UP",
    "down": "DOWN",
    "left": "LEFT",
    "right": "RIGHT",
    "select": "SELECT",
    "back": "BACK",
    "menu": "KALEIDESCAPE_MENU_TOGGLE",
    "movies": "GO_MOVIE_COVERS",
    "power_on": "LEAVE_STANDBY",
    "power_off": "ENTER_STANDBY",
}


def validate(values, previous):
    result = {
        key: values.get(key, previous.get(key, default))
        for key, default in DEFAULTS.items()
    }
    if any(
        type(result[key]) is not bool
        for key in ("control_enabled", "control_allow_launch")
    ):
        raise ValueError("invalid_control_options")
    try:
        host(result, previous.get("library_host", ""))
        if result["control_player"]:
            result["control_player"] = serial_number(result["control_player"])
        elif not isinstance(result["control_player"], str):
            raise ValueError
    except (ValueError, ProtocolError) as error:
        raise ValueError("invalid_control_options") from error
    return result


def host(config, library_host=""):
    value = config.get("control_host", "")
    if not isinstance(value, str):
        raise ValueError("invalid_control_options")
    return urlsplit(origin(value or library_host)).hostname


def fingerprint(config):
    return hashlib.sha256(
        json.dumps(
            {key: config.get(key, default) for key, default in DEFAULTS.items()}
            | {
                "library_host": config.get("library_host", ""),
                "library_enabled": config.get("library_enabled", False),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()

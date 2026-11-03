"""Explicit playback opt-ins and serial-based target selection; no network IO."""

import hashlib
import json
from urllib.parse import urlsplit

from kaleidescape import message as pyk

from ..library.config import origin
from .identity import normalize_serial

DEFAULTS = {
    "control_enabled": False,
    "control_host": "",
    "control_player": "",
    "control_allow_launch": False,
}
COMMANDS = {
    "play": pyk.Play.name,
    "pause": "PAUSE_ON",
    "resume": "PAUSE_OFF",
    "stop": pyk.Stop.name,
    "next": pyk.Next.name,
    "previous": pyk.Previous.name,
    "up": pyk.Up.name,
    "down": pyk.Down.name,
    "left": pyk.Left.name,
    "right": pyk.Right.name,
    "select": pyk.Select.name,
    "back": "BACK",
    "menu": pyk.MenuToggle.name,
    "movies": pyk.GoMovieCovers.name,
    "power_on": pyk.LeaveStandby.name,
    "power_off": pyk.EnterStandby.name,
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
            result["control_player"] = normalize_serial(result["control_player"])
        elif not isinstance(result["control_player"], str):
            raise ValueError
    except ValueError as error:
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

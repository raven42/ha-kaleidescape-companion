"""Explicit playback opt-ins and serial-based target selection; no network IO."""

import hashlib
import json
from urllib.parse import urlsplit

from ..library.config import origin
from .identity import normalize_serial

DEFAULTS = {
    "control_enabled": False,
    "control_host": "",
    "control_player": "",
    "control_allow_launch": False,
}
COLLECTIONS = {
    "collection_paused": "Paused",
    "collection_watch_soon": "Watch Soon",
    "collection_new": "New",
    "collection_favorites": "Favorites",
}
COMMANDS = {
    **dict.fromkeys(COLLECTIONS, "go_movie_collection"),
    "play": "play",
    "pause": "pause_on",
    "pause_toggle": "pause",
    "resume": "pause_off",
    "play_pause": "play_or_pause",
    "stop": "stop",
    "next": "next",
    "previous": "previous",
    "replay": "replay",
    "scan_forward": "scan_forward",
    "scan_reverse": "scan_reverse",
    "page_up": "page_up",
    "page_down": "page_down",
    "intermission": "intermission_toggle",
    "status_and_settings": "status_and_settings",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "select": "select",
    "cancel": "cancel",
    "backspace": "backspace",
    "details": "details",
    "back": "back",
    "menu": "menu_toggle",
    "menu_on": "menu_on",
    "menu_off": "menu_off",
    "go_movies": "go_movies",
    "movie_store": "go_movie_store",
    "movies": "go_movie_covers",
    "movie_list": "go_movie_list",
    "movie_collections": "go_movie_collections",
    "search": "go_search",
    "screensaver": "go_screen_saver",
    "screensaver_off": "stop_screen_saver",
    "power_on": "leave_standby",
    "power_off": "enter_standby",
}


PARAMETER_COMMANDS = {
    "keyboard_character": "keyboard_literal",
    "set_input": "set_user_input_entry",
    "named_collection": "go_movie_collection",
}


def validate_parameter(operation, value):
    """Validate arguments to the fixed, parameterized pyk actions."""
    if (
        operation not in PARAMETER_COMMANDS
        or not isinstance(value, str)
        or len(value) > 256
    ):
        raise ValueError("Invalid text")
    try:
        value.encode("latin-1")
    except UnicodeEncodeError as error:
        raise ValueError("Text is not supported by the player") from error
    if operation == "keyboard_character" and (
        len(value) != 1 or not 32 <= ord(value) <= 126
    ):
        raise ValueError("Character must be printable ASCII")
    if operation == "named_collection" and not value.strip():
        raise ValueError("Text must not be empty")
    return value


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

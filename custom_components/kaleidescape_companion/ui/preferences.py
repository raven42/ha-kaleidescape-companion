"""Validated native landing option and private, database-backed UI preferences."""

import json
import re

from ..core.models import invalid, text
from ..library.config import collection_names

DEFAULTS = {"default_landing_page": "journal"}
CHOICES = {
    "default_landing_page": [
        "now-playing",
        "library",
        "journal",
        "database",
        "settings",
    ]
}
LIBRARY_DEFAULTS = {
    "view": "list",
    "page_size": 100,
    "cover_size": 150,
    "show_titles": True,
    "show_format": True,
    "show_badges": True,
    "show_rating": False,
    "show_library_cost": False,
    "cast_limit": 8,
    "widths": [360, 90, 260, 150, 140, 210],
    "query": "",
    "sort": "name",
    "random_seed": "",
    "descending": False,
    "collection": [],
    "actor": [],
    "director": [],
    "rating": [],
    "genre": [],
    "year": [],
    "format": [],
    "status": [],
    "scraper_conflict": False,
}
SORTS = {"name", "year", "collection", "length", "watched", "added", "random"}


def validate(values, previous):
    config = {
        "default_landing_page": values.get(
            "default_landing_page", previous.get("default_landing_page", "journal")
        )
    }
    if config["default_landing_page"] not in CHOICES["default_landing_page"]:
        raise ValueError("invalid_display_options")
    return config


def public_defaults(config):
    try:
        return validate({}, config)
    except ValueError, TypeError:
        return dict(DEFAULTS)


def validate_library(patch, previous=None):
    # Retire the Library-only switch without breaking older preference exports.
    if isinstance(patch, dict):
        patch = {
            key: value for key, value in patch.items() if key != "show_system_buttons"
        }
    if not isinstance(patch, dict) or set(patch) - LIBRARY_DEFAULTS.keys():
        raise invalid("Unknown UI settings")
    values = {**LIBRARY_DEFAULTS, **(previous or {}), **patch}
    values.pop("show_system_buttons", None)
    if values["view"] not in ("list", "covers") or values["sort"] not in tuple(SORTS):
        raise invalid("Invalid Library view/sort")
    seed = values["random_seed"]
    if not isinstance(seed, str) or (seed and not re.fullmatch(r"[a-f0-9]{32}", seed)):
        raise invalid("Invalid Library shuffle seed")
    count = values["page_size"]
    if not (type(count) is int and count in {25, 100, 1000}) and count != "all":
        raise invalid("Choose 25, 100, 1000, or All")
    if type(values["descending"]) is not bool:
        raise invalid("Invalid sort order")
    if any(
        type(values[key]) is not bool
        for key in (
            "show_titles",
            "show_format",
            "show_badges",
            "show_rating",
            "show_library_cost",
            "scraper_conflict",
        )
    ):
        raise invalid("Invalid display toggle")
    if type(values["cover_size"]) is not int or not 90 <= values["cover_size"] <= 300:
        raise invalid("Invalid cover size")
    if type(values["cast_limit"]) is not int or not 1 <= values["cast_limit"] <= 30:
        raise invalid("Choose 1–30 visible cast members")
    widths = values["widths"]
    if (
        not isinstance(widths, list)
        or len(widths) != 6
        or any(type(n) is not int or not 80 <= n <= 800 for n in widths)
    ):
        raise invalid("Invalid column widths")
    values["query"] = text(values["query"], 500, empty=True)
    for key in (
        "collection",
        "actor",
        "director",
        "rating",
        "genre",
        "year",
        "format",
        "status",
    ):
        items = values[key]
        if (
            not isinstance(items, list)
            or len(items) > 100
            or any(not isinstance(item, str) for item in items)
        ):
            raise invalid("Invalid Library filter selection")
        values[key] = list(dict.fromkeys(text(item, 500) for item in items))
    if any(
        not value.isascii() or not value.isdigit() or len(value) > 4
        for value in values["year"]
    ):
        raise invalid("Invalid year filter")
    if set(values["status"]) - {"watched", "unwatched", "in_progress", "unknown"}:
        raise invalid("Invalid watched filter")
    if len(json.dumps(values).encode()) > 16384:
        raise invalid("UI settings exceed 16 KiB")
    return values


def validate_shared(patch, previous=None):
    if not isinstance(patch, dict) or set(patch) - {"hidden_collections"}:
        raise invalid("Unknown shared UI settings")
    try:
        return {
            "hidden_collections": collection_names(
                patch.get(
                    "hidden_collections", (previous or {}).get("hidden_collections", [])
                )
            )
        }
    except ValueError as error:
        raise invalid("Invalid hidden collections") from error


DATABASE_DEFAULTS = {
    "limit": "fit",
    "show_system": False,
    "table": "viewings",
    "sorts": {},
}


def validate_database(patch, previous=None):
    from ..core.database_schema import TABLE_KEYS

    if not isinstance(patch, dict) or set(patch) - DATABASE_DEFAULTS.keys():
        raise invalid("Unknown Database preferences")
    values = {**DATABASE_DEFAULTS, **(previous or {}), **patch}
    if (
        values["limit"] != "fit"
        and (
            type(values["limit"]) is not int
            or values["limit"] not in (10, 25, 100, 500)
        )
    ) or type(values["show_system"]) is not bool:
        raise invalid("Invalid Database view options")
    if not isinstance(values["table"], str) or values["table"] not in TABLE_KEYS:
        raise invalid("Invalid Database table")
    sorts = values["sorts"]
    if not isinstance(sorts, dict) or set(sorts) - TABLE_KEYS.keys():
        raise invalid("Invalid table sort preferences")
    for item in sorts.values():
        if (
            not isinstance(item, dict)
            or set(item) != {"sort", "descending"}
            or not isinstance(item["sort"], str)
            or len(item["sort"]) > 64
            or not item["sort"].replace("_", "").isalnum()
            or type(item["descending"]) is not bool
        ):
            raise invalid("Invalid Database sort")
    return values


SEARCH_DEFAULTS = {"fuzzy_search": True}
INTERFACE_DEFAULTS = {"advanced_view": True}


def validate_interface(patch, previous=None):
    if not isinstance(patch, dict) or set(patch) - INTERFACE_DEFAULTS.keys():
        raise invalid("Unknown interface preferences")
    values = {**INTERFACE_DEFAULTS, **(previous or {}), **patch}
    if type(values["advanced_view"]) is not bool:
        raise invalid("Invalid interface mode")
    return values


JOURNAL_DEFAULTS = {"view": "list", "calendar_size": 180, "calendar_fit": False}


def validate_journal(patch, previous=None):
    if not isinstance(patch, dict) or set(patch) - JOURNAL_DEFAULTS.keys():
        raise invalid("Unknown Journal preferences")
    values = {**JOURNAL_DEFAULTS, **(previous or {}), **patch}
    if values["view"] not in ("list", "calendar"):
        raise invalid("Choose List or Calendar")
    size = values["calendar_size"]
    if type(size) is not int or not 60 <= size <= 320:
        raise invalid("Choose a calendar size between 60 and 320 pixels")
    if type(values["calendar_fit"]) is not bool:
        raise invalid("Invalid calendar fit option")
    return values


def validate_search(patch, previous=None):
    if not isinstance(patch, dict) or set(patch) - SEARCH_DEFAULTS.keys():
        raise invalid("Unknown search preferences")
    values = {**SEARCH_DEFAULTS, **(previous or {}), **patch}
    if type(values["fuzzy_search"]) is not bool:
        raise invalid("Invalid fuzzy search option")
    return values

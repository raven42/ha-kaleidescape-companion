"""Bounded literal templates and one administrator-selected calendar target."""

import hashlib
import json
from string import Formatter

from homeassistant.components.calendar import CalendarEntityFeature
from homeassistant.helpers import entity_registry as er

DEFAULTS = {
    "calendar_enabled": False,
    "calendar_title": "Watched: {title}",
    "calendar_description": (
        "Watched {title} ({year})\nStarted: {started_at}\nEnded: {ended_at}\n"
        "Watched: {watched} min · Runtime: {duration} min\n"
        "Rating: {rating}\nCast: {cast}\nDirector: {director}\n"
        "Genre: {genre}\nCollections: {collection}\n\n{synopsis}"
    ),
}
FIELDS = (
    "title",
    "year",
    "collection",
    "cast",
    "director",
    "writer",
    "studio",
    "genre",
    "duration",
    "watched",
    "rating",
    "artwork",
    "format",
    "edition",
    "synopsis",
    "purchase_date",
    "added_on",
    "status",
    "started_at",
    "ended_at",
)
HELP = (
    "Allowed fields: "
    + ", ".join("{" + key + "}" for key in FIELDS)
    + ". Duration and watched time are minutes; missing metadata is blank. "
    "Use {{ and }} for literal braces."
)


def template(value, maximum=500, *, empty=False):
    """Allow flat literal placeholders only; never executable templates."""
    if (
        not isinstance(value, str)
        or (not empty and not value.strip())
        or len(value) > maximum
    ):
        raise ValueError("invalid_calendar_template")
    try:
        for _, field, spec, conversion in Formatter().parse(value):
            if field is not None and (field not in FIELDS or spec or conversion):
                raise ValueError
    except ValueError as error:
        raise ValueError("invalid_calendar_template") from error
    return value


def target(hass, config):
    reference = config.get("calendar_entity", {})
    registered = (
        er.async_get(hass).async_get(reference.get("registry_id"))
        if reference.get("registry_id")
        else None
    )
    return (
        registered.entity_id
        if registered
        else (None if reference.get("registry_id") else reference.get("entity_id"))
    )


def validate(hass, values, previous):
    enabled = values.get("calendar_enabled", previous.get("calendar_enabled", False))
    if type(enabled) is not bool:
        raise ValueError("invalid_calendar")
    result = {
        "calendar_enabled": enabled,
        "calendar_title": template(
            values.get(
                "calendar_title",
                previous.get("calendar_title", DEFAULTS["calendar_title"]),
            )
        ),
        "calendar_description": template(
            values.get(
                "calendar_description",
                previous.get("calendar_description", DEFAULTS["calendar_description"]),
            ),
            5000,
            empty=True,
        ),
    }
    if "calendar_entity" in previous:
        result["calendar_entity"] = previous["calendar_entity"]
    selected = values.get("calendar_entity") or target(hass, previous)
    if not selected and not enabled:
        return result
    if not isinstance(selected, str) or not selected.startswith("calendar."):
        raise ValueError("invalid_calendar")
    registered = er.async_get(hass).async_get(selected)
    state = hass.states.get(selected)
    if enabled and (
        not (registered or state)
        or (
            state
            and not int(state.attributes.get("supported_features", 0))
            & CalendarEntityFeature.CREATE_EVENT
        )
    ):
        raise ValueError("invalid_calendar")
    result["calendar_entity"] = {
        "entity_id": selected,
        "registry_id": registered.id if registered else None,
    }
    return result


def fingerprint(config):
    return hashlib.sha256(
        json.dumps(
            {key: config.get(key) for key in (*DEFAULTS, "calendar_entity")},
            sort_keys=True,
        ).encode()
    ).hexdigest()

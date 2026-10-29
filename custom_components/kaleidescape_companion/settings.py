"""One-player tracking configuration and stable entity references."""

from typing import Any
from uuid import uuid4

import probatio as p
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import selector

from .const import DEFAULT_MINIMUM_RUNTIME_MINUTES
from .library_config import DEFAULTS as LIBRARY_DEFAULTS
from .library_config import collection_names
from .library_config import validate as validate_library
from .ui_config import CHOICES
from .ui_config import DEFAULTS as UI_DEFAULTS
from .ui_config import validate as validate_ui

ROLES = {
    "media_player": "media_player",
    "play_status": "sensor",
    "media_location": "sensor",
}


def entity_ids(hass: HomeAssistant, config: dict) -> dict[str, str | None]:
    """Follow registered entities across renames; never rebind deleted identities."""
    registry = er.async_get(hass)
    result = {}
    for role in ROLES:
        reference = config.get(role, {})
        registry_id = reference.get("registry_id")
        registered = registry.async_get(registry_id) if registry_id else None
        result[role] = (
            registered.entity_id
            if registered
            else (None if registry_id else reference.get("entity_id"))
        )
    return result


def form(hass: HomeAssistant, config: dict, collections=()) -> p.Schema:
    """Build selectors without hard-coded household entity names."""
    properties = {
        p.Required(
            "tracking_enabled", default=config.get("tracking_enabled", False)
        ): selector.BooleanSelector()
    }
    resolved_ids = entity_ids(hass, config)
    for role, domain in ROLES.items():
        resolved = resolved_ids.get(role)
        marker = p.Optional(role, default=resolved) if resolved else p.Optional(role)
        properties[marker] = selector.EntitySelector(
            selector.EntitySelectorConfig(domain=domain)
        )
    properties[
        p.Required(
            "minimum_runtime_minutes",
            default=config.get(
                "minimum_runtime_minutes", DEFAULT_MINIMUM_RUNTIME_MINUTES
            ),
        )
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=0, max=1440, step=1, mode=selector.NumberSelectorMode.BOX
        )
    )
    properties[
        p.Required("minimum_seconds", default=config.get("minimum_seconds", 300))
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=1, max=3600, step=1, mode=selector.NumberSelectorMode.BOX
        )
    )
    properties[p.Required("resume_hours", default=config.get("resume_hours", 24))] = (
        selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=168, step=1, mode=selector.NumberSelectorMode.BOX
            )
        )
    )
    for key, default in LIBRARY_DEFAULTS.items():
        marker = (p.Optional if isinstance(default, str) else p.Required)(
            key, default=config.get(key, default)
        )
        if type(default) is bool:
            properties[marker] = selector.BooleanSelector()
        elif key == "library_host":
            properties[marker] = selector.TextSelector()
        elif key == "library_excluded_collections":
            marker = p.Optional(key, default=collection_names(config.get(key, [])))
            properties[marker] = selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=sorted(
                        set(collections) | set(collection_names(config.get(key, [])))
                    ),
                    multiple=True,
                    custom_value=True,
                )
            )
        else:
            properties[marker] = selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=1 if key == "library_interval_hours" else 32,
                    max=168 if key == "library_interval_hours" else 4096,
                    step=1,
                    mode=selector.NumberSelectorMode.BOX,
                )
            )
    for key, default in UI_DEFAULTS.items():
        marker = p.Required(key, default=config.get(key, default))
        if key in CHOICES:
            properties[marker] = selector.SelectSelector(
                selector.SelectSelectorConfig(options=CHOICES[key])
            )
        else:
            properties[marker] = selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=1, max=1000, step=1, mode=selector.NumberSelectorMode.BOX
                )
            )
    return p.Schema(properties)


def validate(hass: HomeAssistant, user_input: dict[str, Any], previous: dict) -> dict:
    """Validate complete mappings; permit registered entities that are offline."""
    config = {
        **previous,
        **validate_library(user_input, previous),
        **validate_ui(user_input, previous),
        "tracking_enabled": user_input.get("tracking_enabled", False),
    }
    for key, default, minimum, maximum in (
        ("minimum_runtime_minutes", DEFAULT_MINIMUM_RUNTIME_MINUTES, 0, 1440),
        ("minimum_seconds", 300, 1, 3600),
        ("resume_hours", 24, 0, 168),
    ):
        value = user_input.get(key, previous.get(key, default))
        if type(value) not in (int, float) or not minimum <= value <= maximum:
            raise ValueError("invalid_rules")
        config[key] = float(value)
    if type(config["tracking_enabled"]) is not bool:
        raise ValueError("invalid_rules")
    if not config["tracking_enabled"]:
        return config
    registry = er.async_get(hass)
    selected = []
    for role, domain in ROLES.items():
        value = user_input.get(role)
        if not isinstance(value, str) or not value:
            raise ValueError("missing_entities")
        registered = registry.async_get(value)
        resolved = registered.entity_id if registered else value
        if not resolved.startswith(domain + ".") or not (
            registered or hass.states.get(resolved)
        ):
            raise ValueError("invalid_entities")
        selected.append(resolved)
        config[role] = {
            "entity_id": resolved,
            "registry_id": registered.id if registered else None,
        }
    if len(set(selected)) != len(ROLES):
        raise ValueError("duplicate_entities")
    old = previous.get("media_player", {})
    current = config["media_player"]
    same_player = bool(old) and (old.get("registry_id") or old.get("entity_id")) == (
        current.get("registry_id") or current["entity_id"]
    )
    config["player_id"] = (
        previous["player_id"]
        if same_player and previous.get("player_id")
        else str(uuid4())
    )
    return config

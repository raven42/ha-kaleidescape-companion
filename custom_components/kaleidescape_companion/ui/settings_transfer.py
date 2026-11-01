"""Explicit categories for private, administrator-reviewed settings transfer."""

import json

from ..calendar.config import target
from ..core.models import invalid
from ..core.settings import entity_ids
from ..enrichment.selection import DEFAULTS as SOURCE_DEFAULTS

CATEGORIES = {
    # Positive list: new native options never become exportable automatically.
    "rules": [
        "tracking_enabled",
        "minimum_runtime_minutes",
        "minimum_seconds",
        "resume_hours",
        "library_enabled",
        "library_interval_hours",
        "library_sync_collections",
        "library_allow_collection_add",
        "library_sync_details",
        "library_sync_artwork",
        "library_artwork_cache_mb",
        "control_enabled",
        "control_allow_launch",
        "metadata_store_enabled",
        "metadata_tmdb_enabled",
        "metadata_requests_per_second",
        *SOURCE_DEFAULTS,
        "default_landing_page",
        "calendar_enabled",
        "calendar_full_sync",
        "calendar_full_sync_months",
        "calendar_full_sync_time",
    ],
    "connections": [
        "media_player",
        "play_status",
        "media_location",
        "library_host",
        "control_host",
        "control_player",
        "calendar_entity",
    ],
    "templates": ["calendar_title", "calendar_description"],
    "browsing": [
        *[
            f"{area}:{profile}"
            for area in ("library", "journal", "database", "search", "interface")
            for profile in ("desktop", "tablet", "mobile")
        ],
        "library",
        "journal",
        "database",
        "search",
        "interface",
    ],
    "shared": ["hidden_collections"],
    "logging": ["level", "log_values"],
}


async def transfer(hass, entry, repo, actor, operation, selected, data, request):
    if (
        not isinstance(selected, list)
        or not selected
        or len(selected) > len(CATEGORIES)
        or any(not isinstance(c, str) or c not in CATEGORIES for c in selected)
        or len(set(selected)) != len(selected)
    ):
        raise invalid("Choose valid settings categories")
    if operation not in {"export", "preview", "apply"}:
        raise invalid("Invalid settings transfer operation")
    config = dict(entry.options or entry.data)
    if operation == "export":
        config.update(entity_ids(hass, config))
        config["calendar_entity"] = target(hass, config) or ""
        categories = {
            name: {key: config[key] for key in CATEGORIES[name] if key in config}
            for name in selected
            if name in {"rules", "connections", "templates"}
        }
        if "browsing" in selected:
            categories["browsing"] = {
                key: (
                    await repo.async_ui_preferences(
                        actor, area=key.split(":")[0], profile=key.split(":")[1]
                    )
                )["values"]
                for key in CATEGORIES["browsing"]
                if ":" in key
            }
        if "shared" in selected:
            categories["shared"] = (
                await repo.async_ui_preferences(actor, shared=True)
            )["values"]
        if "logging" in selected:
            settings = (await repo.async_logs())["config"]
            categories["logging"] = {
                key: settings[key] for key in CATEGORIES["logging"]
            }
        return {"format": "companion-settings", "version": 1, "categories": categories}
    try:
        size = len(json.dumps(data, allow_nan=False).encode())
    except (ValueError, TypeError, RecursionError) as error:
        raise invalid("Invalid settings data") from error
    if (
        not isinstance(data, dict)
        or set(data) != {"format", "version", "categories"}
        or data["format"] != "companion-settings"
        or type(data["version"]) is not int
        or data["version"] != 1
        or not isinstance(data["categories"], dict)
        or set(data["categories"]) - CATEGORIES.keys()
        or size > 262144
    ):
        raise invalid("Invalid settings file; expected version 1, at most 256 KiB")
    categories = {}
    for name in selected:
        values = data["categories"].get(name)
        if not isinstance(values, dict) or set(values) - set(CATEGORIES[name]):
            raise invalid("Unsupported fields or missing settings category")
        if name in {"rules", "connections", "templates"}:
            if any(
                type(v) not in {str, int, float, bool, list} for v in values.values()
            ):
                raise invalid("Invalid settings value")
        categories[name] = values
    patch = {
        key: value
        for name in ("rules", "connections", "templates")
        for key, value in categories.get(name, {}).items()
    }
    if patch.get("calendar_full_sync"):
        # Dedicated-calendar acknowledgement must be made anew in the native form.
        patch["calendar_full_sync_dedicated"] = False
    result = await repo.async_transfer_settings(operation, actor, request, categories)
    return {
        "format": "companion-settings",
        "version": 1,
        "categories": categories,
        "patch": patch,
        **result,
    }

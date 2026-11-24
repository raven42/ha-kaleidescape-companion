"""Resolve Companion sensor states without assuming Home Assistant entity IDs."""

from homeassistant.helpers import entity_registry as er

SENSOR_ATTRIBUTES = {
    "last_watched_movie": ("movie", "watched_at"),
    "movies_7_days": ("movies", "truncated"),
    "movies_30_days": ("movies", "truncated"),
    "movies_365_days": (),
    "partial_movies": ("movies", "truncated"),
    "total_movies": (),
    "database_size": (),
    "last_library_sync": (),
    "artwork_cache_size": (),
    "watched_movies": ("unknown_movies", "collections_synced_at"),
    "unwatched_movies": ("unknown_movies", "collections_synced_at"),
    "recently_added": ("movies", "truncated", "added_at"),
    "last_scrape_date": (
        "operation",
        "status",
        "providers",
        "processed",
        "total",
        "updated",
        "skipped",
        "provider_attempts",
    ),
    "scraper_conflicts": ("movies", "truncated"),
    "missing_metadata": ("movies", "truncated"),
    "missing_artwork": ("movies", "truncated"),
    "missing_purchase_information": ("movies", "truncated"),
}


def sensor_states(hass, entry_id, dataset_id):
    """Read only this entry's registered sensors and their documented attributes."""
    registry = er.async_get(hass)
    entries = er.async_entries_for_config_entry(registry, entry_id)
    by_unique_id = {
        entry.unique_id: entry for entry in entries if entry.domain == "sensor"
    }
    result = {}
    for key, attributes in SENSOR_ATTRIBUTES.items():
        entry = by_unique_id.get(f"{dataset_id}_{key}")
        state = hass.states.get(entry.entity_id) if entry else None
        result[key] = {
            "entity_id": entry.entity_id if entry else None,
            "state": state.state if state else None,
            "unit": state.attributes.get("unit_of_measurement") if state else None,
            "attributes": {
                name: state.attributes[name]
                for name in attributes
                if name in state.attributes
            }
            if state
            else {},
        }
    return result

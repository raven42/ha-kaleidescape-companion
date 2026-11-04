"""Global field preferences over immutable source data and cached provider facts."""

import json

FIELDS = {
    "actors": "Cast",
    "directors": "Directors",
    "writers": "Writers",
    "producers": "Producers",
    "studios": "Studios",
    "synopsis": "Synopsis",
    "genres": "Genres",
    "distributor": "Distributor",
    "critic_score": "Rotten Tomatoes critics",
    "audience_score": "Rotten Tomatoes audience",
    "audience_rating": "TMDB viewer rating",
    "audience_votes": "TMDB audience votes",
    "artwork": "Cover artwork",
    "backdrop": "Landscape image",
}
OPTIONS = {
    key: (
        "auto",
        "original",
        *(
            ("kaleidescape",)
            if key in {"critic_score", "audience_score", "distributor"}
            else ("tmdb",)
            if key in {"audience_rating", "audience_votes", "backdrop"}
            else ("kaleidescape", "tmdb")
        ),
    )
    for key in FIELDS
}
DEFAULTS = {f"metadata_source_{key}": "auto" for key in FIELDS}


def configured(config):
    values = {}
    for field in FIELDS:
        value = config.get(f"metadata_source_{field}", "auto")
        if not isinstance(value, str) or value not in OPTIONS[field]:
            raise ValueError("invalid_metadata_options")
        if value != "auto":
            values[field] = value
    if "metadata_store_enabled" in config or "metadata_tmdb_enabled" in config:
        values["_enabled"] = [
            provider
            for provider, key in (
                ("kaleidescape", "metadata_store_enabled"),
                ("tmdb", "metadata_tmdb_enabled"),
            )
            if config.get(key)
        ]
    return values


def read(db):
    row = db.execute(
        "SELECT value FROM settings WHERE owner='household' AND key='metadata_sources'"
    ).fetchone()
    return json.loads(row[0]) if row else {}


def choose(original, enrichment, field, preference):
    """Explicit source wins when populated; missing facts use the other caches."""
    if preference == "original":
        return original.get(field)
    order = [
        preference,
        *(provider for provider in ("kaleidescape", "tmdb") if provider != preference),
    ]
    for provider in order:
        value = enrichment.get(provider, {}).get(field)
        if value not in (None, "", []):
            return value
    return original.get(field)


def image(original, enrichment, sources, kind="artwork"):
    if isinstance(enrichment, str):
        enrichment = json.loads(enrichment)
    enrichment = enrichment or {}
    key = "poster_key" if kind == "artwork" else "backdrop_key"
    reviewed_data = enrichment.get("reviewed", {})
    if kind == "backdrop" and reviewed_data.get("backdrop_removed"):
        return None
    reviewed = reviewed_data.get(key)
    if reviewed:
        return reviewed
    preferred = sources.get(kind, "auto")
    if preferred == "original":
        return original
    provider_key = enrichment.get("tmdb", {}).get(key)
    # Kaleidescape covers come from the existing edition-specific LAN cache.
    return (
        (provider_key or original)
        if preferred == "tmdb" or kind == "backdrop"
        else (original or provider_key)
    )

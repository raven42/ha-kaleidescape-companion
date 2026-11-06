"""Private provider bindings and durable match conflicts, confined to the worker."""

import json
import re
from datetime import UTC, datetime

from ..core.models import JournalError
from .availability import for_group, marked
from .selection import OPTIONS

REASONS = {
    "tmdb_not_found",
    "tmdb_ambiguous",
    "store_not_found",
    "store_ambiguous",
    "store_search_truncated",
    "provider_identity_mismatch",
    "invalid_store_link",
    "missing_year",
}


def reference(metadata):
    return {key: metadata[key] for key in ("provider_id", "title", "year", "url")}


def same_provider_identity(left, right):
    """Compare provider identities without treating missing IDs as a match."""
    return (
        isinstance(left, dict)
        and isinstance(right, dict)
        and isinstance(left.get("provider_id"), str)
        and bool(left["provider_id"])
        and left["provider_id"] == right.get("provider_id")
    )


def provider_url(provider, metadata):
    """Build a public movie link from an approved provider identity or route."""
    if not isinstance(metadata, dict):
        return None
    if provider == "tmdb":
        movie_id = metadata.get("provider_id")
        if isinstance(movie_id, str) and re.fullmatch(r"[1-9][0-9]{0,9}", movie_id):
            return f"https://www.themoviedb.org/movie/{movie_id}"
    elif provider == "kaleidescape":
        from ..scrapers.providers.store import HOST, movie_path

        try:
            return HOST + movie_path(metadata.get("url"))
        except ValueError:
            return None
    return None


def has_provider_data(enrichment, provider):
    """Recognize cached data whose timestamp was lost during an image edit."""
    cache = enrichment.get(provider, {})
    if not isinstance(cache, dict):
        return False
    if isinstance(cache.get("fetched_at"), str) and cache["fetched_at"]:
        return True
    matches = enrichment.get("matches", {})
    return (
        isinstance(matches, dict)
        and same_provider_identity(cache, matches.get(provider))
        and cache.get("provider") == provider
        and isinstance(cache.get("title"), str)
        and bool(cache["title"])
        and type(cache.get("year")) is int
        and isinstance(cache.get("url"), str)
        and bool(cache["url"])
    )


def bindings(db, source, group):
    result = {}
    for row in db.execute(
        "SELECT json_extract(enrichment,'$.matches') FROM library "
        "WHERE source_id=? AND source_group=? AND available=1 ORDER BY id",
        (source, group),
    ):
        result.update(json.loads(row[0] or "{}"))
    return result


def has_conflict(encoded, sources):
    enrichment = json.loads(encoded) if isinstance(encoded, str) else (encoded or {})
    enabled = set(sources.get("_enabled", ("tmdb", "kaleidescape")))
    desired = set()
    for field, choices in OPTIONS.items():
        preferred = sources.get(field, "auto")
        desired.update((set(choices) if preferred == "auto" else {preferred}) & enabled)
    return bool((desired - marked(enrichment)) & enrichment.get("conflicts", {}).keys())


def conflict(db, source, id, provider, reason, expected):
    if provider not in {"tmdb", "kaleidescape"} or reason not in REASONS:
        raise JournalError("invalid_request", "Unsupported scraper conflict")
    row = db.execute(
        "SELECT * FROM library WHERE source_id=? AND id=? AND available=1", (source, id)
    ).fetchone()
    if row is None:
        raise JournalError("refresh_required", "Movie changed during matching")
    value = json.loads(row["enrichment"])
    if (
        row["title"] != expected["title"]
        or row["source_group"] != expected.get("source_group", expected.get("group"))
        or value.get("source_only")
        or provider in for_group(db, source, row["source_group"])
        or bindings(db, source, row["source_group"]).get(provider)
        != expected.get("matches", {}).get(provider)
    ):
        raise JournalError("refresh_required", "Movie changed during matching")
    with db:
        db.execute(
            "UPDATE library SET enrichment=json_set(enrichment,?,json(?)) "
            "WHERE source_id=? AND source_group=?",
            (
                f"$.conflicts.{provider}",
                json.dumps(
                    {"reason": reason, "checked_at": datetime.now(UTC).isoformat()}
                ),
                source,
                row["source_group"],
            ),
        )

"""Private provider bindings and durable match conflicts, confined to the worker."""

import json
from datetime import UTC, datetime

from ..core.models import JournalError
from .availability import for_group, marked
from .selection import OPTIONS

REASONS = {
    "tmdb_not_found",
    "tmdb_ambiguous",
    "store_not_found",
    "store_ambiguous",
    "provider_identity_mismatch",
    "invalid_store_link",
    "missing_year",
}


def reference(metadata):
    return {key: metadata[key] for key in ("provider_id", "title", "year", "url")}


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

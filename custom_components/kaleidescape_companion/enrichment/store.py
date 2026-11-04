"""Worker-owned provider cache and exact source-group links."""

import json
import re
from datetime import UTC, datetime

from ..core.models import JournalError
from ..library.store import changed
from .availability import artwork_for_group, for_group
from .matching import bindings, reference

PROVIDERS = {"kaleidescape", "tmdb"}
CREDITS = ("actors", "directors", "writers", "producers", "studios")
REVIEW_FIELDS = (
    *CREDITS,
    "synopsis",
    "genres",
    "distributor",
    "critic_score",
    "audience_score",
    "audience_rating",
    "audience_votes",
)
HISTORY_FIELDS = ("title", "year", "rating", *REVIEW_FIELDS)
FIELDS = (
    "provider",
    "provider_id",
    "url",
    "title",
    "year",
    *CREDITS,
    "distributor",
    "critic_score",
    "audience_score",
    "audience_rating",
    "audience_votes",
    "fetched_at",
    "synopsis",
    "genres",
    "rating",
)


def history_values(metadata):
    """Keep a bounded snapshot of values returned by a provider."""
    if not isinstance(metadata, dict):
        return {}
    values = {}
    for field in HISTORY_FIELDS:
        value = metadata.get(field)
        if value in (None, "", []):
            continue
        if isinstance(value, str):
            value = value[:300]
        elif isinstance(value, list):
            value = [str(item)[:80] for item in value[:8]]
            if len(metadata[field]) > 8:
                value.append(f"… and {len(metadata[field]) - 8} more")
        elif not isinstance(value, (int, float)) or isinstance(value, bool):
            continue
        values[field] = value
    return values


def public(value):
    """Never project arbitrary imported/system JSON keys into household responses."""
    return {
        provider: {
            **{key: item[key] for key in FIELDS if key in item},
            **(
                {
                    key: item[key]
                    for key in ("poster_key", "backdrop_key")
                    if isinstance(item.get(key), str)
                    and re.fullmatch(r"[a-f0-9]{64}", item[key])
                }
            ),
            **(
                {
                    "providers": [
                        name for name in item.get("providers", []) if name in PROVIDERS
                    ]
                }
                if provider == "reviewed"
                else {}
            ),
        }
        for provider, item in value.items()
        if provider in PROVIDERS | {"reviewed"} and isinstance(item, dict)
    }


def effective(data, enrichment, sources=None):
    """Augment credits, preserving raw identities and version-specific facts."""
    if not enrichment or enrichment == "{}":
        return data if isinstance(data, str) else json.dumps(data)
    data = json.loads(data) if isinstance(data, str) else dict(data)
    enrichment = json.loads(enrichment) if isinstance(enrichment, str) else enrichment
    from .selection import FIELDS as SOURCE_FIELDS
    from .selection import choose

    original = dict(data)
    for provider in ("kaleidescape", "tmdb"):
        item = enrichment.get(provider, {})
        for key in CREDITS:
            values = (
                [*(item.get(key) or []), *(data.get(key) or [])]
                if provider == "tmdb" and key == "actors"
                else [*(data.get(key) or []), *(item.get(key) or [])]
            )
            data[key] = list(dict.fromkeys(values))[:500]
    for key in SOURCE_FIELDS.keys() - {"artwork", "backdrop"}:
        preference = enrichment.get("field_sources", {}).get(
            key, (sources or {}).get(key, "auto")
        )
        if preference != "auto":
            data[key] = choose(original, enrichment, key, preference)
        elif key not in CREDITS and data.get(key) in (None, "", []):
            data[key] = choose(original, enrichment, key, "kaleidescape")
    if (
        "audience_rating" in data
        and enrichment.get("field_sources", {}).get(
            "audience_votes", (sources or {}).get("audience_votes", "auto")
        )
        == "auto"
    ):
        data["audience_votes"] = enrichment.get("tmdb", {}).get("audience_votes")
    for key in (*REVIEW_FIELDS, "year", "rating"):
        if key in enrichment.get("reviewed", {}):
            data[key] = enrichment["reviewed"][key]
    return json.dumps(data)


def candidates(db, source):
    """Choose scanned movie groups, excluding purchase-only placeholders."""
    rows = db.execute(
        """SELECT id,source_group,title,json_extract(data,'$.year') year,
            coalesce(href,(SELECT json_extract(value,'$.href')
                FROM json_each(purchase_history)
                WHERE json_extract(value,'$.href') IS NOT NULL LIMIT 1)) href,
            json_extract(enrichment,'$.kaleidescape.fetched_at') store_fetched,
            json_extract(enrichment,'$.tmdb.fetched_at') tmdb_fetched,
            json_extract(enrichment,'$.matches') matched_refs
        FROM library WHERE source_id=? AND available=1
        AND purchase_match_pending=0
        AND NOT EXISTS (SELECT 1 FROM library locked
            WHERE locked.source_id=library.source_id
            AND locked.source_group=library.source_group
            AND json_extract(locked.enrichment,'$.source_only')=1)
        ORDER BY metadata_synced_at IS NOT NULL
        DESC,length(data) DESC,id LIMIT 10001""",
        (source,),
    )
    groups = {}
    for count, row in enumerate(rows):
        if count == 10000:
            raise JournalError(
                "metadata_limit", "Metadata sync supports 10,000 versions"
            )
        entry = groups.setdefault(
            row["source_group"],
            {
                "id": row["id"],
                "source_group": row["source_group"],
                "title": row["title"],
                "year": row["year"],
                "href": None,
                "enrichment": {},
                "matches": {},
            },
        )
        if not entry["year"]:
            entry["year"] = row["year"]
        entry["matches"].update(json.loads(row["matched_refs"] or "{}"))
        entry["href"] = entry["href"] or row["href"]
        for provider, field in (
            ("kaleidescape", "store_fetched"),
            ("tmdb", "tmdb_fetched"),
        ):
            if row[field]:
                entry["enrichment"][provider] = {"fetched_at": row[field]}
    for group, entry in groups.items():
        entry["unavailable"] = sorted(for_group(db, source, group))
        entry["unavailable_artwork"] = sorted(artwork_for_group(db, source, group))
    return list(groups.values())


def save(db, source, title_id, provider, metadata):
    if provider not in PROVIDERS:
        raise JournalError("invalid_request", "Unknown metadata provider")
    fetched_at = datetime.now(UTC).isoformat()
    encoded = json.dumps({**metadata, "fetched_at": fetched_at})
    if len(encoded.encode()) > 128 * 1024:
        raise JournalError("metadata_limit", "Provider metadata is too large")
    row = db.execute(
        "SELECT source_group,title,data,enrichment FROM library "
        "WHERE source_id=? AND id=? AND available=1",
        (source, title_id),
    ).fetchone()
    if (
        row is None
        or provider in for_group(db, source, row["source_group"])
        or db.execute(
            "SELECT 1 FROM library WHERE source_id=? AND source_group=? "
            "AND json_extract(enrichment,'$.source_only')=1 LIMIT 1",
            (source, row["source_group"]),
        ).fetchone()
        is not None
        or row["title"] != metadata.get("matched_title")
        or row["source_group"] != metadata.get("matched_group")
        or bindings(db, source, row["source_group"]).get(provider)
        != metadata.get("matched_reference")
        or (
            metadata.get("matched_reference") is not None
            and reference(metadata) != metadata["matched_reference"]
        )
        or (
            metadata.get("matched_reference") is None
            and json.loads(row["data"]).get("year") not in (None, metadata.get("year"))
        )
    ):
        raise JournalError("refresh_required", "Library changed during enrichment")
    with db:
        for member in db.execute(
            "SELECT id,enrichment FROM library "
            "WHERE source_id=? AND source_group=? AND available=1",
            (source, row["source_group"]),
        ).fetchall():
            value = json.loads(member["enrichment"])
            if metadata.get("matched_reference"):
                value.setdefault("matches", {})[provider] = metadata[
                    "matched_reference"
                ]
            value.setdefault("conflicts", {}).pop(provider, None)
            previous = value.get(provider, {})
            value[provider] = json.loads(encoded)
            if provider == "tmdb" and previous.get("provider_id") == metadata.get(
                "provider_id"
            ):
                for key in ("poster_key", "backdrop_key"):
                    if previous.get(key):
                        value[provider][key] = previous[key]
            history = value.setdefault("provider_history", {}).setdefault(provider, [])
            history.append(
                {
                    "checked_at": fetched_at,
                    "outcome": "downloaded",
                    "values": history_values(metadata),
                }
            )
            del history[:-8]
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?",
                (json.dumps(value), member["id"]),
            )
        changed(db, source)


def statistics(db, source):
    """Count cached movie groups, never title names or private provider values."""
    conditions = {
        provider: f"(json_extract(enrichment,'$.{provider}.fetched_at') IS NOT NULL "
        "OR EXISTS (SELECT 1 FROM json_each(enrichment,'$.reviewed.providers') "
        f"WHERE value='{provider}'))"
        for provider in sorted(PROVIDERS)
    }
    expressions = ",".join(
        f"count(DISTINCT CASE WHEN {condition} THEN source_group END) {provider}"
        for provider, condition in conditions.items()
    )
    row = db.execute(
        "SELECT count(DISTINCT CASE WHEN ("
        + " OR ".join(conditions.values())
        + ") THEN source_group END) cached_groups,"
        + expressions
        + " FROM library WHERE source_id=? AND available=1 "
        "AND purchase_match_pending=0",
        (source,),
    ).fetchone()
    return {
        "cached_groups": row["cached_groups"],
        "by_provider": {key: row[key] for key in conditions},
    }

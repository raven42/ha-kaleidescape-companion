"""Worker-owned provider cache and exact source-group links."""

import json
import re
from datetime import UTC, datetime

from ..core.models import JournalError
from ..library.purchases import fill_retail_price
from ..library.store import changed
from ..scrapers.models import genre_name
from .availability import artwork_for_group, for_group
from .matching import bindings, has_provider_data, reference

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
            **{
                key: (
                    normalize_genres({"genres": item[key]})["genres"]
                    if key == "genres"
                    else item[key]
                )
                for key in FIELDS
                if key in item
            },
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
            **(
                {"backdrop_removed": True}
                if provider == "reviewed" and item.get("backdrop_removed") is True
                else {}
            ),
        }
        for provider, item in value.items()
        if provider in PROVIDERS | {"reviewed"} and isinstance(item, dict)
    }


def effective(data, enrichment, sources=None):
    """Augment credits, preserving raw identities and version-specific facts."""
    data = json.loads(data) if isinstance(data, str) else dict(data)
    if not enrichment or enrichment == "{}":
        return json.dumps(normalize_genres(data))
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
    return json.dumps(normalize_genres(data))


def normalize_genres(data):
    """Unify equivalent genre labels for display, filtering and suggestions."""
    values = data.get("genres")
    if isinstance(values, list):
        normalized = []
        for value in values:
            value = genre_name(value)
            if value not in normalized:
                normalized.append(value)
        data["genres"] = normalized
    return data


def candidates(db, source):
    """Choose scanned movie groups, excluding purchase-only placeholders."""
    rows = db.execute(
        """SELECT id,source_group,title,json_extract(data,'$.year') year,
            coalesce(href,(SELECT p.href FROM purchase_records p
                WHERE p.library_id=library.id AND p.href IS NOT NULL
                ORDER BY p.purchased_on IS NULL,p.purchased_on,p.id LIMIT 1)) href,
            json_extract(enrichment,'$.kaleidescape.fetched_at') store_fetched,
            json_extract(enrichment,'$.tmdb.fetched_at') tmdb_fetched,
            json_extract(enrichment,'$.reviewed.backdrop_removed') backdrop_removed,
            EXISTS (SELECT 1 FROM library_artwork a WHERE a.cache_key=
                companion_artwork(library.artwork_key,library.enrichment,
                    'artwork')) poster_selected,
            EXISTS (SELECT 1 FROM library_artwork a WHERE a.cache_key=
                companion_artwork(NULL,library.enrichment,
                    'backdrop')) backdrop_selected,
            json_extract(enrichment,'$.matches') matched_refs,
            CASE WHEN json_type(enrichment,'$.kaleidescape')='object'
                THEN json_extract(enrichment,'$.kaleidescape')
                ELSE '{}' END store_cache,
            CASE WHEN json_type(enrichment,'$.tmdb')='object'
                THEN json_extract(enrichment,'$.tmdb') ELSE '{}' END tmdb_cache
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
                "cached_providers": set(),
                "backdrop_selected": False,
                "poster_selected": False,
                "backdrop_removed": False,
            },
        )
        if not entry["year"]:
            entry["year"] = row["year"]
        entry["matches"].update(json.loads(row["matched_refs"] or "{}"))
        cache = {
            "matches": json.loads(row["matched_refs"] or "{}"),
            "kaleidescape": json.loads(row["store_cache"] or "{}"),
            "tmdb": json.loads(row["tmdb_cache"] or "{}"),
        }
        entry["cached_providers"].update(
            name for name in PROVIDERS if has_provider_data(cache, name)
        )
        entry["href"] = entry["href"] or row["href"]
        entry["backdrop_selected"] |= bool(row["backdrop_selected"])
        entry["poster_selected"] |= bool(row["poster_selected"])
        entry["backdrop_removed"] |= bool(row["backdrop_removed"])
        for provider, field in (
            ("kaleidescape", "store_fetched"),
            ("tmdb", "tmdb_fetched"),
        ):
            if row[field]:
                entry["enrichment"][provider] = {"fetched_at": row[field]}
    for group, entry in groups.items():
        entry["cached_providers"] = sorted(entry["cached_providers"])
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
            metadata.get("discovered_reference") is not None
            and (
                provider != "kaleidescape"
                or metadata.get("matched_reference") is not None
                or reference(metadata) != metadata["discovered_reference"]
            )
        )
        or (
            metadata.get("matched_reference") is None
            and json.loads(row["data"]).get("year") not in (None, metadata.get("year"))
        )
    ):
        raise JournalError("refresh_required", "Library changed during enrichment")
    with db:
        if provider == "kaleidescape":
            fill_retail_price(db, title_id, metadata.get("retail_price"))
        for member in db.execute(
            "SELECT id,enrichment FROM library "
            "WHERE source_id=? AND source_group=? AND available=1",
            (source, row["source_group"]),
        ).fetchall():
            value = json.loads(member["enrichment"])
            if selected := metadata.get("matched_reference") or metadata.get(
                "discovered_reference"
            ):
                value.setdefault("matches", {})[provider] = selected
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

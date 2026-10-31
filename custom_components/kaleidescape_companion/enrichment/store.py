"""Worker-owned provider cache and exact source-group links."""

import json
from datetime import UTC, datetime

from ..core.models import JournalError
from ..library.store import changed

PROVIDERS = {"kaleidescape", "tmdb"}
CREDITS = ("actors", "directors", "writers", "producers", "studios")
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
)


def public(value):
    """Never project arbitrary imported/system JSON keys into household responses."""
    return {
        provider: {key: item[key] for key in FIELDS if key in item}
        for provider, item in value.items()
        if provider in PROVIDERS and isinstance(item, dict)
    }


def effective(data, enrichment):
    """Augment credits, preserving raw identities and version-specific facts."""
    if not enrichment or enrichment == "{}":
        return data if isinstance(data, str) else json.dumps(data)
    data = json.loads(data) if isinstance(data, str) else dict(data)
    enrichment = json.loads(enrichment) if isinstance(enrichment, str) else enrichment
    for provider in ("kaleidescape", "tmdb"):
        item = enrichment.get(provider, {})
        for key in CREDITS:
            values = [*(data.get(key) or []), *(item.get(key) or [])]
            data[key] = list(dict.fromkeys(values))[:500]
    return json.dumps(data)


def candidates(db, source):
    """Choose scanned movie groups, excluding purchase-only placeholders."""
    rows = db.execute(
        """SELECT id,source_group,title,json_extract(data,'$.year') year,
            coalesce(href,(SELECT json_extract(value,'$.href')
                FROM json_each(purchase_history)
                WHERE json_extract(value,'$.href') IS NOT NULL LIMIT 1)) href,
            json_extract(enrichment,'$.kaleidescape.fetched_at') store_fetched,
            json_extract(enrichment,'$.tmdb.fetched_at') tmdb_fetched
        FROM library WHERE source_id=? AND available=1
        AND purchase_match_pending=0 ORDER BY metadata_synced_at IS NOT NULL
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
            },
        )
        if not entry["year"]:
            entry["year"] = row["year"]
        entry["href"] = entry["href"] or row["href"]
        for provider, field in (
            ("kaleidescape", "store_fetched"),
            ("tmdb", "tmdb_fetched"),
        ):
            if row[field]:
                entry["enrichment"][provider] = {"fetched_at": row[field]}
    return list(groups.values())


def save(db, source, title_id, provider, metadata):
    if provider not in PROVIDERS:
        raise JournalError("invalid_request", "Unknown metadata provider")
    encoded = json.dumps({**metadata, "fetched_at": datetime.now(UTC).isoformat()})
    if len(encoded.encode()) > 128 * 1024:
        raise JournalError("metadata_limit", "Provider metadata is too large")
    row = db.execute(
        "SELECT source_group,title,data FROM library "
        "WHERE source_id=? AND id=? AND available=1",
        (source, title_id),
    ).fetchone()
    if (
        row is None
        or row["title"] != metadata.get("matched_title")
        or row["source_group"] != metadata.get("matched_group")
        or (json.loads(row["data"]).get("year") not in (None, metadata.get("year")))
    ):
        raise JournalError("refresh_required", "Library changed during enrichment")
    with db:
        for member in db.execute(
            "SELECT id,enrichment FROM library "
            "WHERE source_id=? AND source_group=? AND available=1",
            (source, row["source_group"]),
        ).fetchall():
            value = json.loads(member["enrichment"])
            value[provider] = json.loads(encoded)
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?",
                (json.dumps(value), member["id"]),
            )
        changed(db, source)

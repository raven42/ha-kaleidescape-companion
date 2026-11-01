"""Worker-owned administrator declarations of unavailable provider metadata."""

import hashlib
import json
import re

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid

PROVIDERS = {"tmdb", "kaleidescape"}


def marked(value):
    return {
        provider
        for provider in PROVIDERS
        if value.get("unavailable", {}).get(provider) is True
    }


def for_group(db, source, group):
    return {
        provider
        for provider in PROVIDERS
        if db.execute(
            "SELECT 1 FROM library WHERE source_id=? AND source_group=? "
            "AND purchase_match_pending=0 AND json_type(enrichment,?)='true' LIMIT 1",
            (source, group, f"$.unavailable.{provider}"),
        ).fetchone()
    }


def change(db, source, actor, request, data, authorize):
    from ..library.store import changed
    from .review_store import members, signature

    authorize()
    if (
        not isinstance(data, dict)
        or set(data) != {"title_id", "provider", "snapshot", "unavailable"}
        or not isinstance(data["provider"], str)
        or data["provider"] not in PROVIDERS
        or type(data["unavailable"]) is not bool
        or not isinstance(data["snapshot"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", data["snapshot"])
        or not isinstance(data["title_id"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", data["title_id"])
    ):
        raise invalid("Choose a movie, provider and current availability snapshot")
    request = identifier(request)
    digest = hashlib.sha256(
        json.dumps(
            ["scraper_availability", source, actor, data], sort_keys=True
        ).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, data["title_id"])
    if signature(rows) != data["snapshot"]:
        raise JournalError(
            "refresh_required", "Movie changed; reopen the scraper dialog"
        )
    result = {"title_id": data["title_id"], "updated_count": len(rows)}
    with db:
        for row in db.execute(
            "SELECT id,enrichment FROM library WHERE source_id=? AND source_group=? "
            "AND purchase_match_pending=0",
            (source, rows[0]["source_group"]),
        ).fetchall():
            value = json.loads(row["enrichment"])
            flags = value.setdefault("unavailable", {})
            if data["unavailable"]:
                flags[data["provider"]] = True
                value.setdefault("conflicts", {}).pop(data["provider"], None)
            else:
                flags.pop(data["provider"], None)
            encoded = json.dumps(value)
            if len(encoded.encode()) > 512 * 1024:
                raise invalid("Reviewed metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?",
                (encoded, row["id"]),
            )
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result

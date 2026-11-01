"""Worker-only administrator display edits, independent of scanned identities."""

import hashlib
import json
import re
from datetime import UTC, datetime

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid, text
from ..enrichment.review_store import members, signature
from .browse import library_versions
from .store import changed

LISTS = {"actors", "directors", "writers", "producers", "studios", "genres"}
FIELDS = ("title", "sort_title", "year", "rating", "synopsis", *sorted(LISTS))


def validate(patch):
    if not isinstance(patch, dict) or not patch or set(patch) - set(FIELDS):
        raise invalid("Choose supported display fields")
    result = {}
    for key, value in patch.items():
        if key in LISTS:
            if not isinstance(value, list) or len(value) > 500:
                raise invalid("Metadata lists support up to 500 names")
            result[key] = list(dict.fromkeys(text(item, 500) for item in value))
        elif key == "year":
            if value is not None and (
                type(value) is not int or not 1800 <= value <= 9999
            ):
                raise invalid("Enter a release year between 1800 and 9999")
            result[key] = value
        elif key == "sort_title":
            result[key] = text(value, 500, empty=True) if value is not None else None
        else:
            result[key] = text(
                value, 10000 if key == "synopsis" else 500, empty=key != "title"
            )
    if len(json.dumps(result).encode()) > 128 * 1024:
        raise invalid("Display changes exceed the metadata limit")
    return result


def inspect(db, source, title):
    title = text(title, 64)
    rows = members(db, source, title)
    current = next(
        row
        for offset in (0, 50)
        for row in library_versions(db, source, title, offset)["items"]
        if row["id"] == title
    )
    return {
        "snapshot": signature(rows),
        "values": {key: current.get(key) for key in FIELDS},
        "version_count": len(rows),
    }


def apply(db, source, actor, request, title, snapshot, patch):
    request, title = identifier(request), text(title, 64)
    patch = validate(patch)
    if not isinstance(snapshot, str) or not re.fullmatch(r"[a-f0-9]{64}", snapshot):
        raise invalid("Invalid movie snapshot; reopen the editor")
    digest = hashlib.sha256(
        json.dumps(
            ["library_edit", source, actor, title, snapshot, patch], sort_keys=True
        ).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, title)
    if signature(rows) != snapshot:
        raise JournalError(
            "refresh_required", "This movie changed; reopen the editor and review again"
        )
    result = {"title_id": title, "updated_count": len(rows)}
    with db:
        for row in rows:
            enrichment = json.loads(row["enrichment"])
            reviewed = enrichment.setdefault("reviewed", {})
            reviewed.update(
                {key: value for key, value in patch.items() if key != "sort_title"}
            )
            reviewed["provider"] = "reviewed"
            reviewed["fetched_at"] = datetime.now(UTC).isoformat()
            encoded = json.dumps(enrichment)
            if len(encoded.encode()) > 512 * 1024:
                raise invalid("Reviewed metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=?,sort_title=? WHERE id=?",
                (encoded, patch.get("sort_title", row["sort_title"]), row["id"]),
            )
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result


def reset(db, source, actor, request, title, snapshot):
    """Restore scanned facts and stop background enrichment until explicit review."""
    request, title = identifier(request), text(title, 64)
    if not isinstance(snapshot, str) or not re.fullmatch(r"[a-f0-9]{64}", snapshot):
        raise invalid("Invalid movie snapshot; reopen the editor")
    digest = hashlib.sha256(
        json.dumps(["library_reset", source, actor, title, snapshot]).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, title)
    if signature(rows) != snapshot:
        raise JournalError(
            "refresh_required", "This movie changed; reopen the editor and review again"
        )
    result = {"title_id": title, "updated_count": len(rows)}
    with db:
        # Include temporarily unavailable editions so returning versions cannot
        # revive old overrides after the next catalog scan.
        updated = db.execute(
            "UPDATE library SET enrichment=?,sort_title=NULL "
            "WHERE source_id=? AND source_group=? AND purchase_match_pending=0",
            ('{"source_only":true}', source, rows[0]["source_group"]),
        )
        result["updated_count"] = updated.rowcount
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result

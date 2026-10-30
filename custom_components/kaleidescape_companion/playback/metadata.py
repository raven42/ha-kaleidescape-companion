"""Worker-only Library display snapshots and exact playback identity resolution."""

import json
import re

from ..core.preferences import excluded
from ..library.browse import PUBLIC_FIELDS, PURCHASE_SQL, group_metadata
from ..library.config import excluded_collections


def metadata_text(value, limit=1024):
    """Bound a display snapshot in UTF-8 bytes without splitting a character."""
    return str(value).encode("utf-8", "replace")[:limit].decode("utf-8", "ignore")


def snapshot(db, row):
    data = json.loads(row["data"])
    shared = group_metadata(db, row["source_id"], [row["source_group"]]).get(
        row["source_group"], {}
    )
    data = {
        **shared,
        **{key: value for key, value in data.items() if value not in (None, "", [])},
    }
    hidden = excluded_collections(excluded(db))
    purchased = db.execute(
        f"SELECT {PURCHASE_SQL} FROM library_titles t WHERE t.id=?", (row["id"],)
    ).fetchone()[0]
    for key, value in data.items():
        if isinstance(value, list):
            data[key] = [metadata_text(item, 100) for item in value[:20]]
        elif isinstance(value, str):
            data[key] = metadata_text(value)
    # Snapshot only display metadata, never origin, handles, paths or credentials.
    return {
        "title": row["title"],
        **{key: data.get(key) for key in PUBLIC_FIELDS},
        "collection": [
            "Watched" if item[0].casefold() == "played" else metadata_text(item[0], 100)
            for item in db.execute(
                "SELECT collection FROM library_memberships WHERE title_id=? "
                "ORDER BY collection LIMIT 20",
                (row["id"],),
            )
            if item[0].casefold() not in hidden
        ],
        "artwork_key": row["artwork_key"],
        "purchase_date": purchased,
        "added_on": row["first_seen"],
    }


def library_row(db, viewing, source):
    """Resolve one version in the configured source, never by movie name.

    The saved playback/browser data uses 26-N.0-S_HEX and N-S_HEX for the
    same version. Translate only this recognized spelling; other opaque IDs
    retain exact matching. Keep the original playback identity in storage.
    """
    if not source:
        return None
    if viewing["library_title_id"]:
        return db.execute(
            "SELECT * FROM library_titles WHERE source_id=? AND id=?",
            (source, viewing["library_title_id"]),
        ).fetchone()
    raw = viewing["raw_content_id"]
    if not raw:
        return None
    handles = [raw]
    match = re.fullmatch(r"26-([0-9]{1,3})\.0-(S_[0-9A-Fa-f]{8})", raw)
    if match:
        handles.append(f"{match[1]}-{match[2]}")
    placeholders = ",".join("?" for _ in handles)
    rows = db.execute(
        f"SELECT * FROM library_titles WHERE source_id=? "
        f"AND source_handle IN ({placeholders}) LIMIT 2",
        (source, *handles),
    ).fetchall()
    return rows[0] if len(rows) == 1 else None


def missing_changes(db, viewing, source):
    """Fill absent snapshot values; keep existing metadata and exact links."""
    row = library_row(db, viewing, source)
    if row is None:
        return {}
    existing = json.loads(viewing["library_metadata"])
    fresh = snapshot(db, row)
    merged = {**fresh, **existing}
    for key, value in fresh.items():
        if merged.get(key) in (None, "", [], {}) and value not in (None, "", [], {}):
            merged[key] = value
    changes = {}
    if not viewing["library_title_id"]:
        changes["library_title_id"] = row["id"]
    if merged != existing:
        changes["library_metadata"] = json.dumps(merged, ensure_ascii=False)
    return changes

"""Worker-only manual viewing admission using an exact cached Library version."""

import json
import re
from datetime import datetime, timedelta

from ..core.models import fields, invalid, seconds, timestamp
from ..core.preferences import excluded
from ..library.browse import PUBLIC_FIELDS, group_metadata
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
        "purchase_date": row["purchased_on"],
        "added_on": row["first_seen"],
    }


def prepare(db, source, data):
    if not isinstance(data, dict) or set(data) - {
        "library_title_id",
        "started_at",
        "status",
        "watched_seconds",
        "notes",
    }:
        raise invalid("Select a Library title and viewing time")
    key = data.get("library_title_id")
    if not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{64}", key):
        raise invalid("Select a Library version from the suggestions")
    row = db.execute(
        "SELECT * FROM library_titles WHERE id=? AND source_id=? AND available=1",
        (key, source),
    ).fetchone()
    if row is None:
        raise invalid("Selected Library version is no longer available")
    metadata = snapshot(db, row)
    runtime = metadata.get("duration_seconds")
    if type(runtime) not in (float, int) or not 0 < runtime <= 1_000_000_000:
        raise invalid("Sync Library runtime metadata before adding this viewing")
    started = timestamp(data.get("started_at"))
    status = data.get("status", "completed")
    watched = runtime if status == "completed" else seconds(data.get("watched_seconds"))
    if not 0 < watched <= runtime or (
        status == "completed" and "watched_seconds" in data
    ):
        raise invalid(
            "Partial viewing minutes must be positive and no longer than runtime"
        )
    try:
        ended = (
            datetime.fromisoformat(started) + timedelta(seconds=watched)
        ).isoformat(timespec="microseconds")
    except OverflowError as error:
        raise invalid("Viewing end time is out of range") from error
    return {
        **fields(
            {
                "title": row["title"],
                "started_at": started,
                "ended_at": ended,
                "duration_seconds": runtime,
                "watched_seconds": watched,
                "status": status,
                "source_id": row["source_id"],
                "raw_content_id": row["source_handle"],
                "notes": data.get("notes", ""),
            }
        ),
        "library_title_id": key,
        "library_metadata": json.dumps(metadata, ensure_ascii=False),
    }

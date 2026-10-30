"""Worker-only manual viewing admission using an exact cached Library version."""

import json
import re
from datetime import datetime, timedelta

from ..core.models import fields, invalid, seconds, timestamp
from .metadata import snapshot


def library_version(db, source, key):
    """Only an exact available scanned version can establish movie identity."""
    if not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{64}", key):
        raise invalid("Select a Library version from the suggestions")
    row = db.execute(
        "SELECT * FROM library WHERE id=? AND source_id=? AND available=1 "
        "AND purchase_match_pending=0",
        (key, source),
    ).fetchone()
    if row is None:
        raise invalid("Selected Library version is no longer available")
    return row


def correction(db, source, patch):
    """Replace attribution, preserving recorded playback identity and timing."""
    if set(patch) & {"title", "source_id", "player_id", "raw_content_id"}:
        raise invalid("Select a Library movie without overriding playback identifiers")
    row = library_version(db, source, patch.get("library_title_id"))
    changes = {key: value for key, value in patch.items() if key != "library_title_id"}
    return {
        **(fields(changes, partial=True) if changes else {}),
        "title": row["title"],
        "library_title_id": row["id"],
        "library_metadata": json.dumps(snapshot(db, row), ensure_ascii=False),
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
    row = library_version(db, source, key)
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

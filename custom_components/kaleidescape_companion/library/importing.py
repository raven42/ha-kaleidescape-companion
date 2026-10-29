"""Validate portable title-version metadata; never import device/cache paths."""

import hashlib
import json
import re
from datetime import UTC, date, datetime

from ..core.models import invalid, seconds, text, timestamp
from .browse import ARRAY_FIELDS, PUBLIC_FIELDS

TITLE_COLUMNS = {
    "id",
    "source_id",
    "source_handle",
    "source_group",
    "title",
    "data",
    "first_seen",
    "last_seen",
    "purchased_on",
}


def purchase_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise invalid("Expected a purchase date")
    parsed = date.fromisoformat(value)
    if not date(1990, 1, 1) <= parsed <= datetime.now(UTC).date():
        raise invalid("Purchase date is outside the supported range")
    return parsed.isoformat()


def title_record(row, now, decode):
    if not isinstance(row, dict):
        raise invalid("Expected a Library title")
    source = text(row.get("source_id"), 64)
    if not re.fullmatch(r"[a-f0-9]{64}", source):
        raise invalid("Invalid Library source identity")
    handle = text(row.get("source_handle"), 256)
    group = text(row.get("source_group"), 256)
    if any(c.isspace() or ord(c) < 32 for c in handle + group):
        raise invalid("Invalid Library version identity")
    expected = hashlib.sha256(f"{source}:{handle}".encode()).hexdigest()
    if row.get("id") != expected:
        raise invalid("Library version identity does not match its source")
    raw = row.get("data", {})
    if isinstance(raw, str):
        raw = decode(raw)
    if not isinstance(raw, dict):
        raise invalid("Expected Library metadata")
    data = {}
    for key in PUBLIC_FIELDS:
        value = raw.get(key)
        if value is None:
            continue
        if key in (*ARRAY_FIELDS, "formats"):
            if not isinstance(value, list) or len(value) > 100:
                raise invalid("Invalid Library metadata list")
            data[key] = [text(item, 500) for item in value]
        elif key == "year":
            if type(value) is not int or not 1800 <= value <= 9999:
                raise invalid("Invalid release year")
            data[key] = value
        elif key == "duration_seconds":
            data[key] = seconds(value)
        else:
            data[key] = text(value, 10000 if key == "synopsis" else 500, empty=True)
    purchased = row.get("purchased_on")
    return {
        "id": expected,
        "source_id": source,
        "source_handle": handle,
        "source_group": group,
        "title": text(row.get("title"), 500),
        "data": data,
        "first_seen": timestamp(row.get("first_seen", now)),
        "last_seen": timestamp(row.get("last_seen", now)),
        "purchased_on": purchase_date(purchased) if purchased is not None else None,
    }


def portable_titles(db):
    """Export no origin, fetch URL, cache key/path, receipt, or device state."""
    columns = ",".join(sorted(TITLE_COLUMNS))
    for row in db.execute(f"SELECT {columns} FROM library_titles ORDER BY id"):
        record = dict(row)
        record["data"] = {
            key: value
            for key, value in json.loads(record["data"]).items()
            if key in PUBLIC_FIELDS
        }
        yield record

"""Read compatible viewing snapshots as untrusted data, never executable SQL."""

import hashlib
import json
import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime

from .journal import (
    VIEWING_FIELDS,
    JournalError,
    fields,
    identifier,
    invalid,
    text,
    timestamp,
    validate_times,
)

MAX_IMPORT_BYTES = 32 * 1024 * 1024
MAX_IMPORT_ROWS = 10_000
IMPORT_SECONDS = 30
IMPORT_COLUMNS = VIEWING_FIELDS | {
    "id",
    "origin",
    "created_at",
    "updated_at",
    "revision",
    "deleted_at",
    "manual_fields",
    "completed_at",
    "completion_reason",
    "rule_version",
}


def _object(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise invalid("Import contains duplicate JSON keys")
        result[key] = value
    return result


def _constant(_value: str):
    raise invalid("Import contains non-finite JSON values")


def _sqlite_rows(payload: bytes, deadline: float) -> list[dict]:
    if not payload.startswith(b"SQLite format 3\x00"):
        raise invalid("Expected a SQLite export")
    with closing(sqlite3.connect(":memory:")) as db:
        db.setconfig(sqlite3.SQLITE_DBCONFIG_DEFENSIVE, True)
        db.setconfig(sqlite3.SQLITE_DBCONFIG_TRUSTED_SCHEMA, False)
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 65536)
        db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 64)
        db.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 4096)
        db.deserialize(payload)
        db.execute("PRAGMA query_only = ON")
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        # Reject views/virtual tables before asking SQLite to evaluate a row.
        kind = db.execute(
            "SELECT type FROM pragma_table_list WHERE schema='main' AND name='viewings'"
        ).fetchone()
        if not kind or kind[0] != "table":
            raise invalid("Import requires a regular viewings table")
        names = {row[1] for row in db.execute("PRAGMA table_info(viewings)")}
        if not {"id", "title", "started_at"} <= names:
            raise invalid("Import requires id, title, and started_at")
        columns = sorted(names & IMPORT_COLUMNS)
        db.set_authorizer(
            lambda action, table, _column, _database, _source: (
                sqlite3.SQLITE_OK
                if action == sqlite3.SQLITE_SELECT
                or (action == sqlite3.SQLITE_READ and table == "viewings")
                else sqlite3.SQLITE_DENY
            )
        )
        db.row_factory = sqlite3.Row
        selected = ", ".join(f'"{name}"' for name in columns)
        return [
            dict(row)
            for row in db.execute(
                f"SELECT {selected} FROM viewings LIMIT ?", (MAX_IMPORT_ROWS + 1,)
            )
        ]


def _record(row: dict, now: str) -> dict:
    if not isinstance(row, dict) or not {"id", "title", "started_at"} <= row.keys():
        raise invalid("Every viewing requires id, title, and started_at")
    data = fields({key: value for key, value in row.items() if key in VIEWING_FIELDS})
    validate_times(data)
    origin = row.get("origin", "manual")
    revision = row.get("revision", 1)
    if (
        origin not in ("manual", "observed")
        or type(revision) is not int
        or not 1 <= revision <= 1_000_000_000
    ):
        raise invalid("Invalid viewing origin/revision")
    corrections = row.get("manual_fields", [])
    if isinstance(corrections, str):
        corrections = json.loads(
            corrections, object_pairs_hook=_object, parse_constant=_constant
        )
    if (
        not isinstance(corrections, list)
        or len(corrections) > len(VIEWING_FIELDS)
        or any(
            not isinstance(key, str) or key not in VIEWING_FIELDS for key in corrections
        )
    ):
        raise invalid("Invalid correction fields")
    rule = row.get("rule_version")
    if rule is not None and (type(rule) is not int or not 1 <= rule <= 1_000_000):
        raise invalid("Invalid completion rule")
    updated = timestamp(row.get("updated_at", now))
    completed = data["status"] == "completed"
    reason = row.get("completion_reason")
    return {
        "id": identifier(row["id"]),
        **data,
        "title_search": data["title"].casefold(),
        "origin": origin,
        "created_at": timestamp(row.get("created_at", now)),
        "updated_at": updated,
        "revision": revision,
        "deleted_at": timestamp(row["deleted_at"])
        if row.get("deleted_at") is not None
        else None,
        "manual_fields": json.dumps(sorted(set(corrections))),
        "completed_at": timestamp(
            row.get("completed_at") or data["ended_at"] or updated
        )
        if completed
        else None,
        "completion_reason": text(reason, 64)
        if reason is not None
        else ("manual" if completed else None),
        "rule_version": rule,
    }


def parse_import(payload: bytes, import_format: str) -> list[dict]:
    """Validate the complete bounded payload before accepting any database writes."""
    if (
        not payload
        or len(payload) > MAX_IMPORT_BYTES
        or import_format not in {"json", "sqlite"}
    ):
        raise invalid("Import must be a JSON/SQLite file of at most 32 MiB")
    deadline = time.monotonic() + IMPORT_SECONDS
    try:
        if import_format == "sqlite":
            rows = _sqlite_rows(payload, deadline)
        else:
            document = json.loads(
                payload.decode("utf-8-sig"),
                object_pairs_hook=_object,
                parse_constant=_constant,
            )
            rows = document.get("viewings") if isinstance(document, dict) else document
        if not isinstance(rows, list) or len(rows) > MAX_IMPORT_ROWS:
            raise invalid("Import requires at most 10000 viewings")
        now = datetime.now(UTC).isoformat(timespec="microseconds")
        records, seen = [], set()
        for row in rows:
            if time.monotonic() > deadline:
                raise invalid("Import validation exceeded its time budget")
            record = _record(row, now)
            if record["id"] in seen:
                raise invalid("Import contains duplicate viewing IDs")
            seen.add(record["id"])
            records.append(record)
        return records
    except (
        sqlite3.Error,
        ValueError,
        TypeError,
        RecursionError,
        UnicodeError,
    ) as error:
        raise invalid("Import is not a compatible viewing export") from error


def import_viewings(
    db,
    payload: bytes,
    import_format: str,
    request_id: str,
    revision: int,
    actor_id: str | None,
) -> dict:
    """Merge new IDs atomically; retain no imported executable or operational state."""
    fingerprint = hashlib.sha256(
        json.dumps(
            [
                "import",
                import_format,
                hashlib.sha256(payload).hexdigest(),
                revision,
                actor_id,
            ]
        ).encode()
    ).hexdigest()
    if cached := db.execute(
        "SELECT * FROM requests WHERE request_id = ?", (request_id,)
    ).fetchone():
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID was used for different data or actor"
            )
        return json.loads(cached["response"])
    records = parse_import(payload, import_format)
    imported, skipped = 0, 0
    with db:
        current = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        if current != revision:
            raise JournalError("conflict", "Database changed; refresh before importing")
        for record in records:
            if db.execute(
                "SELECT 1 FROM viewings WHERE id = ?", (record["id"],)
            ).fetchone():
                skipped += 1
                continue
            columns = ", ".join(record)
            placeholders = ", ".join("?" for _ in record)
            db.execute(
                f"INSERT INTO viewings ({columns}) VALUES ({placeholders})",
                tuple(record.values()),
            )
            imported += 1
        db.execute("UPDATE schema_metadata SET revision = revision + 1")
        result = {
            "imported_count": imported,
            "skipped_count": skipped,
            "revision": current + 1,
        }
        db.execute(
            "INSERT INTO requests VALUES (?, ?, ?)",
            (request_id, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO import_audit VALUES (?, ?, ?, ?, ?, ?)",
            (
                request_id,
                actor_id,
                imported,
                skipped,
                current + 1,
                datetime.now(UTC).isoformat(),
            ),
        )
    return result

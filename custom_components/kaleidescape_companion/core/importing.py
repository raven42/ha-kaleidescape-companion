"""Read compatible viewing snapshots as untrusted data, never executable SQL."""

import json
import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime

from ..library.importing import TITLE_COLUMNS, purchase_date, title_record
from ..library.purchases import PURCHASE_COLUMNS, purchase_record
from .models import (
    VIEWING_FIELDS,
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


def _sqlite_bundle(payload: bytes, deadline: float) -> dict:
    if not payload.startswith(b"SQLite format 3\x00"):
        raise invalid("Expected a SQLite export")
    allowed = {
        "viewings": IMPORT_COLUMNS,
        "library_titles": TITLE_COLUMNS,
        "library_purchases": PURCHASE_COLUMNS,
        "library_purchase_dates": {"title_id", "purchased_on"},
    }
    with closing(sqlite3.connect(":memory:")) as db:
        db.setconfig(sqlite3.SQLITE_DBCONFIG_DEFENSIVE, True)
        db.setconfig(sqlite3.SQLITE_DBCONFIG_TRUSTED_SCHEMA, False)
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 65536)
        db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 64)
        db.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 4096)
        db.deserialize(payload)
        db.execute("PRAGMA query_only = ON")
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        tables = dict(
            db.execute("SELECT name,type FROM pragma_table_list WHERE schema='main'")
        )
        columns = {}
        for name, keys in allowed.items():
            if name not in tables:
                continue
            if tables[name] != "table":
                raise invalid("Import requires regular tables")
            names = {row[1] for row in db.execute(f"PRAGMA table_info({name})")}
            required = {
                "viewings": {"id", "title", "started_at"},
                "library_titles": {
                    "id",
                    "title",
                    "source_id",
                    "source_handle",
                    "source_group",
                },
                "library_purchases": {"id", "title", "purchased_on"},
                "library_purchase_dates": {"title_id", "purchased_on"},
            }[name]
            if not required <= names:
                raise invalid("Import is missing required columns")
            columns[name] = sorted(names & keys)
        if not ({"viewings", "library_titles", "library_purchases"} & columns.keys()):
            raise invalid("Import requires viewing, Library title or purchase records")
        db.set_authorizer(
            lambda action, table, _column, _database, _source: (
                sqlite3.SQLITE_OK
                if action == sqlite3.SQLITE_SELECT
                or (action == sqlite3.SQLITE_READ and table in columns)
                else sqlite3.SQLITE_DENY
            )
        )
        db.row_factory = sqlite3.Row
        result = {}
        for name, keys in columns.items():
            selected = ",".join(f'"{key}"' for key in keys)
            result[name] = [
                dict(row)
                for row in db.execute(
                    f"SELECT {selected} FROM {name} LIMIT ?", (MAX_IMPORT_ROWS + 1,)
                )
            ]
        return result


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


def decode_json(value):
    return json.loads(value, object_pairs_hook=_object, parse_constant=_constant)


def parse_bundle(payload: bytes, import_format: str) -> dict:
    """Normalize bounded portable records, including legacy purchase-date tables."""
    if (
        not payload
        or len(payload) > MAX_IMPORT_BYTES
        or import_format not in {"json", "sqlite"}
    ):
        raise invalid("Import must be a JSON/SQLite file of at most 32 MiB")
    deadline = time.monotonic() + IMPORT_SECONDS
    try:
        document = (
            _sqlite_bundle(payload, deadline)
            if import_format == "sqlite"
            else decode_json(payload.decode("utf-8-sig"))
        )
        if isinstance(document, list):
            purchases = bool(document) and all(
                isinstance(row, dict)
                and {"title", "purchased_on"} <= row.keys()
                and "started_at" not in row
                for row in document
            )
            document = {"library_purchases" if purchases else "viewings": document}
        if (
            not isinstance(document, dict)
            or not {"viewings", "library_titles", "library_purchases"} & document.keys()
        ):
            raise invalid("Import requires viewing, Library title or purchase records")
        now = datetime.now(UTC).isoformat(timespec="microseconds")
        result = {}
        for table, normalize in (
            ("viewings", lambda row: _record(row, now)),
            ("library_titles", lambda row: title_record(row, now, decode_json)),
            ("library_purchases", purchase_record),
        ):
            rows = document.get(table, [])
            if not isinstance(rows, list) or len(rows) > MAX_IMPORT_ROWS:
                raise invalid("Import requires at most 10000 records")
            seen, records = set(), []
            for row in rows:
                if time.monotonic() > deadline:
                    raise invalid("Import validation exceeded its time budget")
                record = normalize(row)
                if record["id"] in seen:
                    raise invalid("Import contains duplicate record IDs")
                seen.add(record["id"])
                records.append(record)
            result[table] = records
        if sum(map(len, result.values())) > MAX_IMPORT_ROWS:
            raise invalid("Import requires at most 10000 records")
        legacy = document.get("library_purchase_dates", [])
        if not isinstance(legacy, list) or len(legacy) > MAX_IMPORT_ROWS:
            raise invalid("Too many legacy purchase dates")
        dates = {}
        for row in legacy:
            if not isinstance(row, dict) or set(row) != {"title_id", "purchased_on"}:
                raise invalid("Invalid legacy purchase date")
            key = row["title_id"]
            if not isinstance(key, str) or key in dates:
                raise invalid("Duplicate legacy purchase date")
            dates[key] = purchase_date(row["purchased_on"])
        title_ids = {row["id"] for row in result["library_titles"]}
        if dates.keys() - title_ids:
            raise invalid("Legacy purchase date has no title")
        for row in result["library_titles"]:
            if row["id"] in dates and row["purchased_on"] is None:
                row["purchased_on"] = dates[row["id"]]
        return result
    except (
        sqlite3.Error,
        ValueError,
        TypeError,
        RecursionError,
        UnicodeError,
    ) as error:
        raise invalid("Import is not a compatible journal/Library export") from error

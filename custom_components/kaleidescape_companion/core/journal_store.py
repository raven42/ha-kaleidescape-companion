"""Worker-only viewing CRUD, literal search and revision-bound pagination.

The repository owns the connection, admission and backup/transfer barriers.
These functions run on that worker and preserve receipts and audit atomically.
"""

import base64
import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from .models import JournalError, identifier, invalid, text, validate_times


def record(row: sqlite3.Row) -> dict:
    """Keep storage-only search and correction bookkeeping out of API records."""
    result = dict(row)
    result.pop("title_search")
    result.pop("manual_fields", None)
    return result


def get_viewing(db, viewing_id: str, include_deleted: bool = False) -> dict:
    """Read one viewing; tombstones require an explicit internal opt-in."""
    row = db.execute(
        "SELECT * FROM viewings WHERE id = ? AND (deleted_at IS NULL OR ?)",
        (viewing_id, include_deleted),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Viewing does not exist")
    return record(row)


def list_viewings(
    db, query: str, viewing_status: str | None, limit: int, cursor: str | None
) -> dict:
    """Bind keyset pagination to this dataset, revision and literal filters."""
    meta = db.execute("SELECT dataset_id, revision FROM schema_metadata").fetchone()
    binding = [meta["dataset_id"], meta["revision"], query, viewing_status]
    predicates = ["deleted_at IS NULL", "instr(title_search, ?) > 0"]
    values: list[Any] = [query]
    if viewing_status:
        predicates.append("status = ?")
        values.append(viewing_status)
    if cursor:
        try:
            decoded = json.loads(
                base64.b64decode(cursor, altchars=b"-_", validate=True)
            )
            if not isinstance(decoded, dict) or set(decoded) != {
                "binding",
                "after",
            }:
                raise ValueError
            after = decoded["after"]
            if not isinstance(after, list) or len(after) != 2:
                raise ValueError
            # Validate before passing values to SQLite, including nested values.
            timestamp_key = text(after[0], 64)
            record_key = identifier(after[1])
            if decoded["binding"] != binding:
                raise JournalError(
                    "refresh_required", "Journal changed; restart pagination"
                )
        except (ValueError, TypeError, KeyError, UnicodeError) as error:
            raise invalid("Invalid pagination cursor") from error
        predicates.append("(started_at, id) < (?, ?)")
        values.extend((timestamp_key, record_key))
    rows = db.execute(
        f"SELECT * FROM viewings WHERE {' AND '.join(predicates)} "
        "ORDER BY started_at DESC, id DESC LIMIT ?",
        (*values, limit + 1),
    ).fetchall()
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {
                    "binding": binding,
                    "after": [last["started_at"], last["id"]],
                }
            ).encode()
        ).decode()
    return {
        "dataset_id": meta["dataset_id"],
        "revision": meta["revision"],
        "items": [record(row) for row in rows[:limit]],
        "next_cursor": next_cursor,
    }


def mutate(
    db,
    operation: str,
    request_id: str,
    data: dict,
    actor_id: str | None,
    paused: bool = False,
) -> dict:
    """Apply or replay a viewing change with actor checks and one transaction."""
    fingerprint = hashlib.sha256(
        json.dumps([operation, data], sort_keys=True, allow_nan=False).encode()
    ).hexdigest()
    if cached := db.execute(
        "SELECT requests.fingerprint, requests.response, manual_audit.request_id "
        "AS audited_request, manual_audit.actor_id FROM requests "
        "LEFT JOIN manual_audit USING (request_id) WHERE requests.request_id = ?",
        (request_id,),
    ).fetchone():
        if cached["fingerprint"] != fingerprint or (
            cached["audited_request"] is not None and cached["actor_id"] != actor_id
        ):
            raise JournalError(
                "conflict", "Request UUID was used for different data or actor"
            )
        response = json.loads(cached["response"])
        if response.get("purged"):
            raise JournalError(
                "not_found", "This request's viewing was permanently purged"
            )
        return response
    if paused:
        raise JournalError("backup_in_progress", "Journal writes paused for backup")
    now = datetime.now(UTC).isoformat(timespec="microseconds")
    with db:
        if operation == "create":
            record = {
                "id": str(uuid4()),
                **data,
                "origin": "manual",
                "created_at": now,
                "updated_at": now,
                "revision": 1,
                "deleted_at": None,
                "completed_at": (data["ended_at"] or now)
                if data["status"] == "completed"
                else None,
                "completion_reason": "manual"
                if data["status"] == "completed"
                else None,
                "rule_version": None,
            }
            stored = {**record, "title_search": record["title"].casefold()}
            columns = ", ".join(stored)
            placeholders = ", ".join("?" for _ in stored)
            db.execute(
                f"INSERT INTO viewings ({columns}) VALUES ({placeholders})",
                tuple(stored.values()),
            )
        else:
            record = get_viewing(
                db, data["viewing_id"], data.get("include_deleted", False)
            )
            if record["revision"] != data["expected_revision"]:
                raise JournalError("conflict", "Viewing was changed; reload it first")
            patch = data.get("patch", {})
            record.update(patch)
            if "status" in patch:
                record["completion_reason"] = (
                    "manual" if patch["status"] == "completed" else None
                )
                record["completed_at"] = (
                    (record["ended_at"] or now)
                    if patch["status"] == "completed"
                    else None
                )
            validate_times(record)
            record["revision"] += 1
            record["updated_at"] = now
            if operation == "delete":
                record["deleted_at"] = now
            stored = {**record, "title_search": record["title"].casefold()}
            corrections = json.loads(
                db.execute(
                    "SELECT manual_fields FROM viewings WHERE id = ?",
                    (record["id"],),
                ).fetchone()[0]
            )
            stored["manual_fields"] = json.dumps(
                sorted(set(corrections) | patch.keys())
            )
            updates = ", ".join(f"{key} = ?" for key in stored if key != "id")
            db.execute(
                f"UPDATE viewings SET {updates} WHERE id = ?",
                (
                    *[value for key, value in stored.items() if key != "id"],
                    record["id"],
                ),
            )
        db.execute("UPDATE schema_metadata SET revision = revision + 1")
        result = {
            "viewing": record,
            "revision": db.execute("SELECT revision FROM schema_metadata").fetchone()[
                0
            ],
        }
        db.execute(
            "INSERT INTO requests VALUES (?, ?, ?)",
            (request_id, fingerprint, json.dumps(result, allow_nan=False)),
        )
        db.execute(
            "INSERT INTO manual_audit VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                request_id,
                actor_id,
                operation,
                record["id"],
                record["revision"],
                result["revision"],
                now,
            ),
        )
    return result

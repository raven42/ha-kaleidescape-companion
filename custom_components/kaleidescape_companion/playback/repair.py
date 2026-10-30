"""Reviewed, local-only repair of missing Journal Library snapshots."""

import hashlib
import json
import re
import time
from datetime import UTC, datetime

from ..core.database_mutations import mutation_fingerprint, replay
from ..core.models import JournalError, invalid
from .metadata import library_row, missing_changes

MAX_VIEWINGS = 10_000
REPAIR_SECONDS = 10


def candidates(db, source, deadline):
    """Stream bounded rows on the single worker; active sessions are left alone."""
    rows = db.execute(
        "SELECT v.*, EXISTS(SELECT 1 FROM sessions s WHERE s.viewing_id=v.id "
        "AND s.closed_at IS NULL) AS active FROM viewings v "
        "WHERE deleted_at IS NULL ORDER BY v.id LIMIT ?",
        (MAX_VIEWINGS + 1,),
    )
    for index, row in enumerate(rows):
        if index == MAX_VIEWINGS or time.monotonic() > deadline:
            raise JournalError("repair_limit", "Journal metadata repair limit reached")
        if row["active"]:
            yield row, {}, "active"
            continue
        changes = missing_changes(db, row, source)
        state = (
            "updated"
            if changes
            else "unchanged"
            if library_row(db, row, source) is not None
            else "unmatched"
        )
        yield row, changes, state


def preview(db, source, *, deadline=None):
    """Return counts and an opaque review token, never movie content."""
    deadline = deadline if deadline is not None else time.monotonic() + REPAIR_SECONDS
    dataset = db.execute("SELECT dataset_id FROM schema_metadata").fetchone()[0]
    digest = hashlib.sha256(json.dumps([dataset, source]).encode())
    counts = dict.fromkeys(("updated", "unchanged", "unmatched", "active"), 0)
    for row, changes, state in candidates(db, source, deadline):
        counts[state] += 1
        digest.update(
            json.dumps(
                [row["id"], state, row["revision"] if changes else None, changes],
                sort_keys=True,
            ).encode()
        )
    return {
        "token": digest.hexdigest(),
        **{f"{key}_count": n for key, n in counts.items()},
    }


def apply(db, source, request, actor, token, *, paused=False, busy=False):
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise invalid("Review the Journal metadata repair first")
    fingerprint = mutation_fingerprint(
        actor,
        {
            "operation": "repair_library_metadata",
            "source": source,
            "token": token,
        },
    )
    cached = replay(db, request, fingerprint)
    if cached is not None:
        return cached
    if paused:
        raise JournalError("backup_in_progress", "Journal writes paused for backup")
    if busy:
        raise JournalError("busy", "Wait for the active transfer before repairing")
    deadline = time.monotonic() + REPAIR_SECONDS
    with db:
        plan = preview(db, source, deadline=deadline)
        if plan["token"] != token:
            raise JournalError(
                "conflict", "Journal or Library changed; review the repair again"
            )
        now = datetime.now(UTC).isoformat()
        for row, changes, _ in candidates(db, source, deadline):
            if changes:
                assignments = ",".join(f"{key}=?" for key in changes)
                db.execute(
                    f"UPDATE viewings SET {assignments},revision=revision+1,"
                    "updated_at=? WHERE id=?",
                    (*changes.values(), now, row["id"]),
                )
        if plan["updated_count"]:
            db.execute("UPDATE schema_metadata SET revision=revision+1")
        revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        result = {key: value for key, value in plan.items() if key != "token"}
        result["revision"] = revision
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO database_audit VALUES (?,?,?,?,?,?,?,?)",
            (
                request,
                actor,
                "repair_library_metadata",
                "viewings",
                plan["updated_count"],
                json.dumps(["library_metadata", "library_title_id"]),
                revision,
                now,
            ),
        )
    return result

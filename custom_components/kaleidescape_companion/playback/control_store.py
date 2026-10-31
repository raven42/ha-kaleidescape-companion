"""Worker-only, actor-bound no-replay barriers for explicit device writes."""

import hashlib
import json
import re
from datetime import UTC, datetime

from ..core.models import JournalError, identifier, invalid


def request_fingerprint(actor, token):
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise invalid("Invalid control review")
    return hashlib.sha256(json.dumps([actor, token]).encode()).hexdigest()


def lookup(db, request, actor, token):
    identifier(request)
    expected = request_fingerprint(actor, token)
    row = db.execute(
        "SELECT fingerprint,response FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if row is None:
        return None
    if row["fingerprint"] != expected:
        raise JournalError(
            "conflict", "Control request belongs to another intent or actor"
        )
    return json.loads(row["response"])


def pending(db):
    return [
        dict(row)
        for row in db.execute(
            "SELECT request_id,actor_id,player_serial,operation,created_at "
            "FROM playback_controls "
            "WHERE status IN ('sending','uncertain') ORDER BY created_at LIMIT 100"
        )
    ]


def begin(db, request, actor, token, serial, operation):
    cached = lookup(db, request, actor, token)
    if cached is not None:
        return cached
    if db.execute(
        "SELECT 1 FROM playback_controls WHERE player_serial=? "
        "AND status IN ('sending','uncertain')",
        (serial,),
    ).fetchone():
        raise JournalError(
            "control_uncertain", "Review the previous uncertain device command"
        )
    if db.execute("SELECT count(*) FROM playback_controls").fetchone()[0] >= 10000:
        raise JournalError("control_limit", "Control receipt history reached its limit")
    result = {
        "request_id": request,
        "outcome": "unconfirmed",
        "acknowledged": False,
        "exact_version_confirmed": False,
    }
    stamp = datetime.now(UTC).isoformat()
    with db:
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (
                request,
                request_fingerprint(actor, token),
                json.dumps(result),
            ),
        )
        db.execute(
            "INSERT INTO playback_controls VALUES (?,?,?,?,'sending',?,?,NULL)",
            (request, actor, serial, operation, stamp, stamp),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return None


def finish(db, request, result, status):
    with db:
        db.execute(
            "UPDATE playback_controls SET status=?,updated_at=? WHERE request_id=?",
            (status, datetime.now(UTC).isoformat(), request),
        )
        db.execute(
            "UPDATE requests SET response=? WHERE request_id=?",
            (json.dumps(result), request),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return result


def acknowledge(db, request, actor):
    identifier(request)
    with db:
        db.execute(
            "UPDATE playback_controls SET status='reviewed',updated_at=?,reviewed_by=? "
            "WHERE request_id=? AND status='uncertain'",
            (datetime.now(UTC).isoformat(), actor, request),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return {"pending": pending(db)}


def recover(db):
    with db:
        changed = db.execute(
            "UPDATE playback_controls SET status='uncertain' WHERE status='sending'"
        ).rowcount
        if changed:
            db.execute("UPDATE schema_metadata SET revision=revision+1")


def library_version(db, source, title_id):
    if not isinstance(title_id, str) or not re.fullmatch(r"[a-f0-9]{64}", title_id):
        raise invalid("Select an exact Library version")
    row = db.execute(
        "SELECT id,source_id,source_handle,title,data FROM library "
        "WHERE id=? AND source_id=? AND available=1 AND purchase_match_pending=0",
        (title_id, source),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Library version is unavailable")
    return dict(row)

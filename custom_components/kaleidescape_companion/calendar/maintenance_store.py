"""Worker-only reconciliation snapshots, links, quarantine and durable write intents."""

import hashlib
import json
from datetime import datetime
from uuid import uuid4

from ..core.models import JournalError, invalid
from .store import now, projection

LIMIT = 10000
GRACE_SECONDS = 600


def rows(db, window, *, brief=False):
    result = db.execute(
        "SELECT "
        + ("id,revision" if brief else "*")
        + " FROM viewings WHERE julianday(started_at)>=julianday(?) "
        "AND julianday(started_at)<julianday(?) ORDER BY id LIMIT ?",
        (*window, LIMIT + 1),
    ).fetchall()
    if len(result) > LIMIT:
        raise invalid("Full Sync supports at most 10000 viewings in its age window")
    return result


def signature(items):
    return hashlib.sha256(
        json.dumps([(r["id"], r["revision"]) for r in items]).encode()
    ).hexdigest()


def dispatch(db, operation, config, *args):
    scope = config["scope"]
    if operation == "snapshot":
        items = rows(db, args[0])
        return {
            "signature": signature(items),
            "rows": [
                projection(db, r, config)
                for r in items
                if r["status"] == "completed" and r["deleted_at"] is None
            ],
            "links": dict(
                db.execute(
                    "SELECT viewing_id,uid FROM calendar_managed_events WHERE scope=?",
                    (scope,),
                )
            ),
        }
    if operation == "signature":
        return signature(rows(db, args[0], brief=True))
    if operation == "status":
        uncertain = db.execute(
            "SELECT count(*) FROM calendar_reconcile_intents WHERE scope=? "
            "AND state IN ('sending','uncertain')",
            (scope,),
        ).fetchone()[0]
        quarantine = db.execute(
            "SELECT count(*),min(first_seen) FROM calendar_reconcile_candidates "
            "WHERE scope=?",
            (scope,),
        ).fetchone()
        return {
            "uncertain": uncertain,
            "review_token": hashlib.sha256(
                json.dumps(
                    [
                        tuple(r)
                        for r in db.execute(
                            "SELECT request_id,digest FROM calendar_reconcile_intents "
                            "WHERE scope=? AND state IN ('sending','uncertain') "
                            "ORDER BY request_id",
                            (scope,),
                        )
                    ]
                ).encode()
            ).hexdigest(),
            "quarantined": quarantine[0],
            "first_candidate": quarantine[1],
        }
    if operation == "candidates":
        expected, candidates, timestamp = args
        eligible = []
        with db:
            existing = {
                r["uid"]: r
                for r in db.execute(
                    "SELECT * FROM calendar_reconcile_candidates WHERE scope=?",
                    (scope,),
                )
            }
            db.execute(
                "DELETE FROM calendar_reconcile_candidates WHERE scope=?", (scope,)
            )
            for uid, digest in candidates:
                old = existing.get(uid)
                same = old and old["digest"] == digest and old["signature"] == expected
                first = old["first_seen"] if same else timestamp
                count = old["observations"] + 1 if same else 1
                db.execute(
                    "INSERT INTO calendar_reconcile_candidates VALUES (?,?,?,?,?,?,?)",
                    (scope, uid, digest, expected, first, timestamp, count),
                )
                if (
                    count >= 2
                    and (
                        datetime.fromisoformat(timestamp)
                        - datetime.fromisoformat(first)
                    ).total_seconds()
                    >= GRACE_SECONDS
                ):
                    eligible.append(uid)
        return eligible
    if operation == "reserve":
        window, expected, kind, viewing, uid, digest = args
        if kind not in {"create", "update", "delete"}:
            raise invalid("Invalid calendar write")
        if kind == "delete":
            candidate = db.execute(
                "SELECT * FROM calendar_reconcile_candidates WHERE scope=? AND uid=?",
                (scope, uid),
            ).fetchone()
            if (
                not candidate
                or candidate["digest"] != digest
                or candidate["observations"] < 2
                or (
                    datetime.fromisoformat(candidate["last_seen"])
                    - datetime.fromisoformat(candidate["first_seen"])
                ).total_seconds()
                < GRACE_SECONDS
            ):
                raise JournalError(
                    "not_ready", "Calendar deletion is still quarantined"
                )
        if signature(rows(db, window, brief=True)) != expected:
            raise JournalError("refresh_required", "Journal changed during Full Sync")
        if dispatch(db, "status", config)["uncertain"]:
            raise JournalError("not_ready", "An uncertain calendar write needs review")
        request = str(uuid4())
        with db:
            count = db.execute(
                "SELECT count(*) FROM calendar_reconcile_intents"
            ).fetchone()[0]
            if count >= LIMIT:
                # Confirmed receipts are a bounded recent audit, not a retry barrier.
                db.execute(
                    "DELETE FROM calendar_reconcile_intents WHERE request_id IN "
                    "(SELECT request_id FROM calendar_reconcile_intents "
                    "WHERE state IN ('confirmed','reviewed','cancelled') "
                    "ORDER BY updated_at LIMIT 1000)"
                )
                if (
                    db.execute(
                        "SELECT count(*) FROM calendar_reconcile_intents"
                    ).fetchone()[0]
                    >= LIMIT
                ):
                    raise JournalError(
                        "storage_limit", "Calendar receipt limit reached"
                    )
            db.execute(
                "INSERT INTO calendar_reconcile_intents VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    request,
                    scope,
                    kind,
                    viewing,
                    uid,
                    digest,
                    "sending",
                    now(),
                    now(),
                    None,
                ),
            )
        return request
    if operation == "finish":
        request, state = args
        if state not in {"confirmed", "uncertain", "cancelled"}:
            raise invalid("Invalid calendar outcome")
        with db:
            intent = db.execute(
                "SELECT uid,operation FROM calendar_reconcile_intents "
                "WHERE request_id=? AND scope=?",
                (request, scope),
            ).fetchone()
            if intent and state == "confirmed" and intent["operation"] == "delete":
                db.execute(
                    "DELETE FROM calendar_reconcile_candidates WHERE scope=? AND uid=?",
                    (scope, intent["uid"]),
                )
                db.execute(
                    "DELETE FROM calendar_managed_events WHERE scope=? AND uid=?",
                    (scope, intent["uid"]),
                )
            db.execute(
                "UPDATE calendar_reconcile_intents SET state=?,updated_at=? "
                "WHERE request_id=? AND scope=?",
                (state, now(), request, scope),
            )
        return None
    if operation == "pending":
        return [
            dict(r)
            for r in db.execute(
                "SELECT * FROM calendar_reconcile_intents WHERE scope=? "
                "AND state IN ('sending','uncertain')",
                (scope,),
            )
        ]
    if operation == "link":
        viewing, uid = args
        existing = db.execute(
            "SELECT uid FROM calendar_managed_events WHERE scope=? AND viewing_id=?",
            (scope, viewing),
        ).fetchone()
        if existing and existing[0] == uid:
            return None
        with db:
            db.execute(
                "DELETE FROM calendar_managed_events WHERE scope=? AND uid=?",
                (scope, uid),
            )
            db.execute(
                "INSERT OR REPLACE INTO calendar_managed_events VALUES (?,?,?)",
                (scope, viewing, uid),
            )
        return None
    if operation == "acknowledge":
        if args[1] != dispatch(db, "status", config)["review_token"]:
            raise JournalError(
                "conflict", "Calendar attempts changed; inspect them again"
            )
        with db:
            db.execute(
                "UPDATE calendar_reconcile_intents SET state='reviewed',"
                "updated_at=?,reviewed_by=? WHERE scope=? "
                "AND state IN ('sending','uncertain')",
                (now(), args[0], scope),
            )
        return None
    raise invalid("Invalid Full Sync operation")

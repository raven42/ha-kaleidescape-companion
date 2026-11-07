"""Revision-bound, reversible corrections to private purchase records."""

import hashlib
import json
import re
import time
from datetime import UTC, datetime
from uuid import uuid4

from ..library import purchases
from .maintenance import row_token
from .models import JournalError, invalid

REVIEW_SECONDS = 600
RECORD_FIELDS = ("id", *purchases.INVOICE_FIELDS, "imported_at", "library_id", "issue")
EDIT_FIELDS = frozenset((*purchases.INVOICE_FIELDS, "library_id"))
GROUP_FIELDS = (
    "id",
    "purchased_on",
    "purchase_price",
    "retail_price",
    "order_id",
    "href",
    "purchase_information_unavailable",
)


def _check_group(db, state):
    """Check private group evidence before applying or reversing a correction."""
    if not isinstance(state, dict) or set(state) != {
        "source_id",
        "source_group",
        "rows",
    }:
        raise JournalError("conflict", "Purchase group evidence is invalid")
    rows = state["rows"]
    if (
        not isinstance(state["source_id"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", state["source_id"])
        or not isinstance(state["source_group"], str)
        or not 0 < len(state["source_group"]) <= 256
        or not isinstance(rows, list)
        or len(rows) > purchases.MAX_HISTORY
    ):
        raise JournalError("conflict", "Purchase group evidence is invalid")
    current = [
        dict(row)
        for row in db.execute(
            "SELECT id,purchased_on,purchase_price,retail_price,order_id,href,"
            "purchase_information_unavailable FROM library WHERE source_id=? "
            "AND source_group=? AND purchase_match_pending=0 ORDER BY id",
            (state["source_id"], state["source_group"]),
        )
    ]
    if current != rows:
        raise JournalError("conflict", "Purchase group changed; review it again")


def _write_group(db, state):
    for row in state["rows"]:
        if not isinstance(row, dict) or set(row) != set(GROUP_FIELDS):
            raise JournalError("conflict", "Purchase group evidence is invalid")
        db.execute(
            "UPDATE library SET purchased_on=?,purchase_price=?,retail_price=?,"
            "order_id=?,href=?,purchase_information_unavailable=? WHERE id=? "
            "AND source_id=? AND source_group=? AND purchase_match_pending=0",
            (
                *(row[key] for key in GROUP_FIELDS[1:]),
                row["id"],
                state["source_id"],
                state["source_group"],
            ),
        )


def _check_group_transition(before, after):
    if not isinstance(after, dict) or set(after) != {
        "source_id",
        "source_group",
        "rows",
    }:
        raise JournalError("conflict", "Purchase group evidence is invalid")
    if (before["source_id"], before["source_group"]) != (
        after["source_id"],
        after["source_group"],
    ):
        raise JournalError("conflict", "Purchase group evidence is invalid")
    if not isinstance(after["rows"], list) or len(before["rows"]) != len(after["rows"]):
        raise JournalError("conflict", "Purchase group evidence is invalid")
    if any(
        not isinstance(a, dict)
        or not isinstance(b, dict)
        or set(a) != set(GROUP_FIELDS)
        or set(b) != set(GROUP_FIELDS)
        or a["id"] != b["id"]
        or type(b["purchase_information_unavailable"]) is not int
        or b["purchase_information_unavailable"] not in (0, 1)
        or any(
            b[key] is not None and not isinstance(b[key], str)
            for key in GROUP_FIELDS[1:-1]
        )
        for a, b in zip(before["rows"], after["rows"], strict=True)
    ):
        raise JournalError("conflict", "Purchase group evidence is invalid")


def _record(db, purchase_id):
    row = db.execute(
        "SELECT * FROM purchase_records WHERE id=?", (purchase_id,)
    ).fetchone()
    return {key: row[key] for key in RECORD_FIELDS} if row else None


def _owner(db, record):
    if not record or not record["library_id"]:
        return None
    row = db.execute(
        "SELECT id,title,source_id,source_group,source_handle,available,"
        "purchase_match_pending "
        "FROM library WHERE id=?",
        (record["library_id"],),
    ).fetchone()
    if row is None:
        raise JournalError("conflict", "The purchase's Library entry no longer exists")
    return dict(row)


def _available_owner(db, record):
    owner = _owner(db, record)
    if owner and (not owner["available"] or owner["purchase_match_pending"]):
        raise JournalError("conflict", "The selected Library entry is unavailable")
    return owner


def _effect(db, before, after, group_after=None):
    """Compute actual totals using the normal projection, then roll back the preview."""
    owners = [_owner(db, record) for record in (before, after)]
    sources = sorted({owner["source_id"] for owner in owners if owner})
    previous = {source: purchases.totals(db, source) for source in sources}
    db.execute("SAVEPOINT purchase_repair_preview")
    try:
        if group_after is not None:
            _write_group(db, group_after)
        if before:
            db.execute("DELETE FROM purchase_records WHERE id=?", (before["id"],))
        if after:
            columns = ",".join(RECORD_FIELDS)
            marks = ",".join("?" for _ in RECORD_FIELDS)
            db.execute(
                f"INSERT INTO purchase_records ({columns}) VALUES ({marks})",
                tuple(after[key] for key in RECORD_FIELDS),
            )
        proposed = {source: purchases.totals(db, source) for source in sources}
    finally:
        db.execute("ROLLBACK TO purchase_repair_preview")
        db.execute("RELEASE purchase_repair_preview")
    return [
        {"source_id": source, "before": previous[source], "after": proposed[source]}
        for source in sources
    ]


def _check_destination(db, before, after, reversing=None):
    if after is None:
        return
    if before and before["library_id"] == after["library_id"]:
        _owner(db, after)
    else:
        _available_owner(db, after)
    if before and before["id"] == after["id"]:
        return
    if _record(db, after["id"]):
        raise JournalError("conflict", "The resulting purchase identity already exists")
    barrier = db.execute(
        "SELECT event_id FROM purchase_identity_barriers WHERE purchase_id=?",
        (after["id"],),
    ).fetchone()
    if barrier and barrier[0] != reversing:
        raise JournalError("conflict", "The resulting purchase identity is reserved")
    if reversing and (not barrier or barrier[0] != reversing):
        raise JournalError("conflict", "The reserved purchase identity changed")


def preview(db, action, key, token, changes, actor):
    """Create an actor-bound preview without changing any ledger data."""
    if action not in {"correct", "void", "reverse"}:
        raise invalid("Invalid purchase repair action")
    if not isinstance(key, str) or len(key) > 64 or not isinstance(token, str):
        raise invalid("Invalid purchase repair selection")
    if not isinstance(changes, dict) or (action != "correct" and changes):
        raise invalid("Invalid purchase repair changes")
    reverse_id = None
    before_group = after_group = None
    if action == "reverse":
        event = db.execute(
            "SELECT * FROM purchase_repair_events WHERE request_id=?", (key,)
        ).fetchone()
        if not event:
            raise JournalError("not_found", "Purchase repair event no longer exists")
        if row_token(event) != token:
            raise JournalError("conflict", "Purchase repair evidence changed")
        if db.execute(
            "SELECT 1 FROM purchase_repair_events WHERE reverses=?", (key,)
        ).fetchone():
            raise JournalError("conflict", "This purchase repair was already reversed")
        before = json.loads(event["after_record"]) if event["after_record"] else None
        after = json.loads(event["before_record"]) if event["before_record"] else None
        before_library = (
            json.loads(event["after_library"]) if event["after_library"] else {}
        )
        after_library = (
            json.loads(event["before_library"]) if event["before_library"] else {}
        )
        if not isinstance(before_library, dict) or not isinstance(after_library, dict):
            raise JournalError("conflict", "Purchase repair evidence is invalid")
        before_group = before_library.get("group_purchase")
        after_group = after_library.get("group_purchase")
        if (before_group is None) != (after_group is None):
            raise JournalError("conflict", "Purchase group evidence is invalid")
        if before_group is not None:
            _check_group(db, before_group)
            _check_group_transition(before_group, after_group)
        if before and _record(db, before["id"]) != before:
            raise JournalError("conflict", "The repaired purchase has since changed")
        reverse_id = key
    else:
        if not re.fullmatch(r"[a-f0-9]{64}", key):
            raise invalid("Invalid purchase identity")
        before = _record(db, key)
        if before is None:
            raise JournalError("not_found", "Purchase no longer exists")
        if row_token(before) != token:
            raise JournalError("conflict", "Purchase changed; refresh before repair")
        after = None
        if action == "correct":
            if not changes or set(changes) - EDIT_FIELDS:
                raise invalid("Choose supported purchase fields to correct")
            values = {**before, **changes}
            normalized = purchases.purchase_record(
                {key: values[key] for key in (*purchases.INVOICE_FIELDS, "library_id")}
            )
            after = {
                **{key: normalized[key] for key in ("id", *purchases.INVOICE_FIELDS)},
                "imported_at": before["imported_at"],
                "library_id": normalized["library_id"],
                "issue": before["issue"]
                if normalized["library_id"] == before["library_id"]
                else None
                if normalized["library_id"]
                else "unmatched",
            }
            if after == before:
                raise invalid("Purchase correction contains no changes")
    _check_destination(db, before, after, reverse_id)
    revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
    before_library = _owner(db, before)
    after_library = _owner(db, after)
    if before_group is not None:
        if not before_library or not after_library:
            raise JournalError("conflict", "Purchase group evidence is invalid")
        if any(
            (owner["source_id"], owner["source_group"])
            != (before_group["source_id"], before_group["source_group"])
            for owner in (before_library, after_library)
        ):
            raise JournalError("conflict", "Purchase group evidence is invalid")
        before_library["group_purchase"] = before_group
        after_library["group_purchase"] = after_group
    public = {
        "plan_id": str(uuid4()),
        "revision": revision,
        "action": action,
        "before": before,
        "after": after,
        "before_library": before_library,
        "after_library": after_library,
        "totals_change": _effect(db, before, after, after_group),
        "expires_in": REVIEW_SECONDS,
    }
    return {
        "public": public,
        "actor": actor,
        "reverses": reverse_id,
        "expires": time.monotonic() + REVIEW_SECONDS,
    }


def apply(
    db,
    plan,
    request_id,
    plan_id,
    revision,
    actor,
    *,
    fingerprint_override=None,
    before_mutation=None,
):
    """Apply the reviewed transition, its evidence and replay barriers atomically."""
    fingerprint = (
        fingerprint_override
        or hashlib.sha256(
            json.dumps(["purchase_repair", plan_id, revision, actor]).encode()
        ).hexdigest()
    )
    cached = db.execute(
        "SELECT * FROM requests WHERE request_id=?", (request_id,)
    ).fetchone()
    if cached:
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID belongs to different data or actor"
            )
        return json.loads(cached["response"])
    if (
        not plan
        or plan["actor"] != actor
        or plan["public"]["plan_id"] != plan_id
        or plan["public"]["revision"] != revision
        or plan["expires"] < time.monotonic()
    ):
        raise JournalError("conflict", "Purchase repair review expired or changed")
    public = plan["public"]
    before, after, reverse_id = public["before"], public["after"], plan["reverses"]
    with db:
        current = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        if type(revision) is not int or current != revision:
            raise JournalError(
                "conflict", "Database changed; review the purchase again"
            )
        if before and _record(db, before["id"]) != before:
            raise JournalError("conflict", "Purchase changed; review it again")
        if (
            reverse_id
            and db.execute(
                "SELECT 1 FROM purchase_repair_events WHERE reverses=?", (reverse_id,)
            ).fetchone()
        ):
            raise JournalError("conflict", "This purchase repair was already reversed")
        _check_destination(db, before, after, reverse_id)
        if before_mutation is not None:
            before_mutation(db)
        before_group = (public["before_library"] or {}).get("group_purchase")
        after_group = (public["after_library"] or {}).get("group_purchase")
        if (before_group is None) != (after_group is None):
            raise JournalError("conflict", "Purchase group evidence is invalid")
        if before_group is not None:
            _check_group(db, before_group)
            _check_group_transition(before_group, after_group)
            if not public["before_library"] or not public["after_library"]:
                raise JournalError("conflict", "Purchase group evidence is invalid")
            if any(
                (owner["source_id"], owner["source_group"])
                != (before_group["source_id"], before_group["source_group"])
                for owner in (public["before_library"], public["after_library"])
            ):
                raise JournalError("conflict", "Purchase group evidence is invalid")
            _write_group(db, after_group)
        now = datetime.now(UTC).isoformat()
        result = {"revision": revision + 1, "event_id": request_id}
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request_id, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO purchase_repair_events VALUES (?,?,?,?,?,?,?,?,?)",
            (
                request_id,
                actor,
                public["action"],
                json.dumps(before) if before else None,
                json.dumps(after) if after else None,
                json.dumps(public["before_library"])
                if public["before_library"]
                else None,
                json.dumps(public["after_library"])
                if public["after_library"]
                else None,
                reverse_id,
                now,
            ),
        )
        if before and (not after or before["id"] != after["id"]):
            db.execute("DELETE FROM purchase_records WHERE id=?", (before["id"],))
            db.execute(
                "INSERT INTO purchase_identity_barriers VALUES (?,?)",
                (before["id"], request_id),
            )
        if after:
            if reverse_id and (not before or before["id"] != after["id"]):
                db.execute(
                    "DELETE FROM purchase_identity_barriers "
                    "WHERE purchase_id=? AND event_id=?",
                    (after["id"], reverse_id),
                )
            columns = ",".join(RECORD_FIELDS)
            marks = ",".join("?" for _ in RECORD_FIELDS)
            if before and before["id"] == after["id"]:
                db.execute("DELETE FROM purchase_records WHERE id=?", (before["id"],))
            db.execute(
                f"INSERT INTO purchase_records ({columns}) VALUES ({marks})",
                tuple(after[key] for key in RECORD_FIELDS),
            )
        for source in {
            item["source_id"]
            for item in (public["before_library"], public["after_library"])
            if item
        }:
            db.execute(
                "UPDATE library_sources SET revision=revision+1 WHERE id=?", (source,)
            )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return result

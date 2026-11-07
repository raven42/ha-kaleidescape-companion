"""Snapshot-checked group purchase edits with audited receipt corrections."""

import hashlib
import json
import re

from ..core import purchase_repair
from ..core.database_mutations import replay
from ..core.maintenance import row_token
from ..core.models import JournalError, identifier, invalid, text
from .importing import purchase_date
from .purchases import MAX_HISTORY, price, store_href
from .store import changed

MANUAL_FIELDS = ("purchased_on", "purchase_price", "retail_price", "order_id", "href")
FIELDS = {*MANUAL_FIELDS, "title"}


def _manual_order(rows):
    return sorted(
        rows,
        key=lambda row: (
            row["purchased_on"] is None,
            row["purchased_on"] or "",
            row["id"],
        ),
    )


def _state(db, source, title):
    if not isinstance(title, str) or not re.fullmatch(r"[a-f0-9]{64}", title):
        raise invalid("Invalid Library title")
    target = db.execute(
        "SELECT source_group FROM library WHERE id=? AND source_id=? "
        "AND available=1 AND purchase_match_pending=0",
        (title, source),
    ).fetchone()
    if target is None:
        raise JournalError("not_found", "Select an available Library title")
    group = target[0]
    rows = db.execute(
        "SELECT id,available,purchase_match_pending,purchased_on,purchase_price,"
        "retail_price,order_id,href,purchase_information_unavailable FROM library "
        "WHERE source_id=? AND source_group=? ORDER BY id LIMIT ?",
        (source, group, MAX_HISTORY + 1),
    ).fetchall()
    receipts = db.execute(
        "SELECT p.* FROM purchase_records p JOIN library t ON t.id=p.library_id "
        "WHERE t.source_id=? AND t.source_group=? AND t.purchase_match_pending=0 "
        "ORDER BY p.purchased_on IS NULL,p.purchased_on,p.id LIMIT ?",
        (source, group, MAX_HISTORY + 1),
    ).fetchall()
    if len(rows) > MAX_HISTORY or len(receipts) > MAX_HISTORY:
        raise JournalError(
            "purchase_limit", "This movie has too many purchase records to edit here"
        )
    rows = [dict(row) for row in rows]
    receipts = [dict(row) for row in receipts]
    snapshot = hashlib.sha256(
        json.dumps([source, group, rows, receipts], sort_keys=True).encode()
    ).hexdigest()
    return group, rows, receipts, snapshot


def inspect(db, source, title):
    _, rows, receipts, snapshot = _state(db, source, title)
    manual = [
        {"library_id": row["id"], **{key: row[key] for key in MANUAL_FIELDS}}
        for row in _manual_order(rows)
        if not row["purchase_match_pending"]
        and any(row[key] is not None for key in MANUAL_FIELDS)
    ]
    return {
        "snapshot": snapshot,
        "unavailable": any(
            row["purchase_information_unavailable"]
            for row in rows
            if not row["purchase_match_pending"]
        ),
        "records": receipts,
        "manual": manual,
    }


def _normalize(fields, has_receipt):
    if (
        not isinstance(fields, dict)
        or set(fields) - FIELDS
        or (not has_receipt and "title" in fields)
    ):
        raise invalid("Choose supported purchase fields")
    result = {}
    for key, value in fields.items():
        if key == "title":
            result[key] = text(value, 500)
        elif key == "purchased_on":
            try:
                result[key] = purchase_date(value) if value is not None else None
            except ValueError as error:
                raise invalid("Enter a valid purchase date") from error
        elif key in {"purchase_price", "retail_price"}:
            result[key] = price(value)
        elif key == "order_id":
            result[key] = text(value, 256) if value is not None else None
        else:
            result[key] = store_href(value)
    return result


def apply(db, source, actor, request, title, snapshot, data):
    request = identifier(request)
    if not isinstance(snapshot, str) or not re.fullmatch(r"[a-f0-9]{64}", snapshot):
        raise invalid("Reopen purchase details")
    if not isinstance(data, dict) or set(data) != {
        "receipt_id",
        "fields",
        "unavailable",
    }:
        raise invalid("Invalid purchase edit")
    if type(data["unavailable"]) is not bool:
        raise invalid("Invalid purchase information status")
    digest = hashlib.sha256(
        json.dumps(
            ["group_purchase_edit", source, actor, title, snapshot, data],
            sort_keys=True,
        ).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    group, rows, receipts, current = _state(db, source, title)
    if current != snapshot:
        raise JournalError(
            "refresh_required", "Purchase details changed; reopen the editor"
        )
    receipt_id = data["receipt_id"]
    receipt = next((row for row in receipts if row["id"] == receipt_id), None)
    if (receipts and receipt is None) or (not receipts and receipt_id is not None):
        raise invalid("Select a purchase belonging to this movie")
    fields = _normalize(data["fields"], receipt is not None)
    if data["unavailable"] and fields:
        raise invalid("Purchase fields are hidden while information is unavailable")
    matched = _manual_order([row for row in rows if not row["purchase_match_pending"]])
    baseline, sources = {}, {}
    for key in MANUAL_FIELDS:
        value = receipt[key] if receipt else None
        sources[key] = "receipt" if value is not None else None
        if value is None:
            candidates = list(
                dict.fromkeys(row[key] for row in receipts if row[key] is not None)
            )
            if len(candidates) == 1:
                value, sources[key] = candidates[0], "other_receipt"
            elif not candidates:
                value = next(
                    (row[key] for row in matched if row[key] is not None), None
                )
                if value is not None:
                    sources[key] = "manual"
        baseline[key] = value
    baseline["title"] = receipt["title"] if receipt else None
    fields = {key: value for key, value in fields.items() if value != baseline[key]}
    if any(sources.get(key) == "other_receipt" for key in fields):
        raise invalid("Select the purchase record that contains the value to edit")
    current_unavailable = any(
        row["purchase_information_unavailable"] for row in matched
    )
    if not fields and data["unavailable"] == current_unavailable:
        raise invalid("No purchase details changed")

    before_rows = [
        {key: row[key] for key in purchase_repair.GROUP_FIELDS}
        for row in sorted(matched, key=lambda item: item["id"])
    ]
    after_rows = [dict(row) for row in before_rows]
    for row in after_rows:
        row["purchase_information_unavailable"] = int(data["unavailable"])
    # Only update manual copies of a value the user actually changed. Distinct
    # receipt records and conflicting manual values are never merged or deleted.
    for key, value in fields.items():
        if key not in MANUAL_FIELDS or (
            receipt and len(receipts) > 1 and sources[key] != "manual"
        ):
            continue
        old = baseline[key]
        for row in after_rows:
            if (old is not None and row[key] == old) or (
                old is None and receipt is None and row["id"] == title
            ):
                row[key] = value
    before_group = {"source_id": source, "source_group": group, "rows": before_rows}
    after_group = {"source_id": source, "source_group": group, "rows": after_rows}

    def check_snapshot(db):
        if _state(db, source, title)[3] != snapshot:
            raise JournalError(
                "refresh_required", "Purchase details changed; reopen the editor"
            )

    receipt_changes = {
        key: value for key, value in fields.items() if receipt and receipt[key] != value
    }
    if receipt_changes:
        plan = purchase_repair.preview(
            db, "correct", receipt["id"], row_token(receipt), receipt_changes, actor
        )
        if before_rows != after_rows:
            plan["public"]["before_library"]["group_purchase"] = before_group
            plan["public"]["after_library"]["group_purchase"] = after_group
        return purchase_repair.apply(
            db,
            plan,
            request,
            plan["public"]["plan_id"],
            plan["public"]["revision"],
            actor,
            fingerprint_override=digest,
            before_mutation=check_snapshot,
        )
    with db:
        check_snapshot(db)
        purchase_repair._write_group(db, after_group)
        changed(db, source)
        result = {"title_id": title}
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result

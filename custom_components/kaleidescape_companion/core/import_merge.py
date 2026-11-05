"""Worker-only, revision-bound import review and atomic missing-field merges."""

import hashlib
import json
import re
import time
from datetime import UTC, datetime
from uuid import uuid4

from ..library import purchases
from ..library.title_matching import TitleMatcher
from .importing import parse_bundle
from .models import JournalError, invalid, text, validate_times

REVIEW_SECONDS = 600
MAX_REVIEW_BYTES = 8 * 1024 * 1024
EMPTY = (None, "", [])
VIEWING_MERGE_FIELDS = (
    "ended_at",
    "duration_seconds",
    "source_id",
    "player_id",
    "raw_content_id",
    "notes",
)


def review(db, payload, import_format, actor, *, purchase_only=False):
    bundle = parse_bundle(payload, import_format)
    if purchase_only and (
        bundle["viewings"] or bundle["library"] or not bundle["purchases"]
    ):
        raise invalid("Purchase reconciliation accepts only purchase records")
    revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
    sources = {row[0] for row in db.execute("SELECT id FROM library_sources")}
    rows, operations, purchase_matches = [], {}, {}
    artwork_cache = {}
    purchase_index = purchases.index(db)
    # Candidate lookup is bounded by the import limit and never changes records.
    by_order, by_link, by_title_date = {}, {}, {}
    for existing_id, item in purchase_index.items():
        prior = item["record"]
        if prior.get("order_id"):
            by_order.setdefault(prior["order_id"], []).append(existing_id)
        if prior.get("href"):
            by_link.setdefault(prior["href"], []).append(existing_id)
        key = (prior["title"].casefold(), prior["purchased_on"])
        by_title_date.setdefault(key, []).append(existing_id)
    deadline = time.monotonic() + 30
    matcher = (
        TitleMatcher(
            db,
            deadline,
            preferred_ids=(
                {
                    link["owner"]
                    for link in purchase_index.values()
                    if not link["pending"]
                }
                | {
                    row[0]
                    for row in db.execute(
                        "SELECT id FROM library WHERE NOT EXISTS "
                        "(SELECT 1 FROM purchase_records WHERE library_id=library.id) "
                        "AND (purchase_price IS NOT NULL OR retail_price IS NOT NULL)"
                    )
                }
            ),
        )
        if bundle["purchases"]
        else None
    )
    for table, records in bundle.items():
        for record in records:
            if time.monotonic() > deadline:
                raise invalid("Import review exceeded its time budget")
            key = f"{table}:{record['id']}"
            if table == "purchases":
                old = purchase_index.get(record["id"])
                target, detail = purchases.propose_link(db, record, old, matcher)
                row, operation = purchase_proposal(key, record, old, target, detail)
                possible = False
                if old is None:
                    candidates = set(by_order.get(record["order_id"], ()))
                    candidates.update(by_link.get(record["href"], ()))
                    candidates.update(
                        by_title_date.get(
                            (record["title"].casefold(), record["purchased_on"]), ()
                        )
                    )
                    for existing_id in candidates:
                        if time.monotonic() > deadline:
                            raise invalid("Import review exceeded its time budget")
                        prior = purchase_index[existing_id]["record"]
                        same_title = (
                            prior["title"].casefold() == record["title"].casefold()
                        )
                        same_date = prior["purchased_on"] == record["purchased_on"]
                        same_order = bool(
                            record["order_id"]
                            and prior["order_id"] == record["order_id"]
                        )
                        same_link = bool(
                            record["href"] and prior["href"] == record["href"]
                        )
                        if (
                            (same_order and (same_title or same_date or same_link))
                            or (same_link and (same_title or same_date))
                            or (
                                same_title
                                and same_date
                                and not (
                                    record["order_id"]
                                    and prior["order_id"]
                                    and record["order_id"] != prior["order_id"]
                                )
                            )
                        ):
                            possible = True
                            break
                if possible:
                    row.update(
                        action="skip",
                        needs_match=True,
                        can_match=True,
                        possible_duplicate=True,
                        reason=(
                            "Possible duplicate receipt; review before adding "
                            "a separate purchase"
                        ),
                    )
                    operation = None
                if target:
                    if target not in artwork_cache:
                        artwork_cache[target] = purchase_artwork(db, target)
                    row["artwork_key"] = artwork_cache[target]
                if (old is None or old["pending"]) and target:
                    existing = db.execute(
                        "SELECT purchase_price,retail_price,EXISTS "
                        "(SELECT 1 FROM purchase_records "
                        "WHERE library_id=library.id) has_purchases "
                        "FROM library WHERE id=?",
                        (target,),
                    ).fetchone()
                    if existing and not existing["has_purchases"]:
                        for field in ("purchase_price", "retail_price"):
                            if (
                                existing[field] is not None
                                and record[field] is not None
                                and existing[field] != record[field]
                            ):
                                row["conflicts"].append(field)
                                row["changes"].pop(field, None)
                        if row["conflicts"]:
                            row["action"] = "skip"
                            operation = None
                rows.append(row)
                if operation:
                    operations[key] = operation
                if possible or target is None or (old and old["pending"]):
                    row["can_match"] = True
                    purchase_matches[key] = {"record": dict(record), "old": old}
                continue
            old = db.execute(
                f"SELECT * FROM {table} WHERE id=?", (record["id"],)
            ).fetchone()
            changes, conflicts, reason = {}, [], ""
            if table == "library" and record["source_id"] not in sources:
                reason = "Unknown source; sync this Library source before importing"
            elif old is None:
                changes = {
                    k: {"before": None, "after": v}
                    for k, v in record.items()
                    if k not in {"id", "title_search"} and v not in EMPTY
                }
            elif table == "viewings":
                if old["deleted_at"] is not None:
                    reason = "Existing deletion is preserved"
                else:
                    protected = json.loads(old["manual_fields"])
                    for field in VIEWING_MERGE_FIELDS:
                        value = record[field]
                        if (
                            old[field] in EMPTY
                            and value not in EMPTY
                            and field not in protected
                        ):
                            changes[field] = {"before": old[field], "after": value}
                        elif (
                            value not in EMPTY
                            and (field in protected or old[field] not in EMPTY)
                            and old[field] != value
                        ):
                            conflicts.append(field)
                    for field in ("title", "started_at", "status", "watched_seconds"):
                        if old[field] != record[field]:
                            conflicts.append(field)
                    validate_times(
                        {**dict(old), **{k: v["after"] for k, v in changes.items()}}
                    )
            else:
                if any(old[k] != record[k] for k in ("source_id", "source_handle")):
                    raise invalid(
                        "An existing Library version has a different identity"
                    )
                old_data = json.loads(old["data"])
                for field in ("title", "source_group"):
                    if old[field] != record[field]:
                        conflicts.append(field)
                for field, value in {
                    **record["data"],
                    "purchased_on": record["purchased_on"],
                    "sort_title": record["sort_title"],
                    **{
                        key: record[key]
                        for key in (
                            "purchase_price",
                            "retail_price",
                            "purchase_information_unavailable",
                        )
                        if key in record
                    },
                }.items():
                    previous = (
                        old[field]
                        if field
                        in {
                            "purchased_on",
                            "sort_title",
                            "purchase_price",
                            "retail_price",
                            "purchase_information_unavailable",
                        }
                        else old_data.get(field)
                    )
                    if field == "purchased_on" and previous is None:
                        previous = db.execute(
                            "SELECT min(purchased_on) FROM purchase_records "
                            "WHERE library_id=?",
                            (record["id"],),
                        ).fetchone()[0]
                    if (
                        field == "purchase_information_unavailable"
                        and previous == 0
                        and value == 1
                    ):
                        changes[field] = {"before": previous, "after": value}
                    elif previous in EMPTY and value not in EMPTY:
                        changes[field] = {"before": previous, "after": value}
                    elif (
                        value not in EMPTY
                        and previous not in EMPTY
                        and previous != value
                    ):
                        conflicts.append(field)
            if reason:
                action = "skip"
            elif old is None:
                action = "new"
            elif changes:
                action = "merge"
            else:
                action = "unchanged"
            # Identify individual versions in a compact review, even for remakes
            # and editions sharing a title. Full selection identity stays opaque.
            if table == "library":
                data = record["data"]
                detail = " · ".join(
                    str(value)
                    for value in (
                        data.get("year"),
                        data.get("edition"),
                        record["id"][-12:],
                    )
                    if value not in EMPTY
                )
            else:
                detail = record["started_at"]
            rows.append(
                {
                    "key": key,
                    "table": table,
                    "title": record["title"],
                    "detail": detail,
                    "action": action,
                    "changes": changes,
                    "conflicts": conflicts,
                    "reason": reason,
                    "selected_by_default": True,
                    "needs_match": key in purchase_matches,
                    "can_match": key in purchase_matches,
                }
            )
            if action in {"new", "merge"}:
                operations[key] = {
                    "table": table,
                    "record": record,
                    "action": action,
                    "changes": changes,
                }
    rows.sort(key=lambda row: not row["needs_match"])
    public = {
        "plan_id": str(uuid4()),
        "revision": revision,
        "expires_in": REVIEW_SECONDS,
        "rows": rows,
        "counts": {
            action: sum(row["action"] == action for row in rows)
            for action in ("new", "merge", "unchanged", "skip")
        },
    }
    if len(json.dumps(public, ensure_ascii=True).encode()) > MAX_REVIEW_BYTES:
        raise invalid(
            "Import review exceeds 8 MiB; split the input into smaller exports"
        )
    return {
        "public": public,
        "operations": operations,
        "purchase_matches": purchase_matches,
        "purchase_only": purchase_only,
        "actor": actor,
        "expires": time.monotonic() + REVIEW_SECONDS,
    }


def purchase_proposal(key, record, old, target, detail):
    changes, conflicts, action = purchases.proposal(record, old, target)
    if target is None and old:
        _, conflicts, _ = purchases.proposal(record, old, "pending")
    row = {
        "key": key,
        "table": "library",
        "title": record["title"],
        "detail": f"{record['purchased_on']} · {detail}",
        "action": action,
        "changes": changes,
        "conflicts": conflicts,
        "reason": "Match a scanned Library entry or leave this purchase unselected"
        if target is None
        else "",
        "selected_by_default": False,
        "needs_match": target is None,
        "can_match": target is None,
    }
    operation = (
        {
            "table": "purchases",
            "record": record,
            "action": action,
            "changes": changes,
            "target": target,
            "old_owner": old["owner"] if old else None,
        }
        if target is not None and action in {"new", "merge"}
        else None
    )
    return row, operation


def checked_review(db, plan, plan_id, revision, actor):
    """Review searches/edits confer no database-write or actor selection ability."""
    if (
        not plan
        or plan["public"]["plan_id"] != plan_id
        or plan["actor"] != actor
        or plan["expires"] < time.monotonic()
    ):
        raise JournalError(
            "conflict", "Import review expired or changed; review the file again"
        )
    if type(revision) is not int or revision != plan["public"]["revision"]:
        raise invalid("Invalid import review revision")
    if db.execute("SELECT revision FROM schema_metadata").fetchone()[0] != revision:
        raise JournalError("conflict", "Database changed; review the file again")


def purchase_artwork(db, title_id):
    """Find selected cached cover, falling back to an available group version."""
    row = db.execute(
        "SELECT coalesce(companion_artwork(t.artwork_key,t.enrichment,'artwork'), "
        "(SELECT max(companion_artwork(g.artwork_key,g.enrichment,'artwork')) "
        "FROM library g WHERE g.source_id=t.source_id AND "
        "g.source_group=t.source_group AND g.available=1 "
        "AND g.purchase_match_pending=0)) artwork_key FROM library t WHERE t.id=?",
        (title_id,),
    ).fetchone()
    return row["artwork_key"] if row else None


def search_matches(db, plan, plan_id, revision, key, query, actor):
    checked_review(db, plan, plan_id, revision, actor)
    if (
        not isinstance(key, str)
        or len(key) > 100
        or key not in plan["purchase_matches"]
    ):
        raise invalid("Choose an unresolved purchase in this review")
    query = text(query, 100, empty=True)
    if "\x00" in query:
        raise invalid("Title search is limited to 100 characters")
    if not query.strip():
        return {"items": [], "has_more": False}
    deadline = time.monotonic() + 2
    db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
    try:
        rows = db.execute(
            "SELECT coalesce(min(CASE WHEN EXISTS (SELECT 1 FROM purchase_records "
            "WHERE library_id=library.id) THEN id END),"
            "min(id)) id,min(title) title,min(json_extract(data,'$.year')) year,"
            "max(json_extract(data,'$.directors')) directors,count(*) version_count,"
            "max(companion_artwork(artwork_key,enrichment,'artwork')) artwork_key,"
            "source_id FROM library WHERE available=1 AND purchase_match_pending=0 "
            "AND companion_matches(title_search,?,0) GROUP BY source_id,source_group "
            "ORDER BY min(title_search),source_id,source_group LIMIT 21",
            (query.strip().casefold(),),
        ).fetchall()
    finally:
        db.set_progress_handler(None, 0)
    return {
        "items": [
            {
                "id": row["id"],
                "title": row["title"],
                "year": row["year"],
                "directors": json.loads(row["directors"] or "[]"),
                "version_count": row["version_count"],
                "source_hint": row["source_id"][-8:],
                "artwork_key": row["artwork_key"],
            }
            for row in rows[:20]
        ],
        "has_more": len(rows) > 20,
    }


def match_purchase(db, plan, plan_id, revision, key, title_id, actor):
    """Revise an ephemeral proposal; a fresh token protects the final approval."""
    checked_review(db, plan, plan_id, revision, actor)
    if (
        not isinstance(key, str)
        or len(key) > 100
        or key not in plan["purchase_matches"]
    ):
        raise invalid("Only unresolved purchase links can be chosen")
    context = plan["purchase_matches"][key]
    record, old = dict(context["record"]), context["old"]
    detail = "Choose a Library entry before importing this purchase"
    if title_id is not None:
        if not isinstance(title_id, str) or not re.fullmatch(r"[a-f0-9]{64}", title_id):
            raise invalid("Choose an available Library entry")
        target = db.execute(
            "SELECT title,json_extract(data,'$.year') year FROM library "
            "WHERE id=? AND available=1 AND purchase_match_pending=0",
            (title_id,),
        ).fetchone()
        if target is None:
            raise JournalError("not_found", "Selected Library entry is unavailable")
        detail = (
            f"Selected Library movie: {target['title']} · "
            f"{target['year'] or 'year unknown'}"
        )
    row, operation = purchase_proposal(key, record, old, title_id, detail)
    row["artwork_key"] = purchase_artwork(db, title_id) if title_id else None
    if title_id is not None and (old is None or old["pending"]):
        existing = db.execute(
            "SELECT purchase_price,retail_price,EXISTS "
            "(SELECT 1 FROM purchase_records "
            "WHERE library_id=library.id) has_purchases "
            "FROM library WHERE id=?",
            (title_id,),
        ).fetchone()
        if existing and not existing["has_purchases"]:
            for field in ("purchase_price", "retail_price"):
                if (
                    existing[field] is not None
                    and record[field] is not None
                    and existing[field] != record[field]
                ):
                    row["conflicts"].append(field)
                    row["changes"].pop(field, None)
            if row["conflicts"]:
                operation = None
                row["action"] = "skip"
    row["can_match"] = True
    rows = [row if item["key"] == key else item for item in plan["public"]["rows"]]
    rows.sort(key=lambda item: not item["needs_match"])
    public = {
        **plan["public"],
        "plan_id": str(uuid4()),
        "rows": rows,
        "expires_in": max(0, int(plan["expires"] - time.monotonic())),
        "counts": {
            kind: sum(item["action"] == kind for item in rows)
            for kind in ("new", "merge", "unchanged", "skip")
        },
    }
    if len(json.dumps(public, ensure_ascii=True).encode()) > MAX_REVIEW_BYTES:
        raise invalid("Import review exceeds 8 MiB")
    operations = dict(plan["operations"])
    if operation:
        operations[key] = operation
    else:
        operations.pop(key, None)
    plan.update(public=public, operations=operations)
    return {
        key: public[key] for key in ("plan_id", "revision", "expires_in", "counts")
    } | {"row": row}


def apply(db, plan, request_id, plan_id, revision, selected, actor, pending_records=()):
    if (
        not isinstance(selected, list)
        or not (1 <= len(selected) <= 10000 or (not selected and pending_records))
        or any(not isinstance(key, str) or len(key) > 100 for key in selected)
        or len(set(selected)) != len(selected)
    ):
        raise invalid("Select 1–10000 distinct review rows")
    fingerprint = hashlib.sha256(
        json.dumps(
            ["merge_import", plan_id, revision, sorted(selected), actor]
        ).encode()
    ).hexdigest()
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
        or plan["public"]["plan_id"] != plan_id
        or plan["actor"] != actor
        or plan["expires"] < time.monotonic()
    ):
        raise JournalError(
            "conflict", "Import review expired or was replaced; review the file again"
        )
    if (
        revision != plan["public"]["revision"]
        or set(selected) - plan["operations"].keys()
    ):
        raise invalid("Selection does not match this review")
    now = datetime.now(UTC).isoformat()
    imported = updated = pending_count = 0
    sources = set()
    with db:
        if db.execute("SELECT revision FROM schema_metadata").fetchone()[0] != revision:
            raise JournalError("conflict", "Database changed; review the file again")
        for record in pending_records:
            cursor = db.execute(
                "INSERT OR IGNORE INTO purchase_records "
                "(id,title,purchased_on,purchase_price,retail_price,order_id,href,"
                "imported_at,library_id,issue) "
                "VALUES (?,?,?,?,?,?,?,?,NULL,'unmatched')",
                (record["id"], *(record[key] for key in purchases.INVOICE_FIELDS), now),
            )
            pending_count += cursor.rowcount
        for key in selected:
            operation = plan["operations"][key]
            table, record = operation["table"], operation["record"]
            patch = {k: v["after"] for k, v in operation["changes"].items()}
            if table == "purchases":
                sources.add(
                    purchases.merge_into(
                        db, record, operation["target"], now, operation["old_owner"]
                    )
                )
                if operation["action"] == "new":
                    imported += 1
                else:
                    updated += 1
                continue
            if operation["action"] == "new":
                values = dict(record)
                if table == "library":
                    values.update(
                        data=json.dumps(record["data"]),
                        title_search=record["title"].casefold(),
                        base_hash="",
                        available=0,
                        purchase_imported_at=now if record["purchased_on"] else None,
                    )
                columns = ",".join(values)
                placeholders = ",".join("?" for _ in values)
                db.execute(
                    f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
                    tuple(values.values()),
                )
                imported += 1
            elif table == "viewings":
                patch.update(updated_at=now)
                assignment = ",".join(f"{column}=?" for column in patch)
                db.execute(
                    f"UPDATE viewings SET {assignment},revision=revision+1 WHERE id=?",
                    (*patch.values(), record["id"]),
                )
                updated += 1
            else:
                old = db.execute(
                    "SELECT data,purchased_on,purchase_imported_at,sort_title,"
                    "retail_price "
                    "FROM library WHERE id=?",
                    (record["id"],),
                ).fetchone()
                data = json.loads(old["data"])
                data.update(
                    {
                        k: v
                        for k, v in patch.items()
                        if k
                        not in {
                            "purchased_on",
                            "sort_title",
                            "purchase_price",
                            "retail_price",
                            "purchase_information_unavailable",
                        }
                    }
                )
                if "retail_price" in patch:
                    purchases.fill_retail_price(db, record["id"], patch["retail_price"])
                if "purchase_price" in patch:
                    purchases.fill_missing_price(
                        db, record["id"], "purchase_price", patch["purchase_price"]
                    )
                if "purchase_information_unavailable" in patch:
                    db.execute(
                        "UPDATE library SET purchase_information_unavailable=1 "
                        "WHERE id=?",
                        (record["id"],),
                    )
                db.execute(
                    "UPDATE library SET data=?,purchased_on=?,sort_title=?,"
                    "purchase_imported_at=? "
                    "WHERE id=?",
                    (
                        json.dumps(data),
                        patch.get("purchased_on", old["purchased_on"]),
                        patch.get("sort_title", old["sort_title"]),
                        now if "purchased_on" in patch else old["purchase_imported_at"],
                        record["id"],
                    ),
                )
                updated += 1
            if table == "library" and record["source_id"]:
                sources.add(record["source_id"])
        for source in sources:
            db.execute(
                "UPDATE library_sources SET revision=revision+1 WHERE id=?", (source,)
            )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
        skipped = len(plan["public"]["rows"]) - len(selected)
        result = {
            "imported_count": imported,
            "updated_count": updated,
            "skipped_count": skipped,
            "revision": revision + 1,
        }
        if pending_records:
            result["pending_count"] = pending_count
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request_id, fingerprint, json.dumps(result)),
        )
        db.execute(
            """INSERT INTO import_audit
            (request_id,actor_id,imported_count,updated_count,skipped_count,dataset_revision,occurred_at)
            VALUES (?,?,?,?,?,?,?)""",
            (request_id, actor, imported, updated, skipped, revision + 1, now),
        )
    return result

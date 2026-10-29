"""Worker-only, revision-bound import review and atomic missing-field merges."""

import hashlib
import json
import time
from datetime import UTC, datetime
from uuid import uuid4

from .importing import parse_bundle
from .models import JournalError, invalid, validate_times

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


def review(db, payload, import_format, actor):
    bundle = parse_bundle(payload, import_format)
    revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
    sources = {row[0] for row in db.execute("SELECT id FROM library_sources")}
    rows, operations = [], {}
    deadline = time.monotonic() + 30
    for table, records in bundle.items():
        for record in records:
            if time.monotonic() > deadline:
                raise invalid("Import review exceeded its time budget")
            key = f"{table}:{record['id']}"
            old = db.execute(
                f"SELECT * FROM {table} WHERE id=?", (record["id"],)
            ).fetchone()
            changes, conflicts, reason = {}, [], ""
            if table == "library_titles" and record["source_id"] not in sources:
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
                }.items():
                    previous = (
                        old["purchased_on"]
                        if field == "purchased_on"
                        else old_data.get(field)
                    )
                    if previous in EMPTY and value not in EMPTY:
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
            if table == "library_titles":
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
                }
            )
            if action in {"new", "merge"}:
                operations[key] = {
                    "table": table,
                    "record": record,
                    "action": action,
                    "changes": changes,
                }
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
        "actor": actor,
        "expires": time.monotonic() + REVIEW_SECONDS,
    }


def apply(db, plan, request_id, plan_id, revision, selected, actor):
    if (
        not isinstance(selected, list)
        or not 1 <= len(selected) <= 10000
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
    imported = updated = 0
    sources = set()
    with db:
        if db.execute("SELECT revision FROM schema_metadata").fetchone()[0] != revision:
            raise JournalError("conflict", "Database changed; review the file again")
        for key in selected:
            operation = plan["operations"][key]
            table, record = operation["table"], operation["record"]
            patch = {k: v["after"] for k, v in operation["changes"].items()}
            if operation["action"] == "new":
                values = dict(record)
                if table == "library_titles":
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
                    "SELECT data,purchased_on,purchase_imported_at "
                    "FROM library_titles WHERE id=?",
                    (record["id"],),
                ).fetchone()
                data = json.loads(old["data"])
                data.update({k: v for k, v in patch.items() if k != "purchased_on"})
                db.execute(
                    "UPDATE library_titles SET data=?,purchased_on=?,"
                    "purchase_imported_at=? "
                    "WHERE id=?",
                    (
                        json.dumps(data),
                        patch.get("purchased_on", old["purchased_on"]),
                        now if "purchased_on" in patch else old["purchase_imported_at"],
                        record["id"],
                    ),
                )
                updated += 1
            if table == "library_titles":
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

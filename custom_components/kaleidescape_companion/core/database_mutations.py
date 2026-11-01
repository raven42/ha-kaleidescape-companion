"""Confirmed, actor-bound, transactional administration of supported stored rows."""

import hashlib
import json
import re
from datetime import UTC, datetime

from .database_schema import DELETABLE, EDITABLE, TABLE_KEYS
from .maintenance import row_token
from .models import (
    JournalError,
    fields,
    invalid,
    seconds,
    text,
    timestamp,
    validate_times,
)
from .security import private_file


def mutation(db, directory, request, actor, data, calendar=None):
    if not isinstance(data, dict) or set(data) - {
        "table",
        "operation",
        "rows",
        "patch",
        "expected_revision",
        "confirmation",
    }:
        raise invalid("Unknown database mutation fields")
    table = data.get("table")
    op = data.get("operation")
    if (
        not isinstance(table, str)
        or table not in TABLE_KEYS
        or op not in ("edit", "delete")
    ):
        raise invalid("Unsupported table or operation")
    if data.get("confirmation") != ("SAVE" if op == "edit" else "DELETE"):
        raise invalid("Explicit database confirmation is required")
    if (op == "edit" and table not in EDITABLE) or (
        op == "delete" and table not in DELETABLE
    ):
        raise invalid("This table protects identity, audit or retry invariants")
    fingerprint = mutation_fingerprint(actor, data)
    cached = replay(db, request, fingerprint)
    if cached is not None:
        return cached
    selected = data.get("rows")
    if (
        not isinstance(selected, list)
        or not 1 <= len(selected) <= 100
        or (op == "edit" and len(selected) != 1)
    ):
        raise invalid("Select one edit or at most 100 deletions")
    keys = TABLE_KEYS[table].split(",")
    patch = data.get("patch", {})
    if (
        not isinstance(patch, dict)
        or (op == "edit" and (not patch or set(patch) - EDITABLE[table]))
        or (op == "delete" and patch)
    ):
        raise invalid("Protected or unknown fields cannot be changed")
    paths = []
    sources = set()
    rows = []
    identities = set()
    now = datetime.now(UTC).isoformat()
    with db:
        revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        if (
            type(data.get("expected_revision")) is not int
            or data["expected_revision"] != revision
        ):
            raise JournalError(
                "conflict", "Database changed; reload and review before applying"
            )
        for item in selected:
            if (
                not isinstance(item, dict)
                or set(item) != {"key", "token"}
                or not isinstance(item["key"], dict)
                or set(item["key"]) != set(keys)
            ):
                raise invalid("Invalid row identity")
            values = tuple(item["key"][key] for key in keys)
            if any(
                not isinstance(value, (str, int))
                or isinstance(value, bool)
                or len(str(value)) > 512
                for value in values
            ):
                raise invalid("Invalid row key")
            if values in identities:
                raise invalid("Duplicate row selection")
            identities.add(values)
            where = " AND ".join(f'"{key}"=?' for key in keys)
            row = db.execute(
                f'SELECT * FROM "{table}" WHERE {where}', values
            ).fetchone()
            if row is None:
                raise JournalError("not_found", "Selected row no longer exists")
            row = dict(row)
            if row_token(row) != item["token"]:
                raise JournalError(
                    "conflict", "Selected row changed; reload before applying"
                )
            source = row.get("source_id") if table.startswith("library_") else None
            if table == "library_sources":
                source = row["id"]
            if source:
                if db.execute(
                    "SELECT 1 FROM library_collection_intents "
                    "WHERE source_id=? AND status='uncertain'",
                    (source,),
                ).fetchone():
                    raise JournalError(
                        "busy",
                        "Resolve the pending device write before changing this data",
                    )
                sources.add(source)
            if (
                table == "viewings"
                and db.execute(
                    "SELECT 1 FROM sessions WHERE viewing_id=? AND closed_at IS NULL",
                    (row["id"],),
                ).fetchone()
            ):
                raise JournalError(
                    "busy", "An open playback session protects this viewing"
                )
            if table == "sessions" and row["closed_at"] is None:
                raise JournalError("busy", "Open playback sessions cannot be changed")
            if table == "library_artwork" and op == "delete":
                if not re.fullmatch(r"[a-f0-9]{64}", row["cache_key"]):
                    raise invalid("Invalid managed cache key")
                path = directory / (row["cache_key"] + ".img")
                private_file(path)
                paths.append(path)
                sources.update(
                    item[0]
                    for item in db.execute(
                        "SELECT DISTINCT source_id FROM library WHERE artwork_key=? "
                        "OR json_extract(enrichment,'$.tmdb.backdrop_key')=? "
                        "OR json_extract(enrichment,'$.reviewed.poster_key')=? "
                        "OR json_extract(enrichment,'$.reviewed.backdrop_key')=?",
                        (row["cache_key"],) * 4,
                    )
                )
            rows.append((row, where, values))
        for row, where, values in rows:
            if op == "edit":
                changes = validated_patch(db, table, row, patch, now)
                db.execute(
                    f'UPDATE "{table}" SET '
                    + ",".join('"' + key + '"=?' for key in changes)
                    + f" WHERE {where}",
                    (*changes.values(), *values),
                )
                if (
                    table == "viewings"
                    and row["status"] != "completed"
                    and changes.get("status") == "completed"
                ):
                    from ..calendar.store import enqueue

                    enqueue(db, row["id"], calendar)
            else:
                delete_row(db, table, row)
                db.execute(f'DELETE FROM "{table}" WHERE {where}', values)
        for source in sources:
            db.execute(
                "UPDATE library_sources SET revision=revision+1 WHERE id=?", (source,)
            )
        if table == "settings":
            db.execute(
                "UPDATE schema_metadata SET settings_revision=settings_revision+1"
            )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
        result = {
            "updated_count": len(rows) if op == "edit" else 0,
            "deleted_count": len(rows) if op == "delete" else 0,
            "revision": revision + 1,
        }
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO database_audit VALUES (?,?,?,?,?,?,?,?)",
            (
                request,
                actor,
                op,
                table,
                len(rows),
                json.dumps(sorted(patch)),
                revision + 1,
                now,
            ),
        )
    # Indexed access was removed atomically. A failed unlink leaves a private
    # orphan for normal cache reconciliation, never a public/live reference.
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
    return result


def mutation_fingerprint(actor, data):
    try:
        encoded = json.dumps(["database", actor, data], sort_keys=True, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise invalid("Invalid database change") from error
    if len(encoded.encode()) > 1024 * 1024:
        raise invalid("Database change is too large")
    return hashlib.sha256(encoded.encode()).hexdigest()


def replay(db, request, fingerprint):
    cached = db.execute(
        "SELECT * FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if cached:
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID belongs to another payload or actor"
            )
        return json.loads(cached["response"])
    return None


def validated_patch(db, table, row, patch, now):
    result = {}
    if table == "viewings":
        supplied = {
            key: row[key]
            for key in (
                "title",
                "started_at",
                "ended_at",
                "duration_seconds",
                "watched_seconds",
                "status",
                "source_id",
                "player_id",
                "raw_content_id",
                "notes",
            )
        }
        supplied.update(patch)
        checked = fields(supplied)
        validate_times(checked)
        result = {key: checked[key] for key in patch}
        result.update(
            title_search=checked["title"].casefold(),
            revision=row["revision"] + 1,
            updated_at=now,
            manual_fields=json.dumps(
                sorted(set(json.loads(row["manual_fields"])) | set(patch))
            ),
        )
        if "status" in patch:
            result.update(
                completed_at=(checked["ended_at"] or now)
                if checked["status"] == "completed"
                else None,
                completion_reason="manual"
                if checked["status"] == "completed"
                else None,
            )
        return result
    if table == "library":
        from ..library.importing import title_record

        raw = {**row, **patch}
        if isinstance(raw["data"], str):
            if len(raw["data"]) > 65536:
                raise invalid("Metadata exceeds 64 KiB")
            try:
                raw["data"] = json.loads(raw["data"])
            except ValueError as error:
                raise invalid("Metadata must be JSON") from error
        if not isinstance(raw["data"], dict):
            raise invalid("Metadata must be an object")
        from ..library.browse import PUBLIC_FIELDS

        unknown = set(raw["data"]) - set(PUBLIC_FIELDS)
        original = json.loads(row["data"])
        if any(raw["data"][key] != original.get(key) for key in unknown):
            raise invalid("Only recognized Library metadata fields are editable")
        try:
            checked = title_record(raw, now, json.loads)
        except (ValueError, TypeError) as error:
            raise invalid("Invalid Library metadata or purchase date") from error
        for key in patch:
            if key == "data":
                result[key] = json.dumps(
                    {
                        **{
                            key: value
                            for key, value in original.items()
                            if key not in PUBLIC_FIELDS
                        },
                        **checked["data"],
                    }
                )
            elif key in {"purchase_price", "retail_price"}:
                from ..library.purchases import price

                result[key] = price(patch[key])
            elif key != "available":
                result[key] = checked[key]
        if {"purchase_price", "retail_price"} & patch.keys():
            records = json.loads(row["purchase_history"])
            if not records:
                raise invalid("Import a matched purchase before editing its prices")
            for key in ("purchase_price", "retail_price"):
                if key in patch:
                    records[0][key] = result[key]
            result["purchase_history"] = json.dumps(records)
        if "title" in patch:
            result["title_search"] = checked["title"].casefold()
    elif table == "settings":
        from ..ui.preferences import (
            validate_database,
            validate_journal,
            validate_library,
            validate_search,
            validate_shared,
        )

        value = patch["value"]
        if isinstance(value, str):
            if len(value) > 65536:
                raise invalid("Settings exceed 64 KiB")
            try:
                value = json.loads(value)
            except ValueError as error:
                raise invalid("Settings must be JSON") from error
        validator = (
            validate_database
            if row["key"] == "database"
            else validate_search
            if row["key"] == "search"
            else validate_journal
            if row["key"] == "journal"
            else validate_shared
            if row["key"] == "library_shared"
            else validate_library
            if row["key"] in {"library", "library_defaults"}
            else None
        )
        if validator is None:
            raise invalid("Unknown settings row is protected")
        return {
            "value": json.dumps(validator(value)),
            "revision": row["revision"] + 1,
            "updated_at": now,
        }
    for key, value in patch.items():
        if key in result:
            continue
        if key == "available":
            if type(value) is not int or value not in (0, 1):
                raise invalid("Availability must be 0 or 1")
            result[key] = value
        elif key in {
            "first_seen",
            "last_seen",
            "last_synced_at",
            "collections_synced_at",
        }:
            result[key] = (
                None
                if value is None and key.endswith("_synced_at")
                else timestamp(value)
            )
        elif key == "title":
            result[key] = text(value, 500)
        elif key in {"duration_seconds", "watched_seconds"}:
            result[key] = (
                None if value is None and key == "duration_seconds" else seconds(value)
            )
    if table == "sessions":
        result["revision"] = row["revision"] + 1
    if table in {"library", "library_collections"} and result.get(
        "first_seen", row["first_seen"]
    ) > result.get("last_seen", row["last_seen"]):
        raise invalid("First detected must not follow last detected")
    return result


def delete_row(db, table, row):
    if table == "viewings":
        db.execute(
            "UPDATE requests SET response='{\"purged\":true}' "
            "WHERE json_extract(response,'$.viewing.id')=?",
            (row["id"],),
        )
        db.execute("DELETE FROM manual_audit WHERE viewing_id=?", (row["id"],))
        db.execute("DELETE FROM sessions WHERE viewing_id=?", (row["id"],))
    elif table == "library":
        if db.execute(
            "SELECT 1 FROM library_collection_intents WHERE title_id=?", (row["id"],)
        ).fetchone():
            raise JournalError("conflict", "Device-write receipts protect this version")
        db.execute("DELETE FROM library_memberships WHERE title_id=?", (row["id"],))
    elif table == "library_sources":
        if db.execute(
            "SELECT 1 FROM library_collection_intents WHERE source_id=?", (row["id"],)
        ).fetchone():
            raise JournalError("conflict", "Device-write receipts protect this source")
        db.execute("DELETE FROM library_memberships WHERE source_id=?", (row["id"],))
        db.execute("DELETE FROM library_collections WHERE source_id=?", (row["id"],))
        db.execute("DELETE FROM library WHERE source_id=?", (row["id"],))
    elif table == "library_collections":
        db.execute(
            "DELETE FROM library_memberships WHERE source_id=? AND collection=?",
            (row["source_id"], row["name"]),
        )
    elif table == "library_artwork":
        from ..library.store import unlink_artwork

        unlink_artwork(db, row["cache_key"])

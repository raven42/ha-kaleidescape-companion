"""Fixed-table inspection and transactional purge on the repository worker."""

import hashlib
import json
from datetime import UTC, datetime

from .journal import JournalError, invalid

TABLE_KEYS = {
    "viewings": "id",
    "sessions": "id",
    "requests": "request_id",
    "manual_audit": "request_id",
    "maintenance_audit": "request_id",
    "import_audit": "request_id",
    "schema_metadata": "singleton",
    "library_sources": "id",
    "library_titles": "id",
    "library_collections": "source_id,name",
    "library_memberships": "title_id,collection",
    "library_artwork": "cache_key",
}
PAGE_SIZE = 25


def inspect_database(db, table: str, offset: int, revision: int | None) -> dict:
    """Never accept SQL, table identifiers, or paths beyond this fixed allowlist."""
    if (
        table not in TABLE_KEYS
        or type(offset) is not int
        or not 0 <= offset <= 10_000_000
    ):
        raise invalid("Invalid database page")
    current = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
    if revision is not None and (type(revision) is not int or revision != current):
        raise JournalError(
            "refresh_required", "Database changed; refresh the first page"
        )
    counts = {
        name: db.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        for name in TABLE_KEYS
    }
    rows = db.execute(
        f"SELECT * FROM {table} ORDER BY {TABLE_KEYS[table]} LIMIT ? OFFSET ?",
        (PAGE_SIZE + 1, offset),
    ).fetchall()
    return {
        "table": table,
        "tables": counts,
        "revision": current,
        "offset": offset,
        "items": [dict(row) for row in rows[:PAGE_SIZE]],
        "has_more": len(rows) > PAGE_SIZE,
    }


def purge_database(db, request_id: str, data: dict, actor_id: str | None) -> dict:
    """Remove content/references while retaining content-free retry barriers."""
    fingerprint = hashlib.sha256(
        json.dumps(["purge", data, actor_id], sort_keys=True, allow_nan=False).encode()
    ).hexdigest()
    if cached := db.execute(
        "SELECT * FROM requests WHERE request_id = ?", (request_id,)
    ).fetchone():
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID was used for different data or actor"
            )
        return json.loads(cached["response"])
    with db:
        revision = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        if revision != data["expected_revision"]:
            raise JournalError("conflict", "Database changed; refresh before purging")
        selected = "id IN (SELECT value FROM json_each(?))"
        parameters = (json.dumps(data["viewing_ids"]),)
        if data["all"]:
            selected, parameters = "1 = 1", ()
        count = db.execute(
            f"SELECT count(*) FROM viewings WHERE {selected}", parameters
        ).fetchone()[0]
        if not data["all"] and count != len(data["viewing_ids"]):
            raise JournalError("not_found", "A selected viewing no longer exists")
        # Version 1 requests have no audit row: match their response too.
        db.execute(
            "UPDATE requests SET response = '{\"purged\":true}' WHERE "
            "json_extract(response, '$.viewing.id') IN "
            f"(SELECT id FROM viewings WHERE {selected})",
            parameters,
        )
        db.execute(
            "DELETE FROM manual_audit WHERE viewing_id IN "
            f"(SELECT id FROM viewings WHERE {selected})",
            parameters,
        )
        db.execute(
            "DELETE FROM sessions WHERE viewing_id IN "
            f"(SELECT id FROM viewings WHERE {selected})",
            parameters,
        )
        db.execute(f"DELETE FROM viewings WHERE {selected}", parameters)
        db.execute("UPDATE schema_metadata SET revision = revision + 1")
        result = {"purged_count": count, "revision": revision + 1}
        db.execute(
            "INSERT INTO requests VALUES (?, ?, ?)",
            (request_id, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO maintenance_audit VALUES (?, ?, 'purge', ?, ?, ?)",
            (request_id, actor_id, count, revision + 1, datetime.now(UTC).isoformat()),
        )
    return result

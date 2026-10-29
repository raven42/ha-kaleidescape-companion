"""Fixed-table inspection and transactional purge on the repository worker."""

import hashlib
import json
from datetime import UTC, datetime

from .models import JournalError, invalid

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
    "library_collection_intents": "request_id",
}
PAGE_SIZES = (10, 25, 100, 500)
MAX_PAGE_BYTES = 8 * 1024 * 1024


def inspect_database(
    db,
    table: str,
    offset: int,
    revision: int | None,
    limit: int = 25,
    query: str = "",
    sort: str | None = None,
    descending: bool = False,
) -> dict:
    """Never accept SQL, table identifiers, or paths beyond this fixed allowlist."""
    if (
        not isinstance(table, str)
        or table not in TABLE_KEYS
        or type(offset) is not int
        or not 0 <= offset <= 10_000_000
        or type(limit) is not int
        or limit not in PAGE_SIZES
        or not isinstance(query, str)
        or len(query) > 500
        or "\x00" in query
        or type(descending) is not bool
    ):
        raise invalid("Invalid database page")
    current = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
    if revision is not None and (type(revision) is not int or revision != current):
        raise JournalError(
            "refresh_required", "Database changed; refresh the first page"
        )
    # Column identifiers come only from this integration's local migrated schema.
    # Imports never install schemas. Caller-supplied sort strings must match one
    # of these columns exactly before being quoted into the fixed SELECT.
    columns = [row[1] for row in db.execute(f"PRAGMA table_info({table})")]
    sort = TABLE_KEYS[table].split(",")[0] if sort is None else sort
    if not isinstance(sort, str) or sort not in columns:
        raise invalid("Invalid database sort")

    def quoted(column):
        return '"' + column.replace('"', '""') + '"'

    where, values = "", ()
    if query:
        pattern = (
            "%"
            + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        where = " WHERE " + " OR ".join(
            f"CAST({quoted(column)} AS TEXT) LIKE ? ESCAPE '\\'" for column in columns
        )
        values = (pattern,) * len(columns)
    counts = {
        name: db.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        for name in TABLE_KEYS
    }
    total = (
        db.execute(f"SELECT count(*) FROM {table}{where}", values).fetchone()[0]
        if query
        else counts[table]
    )
    order = quoted(sort) + " COLLATE NOCASE " + ("DESC" if descending else "ASC")
    items, byte_size, has_more = [], 0, False
    for row in db.execute(
        f"SELECT * FROM {table}{where} ORDER BY {order},{TABLE_KEYS[table]} "
        "LIMIT ? OFFSET ?",
        (*values, limit + 1, offset),
    ):
        if len(items) == limit:
            has_more = True
            break
        item = dict(row)
        byte_size += len(json.dumps(item, ensure_ascii=True).encode())
        if byte_size > MAX_PAGE_BYTES:
            raise JournalError(
                "database_page_too_large", "Reduce the database rows per page"
            )
        items.append(item)
    page = {
        "table": table,
        "tables": counts,
        "revision": current,
        "offset": offset,
        "items": items,
        "has_more": has_more,
        "limit": limit,
        "total": total,
        "columns": columns,
        "sort": sort,
        "descending": descending,
        "query": query,
    }
    if len(json.dumps(page, ensure_ascii=True).encode()) > MAX_PAGE_BYTES:
        raise JournalError(
            "database_page_too_large", "Reduce the database rows per page"
        )
    return page


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

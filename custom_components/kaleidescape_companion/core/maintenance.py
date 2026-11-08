"""Fixed-table inspection and transactional purge on the repository worker."""

import hashlib
import json
from datetime import UTC, datetime

from .database_query import OPERATORS, compile_query
from .database_schema import DELETABLE, MAIN_TABLES, TABLE_KEYS, references, schema
from .models import JournalError, invalid

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
        or not 1 <= limit <= 500
        or not isinstance(query, str)
        or len(query) > 2000
        or "\x00" in query
        or type(descending) is not bool
    ):
        raise invalid("Invalid database page")
    meta = db.execute(
        "SELECT revision,settings_revision FROM schema_metadata"
    ).fetchone()
    current = (
        meta["settings_revision"]
        if table == "settings"
        else meta["revision"] + meta["settings_revision"]
        if table in {"requests", "schema_metadata"}
        else meta["revision"]
    )
    if revision is not None and (type(revision) is not int or revision != current):
        raise JournalError(
            "refresh_required", "Database changed; refresh the first page"
        )
    # Column identifiers come only from this integration's local migrated schema.
    # Imports never install schemas. Caller-supplied sort strings must match one
    # of these columns exactly before being quoted into the fixed SELECT.
    descriptions, fields = schema(db, table)
    if table == "library":
        # Retain access to stored columns when invoice values override them.
        for name in (
            "purchased_on",
            "purchase_price",
            "retail_price",
            "order_id",
            "href",
        ):
            original = fields[name]
            stored = f"stored_{name}"
            description = {
                key: value for key, value in original.items() if key != "expression"
            }
            description.update(name=stored, editable=False, primary=False)
            descriptions.append(description)
            fields[stored] = {**description, "expression": f'library."{name}"'}

    columns = [item["name"] for item in descriptions]
    sort = TABLE_KEYS[table].split(",")[0] if sort is None else sort
    if not isinstance(sort, str) or sort not in columns:
        raise invalid("Invalid database sort")

    if table == "library":
        # The visible summary comes from the earliest linked invoice, even when
        # that invoice's field is NULL. Keep predicates and ordering in sync.
        invoice = "FROM purchase_records p WHERE p.library_id=library.id"
        first = " ORDER BY p.purchased_on IS NULL,p.purchased_on,p.id LIMIT 1)"
        for name in ("purchase_price", "retail_price", "order_id", "href"):
            fields[name]["expression"] = (
                f"(CASE WHEN EXISTS (SELECT 1 {invoice}) "
                f'THEN (SELECT p.{name} {invoice}{first} ELSE library."{name}" END)'
            )
        fields["purchased_on"]["expression"] = (
            f"COALESCE(library.purchased_on, (SELECT p.purchased_on {invoice}{first})"
        )
    predicate, values = compile_query(query, fields)
    where = " WHERE " + predicate if predicate else ""
    counts = {
        name: db.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        for name in TABLE_KEYS
    }
    total = (
        db.execute(f"SELECT count(*) FROM {table}{where}", values).fetchone()[0]
        if query
        else counts[table]
    )
    order = (
        fields[sort]["expression"]
        + " COLLATE NOCASE "
        + ("DESC" if descending else "ASC")
    )
    items, tokens, byte_size, has_more = [], [], 0, False
    for row in db.execute(
        f"SELECT * FROM {table}{where} ORDER BY {order},{TABLE_KEYS[table]} "
        "LIMIT ? OFFSET ?",
        (*values, limit + 1, offset),
    ):
        if len(items) == limit:
            has_more = True
            break
        item = dict(row)
        tokens.append(row_token(item))
        if table == "library":
            from ..library.purchases import history_for, summary

            for name in (
                "purchased_on",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
            ):
                item[f"stored_{name}"] = item[name]
            history = history_for(db, item["id"])
            item["purchase_history"] = json.dumps(history)
            if history:
                item.update(summary(history))
                item["purchased_on"] = (
                    item["purchased_on"] or history[0]["purchased_on"]
                )
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
        "dataset_revision": meta["revision"],
        "main_tables": MAIN_TABLES,
        "schema": descriptions,
        "references": references(db, table),
        "query_fields": [
            {key: value for key, value in item.items() if key != "expression"}
            for item in fields.values()
        ],
        "operators": OPERATORS,
        "deletable": table in DELETABLE,
        "row_tokens": tokens,
    }
    if len(json.dumps(page, ensure_ascii=True).encode()) > MAX_PAGE_BYTES:
        raise JournalError(
            "database_page_too_large", "Reduce the database rows per page"
        )
    return page


MAX_REFERENCING_ROWS = 10


def referencing_rows(db, table, key, token, revision):
    """Find bounded incoming links for one revision-checked administrator row."""
    if not isinstance(table, str) or table not in TABLE_KEYS:
        raise invalid("Invalid database table")
    keys = TABLE_KEYS[table].split(",")
    if (
        not isinstance(key, dict)
        or set(key) != set(keys)
        or not isinstance(token, str)
        or not isinstance(revision, int)
        or isinstance(revision, bool)
    ):
        raise invalid("Invalid database row identity")
    values = tuple(key[name] for name in keys)
    if any(
        not isinstance(value, (str, int))
        or isinstance(value, bool)
        or len(str(value)) > 512
        for value in values
    ):
        raise invalid("Invalid database row key")
    meta = db.execute(
        "SELECT revision,settings_revision FROM schema_metadata"
    ).fetchone()
    current = (
        meta["settings_revision"]
        if table == "settings"
        else meta["revision"] + meta["settings_revision"]
        if table in {"requests", "schema_metadata"}
        else meta["revision"]
    )
    if current != revision:
        raise JournalError(
            "refresh_required", "Database changed; refresh the selected entry"
        )
    where = " AND ".join(f'"{name}"=?' for name in keys)
    selected = db.execute(f'SELECT * FROM "{table}" WHERE {where}', values).fetchone()
    if selected is None:
        raise JournalError("not_found", "Selected entry no longer exists")
    selected = dict(selected)
    if row_token(selected) != token:
        raise JournalError(
            "refresh_required", "Selected entry changed; refresh the database"
        )
    groups = []
    seen = set()
    for child in TABLE_KEYS:
        for reference in references(db, child):
            if reference["table"] != table:
                continue
            mapping = reference["key"]
            signature = (child, tuple(sorted(mapping.items())))
            if signature in seen or any(
                name not in selected or selected[name] is None for name in mapping
            ):
                continue
            seen.add(signature)
            child_keys = TABLE_KEYS[child].split(",")
            child_where = " AND ".join(f'"{local}"=?' for local in mapping.values())
            columns = ",".join(f'"{name}"' for name in child_keys)
            matches = db.execute(
                f'SELECT {columns} FROM "{child}" WHERE {child_where} LIMIT ?',
                (*[selected[name] for name in mapping], MAX_REFERENCING_ROWS + 1),
            ).fetchall()
            if matches:
                groups.append(
                    {
                        "table": child,
                        "key": {local: parent for parent, local in mapping.items()},
                        "items": [
                            {name: row[name] for name in child_keys}
                            for row in matches[:MAX_REFERENCING_ROWS]
                        ],
                        "more": len(matches) > MAX_REFERENCING_ROWS,
                    }
                )
    return {"groups": groups}


def row_token(row):
    return hashlib.sha256(
        json.dumps(dict(row), sort_keys=True, allow_nan=False).encode()
    ).hexdigest()


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

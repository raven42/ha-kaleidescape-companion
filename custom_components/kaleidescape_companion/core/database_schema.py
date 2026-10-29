"""Trusted table policies shared by inspection, safe queries and mutations."""

TABLE_KEYS = {
    "viewings": "id",
    "sessions": "id",
    "library_titles": "id",
    "library_collections": "source_id,name",
    "library_sources": "id",
    "library_artwork": "cache_key",
    "settings": "owner,key",
    "library_memberships": "title_id,collection",
    "requests": "request_id",
    "manual_audit": "request_id",
    "maintenance_audit": "request_id",
    "import_audit": "request_id",
    "database_audit": "request_id",
    "schema_metadata": "singleton",
    "library_collection_intents": "request_id",
}
MAIN_TABLES = tuple(list(TABLE_KEYS)[:6])
EDITABLE = {
    "viewings": {
        "title",
        "started_at",
        "ended_at",
        "duration_seconds",
        "watched_seconds",
        "status",
        "notes",
    },
    "sessions": {"title", "duration_seconds", "watched_seconds"},
    "library_titles": {
        "title",
        "data",
        "purchased_on",
        "first_seen",
        "last_seen",
        "available",
    },
    "library_collections": {"first_seen", "last_seen", "available"},
    "library_sources": {"first_seen"},
    "settings": {"value"},
}
DELETABLE = {*EDITABLE, "library_artwork", "library_memberships"}
JSON_FIELDS = {
    "library_titles": {
        "actors": "array",
        "directors": "array",
        "writers": "array",
        "studios": "array",
        "genres": "array",
        "formats": "array",
        "rating": "text",
        "year": "number",
        "edition": "text",
        "duration_seconds": "number",
        "synopsis": "text",
    },
}


def schema(db, table):
    columns = []
    for row in db.execute(f'PRAGMA table_info("{table}")'):
        name, kind = row[1], row[2]
        columns.append(
            {
                "name": name,
                "type": "json"
                if (table, name) in {("library_titles", "data"), ("settings", "value")}
                else "number"
                if kind in {"INTEGER", "REAL"}
                else "text",
                "nullable": not bool(row[3]),
                "editable": name in EDITABLE.get(table, set()),
                "primary": bool(row[5]),
            }
        )
    fields = {
        item["name"]: {**item, "expression": '"' + item["name"] + '"'}
        for item in columns
    }
    for name, kind in JSON_FIELDS.get(table, {}).items():
        fields[name] = {
            "name": name,
            "type": kind,
            "nullable": True,
            "editable": False,
            "expression": f"json_extract(data,'$.{name}')",
        }
        fields[f"data.{name}"] = {**fields[name], "name": f"data.{name}"}
    return columns, fields

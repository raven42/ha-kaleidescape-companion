"""Worker-only cached catalog queries and a bounded private cover-file cache."""

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .journal import JournalError, invalid
from .security import private_directory, private_file

ARRAY_FIELDS = ("actors", "directors", "writers", "studios", "genres")
PUBLIC_FIELDS = (
    *ARRAY_FIELDS,
    "rating",
    "year",
    "edition",
    "duration_seconds",
    "synopsis",
)
MAX_ARTWORK_BYTES = 5 * 1024 * 1024
STATUS_SQL = """CASE WHEN s.collections_synced_at IS NULL
    OR t.first_seen>s.collections_synced_at THEN 'unknown'
    WHEN EXISTS (SELECT 1 FROM library_memberships m WHERE m.title_id=t.id
        AND lower(m.collection)='paused') THEN 'in_progress'
    WHEN EXISTS (SELECT 1 FROM library_memberships m WHERE m.title_id=t.id
        AND lower(m.collection)='played') THEN 'watched'
    ELSE 'unwatched' END"""


def source_id(origin: str) -> str:
    return hashlib.sha256(origin.encode()).hexdigest()


def title_id(source: str, handle: str) -> str:
    return hashlib.sha256(f"{source}:{handle}".encode()).hexdigest()


def now() -> str:
    return datetime.now(UTC).isoformat()


def changed(db, source):
    db.execute("UPDATE library_sources SET revision=revision+1 WHERE id=?", (source,))
    db.execute("UPDATE schema_metadata SET revision=revision+1")


def save_catalog(db, origin, rows, collections=None, *, detected_at=None):
    """Commit a complete listing; preserve the old generation on failure."""
    source, seen = source_id(origin), detected_at or now()
    with db:
        db.execute(
            """INSERT OR IGNORE INTO library_sources(id,origin,first_seen) VALUES
                (?,?,?)""",
            (source, origin, seen),
        )
        db.execute("UPDATE library_titles SET available=0 WHERE source_id=?", (source,))
        for item in rows:
            handle = item["source_handle"]
            fingerprint = hashlib.sha256(
                json.dumps(item, sort_keys=True).encode()
            ).hexdigest()
            existing = db.execute(
                "SELECT data,base_hash,metadata_synced_at FROM library_titles "
                "WHERE source_id=? AND source_handle=?",
                (source, handle),
            ).fetchone()
            data = (
                json.loads(existing[0])
                if existing
                else {
                    **{key: [] for key in ARRAY_FIELDS},
                    "duration_seconds": None,
                    "synopsis": "",
                }
            )
            base = {
                key: value
                for key, value in item.items()
                if key not in {"source_handle", "source_group", "title"}
            }
            if (
                existing
                and existing["metadata_synced_at"]
                and existing["base_hash"] == fingerprint
            ):
                base = {
                    key: value
                    for key, value in base.items()
                    if key not in {"directors", "genres"}
                }
            data.update(base)
            db.execute(
                """INSERT INTO library_titles
                (id,source_id,source_handle,source_group,title,title_search,
                 base_hash,data,first_seen,last_seen)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(source_id,source_handle) DO UPDATE SET
                source_group=excluded.source_group,title=excluded.title,
                title_search=excluded.title_search,
                fetched_at=CASE WHEN library_titles.base_hash!=excluded.base_hash
                    THEN NULL ELSE library_titles.fetched_at END,
                base_hash=excluded.base_hash,data=excluded.data,
                last_seen=excluded.last_seen,available=1""",
                (
                    title_id(source, handle),
                    source,
                    handle,
                    item["source_group"],
                    item["title"],
                    item["title"].casefold(),
                    fingerprint,
                    json.dumps(data),
                    seen,
                    seen,
                ),
            )
        db.execute(
            "UPDATE library_sources SET last_synced_at=? WHERE id=?", (seen, source)
        )
        if collections is not None:
            db.execute(
                "UPDATE library_collections SET available=0 WHERE source_id=?",
                (source,),
            )
            db.execute("DELETE FROM library_memberships WHERE source_id=?", (source,))
            for name, handles in collections.items():
                db.execute(
                    """INSERT INTO library_collections VALUES (?,?,?,?,1)
                    ON CONFLICT(source_id,name) DO UPDATE SET
                    last_seen=excluded.last_seen,available=1""",
                    (source, name, seen, seen),
                )
                for handle in handles:
                    row = db.execute(
                        """SELECT id FROM library_titles WHERE source_id=? AND
                            source_handle=? AND available=1""",
                        (source, handle),
                    ).fetchone()
                    if row is None:
                        raise JournalError(
                            "library_changed",
                            "The source changed during collection sync; retry later",
                        )
                    db.execute(
                        "INSERT INTO library_memberships VALUES (?,?,?)",
                        (source, row[0], name),
                    )
            db.execute(
                "UPDATE library_sources SET collections_synced_at=? WHERE id=?",
                (seen, source),
            )
        changed(db, source)


def detail_candidates(db, source):
    """Return a bounded worker snapshot; no title-based journal identity guesses."""
    return [
        dict(row)
        for row in db.execute(
            """SELECT id,source_handle,fetched_at,metadata_synced_at,
                artwork_path,artwork_key
        FROM library_titles WHERE source_id=? AND available=1
        ORDER BY fetched_at IS NOT NULL,fetched_at,id LIMIT 10000""",
            (source,),
        )
    ]


def save_details(db, source, id, details, include_metadata):
    row = db.execute(
        "SELECT data FROM library_titles WHERE id=? AND source_id=?", (id, source)
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Library title is no longer available")
    data = json.loads(row[0])
    if include_metadata:
        data.update(
            {key: value for key, value in details.items() if key in PUBLIC_FIELDS}
        )
    with db:
        db.execute(
            """UPDATE library_titles SET data=?,fetched_at=?,
            metadata_synced_at=CASE WHEN ? THEN ? ELSE metadata_synced_at END,
            artwork_path=? WHERE id=? AND source_id=?""",
            (
                json.dumps(data),
                now(),
                include_metadata,
                now(),
                details.get("artwork_path"),
                id,
                source,
            ),
        )
        changed(db, source)


def library_info(db, source):
    row = db.execute(
        """SELECT last_synced_at,collections_synced_at,revision FROM
            library_sources WHERE id=?""",
        (source,),
    ).fetchone()
    return {
        **(
            dict(row)
            if row
            else {"last_synced_at": None, "collections_synced_at": None, "revision": 0}
        ),
        "title_count": db.execute(
            "SELECT count(*) FROM library_titles WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        "group_count": db.execute(
            "SELECT count(DISTINCT source_group) FROM library_titles "
            "WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        "collection_count": db.execute(
            """SELECT count(*) FROM library_collections WHERE source_id=? AND
                available=1""",
            (source,),
        ).fetchone()[0],
        "artwork_bytes": db.execute(
            "SELECT coalesce(sum(byte_size),0) FROM library_artwork"
        ).fetchone()[0],
    }


def library_list(db, source, filters):
    """Query local SQLite with parameters and fixed sort expressions."""
    allowed = {
        "query",
        "collection",
        "actor",
        "director",
        "writer",
        "studio",
        "rating",
        "status",
        "sort",
        "descending",
        "offset",
        "revision",
    }
    if not isinstance(filters, dict) or set(filters) - allowed:
        raise invalid("Unknown library filters")
    offset = filters.get("offset", 0)
    descending = filters.get("descending", False)
    if (
        type(offset) is not int
        or not 0 <= offset <= 10_000
        or type(descending) is not bool
    ):
        raise invalid("Invalid library page")
    sort = filters.get("sort", "name")
    sorts = {
        "name": "t.title_search",
        "length": "json_extract(t.data,'$.duration_seconds')",
        "watched": "watched_status",
    }
    if not isinstance(sort, str) or sort not in sorts:
        raise invalid("Invalid library sort")
    info = library_info(db, source)
    revision = filters.get("revision")
    if revision is not None and (
        type(revision) is not int or revision != info["revision"]
    ):
        raise JournalError(
            "refresh_required", "Library changed; refresh the first page"
        )
    clauses, values = ["t.source_id=?", "t.available=1"], [source]
    for key in (
        "query",
        "collection",
        "actor",
        "director",
        "writer",
        "studio",
        "rating",
        "status",
    ):
        value = filters.get(key, "")
        if not isinstance(value, str) or len(value) > 500 or "\x00" in value:
            raise invalid("Invalid library filter")
        if not value:
            continue
        if key == "query":
            clauses.append("t.title_search LIKE ? ESCAPE '\\'")
            values.append(
                "%"
                + value.casefold()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
                + "%"
            )
        elif key == "collection":
            clauses.append(
                "EXISTS (SELECT 1 FROM library_memberships m "
                "WHERE m.title_id=t.id AND m.collection=?)"
            )
            values.append(value)
        elif key in {"actor", "director", "writer", "studio"}:
            path = {
                "actor": "actors",
                "director": "directors",
                "writer": "writers",
                "studio": "studios",
            }[key]
            clauses.append(
                f"EXISTS (SELECT 1 FROM json_each(t.data,'$.{path}') WHERE value=?)"
            )
            values.append(value)
        elif key == "rating":
            clauses.append("json_extract(t.data,'$.rating')=?")
            values.append(value)
        else:
            if value not in {"watched", "unwatched", "in_progress", "unknown"}:
                raise invalid("Invalid library status")
            clauses.append(f"({STATUS_SQL})=?")
            values.append(value)
    where = " AND ".join(clauses)
    join = "library_titles t JOIN library_sources s ON s.id=t.source_id"
    total = db.execute(f"SELECT count(*) FROM {join} WHERE {where}", values).fetchone()[
        0
    ]
    order = sorts[sort] + (" DESC" if descending else " ASC")
    rows = db.execute(
        f"""SELECT t.*,({STATUS_SQL}) watched_status FROM {join} WHERE {where}
        ORDER BY {order},t.id LIMIT 51 OFFSET ?""",
        (*values, offset),
    ).fetchall()
    items = []
    for row in rows[:50]:
        data = json.loads(row["data"])
        items.append(
            {
                **{key: data.get(key) for key in PUBLIC_FIELDS},
                **{
                    key: row[key]
                    for key in (
                        "id",
                        "title",
                        "first_seen",
                        "last_seen",
                        "metadata_synced_at",
                        "artwork_key",
                        "watched_status",
                    )
                },
                "collections": [
                    value[0]
                    for value in db.execute(
                        """SELECT collection FROM library_memberships WHERE
                            title_id=? ORDER BY collection""",
                        (row["id"],),
                    )
                ],
            }
        )
    facets = {}
    truncated = []
    for key in ARRAY_FIELDS:
        options = [
            row[0]
            for row in db.execute(
                """SELECT DISTINCT value FROM library_titles t,json_each(t.data,?)
                    WHERE source_id=? AND available=1 ORDER BY value LIMIT 501""",
                (f"$.{key}", source),
            )
        ]
        if len(options) > 500:
            truncated.append(key)
        facets[key] = options[:500]
    facets["rating"] = [
        row[0]
        for row in db.execute(
            """SELECT DISTINCT json_extract(data,'$.rating') FROM library_titles
                WHERE source_id=? AND available=1 AND
                json_extract(data,'$.rating')!='' ORDER BY 1 LIMIT 500""",
            (source,),
        )
    ]
    facets["collections"] = [
        row[0]
        for row in db.execute(
            """SELECT name FROM library_collections WHERE source_id=? AND
                available=1 ORDER BY name""",
            (source,),
        )
    ]
    return {
        "items": items,
        "total": total,
        "offset": offset,
        "has_more": len(rows) > 50,
        "revision": info["revision"],
        "facets": facets,
        "truncated_facets": truncated,
    }


def image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def cache_open(db, directory: Path):
    """Tighten managed files and remove only recognized orphan/temp names."""
    private_directory(directory)
    keys = {row[0] for row in db.execute("SELECT cache_key FROM library_artwork")}
    for path in directory.iterdir():
        if re.fullmatch(r"[a-f0-9]{64}\.img|[a-f0-9]{32}\.tmp", path.name):
            private_file(path)
            if path.suffix == ".tmp" or path.stem not in keys:
                path.unlink()
    with db:
        for key in keys:
            if not (directory / f"{key}.img").exists():
                db.execute(
                    "UPDATE library_titles SET artwork_key=NULL WHERE artwork_key=?",
                    (key,),
                )
                db.execute("DELETE FROM library_artwork WHERE cache_key=?", (key,))
                db.execute("UPDATE library_sources SET revision=revision+1")
                db.execute("UPDATE schema_metadata SET revision=revision+1")


def cache_trim(db, directory: Path, budget: int, incoming=0, keep=None):
    total = db.execute(
        "SELECT coalesce(sum(byte_size),0) FROM library_artwork"
    ).fetchone()[0]
    evicted = []
    for row in db.execute(
        "SELECT cache_key,byte_size FROM library_artwork ORDER BY stored_at,cache_key"
    ).fetchall():
        if total + incoming <= budget:
            break
        if row[0] == keep:
            continue
        path = directory / f"{row[0]}.img"
        private_file(path)
        evicted.append(path)
        db.execute(
            "UPDATE library_titles SET artwork_key=NULL WHERE artwork_key=?", (row[0],)
        )
        db.execute("DELETE FROM library_artwork WHERE cache_key=?", (row[0],))
        total -= row[1]
    return evicted


def save_artwork(
    db,
    directory: Path,
    source: str,
    id: str,
    data: bytes,
    content_type: str,
    budget: int,
):
    if len(data) > MAX_ARTWORK_BYTES or image_type(data) != content_type:
        raise JournalError("library_artwork", "Cover image was rejected")
    if (
        db.execute(
            "SELECT 1 FROM library_titles WHERE id=? AND source_id=?", (id, source)
        ).fetchone()
        is None
    ):
        raise JournalError("not_found", "Library title is no longer available")
    key = hashlib.sha256(data).hexdigest()
    path, temporary = directory / f"{key}.img", directory / f"{uuid4().hex}.tmp"
    private_file(path)
    file_existed = path.exists()
    try:
        with db:
            existing = db.execute(
                "SELECT 1 FROM library_artwork WHERE cache_key=?", (key,)
            ).fetchone()
            evicted = cache_trim(
                db, directory, budget, 0 if existing else len(data), keep=key
            )
            try:
                descriptor = os.open(
                    temporary,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o600,
                )
                with os.fdopen(descriptor, "wb") as file:
                    file.write(data)
                os.replace(temporary, path)
                db.execute(
                    "INSERT OR IGNORE INTO library_artwork VALUES (?,?,?,?)",
                    (key, content_type, len(data), now()),
                )
                db.execute(
                    "UPDATE library_titles SET artwork_key=? "
                    "WHERE id=? AND source_id=?",
                    (key, id, source),
                )
                changed(db, source)
            finally:
                temporary.unlink(missing_ok=True)
    except BaseException:
        if not file_existed:
            path.unlink(missing_ok=True)
        raise
    for old_path in evicted:
        old_path.unlink(missing_ok=True)


def read_artwork(db, directory: Path, source: str, key: str):
    if not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{64}", key):
        raise invalid("Invalid cover identity")
    row = db.execute(
        """SELECT content_type FROM library_artwork a WHERE cache_key=? AND EXISTS
            (SELECT 1 FROM library_titles WHERE source_id=? AND
            artwork_key=a.cache_key)""",
        (key, source),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Cover is not cached")
    path = directory / f"{key}.img"
    private_file(path)
    try:
        with path.open("rb") as file:
            data = file.read(MAX_ARTWORK_BYTES + 1)
    except FileNotFoundError as error:
        raise JournalError("not_found", "Cover is not cached") from error
    if (
        len(data) > MAX_ARTWORK_BYTES
        or hashlib.sha256(data).hexdigest() != key
        or image_type(data) != row[0]
    ):
        raise JournalError("not_found", "Cached cover is unavailable")
    return data, row[0]

"""Worker-only cached catalog queries and a bounded private cover-file cache."""

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from ..core.models import JournalError, invalid
from ..core.security import private_directory, private_file
from .browse import ARRAY_FIELDS, PUBLIC_FIELDS
from .summary import record_additions

MAX_ARTWORK_BYTES = 5 * 1024 * 1024


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
    rows = tuple(rows)
    source, seen = source_id(origin), detected_at or now()
    with db:
        db.execute(
            """INSERT OR IGNORE INTO library_sources(id,origin,first_seen) VALUES
                (?,?,?)""",
            (source, origin, seen),
        )
        batch, recent_groups = record_additions(db, source, rows, seen)
        db.execute("UPDATE library SET available=0 WHERE source_id=?", (source,))
        for item in rows:
            handle = item["source_handle"]
            fingerprint = hashlib.sha256(
                json.dumps(item, sort_keys=True).encode()
            ).hexdigest()
            existing = db.execute(
                "SELECT data,base_hash,metadata_synced_at FROM library "
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
                """INSERT INTO library
                (id,source_id,source_handle,source_group,title,title_search,
                 base_hash,data,first_seen,last_seen,addition_batch)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(source_id,source_handle) DO UPDATE SET
                source_group=excluded.source_group,title=excluded.title,
                addition_batch=excluded.addition_batch,
                title_search=excluded.title_search,
                fetched_at=CASE WHEN library.base_hash!=excluded.base_hash
                    THEN NULL ELSE library.fetched_at END,
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
                    batch if item["source_group"] in recent_groups else None,
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
                        """SELECT id FROM library WHERE source_id=? AND
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
        FROM library WHERE source_id=? AND available=1
        ORDER BY fetched_at IS NOT NULL,fetched_at,id LIMIT 10000""",
            (source,),
        )
    ]


def save_details(db, source, id, details, include_metadata):
    row = db.execute(
        "SELECT data FROM library WHERE id=? AND source_id=?", (id, source)
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
            """UPDATE library SET data=?,fetched_at=?,
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
                    "UPDATE library SET artwork_key=NULL WHERE artwork_key=?",
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
        db.execute("UPDATE library SET artwork_key=NULL WHERE artwork_key=?", (row[0],))
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
            "SELECT 1 FROM library WHERE id=? AND source_id=?", (id, source)
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
                    "UPDATE library SET artwork_key=? WHERE id=? AND source_id=?",
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
            (SELECT 1 FROM library WHERE source_id=? AND
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

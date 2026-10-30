"""Worker-only, actor-scoped UI settings with atomic field patches and exact retries."""

import hashlib
import json
from datetime import UTC, datetime

from ..ui.preferences import (
    DATABASE_DEFAULTS,
    JOURNAL_DEFAULTS,
    LIBRARY_DEFAULTS,
    validate_database,
    validate_journal,
    validate_library,
    validate_shared,
)
from .models import JournalError


def seed(db, legacy):
    """Copy old HA display defaults once; new users inherit this initial snapshot."""
    count = legacy.get("library_default_count", 100)
    count = next((n for n in (25, 100, 1000) if type(count) is int and count <= n), 100)
    view = legacy.get("library_default_view", "list")
    defaults = {
        **LIBRARY_DEFAULTS,
        "page_size": count,
        "view": view if view in ("list", "covers") else "list",
    }
    shared = validate_shared(
        {"hidden_collections": legacy.get("library_excluded_collections", [])}
    )
    with db:
        for key, value in (("library_defaults", defaults), ("library_shared", shared)):
            changed = db.execute(
                "INSERT OR IGNORE INTO settings VALUES (?,?,?,?,?)",
                ("household", key, json.dumps(value), 1, datetime.now(UTC).isoformat()),
            )
            if changed.rowcount:
                db.execute(
                    "UPDATE schema_metadata SET settings_revision=settings_revision+1"
                )


def get(db, actor, shared=False, area="library"):
    if area not in ("library", "database", "journal") or (shared and area != "library"):
        raise JournalError("invalid_request", "Unknown UI preference area")
    owner, key = ("household", "library_shared") if shared else (f"user:{actor}", area)
    row = db.execute(
        "SELECT value,revision FROM settings WHERE owner=? AND key=?", (owner, key)
    ).fetchone()
    if row:
        values = json.loads(row["value"])
    elif area == "database":
        values = DATABASE_DEFAULTS
    elif area == "journal":
        values = JOURNAL_DEFAULTS
    elif shared:
        values = {"hidden_collections": []}
    else:
        defaults = db.execute(
            "SELECT value FROM settings WHERE owner='household' "
            "AND key='library_defaults'"
        ).fetchone()
        values = json.loads(defaults[0]) if defaults else LIBRARY_DEFAULTS
    # Add new UI defaults at read time without rewriting existing personal rows.
    if not shared:
        values = (
            validate_database
            if area == "database"
            else validate_journal
            if area == "journal"
            else validate_library
        )({}, values)
    return {"values": values, "revision": row["revision"] if row else 0}


def update(db, actor, shared, request, revision, patch, area="library"):
    fingerprint = hashlib.sha256(
        json.dumps(
            [
                "ui_settings",
                actor,
                shared,
                revision,
                patch,
                *([area] if area != "library" else []),
            ],
            sort_keys=True,
        ).encode()
    ).hexdigest()
    cached = db.execute(
        "SELECT * FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if cached:
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID belongs to different settings or actor"
            )
        return json.loads(cached["response"])
    current = get(db, actor, shared, area)
    if type(revision) is not int or revision < 0:
        raise JournalError("invalid_request", "Invalid UI settings revision")
    # Preferences are reversible field setters, not journal corrections. Merge
    # against the current row; the last accepted edit to a field wins across tabs.
    revision = current["revision"]
    values = (
        validate_shared
        if shared
        else validate_database
        if area == "database"
        else validate_journal
        if area == "journal"
        else validate_library
    )(patch, current["values"])
    owner, key = ("household", "library_shared") if shared else (f"user:{actor}", area)
    result = {"revision": revision + 1}
    with db:
        db.execute(
            """INSERT INTO settings VALUES (?,?,?,?,?)
            ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value,
            revision=excluded.revision,updated_at=excluded.updated_at""",
            (
                owner,
                key,
                json.dumps(values),
                revision + 1,
                datetime.now(UTC).isoformat(),
            ),
        )
        db.execute("UPDATE schema_metadata SET settings_revision=settings_revision+1")
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request, fingerprint, json.dumps(result)),
        )
    return result


def excluded(db):
    return get(db, None, True)["values"]["hidden_collections"]

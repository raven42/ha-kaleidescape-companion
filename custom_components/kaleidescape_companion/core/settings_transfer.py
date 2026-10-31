"""Atomic UI/log-settings transfer; native HA changes use the options flow."""

import hashlib
import json
from datetime import UTC, datetime

from ..ui.preferences import (
    validate_database,
    validate_journal,
    validate_library,
    validate_search,
    validate_shared,
)
from . import preferences
from .models import JournalError, identifier, invalid

VALIDATORS = {
    "library": validate_library,
    "journal": validate_journal,
    "database": validate_database,
    "search": validate_search,
}


def apply(db, operation, actor, request, categories):
    rows = []
    for area, value in categories.get("browsing", {}).items():
        if area not in VALIDATORS:
            raise invalid("Invalid browsing settings area")
        current = preferences.get(db, actor, area=area)
        rows.append(
            (f"user:{actor}", area, VALIDATORS[area](value), current["revision"] + 1)
        )
    if "shared" in categories:
        current = preferences.get(db, actor, True)
        rows.append(
            (
                "household",
                "library_shared",
                validate_shared(categories["shared"]),
                current["revision"] + 1,
            )
        )
    logging = categories.get("logging")
    if logging is not None:
        from kaleidescape_api.logging import Level

        if (
            set(logging) - {"level", "log_values"}
            or logging.get("level") not in [v.value for v in Level]
            or type(logging.get("log_values")) is not bool
        ):
            raise invalid("Invalid logging settings")
    if operation == "preview":
        return {"applied": False}
    request = identifier(request)
    digest = hashlib.sha256(
        json.dumps([actor, categories], sort_keys=True).encode()
    ).hexdigest()
    cached = db.execute(
        "SELECT fingerprint FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if cached:
        if cached[0] != digest:
            raise JournalError(
                "conflict", "Settings request belongs to another transfer"
            )
        return {"applied": True}
    with db:
        for owner, key, values, revision in rows:
            db.execute(
                "INSERT INTO settings VALUES (?,?,?,?,?) ON CONFLICT(owner,key) "
                "DO UPDATE SET value=excluded.value,revision=excluded.revision,"
                "updated_at=excluded.updated_at",
                (
                    owner,
                    key,
                    json.dumps(values),
                    revision,
                    datetime.now(UTC).isoformat(),
                ),
            )
        if logging is not None:
            db.execute(
                "UPDATE log_state SET level=?,log_values=?",
                (logging["level"], logging["log_values"]),
            )
        db.execute("UPDATE schema_metadata SET settings_revision=settings_revision+1")
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, '{"applied":true}')
        )
    return {"applied": True}

"""Atomic UI settings transfer; native HA changes use the options flow."""

import hashlib
import json
from datetime import UTC, datetime

from ..ui.preferences import (
    validate_database,
    validate_interface,
    validate_journal,
    validate_library,
    validate_search,
    validate_shared,
)
from . import preferences
from .models import JournalError, identifier, invalid

VALIDATORS = {
    "interface": validate_interface,
    "library": validate_library,
    "journal": validate_journal,
    "database": validate_database,
    "search": validate_search,
}


def apply(db, operation, actor, request, categories):
    rows = []
    seeds = set()
    for key, value in categories.get("browsing", {}).items():
        if not isinstance(key, str):
            raise invalid("Invalid browsing settings area")
        area, _, profile = key.partition(":")
        if area not in VALIDATORS or (profile and profile not in preferences.PROFILES):
            raise invalid("Invalid browsing settings area")
        values = VALIDATORS[area](value)
        if area == "library":
            seeds.add(values["random_seed"])
        # Older files apply to all formats, including existing saved profiles.
        targets = (profile,) if profile else (None, *preferences.PROFILES)
        for target in targets:
            current = preferences.get(db, actor, area=area, profile=target)
            saved = {
                k: v
                for k, v in values.items()
                if not (area == "library" and target and k == "random_seed")
            }
            rows.append(
                (
                    f"user:{actor}",
                    preferences.preference_key(area, target),
                    saved,
                    current["revision"] + 1,
                )
            )
    if len(seeds) > 1:
        raise invalid("Library profiles must use the same random seed")
    if seeds:
        rows.append(
            (f"user:{actor}", "library_random", {"random_seed": seeds.pop()}, 1)
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
        db.execute("UPDATE schema_metadata SET settings_revision=settings_revision+1")
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, '{"applied":true}')
        )
    return {"applied": True}

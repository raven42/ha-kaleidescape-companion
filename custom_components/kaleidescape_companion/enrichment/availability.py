"""Worker-owned administrator declarations of unavailable metadata or artwork."""

import hashlib
import json
import re

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid

PROVIDERS = {"tmdb", "kaleidescape"}
ARTWORK = {"poster", "backdrop"}


def marked(value):
    return {
        provider
        for provider in PROVIDERS
        if value.get("unavailable", {}).get(provider) is True
    }


def for_group(db, source, group):
    return {
        provider
        for provider in PROVIDERS
        if db.execute(
            "SELECT 1 FROM library WHERE source_id=? AND source_group=? "
            "AND purchase_match_pending=0 AND json_type(enrichment,?)='true' LIMIT 1",
            (source, group, f"$.unavailable.{provider}"),
        ).fetchone()
    }


def artwork_for_group(db, source, group):
    """Return group-wide declarations for artwork known to be unavailable."""
    return {
        kind
        for kind in ARTWORK
        if db.execute(
            "SELECT 1 FROM library WHERE source_id=? AND source_group=? "
            "AND purchase_match_pending=0 AND json_type(enrichment,?)='true' LIMIT 1",
            (source, group, f"$.unavailable_artwork.{kind}"),
        ).fetchone()
    }


def change(db, source, actor, request, data, authorize):
    from ..library.store import changed
    from .review_store import members, signature

    authorize()
    batch = isinstance(data, dict) and set(data) == {
        "title_id",
        "snapshot",
        "providers",
        "artwork",
    }
    single = isinstance(data, dict) and set(data) in (
        {"title_id", "provider", "snapshot", "unavailable"},
        {"title_id", "kind", "snapshot", "unavailable"},
    )
    if (
        not (batch or single)
        or not isinstance(data["snapshot"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", data["snapshot"])
        or not isinstance(data["title_id"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", data["title_id"])
    ):
        raise invalid("Choose a movie, availability target and current snapshot")
    if batch:
        providers, artwork = data["providers"], data["artwork"]
        if (
            not isinstance(providers, dict)
            or not isinstance(artwork, dict)
            or not set(providers) <= PROVIDERS
            or not set(artwork) <= ARTWORK
            or not all(
                type(value) is bool
                for value in (*providers.values(), *artwork.values())
            )
        ):
            raise invalid("Choose supported metadata and artwork expectations")
        changes = [
            ("unavailable", key, not enabled) for key, enabled in providers.items()
        ]
        changes.extend(
            ("unavailable_artwork", key, not enabled)
            for key, enabled in artwork.items()
        )
    else:
        key = data.get("provider", data.get("kind"))
        namespace = "unavailable" if "provider" in data else "unavailable_artwork"
        if (
            key not in (PROVIDERS if namespace == "unavailable" else ARTWORK)
            or type(data["unavailable"]) is not bool
        ):
            raise invalid("Choose a supported availability target")
        changes = [(namespace, key, data["unavailable"])]
    request = identifier(request)
    digest = hashlib.sha256(
        json.dumps(
            ["scraper_availability", source, actor, data], sort_keys=True
        ).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, data["title_id"])
    if signature(rows) != data["snapshot"]:
        raise JournalError(
            "refresh_required", "Movie changed; reopen the scraper dialog"
        )
    result = {"title_id": data["title_id"], "updated_count": len(rows)}
    with db:
        for row in db.execute(
            "SELECT id,enrichment FROM library WHERE source_id=? AND source_group=? "
            "AND purchase_match_pending=0",
            (source, rows[0]["source_group"]),
        ).fetchall():
            value = json.loads(row["enrichment"])
            for namespace, key, unavailable in changes:
                flags = value.setdefault(namespace, {})
                if unavailable:
                    flags[key] = True
                    if namespace == "unavailable":
                        value.setdefault("conflicts", {}).pop(key, None)
                else:
                    flags.pop(key, None)
            encoded = json.dumps(value)
            if len(encoded.encode()) > 512 * 1024:
                raise invalid("Reviewed metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?",
                (encoded, row["id"]),
            )
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result

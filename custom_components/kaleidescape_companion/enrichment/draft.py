"""Atomic, actor-bound commits of staged per-movie metadata and artwork."""

import hashlib
import json
import re
from datetime import UTC, datetime

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid
from ..core.security import private_directory
from ..library.store import image_type, save_images
from .matching import reference, same_provider_identity
from .selection import FIELDS, OPTIONS
from .store import PROVIDERS, history_values


def selection(data):
    keys = {
        "title_id",
        "snapshot",
        "providers",
        "sources",
        "expectations",
        "image_plan",
        "images",
        "resets",
    }
    if not isinstance(data, dict) or set(data) != keys:
        raise invalid("Invalid metadata draft")
    for key in ("title_id", "snapshot"):
        if not isinstance(data[key], str) or not re.fullmatch(
            r"[a-f0-9]{64}", data[key]
        ):
            raise invalid("Invalid movie snapshot")
    providers, sources, expectations = (
        data["providers"],
        data["sources"],
        data["expectations"],
    )
    if not isinstance(providers, dict) or any(
        provider not in PROVIDERS or not isinstance(token, str)
        for provider, token in providers.items()
    ):
        raise invalid("Choose supported scraper results")
    for token in providers.values():
        identifier(token)
    if sources is not None and (
        not isinstance(sources, dict)
        or any(
            field not in FIELDS
            or field in {"artwork", "backdrop"}
            or not isinstance(source, str)
            or source not in OPTIONS[field]
            or source == "auto"
            for field, source in sources.items()
        )
    ):
        raise invalid("Choose supported field sources")
    if expectations is not None and (
        not isinstance(expectations, dict)
        or set(expectations) != {"providers", "artwork"}
        or not isinstance(expectations["providers"], dict)
        or not isinstance(expectations["artwork"], dict)
        or set(expectations["providers"]) - PROVIDERS
        or set(expectations["artwork"]) - {"poster", "backdrop"}
        or any(
            type(value) is not bool
            for value in (
                *expectations["providers"].values(),
                *expectations["artwork"].values(),
            )
        )
    ):
        raise invalid("Choose supported availability settings")
    images, image_plan, resets = data["images"], data["image_plan"], data["resets"]
    if (
        not isinstance(images, dict)
        or set(images) - {"poster", "backdrop"}
        or any(
            not isinstance(choice, str) or len(choice) > 40
            for choice in images.values()
        )
        or not isinstance(image_plan, str)
        or bool(images) != bool(image_plan)
        or not isinstance(resets, list)
        or any(
            not isinstance(kind, str) or kind not in {"poster", "backdrop"}
            for kind in resets
        )
        or len(resets) != len(set(resets))
        or set(images) & set(resets)
    ):
        raise invalid("Choose supported artwork changes")
    if image_plan:
        identifier(image_plan)
    if (
        not providers
        and sources is None
        and expectations is None
        and not images
        and not resets
    ):
        raise invalid("No metadata changes were selected")
    return data


def fingerprint(actor, source, data):
    return hashlib.sha256(
        json.dumps(
            ["metadata_draft", actor, source, selection(data)], sort_keys=True
        ).encode()
    ).hexdigest()


def lookup(db, source, actor, request, data):
    return replay(db, identifier(request), fingerprint(actor, source, data))


def apply(
    db,
    directory,
    source,
    actor,
    request,
    data,
    plans,
    image_plan,
    images,
    budget,
    ready,
):
    from .review_store import members, signature

    ready()
    request, data = identifier(request), selection(data)
    digest = fingerprint(actor, source, data)
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, data["title_id"])
    if signature(rows) != data["snapshot"]:
        raise JournalError("refresh_required", "Movie changed; reopen metadata manager")
    selected = next(row for row in rows if row["id"] == data["title_id"])
    if "poster" in data["resets"] and (
        not selected["artwork_key"]
        or not db.execute(
            "SELECT 1 FROM library_artwork WHERE cache_key=?",
            (selected["artwork_key"],),
        ).fetchone()
    ):
        raise JournalError("not_found", "Original cover is unavailable")
    if "backdrop" in data["resets"]:
        for row in rows:
            previous = json.loads(row["enrichment"]).get("backdrop_previous", {})
            key = previous.get("key") if isinstance(previous, dict) else None
            if (
                key
                and not db.execute(
                    "SELECT 1 FROM library_artwork WHERE cache_key=?", (key,)
                ).fetchone()
            ):
                raise JournalError(
                    "library_artwork", "Previous backdrop is unavailable"
                )
    previous_backdrop = None
    if "backdrop" in images:
        key = image_plan["target"]["comparison"].get("backdrop_key")
        if (
            key
            and db.execute(
                "SELECT 1 FROM library_artwork WHERE cache_key=?", (key,)
            ).fetchone()
        ):
            previous_backdrop = key
    ordered = sorted(images)
    now = datetime.now(UTC).isoformat()
    result = {"title_id": data["title_id"], "updated_count": len(rows)}

    def commit(keys):
        ready()
        image_keys = dict(zip(ordered, keys, strict=True))
        for row in rows:
            value = json.loads(
                db.execute(
                    "SELECT enrichment FROM library WHERE id=?", (row["id"],)
                ).fetchone()[0]
            )
            for provider, plan in plans.items():
                value.setdefault("checks", {})[provider] = now
                metadata = plan.get("metadata")
                history = value.setdefault("provider_history", {}).setdefault(
                    provider, []
                )
                history.append(
                    {
                        "checked_at": now,
                        "outcome": "downloaded" if metadata else "no_data",
                        "values": history_values(metadata),
                    }
                )
                del history[:-8]
                if metadata:
                    old = value.get(provider, {})
                    value[provider] = {**metadata, "fetched_at": now}
                    if same_provider_identity(old, metadata):
                        for key in ("poster_key", "backdrop_key"):
                            if old.get(key):
                                value[provider][key] = old[key]
                    value.setdefault("matches", {})[provider] = reference(metadata)
                    value.setdefault("conflicts", {}).pop(provider, None)
                    value.pop("source_only", None)
            if "auto" in image_keys:
                value.setdefault("tmdb", {})["backdrop_key"] = image_keys["auto"]
            reviewed = value.setdefault("reviewed", {})
            if image_plan and data["images"]:
                provider = image_plan["provider"]
                match = image_plan.get("match")
                if match:
                    if value.get("matches", {}).get(
                        provider
                    ) != match and not same_provider_identity(
                        value.get(provider), match
                    ):
                        value.get(provider, {}).pop("fetched_at", None)
                    value.setdefault("matches", {})[provider] = match
                    value.setdefault("conflicts", {}).pop(provider, None)
                if "backdrop" in image_keys:
                    value["backdrop_previous"] = {"key": previous_backdrop}
                    reviewed.pop("backdrop_removed", None)
                for kind in data["images"]:
                    reviewed["poster_key" if kind == "poster" else "backdrop_key"] = (
                        image_keys[kind]
                    )
                    value.get("unavailable_artwork", {}).pop(kind, None)
                reviewed["providers"] = sorted(
                    set(reviewed.get("providers", [])) | {provider}
                )
                reviewed["provider"] = "reviewed"
                reviewed["fetched_at"] = now
            if "poster" in data["resets"]:
                reviewed.pop("poster_key", None)
                if row["artwork_key"]:
                    reviewed["poster_key"] = row["artwork_key"]
            if "backdrop" in data["resets"]:
                previous = value.pop("backdrop_previous", {})
                key = previous.get("key") if isinstance(previous, dict) else None
                if key:
                    reviewed["backdrop_key"] = key
                    reviewed.pop("backdrop_removed", None)
                else:
                    reviewed.pop("backdrop_key", None)
                    reviewed["backdrop_removed"] = True
            if data["sources"] is not None:
                value["field_sources"] = data["sources"]
                for field in data["sources"]:
                    reviewed.pop(field, None)
            if data["expectations"] is not None:
                for namespace, changes in (
                    ("unavailable", data["expectations"]["providers"]),
                    ("unavailable_artwork", data["expectations"]["artwork"]),
                ):
                    flags = value.setdefault(namespace, {})
                    for key, enabled in changes.items():
                        if enabled:
                            flags.pop(key, None)
                        else:
                            flags[key] = True
                            if namespace == "unavailable":
                                value.setdefault("conflicts", {}).pop(key, None)
            encoded = json.dumps(value)
            if len(encoded.encode()) > 512 * 1024:
                raise JournalError("metadata_limit", "Movie metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?", (encoded, row["id"])
            )
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )

    if images:
        private_directory(directory)
    save_images(
        db,
        directory,
        source,
        [(images[kind], image_type(images[kind])) for kind in ordered],
        budget,
        commit,
        keep={previous_backdrop} if previous_backdrop else set(),
    )
    return result

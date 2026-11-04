"""Worker-only movie enrichment with snapshots and actor-bound receipts."""

import hashlib
import json
import re
from datetime import UTC, datetime

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid
from ..core.security import private_directory
from ..library.browse import library_versions
from ..library.store import changed, image_type, save_images
from .matching import (
    bindings,
    has_provider_data,
    provider_url,
    reference,
    same_provider_identity,
)
from .selection import FIELDS as SOURCE_FIELDS
from .selection import OPTIONS
from .selection import read as read_sources
from .store import PROVIDERS, REVIEW_FIELDS, history_values


def signature(rows):
    return hashlib.sha256(
        json.dumps(
            [
                [
                    row[key]
                    for key in (
                        "id",
                        "source_id",
                        "source_group",
                        "source_handle",
                        "title",
                        "data",
                        "enrichment",
                        "artwork_key",
                        "sort_title",
                    )
                ]
                for row in rows
            ],
            sort_keys=True,
        ).encode()
    ).hexdigest()


def members(db, source, title):
    row = db.execute(
        "SELECT source_group FROM library WHERE source_id=? AND id=? "
        "AND available=1 AND purchase_match_pending=0",
        (source, title),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Select an available scanned Library title")
    rows = db.execute(
        "SELECT * FROM library WHERE source_id=? AND source_group=? "
        "AND available=1 ORDER BY id LIMIT 101",
        (source, row[0]),
    ).fetchall()
    if len(rows) > 100:
        raise JournalError(
            "metadata_limit", "Title reviews support up to 100 versions per movie"
        )
    return rows


def target(db, source, title):
    from .availability import artwork_for_group, for_group

    rows = members(db, source, title)
    # Completeness uses the same available, matched versions as Library sensors.
    # Pending purchase matches remain in the review snapshot but do not count.
    counted_rows = [row for row in rows if not row["purchase_match_pending"]]
    enrichment = [json.loads(row["enrichment"]) for row in counted_rows]
    selected = next(row for row in rows if row["id"] == title)
    versions = library_versions(db, source, title)["items"]
    current = next((row for row in versions if row["id"] == title), versions[0])
    cached_images = {
        row[0] for row in db.execute("SELECT cache_key FROM library_artwork")
    }
    counted_ids = {row["id"] for row in counted_rows}
    artwork_present = {
        "poster": any(
            row["id"] in counted_ids and row.get("artwork_key") in cached_images
            for row in versions
        ),
        "backdrop": any(
            row["id"] in counted_ids and row.get("backdrop_key") in cached_images
            for row in versions
        ),
    }
    href = next((row["href"] for row in rows if row["href"]), None)
    if href is None:
        href = next(
            (
                purchase.get("href")
                for row in rows
                for purchase in json.loads(row["purchase_history"])
                if purchase.get("href")
            ),
            "",
        )
    matches = bindings(db, source, selected["source_group"])
    provider_status = {
        provider: {
            "has_data": any(has_provider_data(value, provider) for value in enrichment),
            "match_url": provider_url(
                provider,
                matches.get(provider)
                if provider in matches
                else next(
                    (
                        value.get(provider)
                        for value in enrichment
                        if has_provider_data(value, provider)
                    ),
                    None,
                ),
            ),
            "fetched_at": max(
                (
                    value.get(provider, {}).get("fetched_at")
                    for value in enrichment
                    if isinstance(value.get(provider, {}).get("fetched_at"), str)
                ),
                default=None,
            ),
            "fields": max(
                (
                    sum(
                        value.get(provider, {}).get(key) not in (None, "", [])
                        for key in REVIEW_FIELDS
                    )
                    for value in enrichment
                ),
                default=0,
            ),
            "checked_at": max(
                (
                    value.get("checks", {}).get(provider)
                    for value in enrichment
                    if isinstance(value.get("checks", {}).get(provider), str)
                ),
                default=None,
            ),
        }
        for provider in PROVIDERS
    }
    original = json.loads(selected["data"])
    selected_enrichment = json.loads(selected["enrichment"])
    preferences = read_sources(db)
    field_mapping = []
    for field, label in SOURCE_FIELDS.items():
        if field in {"artwork", "backdrop"}:
            continue
        values = {"original": original.get(field)}
        for provider in PROVIDERS:
            if provider in OPTIONS[field]:
                values[provider] = selected_enrichment.get(provider, {}).get(field)
        preferred = selected_enrichment.get("field_sources", {}).get(field)
        default = preferences.get(field, "auto")
        if preferred not in OPTIONS[field]:
            preferred = default
        if preferred == "auto":
            preferred = next(
                (
                    key
                    for key in ("original", "kaleidescape", "tmdb")
                    if values.get(key) not in (None, "", [])
                ),
                "original",
            )
        elif preferred != "original" and values.get(preferred) in (None, "", []):
            preferred = next(
                (
                    key
                    for key in (*OPTIONS[field][2:], "original")
                    if values.get(key) not in (None, "", [])
                ),
                "original",
            )
        field_mapping.append(
            {
                "field": field,
                "label": label,
                "values": values,
                "selected": preferred,
                "override": field in selected_enrichment.get("field_sources", {}),
            }
        )
    history = {}
    for value in enrichment:
        provider_history = value.get("provider_history", {})
        if not isinstance(provider_history, dict):
            continue
        for provider, events in provider_history.items():
            if provider not in PROVIDERS or not isinstance(events, list):
                continue
            for event in events:
                if (
                    not isinstance(event, dict)
                    or not isinstance(event.get("checked_at"), str)
                    or len(event["checked_at"]) > 64
                ):
                    continue
                history[(provider, event["checked_at"])] = {
                    "provider": provider,
                    "checked_at": event["checked_at"],
                    "outcome": (
                        event.get("outcome")
                        if event.get("outcome") in ("downloaded", "no_data")
                        else "downloaded"
                    ),
                    "values": history_values(event.get("values", {})),
                }
    for provider in PROVIDERS:
        if any(
            event["provider"] == provider and event["outcome"] == "downloaded"
            for event in history.values()
        ):
            continue
        cached = [
            value[provider]
            for value in enrichment
            if isinstance(value.get(provider, {}).get("fetched_at"), str)
        ]
        latest = max(cached, key=lambda item: item["fetched_at"], default=None)
        if latest:
            event_time = latest["fetched_at"]
            history[(provider, event_time)] = {
                "provider": provider,
                "checked_at": event_time,
                "outcome": "downloaded",
                "values": history_values(latest),
            }
    return {
        "source": source,
        "id": title,
        "group": selected["source_group"],
        "title": selected["title"],
        "year": json.loads(selected["data"]).get("year")
        or next(
            (
                json.loads(row["data"]).get("year")
                for row in rows
                if json.loads(row["data"]).get("year")
            ),
            None,
        ),
        "href": href,
        "matches": matches,
        "snapshot": signature(rows),
        "current": {key: current.get(key) for key in REVIEW_FIELDS},
        "has_backdrop": bool(current.get("backdrop_key")),
        "unavailable": sorted(for_group(db, source, selected["source_group"])),
        "artwork_unavailable": sorted(
            artwork_for_group(db, source, selected["source_group"])
        ),
        "artwork_present": artwork_present,
        "backdrop_removed": any(
            value.get("reviewed", {}).get("backdrop_removed") for value in enrichment
        ),
        "provider_status": provider_status,
        "field_mapping": field_mapping,
        "history": sorted(
            history.values(), key=lambda item: item["checked_at"], reverse=True
        )[:40],
        "comparison": {
            "title": current["title"],
            "year": current.get("year"),
            "directors": (current.get("directors") or [])[:5],
            "actors": (current.get("actors") or [])[:5],
            "edition": current.get("edition"),
            "duration_seconds": current.get("duration_seconds"),
            "metadata_synced_at": current.get("metadata_synced_at"),
            "artwork_key": current.get("artwork_key"),
            "original_artwork_key": (
                selected["artwork_key"]
                if selected["artwork_key"] in cached_images
                else None
            ),
            "backdrop_key": current.get("backdrop_key"),
            "backdrop_reset_available": bool(current.get("backdrop_key"))
            or any("backdrop_previous" in value for value in enrichment),
            "previous_backdrop_key": (
                selected_enrichment.get("backdrop_previous", {}).get("key")
                if isinstance(selected_enrichment.get("backdrop_previous"), dict)
                and selected_enrichment["backdrop_previous"].get("key") in cached_images
                else None
            ),
        },
    }


def selection(data):
    if (
        not isinstance(data, dict)
        or set(data) - {"plan_id", "fields", "images", "save_match"}
        or not {"plan_id", "fields", "images"} <= data.keys()
        or type(data.get("save_match", False)) is not bool
    ):
        raise invalid("Invalid scrape selection")
    plan = identifier(data["plan_id"])
    fields, images = data["fields"], data["images"]
    if (
        not isinstance(fields, list)
        or len(fields) > len(REVIEW_FIELDS)
        or any(not isinstance(key, str) or key not in REVIEW_FIELDS for key in fields)
        or len(fields) != len(set(fields))
    ):
        raise invalid("Choose supported metadata fields")
    if (
        not isinstance(images, dict)
        or set(images) - {"poster", "backdrop"}
        or any(
            not isinstance(value, str) or len(value) > 40 for value in images.values()
        )
    ):
        raise invalid("Choose supported images")
    if not fields and not images and not data.get("save_match"):
        raise invalid("Select data to apply")
    return {
        "plan_id": plan,
        "fields": sorted(fields),
        "images": images,
        **({"save_match": True} if data.get("save_match") else {}),
    }


def fingerprint(actor, data):
    return hashlib.sha256(
        json.dumps(["metadata_review", actor, selection(data)], sort_keys=True).encode()
    ).hexdigest()


def lookup(db, actor, request, data):
    return replay(db, identifier(request), fingerprint(actor, data))


def action(db, source, actor, request, data, ready):
    """Persist a manual provider check, provider result, mapping, or cover reset."""
    ready()
    request = identifier(request)
    if not isinstance(data, dict) or data.get("action") not in {
        "checked",
        "download",
        "mapping",
        "reset_cover",
        "reset_backdrop",
    }:
        raise invalid("Choose a supported metadata action")
    kind = data["action"]
    allowed = {
        "checked": {"action", "title_id", "snapshot", "provider"},
        "download": {"action", "title_id", "snapshot", "provider", "metadata"},
        "mapping": {"action", "title_id", "snapshot", "sources"},
        "reset_cover": {"action", "title_id", "snapshot"},
        "reset_backdrop": {"action", "title_id", "snapshot"},
    }[kind]
    if set(data) != allowed:
        raise invalid("Invalid metadata action")
    title = data["title_id"]
    if not isinstance(title, str) or not re.fullmatch(r"[a-f0-9]{64}", title):
        raise invalid("Invalid movie identity")
    if not isinstance(data["snapshot"], str) or not re.fullmatch(
        r"[a-f0-9]{64}", data["snapshot"]
    ):
        raise invalid("Invalid movie snapshot")
    if kind in {"checked", "download"} and (
        not isinstance(data["provider"], str) or data["provider"] not in PROVIDERS
    ):
        raise invalid("Choose a supported scraper")
    if kind == "download":
        metadata = data["metadata"]
        if (
            not isinstance(metadata, dict)
            or any(
                key not in metadata for key in ("provider_id", "title", "year", "url")
            )
            or len(json.dumps(metadata).encode()) > 128 * 1024
        ):
            raise invalid("Invalid provider result")
    if kind == "mapping":
        sources = data["sources"]
        if not isinstance(sources, dict) or any(
            not isinstance(field, str)
            or field not in SOURCE_FIELDS
            or field in {"artwork", "backdrop"}
            or not isinstance(choice, str)
            or choice not in OPTIONS[field]
            or choice == "auto"
            for field, choice in sources.items()
        ):
            raise invalid("Choose supported field sources")
    digest = hashlib.sha256(
        json.dumps(["metadata_action", actor, source, data], sort_keys=True).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, title)
    if signature(rows) != data["snapshot"]:
        raise JournalError("refresh_required", "Movie changed; reopen metadata manager")
    if kind == "reset_cover":
        selected = next(row for row in rows if row["id"] == title)
        if (
            not selected["artwork_key"]
            or not db.execute(
                "SELECT 1 FROM library_artwork WHERE cache_key=?",
                (selected["artwork_key"],),
            ).fetchone()
        ):
            raise JournalError("not_found", "Original cover is unavailable")
    if kind == "reset_backdrop":
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
    now = datetime.now(UTC).isoformat()
    result = {"title_id": title, "updated_count": len(rows), "checked_at": now}
    with db:
        ready()
        for row in rows:
            value = json.loads(row["enrichment"])
            if kind == "checked":
                value.setdefault("checks", {})[data["provider"]] = now
                record = {
                    "checked_at": now,
                    "outcome": "no_data",
                    "values": {},
                }
                history = value.setdefault("provider_history", {}).setdefault(
                    data["provider"], []
                )
                history.append(record)
                del history[:-8]
            elif kind == "download":
                provider, metadata = data["provider"], data["metadata"]
                previous = value.get(provider, {})
                value[provider] = {**metadata, "fetched_at": now}
                if (
                    provider == "tmdb"
                    and previous.get("provider_id") == metadata["provider_id"]
                ):
                    for key in ("poster_key", "backdrop_key"):
                        if previous.get(key):
                            value[provider][key] = previous[key]
                value.setdefault("matches", {})[provider] = reference(metadata)
                value.setdefault("checks", {})[provider] = now
                history = value.setdefault("provider_history", {}).setdefault(
                    provider, []
                )
                history.append(
                    {
                        "checked_at": now,
                        "outcome": "downloaded",
                        "values": history_values(metadata),
                    }
                )
                del history[:-8]
                value.setdefault("conflicts", {}).pop(provider, None)
                value.get("unavailable", {}).pop(provider, None)
                value.pop("source_only", None)
            elif kind == "mapping":
                value["field_sources"] = data["sources"]
                for field in data["sources"]:
                    value.get("reviewed", {}).pop(field, None)
            elif kind == "reset_cover":
                original_key = row["artwork_key"]
                value.setdefault("reviewed", {}).pop("poster_key", None)
                if original_key:
                    value["reviewed"]["poster_key"] = original_key
            else:
                previous = value.pop("backdrop_previous", {})
                key = previous.get("key") if isinstance(previous, dict) else None
                reviewed = value.setdefault("reviewed", {})
                if key:
                    reviewed["backdrop_key"] = key
                    reviewed.pop("backdrop_removed", None)
                else:
                    reviewed.pop("backdrop_key", None)
                    reviewed["backdrop_removed"] = True
            encoded = json.dumps(value)
            if len(encoded.encode()) > 512 * 1024:
                raise JournalError("metadata_limit", "Movie metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?", (encoded, row["id"])
            )
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result


def apply(db, directory, source, actor, request, data, plan, images, budget):
    request, data = identifier(request), selection(data)
    digest = fingerprint(actor, data)
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    if (
        plan.get("actor") != actor
        or plan.get("id") != data["plan_id"]
        or plan["target"].get("source") != source
    ):
        raise invalid("Scrape review belongs to another scope or actor")
    rows = members(db, source, plan["target"]["id"])
    if signature(rows) != plan["target"]["snapshot"]:
        raise JournalError(
            "refresh_required", "This movie changed; scrape and review it again"
        )
    if any(
        key not in plan["metadata"] or plan["metadata"][key] in (None, "", [])
        for key in data["fields"]
    ):
        raise invalid("Selected data is unavailable")
    if set(images) != set(data["images"]):
        raise invalid("Image selection changed")
    ordered = sorted(images)
    result = {"title_id": plan["target"]["id"], "updated_count": len(rows)}
    previous_backdrop = None
    if "backdrop" in ordered:
        key = plan["target"]["comparison"].get("backdrop_key")
        if (
            key
            and db.execute(
                "SELECT 1 FROM library_artwork WHERE cache_key=?", (key,)
            ).fetchone()
        ):
            previous_backdrop = key

    def commit(keys):
        # An explicit reviewed apply reenables the complete group, including
        # editions temporarily absent from the latest scan.
        db.execute(
            "UPDATE library SET enrichment=json_remove(enrichment,'$.source_only') "
            "WHERE source_id=? AND source_group=?",
            (source, plan["target"]["group"]),
        )
        for row in rows:
            # Cache eviction may have cleared references inside this transaction.
            enrichment = json.loads(
                db.execute(
                    "SELECT enrichment FROM library WHERE id=?", (row["id"],)
                ).fetchone()[0]
            )
            enrichment.pop("source_only", None)
            if plan.get("match"):
                if enrichment.get("matches", {}).get(plan["provider"]) != plan[
                    "match"
                ] and not same_provider_identity(
                    enrichment.get(plan["provider"]), plan["match"]
                ):
                    enrichment.get(plan["provider"], {}).pop("fetched_at", None)
                enrichment.setdefault("matches", {})[plan["provider"]] = plan["match"]
                enrichment.setdefault("conflicts", {}).pop(plan["provider"], None)
            reviewed = enrichment.setdefault("reviewed", {})
            if "backdrop" in ordered:
                enrichment["backdrop_previous"] = {"key": previous_backdrop}
                reviewed.pop("backdrop_removed", None)
            reviewed.update({key: plan["metadata"][key] for key in data["fields"]})
            reviewed.update(
                {
                    ("poster_key" if kind == "poster" else "backdrop_key"): key
                    for kind, key in zip(ordered, keys, strict=True)
                }
            )
            for kind in ordered:
                enrichment.get("unavailable_artwork", {}).pop(kind, None)
            reviewed["providers"] = sorted(
                set(reviewed.get("providers", [])) | {plan["provider"]}
            )
            reviewed["provider"] = "reviewed"
            reviewed["fetched_at"] = datetime.now(UTC).isoformat()
            enrichment["reviewed"] = reviewed
            encoded = json.dumps(enrichment)
            if len(encoded.encode()) > 512 * 1024:
                raise JournalError("metadata_limit", "Reviewed metadata is too large")
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

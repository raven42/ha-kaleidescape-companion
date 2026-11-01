"""Worker-only reviewed enrichment; no caller values, identities or SQL are imported."""

import hashlib
import json
from datetime import UTC, datetime

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid
from ..core.security import private_directory
from ..library.browse import library_versions
from ..library.store import image_type, save_images
from .store import REVIEW_FIELDS


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
    rows = members(db, source, title)
    selected = next(row for row in rows if row["id"] == title)
    current = library_versions(db, source, title)["items"]
    current = next((row for row in current if row["id"] == title), current[0])
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
        "snapshot": signature(rows),
        "current": {key: current.get(key) for key in REVIEW_FIELDS},
    }


def selection(data):
    if not isinstance(data, dict) or set(data) != {"plan_id", "fields", "images"}:
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
    if not fields and not images:
        raise invalid("Select data to apply")
    return {"plan_id": plan, "fields": sorted(fields), "images": images}


def fingerprint(actor, data):
    return hashlib.sha256(
        json.dumps(["metadata_review", actor, selection(data)], sort_keys=True).encode()
    ).hexdigest()


def lookup(db, actor, request, data):
    return replay(db, identifier(request), fingerprint(actor, data))


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
            reviewed = enrichment.setdefault("reviewed", {})
            reviewed.update({key: plan["metadata"][key] for key in data["fields"]})
            reviewed.update(
                {
                    ("poster_key" if kind == "poster" else "backdrop_key"): key
                    for kind, key in zip(ordered, keys, strict=True)
                }
            )
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
    )
    return result

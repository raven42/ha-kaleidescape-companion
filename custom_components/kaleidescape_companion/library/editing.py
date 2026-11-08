"""Worker-only administrator display edits, independent of scanned identities."""

import hashlib
import json
import re
from datetime import UTC, datetime

from ..core.database_mutations import replay
from ..core.models import JournalError, identifier, invalid, text
from ..enrichment.review_store import members, signature
from .browse import library_versions
from .formats import CANONICAL, facet_labels
from .importing import purchase_date
from .purchases import price
from .store import changed

LISTS = {"actors", "directors", "writers", "producers", "studios", "genres"}
FIELDS = ("title", "sort_title", "year", "rating", "synopsis", *sorted(LISTS))
PURCHASE_FIELDS = {
    "purchased_on",
    "purchase_price",
    "retail_price",
    "purchase_information_unavailable",
}


def validate(patch):
    if (
        not isinstance(patch, dict)
        or not patch
        or set(patch) - (set(FIELDS) | PURCHASE_FIELDS | {"format_override"})
    ):
        raise invalid("Choose supported display fields")
    result = {}
    for key, value in patch.items():
        if key == "format_override":
            if (
                not isinstance(value, dict)
                or not isinstance(value.get("mode"), str)
                or value["mode"] not in {"auto", "original", "custom"}
            ):
                raise invalid("Choose a format source")
            mode = value["mode"]
            if set(value) != ({"mode", "badges"} if mode == "custom" else {"mode"}):
                raise invalid("Invalid format override")
            if mode == "custom":
                badges = value["badges"]
                if (
                    not isinstance(badges, list)
                    or len(badges) > len(CANONICAL)
                    or any(
                        not isinstance(item, str) or item not in CANONICAL
                        for item in badges
                    )
                    or len(set(badges)) != len(badges)
                ):
                    raise invalid("Choose supported format badges")
                result[key] = {"mode": mode, "badges": badges}
            else:
                result[key] = {"mode": mode}
        elif key == "purchase_information_unavailable":
            if type(value) is not bool:
                raise invalid("Choose whether purchase information is unavailable")
            result[key] = value
        elif key == "purchased_on":
            try:
                result[key] = purchase_date(value) if value is not None else None
            except ValueError as error:
                raise invalid("Enter a valid purchase date") from error
        elif key in {"purchase_price", "retail_price"}:
            result[key] = price(value)
        elif key in LISTS:
            if not isinstance(value, list) or len(value) > 500:
                raise invalid("Metadata lists support up to 500 names")
            result[key] = list(dict.fromkeys(text(item, 500) for item in value))
        elif key == "year":
            if value is not None and (
                type(value) is not int or not 1800 <= value <= 9999
            ):
                raise invalid("Enter a release year between 1800 and 9999")
            result[key] = value
        elif key == "sort_title":
            result[key] = text(value, 500, empty=True) if value is not None else None
        else:
            result[key] = text(
                value, 10000 if key == "synopsis" else 500, empty=key != "title"
            )
    if len(json.dumps(result).encode()) > 128 * 1024:
        raise invalid("Display changes exceed the metadata limit")
    return result


def inspect(db, source, title):
    title = text(title, 64)
    rows = members(db, source, title)
    current = next(
        row
        for offset in (0, 50)
        for row in library_versions(db, source, title, offset)["items"]
        if row["id"] == title
    )
    selected = next(row for row in rows if row["id"] == title)
    enrichment = json.loads(selected["enrichment"])
    override = enrichment.get("format_override", {})
    mode = override.get("mode", "auto") if isinstance(override, dict) else "auto"
    automatic = {
        key: value for key, value in enrichment.items() if key != "format_override"
    }
    return {
        "snapshot": signature(rows),
        "values": {
            **{key: current.get(key) for key in FIELDS},
            **{
                key: next(row for row in rows if row["id"] == title)[key]
                for key in ("purchased_on", "purchase_price", "retail_price")
            },
            "purchase_information_unavailable": any(
                row["purchase_information_unavailable"] for row in rows
            ),
        },
        "version_count": len(rows),
        "format_mode": mode if mode in {"auto", "original", "custom"} else "auto",
        "format_badges": [
            item
            for item in json.loads(
                facet_labels(selected["data"], selected["enrichment"])
            )
            if item in CANONICAL
        ],
        "scanned_format_badges": [
            item
            for item in json.loads(facet_labels(selected["data"]))
            if item in CANONICAL
        ],
        "automatic_format_badges": [
            item
            for item in json.loads(facet_labels(selected["data"], automatic))
            if item in CANONICAL
        ],
        "has_invoices": bool(
            json.loads(
                next(row for row in rows if row["id"] == title)["purchase_history"]
            )
        ),
    }


def apply(db, source, actor, request, title, snapshot, patch):
    request, title = identifier(request), text(title, 64)
    patch = validate(patch)
    if not isinstance(snapshot, str) or not re.fullmatch(r"[a-f0-9]{64}", snapshot):
        raise invalid("Invalid movie snapshot; reopen the editor")
    digest = hashlib.sha256(
        json.dumps(
            ["library_edit", source, actor, title, snapshot, patch], sort_keys=True
        ).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, title)
    if signature(rows) != snapshot:
        raise JournalError(
            "refresh_required", "This movie changed; reopen the editor and review again"
        )
    result = {"title_id": title, "updated_count": len(rows)}
    with db:
        if "purchase_information_unavailable" in patch:
            db.execute(
                "UPDATE library SET purchase_information_unavailable=? "
                "WHERE source_id=? AND source_group=? AND purchase_match_pending=0",
                (
                    int(patch["purchase_information_unavailable"]),
                    source,
                    rows[0]["source_group"],
                ),
            )
        selected = next(row for row in rows if row["id"] == title)
        price_changes = {
            key: patch[key]
            for key in ("purchased_on", "purchase_price", "retail_price")
            if key in patch
        }
        if price_changes:
            invoices = json.loads(selected["purchase_history"])
            raw_date = db.execute(
                "SELECT purchased_on FROM library WHERE id=?", (title,)
            ).fetchone()[0]
            new_date = price_changes.get("purchased_on", raw_date)
            if invoices and new_date == invoices[0]["purchased_on"]:
                new_date = None
            if invoices:
                for key in ("purchase_price", "retail_price"):
                    if key in price_changes:
                        db.execute(
                            f"UPDATE purchase_records SET {key}=? WHERE id=?",
                            (price_changes[key], invoices[0]["id"]),
                        )
            db.execute(
                "UPDATE library SET purchased_on=?,purchase_price=?,retail_price=? "
                "WHERE id=?",
                (
                    new_date,
                    None
                    if invoices
                    else price_changes.get(
                        "purchase_price", selected["purchase_price"]
                    ),
                    None
                    if invoices
                    else price_changes.get("retail_price", selected["retail_price"]),
                    title,
                ),
            )
        for row in rows if set(patch) - PURCHASE_FIELDS - {"format_override"} else []:
            enrichment = json.loads(row["enrichment"])
            reviewed = enrichment.setdefault("reviewed", {})
            reviewed.update(
                {
                    key: value
                    for key, value in patch.items()
                    if key != "sort_title"
                    and key not in PURCHASE_FIELDS
                    and key != "format_override"
                }
            )
            reviewed["provider"] = "reviewed"
            reviewed["fetched_at"] = datetime.now(UTC).isoformat()
            encoded = json.dumps(enrichment)
            if len(encoded.encode()) > 512 * 1024:
                raise invalid("Reviewed metadata is too large")
            db.execute(
                "UPDATE library SET enrichment=?,sort_title=? WHERE id=?",
                (encoded, patch.get("sort_title", row["sort_title"]), row["id"]),
            )
        if "format_override" in patch:
            enrichment = json.loads(
                db.execute(
                    "SELECT enrichment FROM library WHERE id=?", (title,)
                ).fetchone()[0]
            )
            override = patch["format_override"]
            if override["mode"] == "auto":
                enrichment.pop("format_override", None)
            else:
                enrichment["format_override"] = override
            db.execute(
                "UPDATE library SET enrichment=? WHERE id=?",
                (json.dumps(enrichment), title),
            )
            if set(patch) == {"format_override"}:
                result["updated_count"] = 1
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result


def reset(db, source, actor, request, title, snapshot):
    """Restore scanned facts and stop background enrichment until explicit review."""
    request, title = identifier(request), text(title, 64)
    if not isinstance(snapshot, str) or not re.fullmatch(r"[a-f0-9]{64}", snapshot):
        raise invalid("Invalid movie snapshot; reopen the editor")
    digest = hashlib.sha256(
        json.dumps(["library_reset", source, actor, title, snapshot]).encode()
    ).hexdigest()
    cached = replay(db, request, digest)
    if cached is not None:
        return cached
    rows = members(db, source, title)
    if signature(rows) != snapshot:
        raise JournalError(
            "refresh_required", "This movie changed; reopen the editor and review again"
        )
    result = {"title_id": title, "updated_count": len(rows)}
    with db:
        # Include temporarily unavailable editions so returning versions cannot
        # revive old overrides after the next catalog scan.
        updated = db.execute(
            "UPDATE library SET enrichment=?,sort_title=NULL "
            "WHERE source_id=? AND source_group=? AND purchase_match_pending=0",
            ('{"source_only":true}', source, rows[0]["source_group"]),
        )
        result["updated_count"] = updated.rowcount
        changed(db, source)
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
    return result

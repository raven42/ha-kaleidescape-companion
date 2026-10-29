"""Private, offline purchase-history parsing and explicit local date corrections."""

import hashlib
import json
import re
from datetime import UTC, date, datetime

from custom_components.kaleidescape_companion.core.models import (
    JournalError,
    identifier,
    invalid,
)
from custom_components.kaleidescape_companion.library.browse import bounded_page
from custom_components.kaleidescape_companion.library.importing import purchase_date
from custom_components.kaleidescape_companion.library.parser import Tree, clean
from custom_components.kaleidescape_companion.library.store import changed

MAX_BYTES = 8 * 1024 * 1024
MONTHS = (
    "January February March April May June July August September October "
    "November December"
).split()
DATE_BINDING = "moment: { timestamp: added_timestamp(), format: 'MMMM D, YYYY' }"


def parse_history(body):
    """Read rendered invoice dates and owned title rows; execute/fetch nothing."""
    if not isinstance(body, bytes) or len(body) > MAX_BYTES:
        raise JournalError("purchase_too_large", "Purchase history exceeds 8 MiB")
    try:
        root = Tree(body.decode("utf-8-sig")).root
    except (UnicodeError, JournalError) as error:
        raise invalid("Purchase history HTML was not recognized") from error
    found = {}
    invoices = 0
    for invoice in root.nodes():
        if (
            invoice.tag != "div"
            or "invoice" not in invoice.attrs.get("class", "").split()
        ):
            continue
        for section in invoice.children:
            if not hasattr(section, "tag") or section.tag != "div":
                continue
            heading = section.find(cls="title")
            if heading is None:
                continue
            if any(
                "is_pending()" in node.attrs.get("data-bind", "")
                and not re.search(
                    r"display\s*:\s*none", node.attrs.get("style", ""), re.I
                )
                for node in heading.nodes()
            ):
                continue
            stamp = next(
                (
                    node
                    for node in section.nodes()
                    if node.attrs.get("data-bind") == DATE_BINDING
                ),
                None,
            )
            if stamp is None:
                raise invalid("An invoice date is missing")
            match = re.fullmatch(r"([A-Za-z]+) (\d{1,2}), (\d{4})", clean(stamp.text()))
            if not match or match[1] not in MONTHS:
                raise invalid("An invoice date was not recognized")
            try:
                day = purchase_date(
                    date(
                        int(match[3]), MONTHS.index(match[1]) + 1, int(match[2])
                    ).isoformat()
                )
            except ValueError as error:
                raise invalid("An invoice date was not recognized") from error
            invoices += 1
            for row in section.nodes():
                if (
                    row.tag != "tr"
                    or "cancelled" in row.attrs.get("class", "").split()
                    or re.search(
                        r"display\s*:\s*none", row.attrs.get("style", ""), re.I
                    )
                ):
                    continue
                title = next(
                    (
                        node
                        for node in row.nodes()
                        if node.attrs.get("data-bind") == "text: full_title"
                    ),
                    None,
                )
                if title is None:
                    continue
                rental = next(
                    (
                        node
                        for node in row.nodes()
                        if node.attrs.get("data-bind") == "visible: is_rental"
                    ),
                    None,
                )
                if rental is not None and not re.search(
                    r"display\s*:\s*none", rental.attrs.get("style", ""), re.I
                ):
                    continue
                text = clean(title.text())
                if not text:
                    raise invalid("A purchased title is missing")
                key = text.casefold()
                if key not in found or day < found[key]["purchased_on"]:
                    found[key] = {"title": text, "purchased_on": day}
                if len(found) > 10000:
                    raise invalid("Too many purchased titles")
    if not invoices or not found:
        raise invalid("No owned titles and invoice dates were found")
    return list(found.values())


def preview(db, source, body):
    purchases = parse_history(body)
    revision = db.execute(
        "SELECT revision FROM library_sources WHERE id=?", (source,)
    ).fetchone()
    if revision is None:
        raise JournalError("not_ready", "Sync the Library before importing dates")
    rows = []
    for purchase in purchases:
        matches = db.execute(
            "SELECT t.id,t.source_group,t.title,json_extract(t.data,'$.year') year,"
            "json_extract(t.data,'$.edition') edition,t.purchased_on "
            "FROM library_titles t "
            "WHERE t.source_id=? AND t.available=1 "
            "AND t.title_search=? ORDER BY t.id LIMIT 51",
            (source, purchase["title"].casefold()),
        ).fetchall()
        rows.append(
            {
                **purchase,
                "ambiguous": len({row["source_group"] for row in matches}) > 1
                or len(matches) > 50,
                "versions": [
                    {
                        key: row[key]
                        for key in ("id", "title", "year", "edition", "purchased_on")
                    }
                    for row in matches[:50]
                ],
                "versions_truncated": len(matches) > 50,
            }
        )
    return bounded_page({"rows": rows, "revision": revision[0]})


def apply(db, source, request_id, revision, updates, actor_id):
    request_id = identifier(request_id)
    if (
        type(revision) is not int
        or revision < 0
        or not isinstance(updates, list)
        or not 1 <= len(updates) <= 1000
    ):
        raise invalid("Choose 1–1000 explicit Library versions")
    normalized = []
    for update in updates:
        if (
            not isinstance(update, dict)
            or set(update) != {"title_id", "purchased_on"}
            or not isinstance(update["title_id"], str)
            or not re.fullmatch(r"[a-f0-9]{64}", update["title_id"])
        ):
            raise invalid("Invalid purchase correction")
        normalized.append(
            {
                "title_id": update["title_id"],
                "purchased_on": purchase_date(update["purchased_on"]),
            }
        )
    if len({row["title_id"] for row in normalized}) != len(normalized):
        raise invalid("Duplicate purchase corrections")
    fingerprint = hashlib.sha256(
        json.dumps(
            ["purchase_dates", source, revision, normalized, actor_id], sort_keys=True
        ).encode()
    ).hexdigest()
    cached = db.execute(
        "SELECT fingerprint,response FROM requests WHERE request_id=?", (request_id,)
    ).fetchone()
    if cached:
        if cached["fingerprint"] != fingerprint:
            raise JournalError(
                "conflict", "Request UUID belongs to different data or actor"
            )
        return json.loads(cached["response"])
    with db:
        current = db.execute(
            "SELECT revision FROM library_sources WHERE id=?", (source,)
        ).fetchone()
        if current is None or current[0] != revision:
            raise JournalError(
                "conflict", "Library changed; preview the purchase dates again"
            )
        for update in normalized:
            row = db.execute(
                "SELECT 1 FROM library_titles "
                "WHERE id=? AND source_id=? AND available=1",
                (update["title_id"], source),
            ).fetchone()
            if row is None:
                raise JournalError(
                    "not_found", "A selected Library version is unavailable"
                )
            db.execute(
                "UPDATE library_titles SET purchased_on=?,purchase_imported_at=? "
                "WHERE id=?",
                (
                    update["purchased_on"],
                    datetime.now(UTC).isoformat(),
                    update["title_id"],
                ),
            )
        changed(db, source)
        result = {"updated_count": len(normalized), "revision": revision + 1}
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request_id, fingerprint, json.dumps(result)),
        )
        db.execute(
            """INSERT INTO import_audit
                (request_id,actor_id,imported_count,skipped_count,dataset_revision,
                occurred_at,updated_count,kind,source_revision)
                VALUES (?,?,0,0,NULL,?,?,'purchase_dates',?)""",
            (
                request_id,
                actor_id,
                datetime.now(UTC).isoformat(),
                len(normalized),
                revision + 1,
            ),
        )
    return result

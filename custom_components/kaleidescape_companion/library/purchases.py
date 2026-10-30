"""Validated invoice history owned by a Library entry, never a public projection."""

import hashlib
import json
import re
import time
from urllib.parse import urlsplit

from ..core.models import JournalError, invalid, text, timestamp
from .importing import purchase_date
from .title_matching import TitleMatcher, TitleQuery, store_title

PURCHASE_COLUMNS = {
    "id",
    "title",
    "purchased_on",
    "purchase_price",
    "retail_price",
    "order_id",
    "href",
    "source_id",
    "source_group",
    "library_id",
}
INVOICE_FIELDS = (
    "title",
    "purchased_on",
    "purchase_price",
    "retail_price",
    "order_id",
    "href",
)
SUMMARY_FIELDS = ("purchase_price", "retail_price", "order_id", "href")
MAX_HISTORY = 1000


def totals(db, source):
    """Sum recorded invoices once, using integer cents and separate currencies."""
    deadline = time.monotonic() + 2
    currencies, invoices, orders = {}, set(), set()
    counts = dict.fromkeys(
        (
            "purchase_count",
            "missing_purchase_prices",
            "missing_retail_prices",
            "missing_order_ids",
            "unpaired_prices",
            "duplicate_purchases",
        ),
        0,
    )
    for index, row in enumerate(
        db.execute(
            "SELECT invoice.value FROM library t,json_each(t.purchase_history) invoice "
            "WHERE t.source_id=? AND t.purchase_match_pending=0 ORDER BY t.id "
            "LIMIT 100001",
            (source,),
        )
    ):
        if index == 100000 or time.monotonic() > deadline:
            raise JournalError(
                "purchase_totals_limit", "Purchase totals exceed the read budget"
            )
        invoice = json.loads(row[0])
        if invoice["id"] in invoices:
            counts["duplicate_purchases"] += 1
            continue
        invoices.add(invoice["id"])
        counts["purchase_count"] += 1
        if invoice.get("order_id"):
            orders.add(invoice["order_id"])
        else:
            counts["missing_order_ids"] += 1
        paid = price_cents(invoice.get("purchase_price"))
        retail = price_cents(invoice.get("retail_price"))
        for value, field, missing in (
            (paid, "library_cost", "missing_purchase_prices"),
            (retail, "retail_price", "missing_retail_prices"),
        ):
            if value is None:
                counts[missing] += 1
                continue
            currency, cents = value
            bucket = currencies.setdefault(
                currency, {"library_cost": None, "retail_price": None, "savings": None}
            )
            bucket[field] = (bucket[field] or 0) + cents
        if paid and retail and paid[0] == retail[0]:
            bucket = currencies[paid[0]]
            bucket["savings"] = (bucket["savings"] or 0) + retail[1] - paid[1]
        else:
            counts["unpaired_prices"] += 1
    revision = db.execute(
        "SELECT revision FROM library_sources WHERE id=?", (source,)
    ).fetchone()
    return {
        **counts,
        "unique_transactions": len(orders),
        "revision": revision[0] if revision else 0,
        "currencies": [
            {
                "currency": currency,
                **{
                    key: money(currency, value) if value is not None else None
                    for key, value in values.items()
                },
            }
            for currency, values in sorted(currencies.items())
        ],
    }


def price_cents(value):
    value = price(value)
    if value is None:
        return None
    match = re.fullmatch(r"([^\d\s.,+-]{1,8})\s*([\d,]+)\.([0-9]{2})", value)
    return match[1], int(match[2].replace(",", "")) * 100 + int(match[3])


def money(currency, cents):
    amount = abs(cents)
    return f"{'-' if cents < 0 else ''}{currency}{amount // 100}.{amount % 100:02d}"


def price(value):
    if value is None:
        return None
    value = text(value, 64)
    if not re.fullmatch(
        r"[^\d\s.,+-]{1,8}\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\.[0-9]{2}", value
    ):
        raise invalid("Expected a nonnegative currency price with two decimal places")
    return value


def store_href(value):
    """Validate passive metadata only; this URL is never used for networking."""
    if value is None:
        return None
    value = text(value, 2048)
    if any(ord(char) < 32 for char in value):
        raise invalid("Invalid movie-store link")
    try:
        url = urlsplit(value)
        if (
            url.scheme in {"http", "https"}
            and url.hostname
            and not (url.username or url.password)
        ):
            return value
        if (
            not url.scheme
            and not url.netloc
            and value.startswith(("/movie-store/", "movie-store/"))
        ):
            return value
    except ValueError:
        pass
    raise invalid("Expected an HTTP(S) or store-relative movie link")


def purchase_record(row):
    if not isinstance(row, dict):
        raise invalid("Expected a purchase record")
    record = {
        "title": text(row.get("title"), 500),
        "purchased_on": purchase_date(row.get("purchased_on")),
        "purchase_price": price(row.get("purchase_price")),
        "retail_price": price(row.get("retail_price")),
        "order_id": None if row.get("order_id") is None else text(row["order_id"], 256),
        "href": store_href(row.get("href")),
    }
    identity = [record[key] for key in ("title", "purchased_on", "order_id", "href")]
    record["id"] = hashlib.sha256(
        json.dumps(identity, ensure_ascii=True).encode()
    ).hexdigest()
    if "id" in row and row["id"] != record["id"]:
        raise invalid("Purchase identity does not match its invoice fields")
    source, group = row.get("source_id"), row.get("source_group")
    if (source is None) != (group is None):
        raise invalid("A purchase Library link requires both source and group")
    if source is not None:
        if not re.fullmatch(r"[a-f0-9]{64}", text(source, 64)):
            raise invalid("Invalid purchase Library source")
        group = text(group, 256)
        if any(c.isspace() or ord(c) < 32 for c in group):
            raise invalid("Invalid purchase Library group")
    library_id = row.get("library_id")
    if library_id is not None and not re.fullmatch(
        r"[a-f0-9]{64}", text(library_id, 64)
    ):
        raise invalid("Invalid purchase Library entry")
    return {
        **record,
        "source_id": source,
        "source_group": group,
        "library_id": library_id,
    }


def history(value):
    """Bound and normalize embedded history; no device identity belongs in it."""
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, list) or len(value) > MAX_HISTORY:
        raise invalid("A Library entry supports up to 1000 purchase records")
    records, seen = [], set()
    for item in value:
        record = purchase_record(item)
        if record["id"] in seen:
            raise invalid("Duplicate purchase identity in Library history")
        seen.add(record["id"])
        stored = {key: record[key] for key in ("id", *INVOICE_FIELDS)}
        if "imported_at" in item:
            stored["imported_at"] = timestamp(item["imported_at"])
        records.append(stored)
    if len(json.dumps(records, ensure_ascii=True).encode()) > 2 * 1024 * 1024:
        raise invalid("Purchase history exceeds 2 MiB for this Library entry")
    return sorted(records, key=lambda row: (row["purchased_on"], row["id"]))


def embedded_history(row, decode):
    """Read either embedded invoices or compatible flat purchase columns."""
    value = row.get("purchase_history", [])
    records = history(decode(value) if isinstance(value, str) else value)
    flat = {
        "purchase_price": price(row.get("purchase_price")),
        "retail_price": price(row.get("retail_price")),
        "order_id": None if row.get("order_id") is None else text(row["order_id"], 256),
        "href": store_href(row.get("href")),
    }
    if records:
        expected = summary(records)
        if any(key in row and value != expected[key] for key, value in flat.items()):
            raise invalid("Library purchase summary differs from its invoice history")
    elif any(value is not None for value in flat.values()):
        records = history(
            [
                {
                    "title": row.get("title"),
                    "purchased_on": row.get("purchased_on"),
                    **flat,
                }
            ]
        )
    return records


def summary(records):
    """Flat private columns summarize the earliest invoice; retain every order."""
    first = records[0] if records else {}
    return {key: first.get(key) for key in SUMMARY_FIELDS}


def index(db):
    result = {}
    for row in db.execute(
        "SELECT id,purchase_history,purchase_match_pending FROM library "
        "WHERE purchase_history!='[]'"
    ):
        for record in json.loads(row["purchase_history"]):
            result[record["id"]] = {
                "record": record,
                "owner": row["id"],
                "pending": bool(row["purchase_match_pending"]),
            }
    return result


def title_query(record) -> TitleQuery:
    """Adapt invoice fields to reusable title evidence without changing identity."""
    alternate, year = store_title(record.get("href"))
    return TitleQuery(
        title=record["title"],
        alternate_title=alternate,
        year=year,
        source_id=record.get("source_id"),
        source_group=record.get("source_group"),
    )


def propose_link(db, record, old, matcher=None):
    """Preserve stored identities; other names/years only suggest a reviewed owner."""
    if old and not old["pending"]:
        target = old["owner"]
        reason = "Existing Library entry preserved"
    else:
        target = record.get("library_id")
        reason = "Review exact Library entry"
        if target:
            row = db.execute(
                "SELECT id FROM library WHERE id=? AND available=1 AND "
                "purchase_match_pending=0",
                (target,),
            ).fetchone()
            target = row[0] if row else None
        else:
            if matcher is None:
                matcher = TitleMatcher(
                    db,
                    preferred_ids=(
                        link["owner"]
                        for link in index(db).values()
                        if not link["pending"]
                    ),
                )
            match = matcher.match(title_query(record))
            return match.target, match.detail
    if not target:
        return None, "Choose a Library entry before importing this purchase"
    row = db.execute(
        "SELECT title,json_extract(data,'$.year') year FROM library WHERE id=?",
        (target,),
    ).fetchone()
    return target, f"{reason}: {row['title']} · {row['year'] or 'year unknown'}"


def proposal(record, old, target):
    """Review one invoice. Apply re-reads the owner to combine selected invoices."""
    if target is None:
        return {}, [], "skip"
    previous = old["record"] if old else {}
    changes, conflicts = {}, []
    for key in INVOICE_FIELDS:
        value, before = record[key], previous.get(key)
        if before in (None, "") and value not in (None, ""):
            changes[key] = {"before": before, "after": value}
        elif value not in (None, "") and before != value:
            conflicts.append(key)
    if old and old["pending"]:
        changes["library_id"] = {"before": old["owner"], "after": target}
    return (
        changes,
        conflicts,
        "new" if old is None else "merge" if changes else "unchanged",
    )


def merge_into(db, record, target, now, old_owner=None):
    """Keep the association inseparable from the row, including repeated orders."""
    row = db.execute(
        "SELECT * FROM library WHERE id=? AND purchase_match_pending=0", (target,)
    ).fetchone()
    if row is None:
        raise invalid("Purchase requires an existing matched Library entry")
    records = json.loads(row["purchase_history"])
    previous_date = records[0]["purchased_on"] if records else None
    previous = next((item for item in records if item["id"] == record["id"]), None)
    if previous is None:
        imported_at = now
        if old_owner and old_owner != target:
            old = db.execute(
                "SELECT purchase_history FROM library WHERE id=? "
                "AND purchase_match_pending=1",
                (old_owner,),
            ).fetchone()
            if old:
                imported_at = next(
                    (
                        item.get("imported_at", now)
                        for item in json.loads(old[0])
                        if item["id"] == record["id"]
                    ),
                    now,
                )
        records.append(
            {
                **{key: record[key] for key in ("id", *INVOICE_FIELDS)},
                "imported_at": imported_at,
            }
        )
    else:
        for key in INVOICE_FIELDS:
            if previous.get(key) in (None, "") and record[key] not in (None, ""):
                previous[key] = record[key]
    records = history(records)
    private = summary(records)
    db.execute(
        "UPDATE library SET "
        "purchase_history=?,purchase_price=?,retail_price=?,order_id=?,href=?,"
        "purchased_on=?,purchase_imported_at=? WHERE id=?",
        (
            json.dumps(records),
            *private.values(),
            records[0]["purchased_on"]
            if row["purchased_on"] in (None, previous_date)
            else row["purchased_on"],
            now,
            target,
        ),
    )
    if old_owner and old_owner != target:
        old = db.execute(
            "SELECT purchase_history,purchase_match_pending FROM library WHERE id=?",
            (old_owner,),
        ).fetchone()
        if old and old["purchase_match_pending"]:
            remaining = [
                item
                for item in json.loads(old["purchase_history"])
                if item["id"] != record["id"]
            ]
            if not remaining:
                db.execute("DELETE FROM library WHERE id=?", (old_owner,))
            else:
                db.execute(
                    "UPDATE library SET purchase_history=? WHERE id=?",
                    (json.dumps(remaining), old_owner),
                )
    return row["source_id"]

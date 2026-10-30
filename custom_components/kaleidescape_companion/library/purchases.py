"""Private purchase records and reviewed, work-level Library associations."""

import hashlib
import json
import re
from urllib.parse import urlsplit

from ..core.models import invalid, text
from .importing import purchase_date

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
}
PURCHASE_FIELDS = ("purchase_price", "retail_price", "source_id", "source_group")


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
    return {**record, "source_id": source, "source_group": group}


def propose_link(db, record, old):
    """A title match suggests a work, never a version; explicit review approves it."""
    if old is not None and old["source_id"] is not None:
        record.update(source_id=old["source_id"], source_group=old["source_group"])
        return "Existing Library link preserved"
    params = [record["title"].casefold()]
    scope = ""
    explicit = record["source_id"] is not None
    if explicit:
        scope = " AND source_id=? AND source_group=?"
        params += [record["source_id"], record["source_group"]]
    matches = db.execute(
        "SELECT source_id,source_group,count(*) versions,"
        "min(json_extract(data,'$.year')) year FROM library_titles "
        "WHERE available=1 AND title_search=?"
        + scope
        + " GROUP BY source_id,source_group LIMIT 2",
        params,
    ).fetchall()
    if len(matches) != 1:
        record.update(source_id=None, source_group=None)
        return "No unique exact-name Library match; import without a Library link"
    match = matches[0]
    record.update(source_id=match["source_id"], source_group=match["source_group"])
    return (
        f"Review Library group link: {match['year'] or 'year unknown'} · "
        f"{match['versions']} version{'' if match['versions'] == 1 else 's'} · "
        f"{match['source_group']} (exact name only)"
    )


def portable_purchases(db):
    columns = ",".join(sorted(PURCHASE_COLUMNS))
    for row in db.execute(f"SELECT {columns} FROM library_purchases ORDER BY id"):
        yield dict(row)

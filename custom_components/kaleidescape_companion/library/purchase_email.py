"""Convert bounded purchase-email payloads into existing invoice records."""

import base64
import binascii
import json
import quopri
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

from ..core.models import invalid
from .purchases import money, price_cents, purchase_record

MAX_BYTES = 1024 * 1024
MAX_MOVIES = 1000


def _title_key(value):
    return " ".join(value.split()).casefold()


class _MovieLinks(HTMLParser):
    """Collect visible store movie links; cover-image links have no text."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = {}
        self.href = None
        self.label = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        self.href, self.label = None, []
        href = dict(attrs).get("href")
        if not href or len(href) > 2048:
            return
        try:
            url = urlsplit(href)
            if url.scheme not in ("", "https") or url.netloc not in (
                "",
                "store.kaleidescape.com",
            ):
                return
            if re.fullmatch(r"/movie-store/movie/details/\d+", url.path):
                self.href = url.path
        except ValueError:
            return

    def handle_data(self, data):
        if self.href is not None:
            self.label.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            title = _title_key("".join(self.label))
            if title:
                self.links.setdefault(title, set()).add(self.href)
            self.href = None


def _html_links(part):
    if not isinstance(part, dict) or part.get("content_type") != "text/html":
        return {}
    data = part.get("part_data")
    if not isinstance(data, str) or len(data) > MAX_BYTES:
        return {}
    encoding = str(part.get("content_transfer_encoding") or "").lower()
    try:
        if encoding == "quoted-printable":
            raw = quopri.decodestring(data.encode("utf-8"))
        elif encoding == "base64":
            raw = base64.b64decode(data, validate=False)
        elif encoding in ("", "7bit", "8bit", "binary"):
            raw = data.encode("utf-8")
        else:
            return {}
        if len(raw) > MAX_BYTES:
            return {}
        parser = _MovieLinks()
        parser.feed(raw.decode("utf-8"))
        return parser.links
    except ValueError, UnicodeError, binascii.Error, RecursionError:
        return {}


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise invalid("Purchase email contains duplicate JSON keys")
        result[key] = value
    return result


def _shares(value, count):
    parsed = price_cents(value)
    if parsed is None:
        return [None] * count
    currency, cents = parsed
    amount, remainder = divmod(cents, count)
    return [money(currency, amount + (index < remainder)) for index in range(count)]


def normalize(payload):
    """Expand movie sets, allocating each set's price evenly in integer cents."""
    try:
        if isinstance(payload, str):
            if len(payload.encode("utf-8")) > MAX_BYTES:
                raise invalid("Purchase email exceeds 1 MiB")
            payload = json.loads(payload, object_pairs_hook=_object)
        elif len(json.dumps(payload, allow_nan=False).encode()) > MAX_BYTES:
            raise invalid("Purchase email exceeds 1 MiB")
    except (ValueError, TypeError, UnicodeError, RecursionError) as error:
        raise invalid("Expected a valid purchase email JSON object") from error
    if not isinstance(payload, dict) or payload.get("source") != "kaleidescape":
        raise invalid("Expected a Kaleidescape purchase email")
    if payload.get("prices_reconciled", True) is not True:
        raise invalid("Purchase email prices are not reconciled")
    items = payload.get("purchases")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_MOVIES:
        raise invalid("Purchase email requires 1–1000 purchases")
    html_links = _html_links(payload.get("html_part"))
    records, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise invalid("Expected a purchase record")
        date = item.get("purchased_on", payload.get("purchased_on"))
        order = item.get("order_id", payload.get("order_id"))
        if (
            payload.get("purchased_on") is not None and date != payload["purchased_on"]
        ) or (payload.get("order_id") is not None and order != payload["order_id"]):
            raise invalid("Purchase date or order differs from its email")
        members = item.get("included_titles")
        if members is None:
            href = item.get("href")
            title = item.get("title")
            candidates = (
                html_links.get(_title_key(title), set())
                if isinstance(title, str)
                else set()
            )
            if href is None and len(candidates) == 1:
                href = next(iter(candidates))
            members = [{"title": title, "href": href}]
        if (
            not isinstance(members, list)
            or not members
            or len(records) + len(members) > MAX_MOVIES
        ):
            raise invalid("Purchase email supports up to 1000 included movies")
        if any(not isinstance(member, dict) for member in members):
            raise invalid("Expected included movie records")
        # Stable ordering makes allocations independent of the email's list order.
        validated = [
            purchase_record(
                {
                    "title": member.get("title"),
                    "href": member.get("href"),
                    "purchased_on": date,
                    "order_id": order,
                }
            )
            for member in members
        ]
        validated.sort(key=lambda row: row["id"])
        paid = _shares(item.get("purchase_price"), len(validated))
        retail = _shares(item.get("retail_price"), len(validated))
        for index, record in enumerate(validated):
            if record["id"] in seen:
                raise invalid("Duplicate purchase identity in email")
            seen.add(record["id"])
            records.append(
                {**record, "purchase_price": paid[index], "retail_price": retail[index]}
            )
    return records

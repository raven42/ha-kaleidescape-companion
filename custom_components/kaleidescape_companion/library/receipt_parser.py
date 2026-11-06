"""Extract bounded purchase evidence from fetched receipt HTML."""

import base64
import binascii
import json
import quopri
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..core.models import JournalError, invalid
from .importing import purchase_date
from .purchase_email import (
    MAX_BYTES,
    MAX_MOVIES,
    _html_links,
    _title_key,
    normalize,
    selected_fields,
)
from .purchases import price_cents
from .receipt_html import parse_rows

_TOTAL = re.compile(
    r"(?im)^\s*(subtotal|tax(?:es)?|total)\s*:?\s*([$£€][\d,]+\.\d{2})\b"
)


class _HTMLText(HTMLParser):
    """Render visible receipt structure without evaluating markup or loading assets."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = []
        self.anchors = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        void = tag in {
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr",
        }
        style = str(attrs.get("style") or "").lower()
        hidden = (
            tag in {"script", "style", "head"}
            or "hidden" in attrs
            or str(attrs.get("aria-hidden") or "").lower() == "true"
            or bool(re.search(r"(?:display\s*:\s*none|visibility\s*:\s*hidden)", style))
        )
        if self.hidden or hidden:
            if not void:
                self.hidden.append(tag)
            return
        if tag in {"tr", "p", "div", "li", "br", "table"}:
            self.parts.append("\n")
        elif tag in {"td", "th"}:
            self.parts.append(" ")
        elif tag == "img" and attrs.get("alt", "").lower() == "cover":
            self.parts.append("\n[image: Cover]\n")
        elif tag == "a":
            self.anchors.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if self.hidden:
            if tag in self.hidden:
                while self.hidden:
                    if self.hidden.pop() == tag:
                        break
            return
        if tag == "a" and self.anchors:
            href = self.anchors.pop()
            try:
                url = urlsplit(href)
                if (
                    url.scheme == "https"
                    and url.hostname
                    in {"store.kaleidescape.com", "www.kaleidescape.com"}
                    and url.path.startswith(
                        ("/movie-store/movie/", "/movie-store/set/")
                    )
                ):
                    self.parts.append(f" <{href}> ")
                elif (
                    not url.scheme
                    and not url.netloc
                    and url.path.startswith(
                        ("/movie-store/movie/", "/movie-store/set/")
                    )
                ):
                    self.parts.append(f" <https://store.kaleidescape.com{href}> ")
            except ValueError:
                pass
        if tag in {"tr", "p", "div", "li", "table"}:
            self.parts.append("\n")
        elif tag in {"td", "th"}:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def _html_part(part):
    if (
        not isinstance(part, dict)
        or not isinstance(part.get("content_type"), str)
        or part["content_type"].lower().split(";", 1)[0].strip() != "text/html"
    ):
        return None
    data = part.get("part_data")
    if not isinstance(data, str):
        return None
    try:
        if len(data.encode("utf-8")) > MAX_BYTES * 2:
            return None
        encoding = str(part.get("content_transfer_encoding") or "").lower()
        if encoding == "base64":
            raw = base64.b64decode(data, validate=False)
        elif encoding == "quoted-printable":
            raw = quopri.decodestring(data.encode("utf-8"))
        elif encoding in {"", "7bit", "8bit", "binary"}:
            raw = data.encode("utf-8")
        else:
            return None
        if len(raw) > MAX_BYTES:
            return None
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("latin-1")
    except ValueError, UnicodeError, binascii.Error:
        return None


def _render_html(body):
    parser = _HTMLText()
    parser.feed(body)
    parser.close()
    return "".join(parser.parts)


def _date(value, timezone, *, localize=False):
    if not isinstance(value, str) or len(value) > 256:
        return None
    value = re.sub(r"\s+", " ", value.replace("\u202f", " ")).strip()
    candidates = []
    try:
        candidates.append(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        pass
    try:
        candidates.append(parsedate_to_datetime(value))
    except ValueError, TypeError, OverflowError:
        pass
    for fmt in (
        "%B %d, %Y",
        "%b %d, %Y",
        "%a, %b %d, %Y at %I:%M %p",
        "%a, %b %d, %Y %I:%M %p",
        "%b %d, %Y at %I:%M %p",
    ):
        try:
            candidates.append(datetime.strptime(value, fmt))
        except ValueError:
            pass
    for date in candidates:
        if date is None:
            continue
        try:
            if localize and date.utcoffset() is not None:
                date = date.astimezone(ZoneInfo(timezone))
            return purchase_date(date.date().isoformat())
        except JournalError, ZoneInfoNotFoundError, ValueError, OverflowError:
            continue
    return None


def _receipt_date(body, subject, event_date, timezone):
    labeled = re.findall(r"(?im)^\s*(?:order|purchase)\s+date\s*:?\s*([^\r\n]+)", body)
    forwarded = bool(re.match(r"(?i)^\s*(?:fwd?|forwarded):", subject))
    original = re.findall(
        r"(?im)^\s*from:[^\r\n]*\bstore@kaleidescape[.]com\b[^\r\n]*\r?\n\s*date:\s*([^\r\n]+)",
        body,
    )
    for candidate in [*labeled, *reversed(original)]:
        if result := _date(candidate, timezone):
            return result
    if not forwarded:
        return _date(event_date, timezone, localize=True)
    return None


def _clean(body):
    body = unescape(body).replace("\xa0", " ")
    body = re.sub(r"(?m)^[ \t]*(?:>[ \t]*)+", "", body)
    body = re.sub(r"(?i)\[image:\s*cover\s*\]", "\n@cover@\n", body)
    return re.sub(r"(?is)\[image:[^\]]*\]", " ", body)


def _totals(body):
    totals, issues = {}, []
    for key, value in _TOTAL.findall(body):
        try:
            totals["taxes" if key.lower() == "tax" else key.lower()] = price_cents(
                value
            )
        except JournalError:
            issues.append({"reason": "invalid_total"})
    return totals, issues


def parse_receipt(payload, timezone="UTC"):
    """Return independently validated records and bounded, actionable issues."""
    if not isinstance(payload, dict) or payload.get("source") != "kaleidescape":
        raise invalid("Expected a Kaleidescape purchase email")
    try:
        if len(json.dumps(payload, ensure_ascii=True).encode()) > MAX_BYTES * 4:
            raise invalid("Purchase email exceeds the size limit")
    except (TypeError, ValueError, RecursionError, UnicodeError) as error:
        raise invalid("Expected a valid purchase email object") from error
    selected = selected_fields(payload)
    email = payload.get("email")
    if not isinstance(email, dict):
        raise invalid("Expected fetched purchase email content")
    text = email.get("text") or ""
    subject = email.get("subject") or ""
    if not isinstance(text, str) or not isinstance(subject, str):
        raise invalid("Expected purchase email text and subject")
    try:
        if len(text.encode("utf-8")) > MAX_BYTES:
            raise invalid("Purchase email text exceeds the size limit")
    except UnicodeError as error:
        raise invalid("Purchase email text must contain valid Unicode") from error
    html = _html_part(payload.get("html_part"))
    if not html:
        return [], [{"reason": "html_part_unavailable"}]
    rows = parse_rows(html)
    if rows is None:
        return [], [{"reason": "html_items_unavailable"}]
    items, issues = rows
    body = _clean(_render_html(html))
    totals, total_issues = _totals(body)
    issues.extend(total_issues)
    if not items:
        issues.append({"reason": "no_items_found"})
    date = None
    if "purchase-date" in selected:
        date = _receipt_date(body, subject, email.get("date"), timezone)
    order = None
    if "transaction-id" in selected:
        order = re.search(
            r"(?i)\b(?:order|transaction)\s*(?:id|number|#)\s*:?\s*([A-Za-z0-9_-]{1,256})",
            body,
        )
    order_id = order.group(1) if order else None
    if "purchase-date" in selected and not date:
        issues.append({"reason": "purchase_date_missing"})
    if "transaction-id" in selected and not order_id:
        issues.append({"reason": "order_id_missing"})
    links = _html_links(payload.get("html_part"))
    records, seen = [], set()
    for item in items[:MAX_MOVIES]:
        title = item.get("title", "")
        if "purchase-date" in selected and not date:
            issues.append({"title": title, "reason": "purchase_date_missing"})
        for selection, field in (
            ("purchase-price", "purchase_price"),
            ("retail-price", "retail_price"),
        ):
            if selection not in selected:
                item[field] = None
            elif item.get(field) is None:
                issues.append({"title": title, "reason": field + "_missing"})
        if "included_titles" in item and not item["included_titles"]:
            issues.append({"title": title, "reason": "collection_members_missing"})
            continue
        for movie in item.get("included_titles", [item]):
            if not movie.get("href") and isinstance(movie.get("title"), str):
                matches = links.get(_title_key(movie["title"]), set())
                if len(matches) == 1:
                    movie["href"] = next(iter(matches))
            if not movie.get("href"):
                issues.append(
                    {"title": movie.get("title", title), "reason": "store_link_missing"}
                )
        try:
            rows = normalize(
                {
                    "source": "kaleidescape",
                    "purchased_on": date,
                    "order_id": order_id,
                    "purchases": [item],
                }
            )
        except JournalError:
            issues.append({"title": title, "reason": "invalid_purchase"})
            continue
        if any(row["id"] in seen for row in rows):
            issues.append({"title": title, "reason": "duplicate_item"})
            continue
        if len(records) + len(rows) > MAX_MOVIES:
            issues.append({"title": title, "reason": "item_limit_exceeded"})
            break
        seen.update(row["id"] for row in rows)
        records.extend(rows)
    if len(items) > MAX_MOVIES:
        issues.append({"reason": "item_limit_exceeded"})
    paid = [price_cents(item.get("purchase_price")) for item in items]
    if (
        "purchase-price" in selected
        and totals.get("subtotal")
        and all(value and value[0] == totals["subtotal"][0] for value in paid)
        and sum(value[1] for value in paid) != totals["subtotal"][1]
    ):
        issues.append({"reason": "subtotal_mismatch"})
    if totals.get("subtotal") and totals.get("taxes") and totals.get("total"):
        if len({totals[key][0] for key in ("subtotal", "taxes", "total")}) != 1:
            issues.append({"reason": "currency_mismatch"})
        elif sum(totals[key][1] for key in ("subtotal", "taxes")) != totals["total"][1]:
            issues.append({"reason": "total_mismatch"})
    if not ({"purchase-price", "retail-price"} & selected):
        issues = [issue for issue in issues if issue["reason"] != "ambiguous_price"]
    if records and not date and not order_id:
        issues.append({"reason": "limited_receipt_identity"})
    return records, issues

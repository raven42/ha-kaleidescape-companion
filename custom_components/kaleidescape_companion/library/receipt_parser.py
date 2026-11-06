"""Extract bounded purchase evidence from fetched receipt text and HTML."""

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

_PRICE = re.compile(r"(?<![\w.+-])[$£€]\s*[\d,]+\.\d{2}(?!\d)")
_PRICE_TOKEN = re.compile(r"(?<![\w.])[-+]?[$£€]\s*[\d,]+(?:\.\d+)?")
_LINK = re.compile(
    r"<?(?:https?://[^\s<>]+)?/movie-store/(?:movie|set)/[^\s<>]+>?", re.I
)
_SECTION = re.compile(
    r"(?i)\b(?:item|items|movie|title|product)\b"
    r"(?:\s+(?:quality|format|qty|quantity|description|unit|item)){0,4}\s+price\b"
)
_TOTAL = re.compile(
    r"(?im)^\s*(subtotal|tax(?:es)?|total)\s*:?\s*([$£€][\d,]+\.\d{2})\b"
)


def _store_path(value):
    try:
        url = urlsplit(value.strip("<>"))
        if url.scheme == "https" and url.netloc in {
            "store.kaleidescape.com",
            "www.kaleidescape.com",
        }:
            return url.path
        if not url.scheme and not url.netloc and value.startswith(("/", "</")):
            return url.path
    except ValueError:
        pass
    return None


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


def _parse_items(body):
    match = _SECTION.search(body)
    issues = []
    if match:
        section = body[match.end() :]
    else:
        lines = body.splitlines()
        indexes = [
            index
            for index, line in enumerate(lines)
            if any(_store_path(url) for url in _LINK.findall(line))
        ]
        if not indexes:
            return [], [{"reason": "item_section_missing"}], {}
        start, end = indexes[0], indexes[-1] + 1
        if start and not lines[start].split("<", 1)[0].strip():
            previous = lines[start - 1].strip()
            if previous and not re.match(
                r"(?i)^(?:order|date|from|subject|subtotal|total)\b", previous
            ):
                start -= 1
        while end < len(lines) and end < indexes[-1] + 5:
            following = lines[end].strip()
            if following and not (
                _PRICE_TOKEN.search(following)
                or re.fullmatch(r"(?i)(?:quality|4k|hd|uhd|sd|included)", following)
            ):
                break
            end += 1
        section = "\n".join(lines[start:end])
        issues.append({"reason": "item_section_missing"})
    stop = re.search(r"(?im)^\s*subtotal\b", section)
    if stop:
        section = section[: stop.start()]
    items, current, bundle = [], None, None

    def finish():
        nonlocal current
        if current is None:
            return
        title = " ".join(current.pop("_title")).strip()
        prices = current.pop("_prices")
        current.pop("_price_seen")
        if title:
            current["title"] = title
            if len(prices) == 2:
                current["retail_price"], current["purchase_price"] = (
                    prices[0],
                    prices[-1],
                )
            elif prices:
                current["_ambiguous_prices"] = prices
            if current.pop("_included"):
                if bundle is not None:
                    bundle["included_titles"].append(
                        {"title": title, "href": current.get("href")}
                    )
                else:
                    issues.append(
                        {"title": title, "reason": "collection_not_identified"}
                    )
            else:
                items.append(current)
        else:
            issues.append({"reason": "title_missing"})
        current = None

    for raw in section.splitlines():
        line = " ".join(raw.split())
        if not line:
            continue
        if line == "@cover@":
            finish()
            bundle = None
            continue
        urls = _LINK.findall(line)
        tokens = _PRICE_TOKEN.findall(line)
        invalid_price = False
        for value in tokens:
            try:
                if _PRICE.fullmatch(value) is None:
                    invalid_price = True
                else:
                    price_cents(value.replace(" ", ""))
            except JournalError:
                invalid_price = True
        values = (
            []
            if invalid_price
            else [
                value.replace(" ", "").replace(",", "")
                for value in _PRICE.findall(line)
            ]
        )
        included = bool(re.search(r"\bincluded\b", line, re.I))
        paths = [path for url in urls if (path := _store_path(url))]
        is_set = any(path.lower().startswith("/movie-store/set/") for path in paths)
        clean = _LINK.sub(" ", line)
        clean = _PRICE_TOKEN.sub(" ", clean)
        clean = re.sub(r"(?i)\s*\bincluded\s*$", " ", clean)
        clean = re.sub(r"(?i)(?:^|\s+)(?:quality|4k|hd|uhd|sd)\s*$", " ", clean)
        clean = " ".join(clean.strip(" <>-–|:").split())
        if not clean and not tokens and not urls and not included:
            continue
        href = next(
            (path for path in paths if path.lower().startswith("/movie-store/movie/")),
            None,
        )
        if is_set:
            finish()
            bundle = {
                "_title": [clean] if clean else [],
                "_prices": values,
                "_included": False,
                "_price_seen": bool(tokens),
                "included_titles": [],
            }
            current = bundle
            continue
        # A new title begins after a priced row, or an included collection row.
        if (
            current
            and clean
            and (current["_price_seen"] or (bundle is not None and current is bundle))
        ):
            finish()
        if current is None:
            current = {
                "_title": [],
                "_prices": [],
                "_price_seen": False,
                "_included": included,
                "href": href,
            }
        if clean:
            if not current["_title"] or clean != current["_title"][-1]:
                current["_title"].append(clean)
        if href:
            current["href"] = href
        current["_prices"].extend(values)
        current["_price_seen"] |= bool(tokens)
        current["_included"] |= included
        if invalid_price:
            issues.append(
                {"title": " ".join(current["_title"]), "reason": "invalid_price"}
            )
        if included and current is not bundle:
            finish()
    finish()
    totals = {}
    for key, value in _TOTAL.findall(body):
        try:
            totals[key.lower()] = price_cents(value)
        except JournalError:
            issues.append({"reason": "invalid_total"})
    # A single displayed price is not inherently a purchase or retail price.
    # It is a purchase price when it exactly accounts for the remaining item
    # subtotal after every other item's known purchase price is deducted.
    ambiguous = [item for item in items if item.get("_ambiguous_prices")]
    if len(ambiguous) == 1 and len(ambiguous[0]["_ambiguous_prices"]) == 1:
        subtotal = totals.get("subtotal")
        candidate = price_cents(ambiguous[0]["_ambiguous_prices"][0])
        others = [
            price_cents(item.get("purchase_price"))
            for item in items
            if item is not ambiguous[0]
        ]
        if (
            subtotal
            and candidate[0] == subtotal[0]
            and all(value is not None and value[0] == subtotal[0] for value in others)
            and candidate[1] + sum(value[1] for value in others) == subtotal[1]
        ):
            ambiguous[0]["purchase_price"] = ambiguous[0]["_ambiguous_prices"][0]
            ambiguous[0].pop("_ambiguous_prices")
    for item in items:
        if item.pop("_ambiguous_prices", None):
            issues.append({"title": item["title"], "reason": "ambiguous_price"})
    return items, issues, totals


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
    html_issue = payload.get("html_expected") is True and html is None
    versions = []
    for content in (text, html):
        if not content:
            continue
        rows = None
        if re.search(r"(?i)<(?:html|body|table|tr|div)\b", content):
            rows = parse_rows(content)
            content = _render_html(content)
        body = _clean(content)
        items, issues, totals = _parse_items(body)
        if rows is not None:
            items, issues = rows
        versions.append((items, issues, totals, body, rows is not None))
    if not versions:
        issues = [{"reason": "email_body_missing"}]
        if html_issue:
            issues.append({"reason": "html_part_unavailable"})
        return [], issues
    items, issues, totals, body, structured = max(
        versions,
        key=lambda result: (
            result[4],
            len(result[0]),
            sum(bool(i.get("purchase_price")) for i in result[0]),
        ),
    )
    if structured:
        # Keep identifiable text-only rows when a partially structured HTML
        # part lacks them, but flag their less certain price/link evidence.
        known = {
            _title_key(movie.get("title", ""))
            for item in items
            for movie in item.get("included_titles", [item])
            if movie.get("title")
        }
        for fallback_items, _, _, _, fallback_structured in versions:
            if fallback_structured:
                continue
            for item in fallback_items:
                if "included_titles" in item:
                    bundles = [
                        candidate
                        for candidate in items
                        if "included_titles" in candidate
                        and _title_key(candidate.get("title", ""))
                        == _title_key(item.get("title", ""))
                    ]
                    if len(bundles) == 1:
                        for member in item["included_titles"]:
                            key = _title_key(member.get("title", ""))
                            if not key or key in known:
                                continue
                            bundles[0]["included_titles"].append(member)
                            known.add(key)
                            issues.append(
                                {"title": member["title"], "reason": "text_only_item"}
                            )
                        continue
                titles = [
                    movie.get("title", "")
                    for movie in item.get("included_titles", [item])
                ]
                keys = {_title_key(title) for title in titles if title}
                if not keys or keys & known:
                    continue
                items.append(item)
                known.update(keys)
                issues.append(
                    {"title": item.get("title", ""), "reason": "text_only_item"}
                )
    if html_issue:
        issues.append({"reason": "html_part_unavailable"})
    if not items:
        issues.append({"reason": "no_items_found"})
    date = None
    if "purchase-date" in selected:
        for candidate in [
            body,
            *(version[3] for version in versions if version[3] != body),
        ]:
            date = _receipt_date(candidate, subject, None, timezone)
            if date:
                break
        if not date:
            date = _receipt_date(body, subject, email.get("date"), timezone)
    order = None
    if "transaction-id" in selected:
        for candidate in [
            body,
            *(version[3] for version in versions if version[3] != body),
        ]:
            order = re.search(
                r"(?i)\b(?:order|transaction)\s*(?:id|number|#)\s*:?\s*([A-Za-z0-9_-]{1,256})",
                candidate,
            )
            if order:
                break
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

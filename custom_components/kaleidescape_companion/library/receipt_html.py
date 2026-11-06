"""Extract purchase rows from visible HTML without evaluating or loading it."""

import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

from ..core.models import JournalError
from .purchase_email import MAX_MOVIES, _title_key
from .purchases import price_cents

_PRICE = re.compile(r"(?<![\w.+-])[$£€]\s*[\d,]+\.\d{2}(?!\d)")
_TOKEN = re.compile(r"(?<![\w.])[-+]?[$£€]\s*[\d,]+(?:\.\d+)?")
_VOID = {
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
_STRIKE_CLASSES = {
    "line-through",
    "strikethrough",
    "strike",
    "old-price",
    "original-price",
}


def _path(href):
    if not isinstance(href, str) or len(href) > 2048:
        return None
    try:
        url = urlsplit(href)
    except ValueError:
        return None
    if not (
        (
            url.scheme == "https"
            and url.netloc in {"store.kaleidescape.com", "www.kaleidescape.com"}
        )
        or (not url.scheme and not url.netloc and href.startswith("/"))
    ):
        return None
    return (
        url.path
        if url.path.startswith(("/movie-store/movie/", "/movie-store/set/"))
        else None
    )


def _struck(tag, attrs):
    style = str(attrs.get("style") or "").lower()
    classes = set(str(attrs.get("class") or "").lower().split())
    return (
        tag in {"s", "strike", "del"}
        or bool(classes & _STRIKE_CLASSES)
        or bool(re.search(r"text-decoration(?:-line)?\s*:[^;]*\bline-through\b", style))
    )


class _ComplexityLimit(Exception):
    """Stop parsing immediately when structural budgets are exceeded."""


class _Rows(HTMLParser):
    """Collect independent rows from nested tables, ignoring hidden content."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.finished = []
        self.hidden = []
        self.too_complex = False
        self.position = 0
        self.depth = 0
        self.data_nodes = 0

    def _row(self):
        return self.tables[-1]["row"] if self.tables else None

    def _cell(self):
        row = self._row()
        return row["cell"] if row else None

    def _close_anchor(self, cell):
        if cell and cell["anchor"]:
            cell["anchors"].append(cell["anchor"])
            cell["anchor"] = None

    def _close_row(self):
        row = self._row()
        if row is None:
            return
        self._close_anchor(row["cell"])
        self.tables[-1]["rows"].append(row)
        self.tables[-1]["row"] = None
        if len(self.tables[-1]["rows"]) > MAX_MOVIES + 100:
            raise _ComplexityLimit

    def handle_starttag(self, tag, attrs):
        self.position += 1
        if self.position > 20000:
            raise _ComplexityLimit
        if tag not in _VOID:
            self.depth += 1
            if self.depth > 128:
                raise _ComplexityLimit
        attrs = dict(attrs)
        void = tag in _VOID
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
                if len(self.hidden) > 128:
                    raise _ComplexityLimit
            return
        if tag == "table":
            if len(self.tables) >= 64:
                raise _ComplexityLimit
            parent = self._row()
            table = {"row": None, "rows": [], "parent": parent}
            if parent:
                parent["nested"].append(table)
            self.tables.append(table)
            return
        if tag == "tr" and self.tables:
            self._close_row()
            self.tables[-1]["row"] = {
                "cells": [],
                "cell": None,
                "nested": [],
                "table": self.tables[-1],
                "position": self.position,
            }
            return
        row = self._row()
        if tag in {"td", "th"} and row is not None:
            self._close_anchor(row["cell"])
            cell = {
                "header": tag == "th",
                "pieces": [],
                "anchors": [],
                "anchor": None,
                "strike": _struck(tag, attrs),
                "inline_tags": [],
                "strike_depth": 0,
            }
            row["cells"].append(cell)
            row["cell"] = cell
            return
        cell = self._cell()
        if cell is None:
            return
        if tag == "a":
            self._close_anchor(cell)
            href = _path(attrs.get("href"))
            if href:
                cell["anchor"] = {"href": href, "text": []}
        if not void:
            struck = _struck(tag, attrs)
            cell["inline_tags"].append((tag, struck))
            if len(cell["inline_tags"]) > 128:
                raise _ComplexityLimit
            cell["strike_depth"] += struck

    def handle_endtag(self, tag):
        self.depth = max(0, self.depth - 1)
        if self.hidden:
            if tag in self.hidden:
                while self.hidden:
                    if self.hidden.pop() == tag:
                        break
            return
        if tag == "table" and self.tables:
            self._close_row()
            self.finished.append(self.tables.pop())
            return
        if tag == "tr" and self.tables:
            self._close_row()
            return
        cell = self._cell()
        if cell is None:
            return
        if tag == "a":
            self._close_anchor(cell)
        if any(name == tag for name, _ in cell["inline_tags"]):
            while cell["inline_tags"]:
                name, struck = cell["inline_tags"].pop()
                cell["strike_depth"] -= struck
                if name == tag:
                    break
        if tag in {"td", "th"}:
            self._close_anchor(cell)
            self._row()["cell"] = None

    def handle_data(self, data):
        self.data_nodes += 1
        if self.data_nodes > 20000:
            raise _ComplexityLimit
        if self.hidden:
            return
        cell = self._cell()
        if cell is None:
            return
        cell["pieces"].append((data, cell["strike"] or cell["strike_depth"] > 0))
        if cell["anchor"]:
            cell["anchor"]["text"].append(data)


def _anchors(row):
    return [anchor for cell in row["cells"] for anchor in cell["anchors"]]


def _members(anchors):
    result, seen = [], set()
    for anchor in anchors:
        if not anchor["href"].startswith("/movie-store/movie/"):
            continue
        title = " ".join("".join(anchor["text"]).split())
        key = (anchor["href"], _title_key(title))
        if title and key not in seen:
            result.append({"title": title, "href": anchor["href"]})
            seen.add(key)
    return result


def _nested_members(row):
    anchors = []
    for table in row["nested"]:
        for child in table["rows"]:
            anchors.extend(_anchors(child))
            anchors.extend(_nested_anchors(child))
    return _members(anchors)


def _nested_anchors(row):
    return [
        anchor
        for table in row["nested"]
        for child in table["rows"]
        for anchor in (*_anchors(child), *_nested_anchors(child))
    ]


def _item(row):
    all_anchors = _anchors(row)
    set_anchors = [
        anchor
        for anchor in all_anchors
        if anchor["href"].startswith("/movie-store/set/")
    ]
    anchors = set_anchors or [
        anchor
        for anchor in all_anchors
        if anchor["href"].startswith("/movie-store/movie/")
    ]
    if not anchors:
        return None, [], None
    hrefs = {anchor["href"] for anchor in anchors}
    names = {" ".join("".join(anchor["text"]).split()) for anchor in anchors}
    names.discard("")
    if not names:
        for cell in row["cells"]:
            value = " ".join("".join(piece for piece, _ in cell["pieces"]).split())
            value = " ".join(_TOKEN.sub(" ", value).split()).strip(" :-–|")
            if value and not re.fullmatch(
                r"(?i)(?:included|quality|4k|uhd|hd|sd)", value
            ):
                names.add(value)
    if len(hrefs) != 1 or len({_title_key(name) for name in names}) != 1:
        return None, [{"reason": "ambiguous_item_row"}], None
    title = max(names, key=len)
    regular, struck, issues = [], [], []
    # Price-only nested rows belong to this item only when no nested purchase
    # or total is present in the same nested table.
    price_cells = list(row["cells"])
    for table in row["nested"]:
        children = table["rows"]
        if any(_anchors(child) or _nested_anchors(child) for child in children):
            continue
        if any(
            re.search(
                r"(?i)\b(?:subtotal|tax(?:es)?|total)\b",
                " ".join(
                    "".join(piece for piece, _ in cell["pieces"])
                    for cell in child["cells"]
                ),
            )
            for child in children
        ):
            continue
        price_cells.extend(cell for child in children for cell in child["cells"])
    for cell in price_cells:
        text = "".join(piece for piece, _ in cell["pieces"])
        flags = [flag for piece, flag in cell["pieces"] for _ in piece]
        for match in _TOKEN.finditer(text):
            value = match.group()
            try:
                if _PRICE.fullmatch(value) is None:
                    raise ValueError
                price_cents(value.replace(" ", ""))
            except JournalError, ValueError:
                issues.append({"title": title, "reason": "invalid_price"})
                continue
            marks = {
                flags[index]
                for index in range(match.start(), match.end())
                if text[index].isdigit()
            }
            if len(marks) != 1:
                issues.append({"title": title, "reason": "ambiguous_price"})
                continue
            (struck if marks.pop() else regular).append(
                value.replace(" ", "").replace(",", "")
            )
    item = {"title": title, "href": next(iter(hrefs))}
    if len(regular) == 1:
        item["purchase_price"] = regular[0]
    elif len(regular) > 1:
        issues.append({"title": title, "reason": "ambiguous_price"})
    if len(struck) == 1:
        item["retail_price"] = struck[0]
    elif len(struck) > 1:
        issues.append({"title": title, "reason": "ambiguous_price"})
    if set_anchors:
        item["included_titles"] = []
        for member in _members(all_anchors) + _nested_members(row):
            if member not in item["included_titles"]:
                item["included_titles"].append(member)
        return item, issues, "set"
    included = re.search(
        r"(?i)\bincluded\b",
        " ".join("".join(p for p, _ in c["pieces"]) for c in row["cells"]),
    )
    return item, issues, "included" if included else "movie"


def parse_rows(html):
    """Return structured movie rows, or None when the layout needs text fallback."""
    parser = _Rows()
    try:
        parser.feed(html)
        parser.close()
    except _ComplexityLimit:
        return None
    while parser.tables:
        parser._close_row()
        parser.finished.append(parser.tables.pop())
    if parser.too_complex:
        return None
    all_rows = [row for table in parser.finished for row in table["rows"]]
    headers = []
    subtotals = []
    for row in all_rows:
        header = " ".join(
            "".join(piece for piece, _ in cell["pieces"])
            for cell in row["cells"]
            if cell["header"]
        )
        labels = {
            " ".join("".join(piece for piece, _ in cell["pieces"]).split()).casefold()
            for cell in row["cells"]
        }
        if (
            re.search(r"(?i)\b(?:item|items|movie|title|product)\b", header)
            and re.search(r"(?i)\bprice\b", header)
        ) or (
            labels & {"item", "items", "movie", "title", "product"}
            and "price" in labels
        ):
            headers.append(row["position"])
        if any(
            re.fullmatch(
                r"(?i)\s*subtotal\s*:?\s*(?:[$£€][\d,]+\.\d{2})?\s*",
                "".join(piece for piece, _ in cell["pieces"]),
            )
            for cell in row["cells"]
        ):
            subtotals.append(row["position"])
    start = min(headers) if headers else None
    end = min(
        (position for position in subtotals if start is not None and position > start),
        default=None,
    )
    eligible_rows = []
    for table in parser.finished:
        parent = table["parent"]
        nested_in_set = False
        while parent:
            if any(
                anchor["href"].startswith("/movie-store/set/")
                for anchor in _anchors(parent)
            ):
                nested_in_set = True
                break
            parent = parent["table"]["parent"]
        if nested_in_set:
            continue
        for row in table["rows"]:
            if start is not None and (
                row["position"] < start or (end is not None and row["position"] >= end)
            ):
                continue
            eligible_rows.append(row)
    items, issues, bundle = [], [], None
    for row in sorted(eligible_rows, key=lambda entry: entry["position"]):
        item, row_issues, kind = _item(row)
        issues.extend(row_issues)
        if kind == "set":
            items.append(item)
            bundle = item
        elif kind == "included":
            if bundle is None:
                issues.append(
                    {"title": item["title"], "reason": "collection_not_identified"}
                )
            else:
                member = {"title": item["title"], "href": item["href"]}
                if member not in bundle["included_titles"]:
                    bundle["included_titles"].append(member)
        elif kind == "movie":
            bundle = None
            items.append(item)
    if not items and not issues:
        return None
    return items, issues

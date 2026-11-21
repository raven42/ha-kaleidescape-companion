"""Conservative, bounded matching of unlinked invoices to scanned movies."""

import logging
import re
import time
from collections import defaultdict
from urllib.parse import urlsplit

from ..core.search import fold_search
from .title_matching import store_title

_LOGGER = logging.getLogger(__name__)
MAX_ITEMS = 10000
MAX_VERSIONS = 20000
BUDGET_SECONDS = 2
YEAR_SUFFIX = re.compile(r"^(.*?)\s+\(((?:18|19|20|21)\d{2})\)$")


def title_key(value):
    """Use complete titles, without fuzzy or article/edition aliases."""
    return " ".join(fold_search(value).split())


def store_path(value):
    """Compare known Store URLs without contacting the Store or guessing IDs."""
    if not isinstance(value, str) or not value:
        return None
    try:
        url = urlsplit(value)
    except ValueError:
        return None
    if (
        url.scheme not in ("", "http", "https")
        or url.netloc not in ("", "www.kaleidescape.com", "store.kaleidescape.com")
        or url.query
        or url.fragment
        or not re.fullmatch(
            r"/movie-store/movie/(?:details/[0-9]{1,20}|[a-z0-9]+(?:-[a-z0-9]+)*)/?",
            url.path,
        )
    ):
        return None
    return url.path.rstrip("/")


def auto_match(db, source):
    """Link only unique, nonconflicting evidence; caller owns the transaction.

    Plan every link before writing so a budget limit leaves the ledger unchanged.
    Each source group is one movie; select an existing linked version when possible.
    """
    started = time.monotonic()
    pending = db.execute(
        "SELECT p.* FROM purchase_records p WHERE p.library_id IS NULL "
        "AND (p.issue IS NULL OR p.issue='unmatched') "
        "AND NOT EXISTS (SELECT 1 FROM purchase_identity_barriers b "
        "WHERE b.purchase_id=p.id) "
        "AND NOT EXISTS (SELECT 1 FROM purchase_repair_events e "
        "WHERE json_extract(e.after_record,'$.id')=p.id "
        "AND json_extract(e.before_record,'$.library_id') IS NOT NULL "
        "AND json_type(e.after_record,'$.library_id')='null') "
        "ORDER BY p.id LIMIT ?",
        (MAX_ITEMS + 1,),
    ).fetchall()
    if not pending:
        return 0
    if len(pending) > MAX_ITEMS:
        _LOGGER.warning("Automatic purchase matching exceeded its record limit")
        return 0
    versions = db.execute(
        "SELECT id,source_group,title,href,purchase_price,retail_price, "
        "EXISTS (SELECT 1 FROM purchase_records WHERE library_id=library.id) "
        "has_purchases, "
        "json_extract(data,'$.year') year, "
        "json_extract(enrichment,'$.kaleidescape.url') store_url, "
        "json_extract(enrichment,'$.kaleidescape.provider_id') store_id, "
        "json_extract(enrichment,'$.matches.kaleidescape.provider_id') bound_id "
        "FROM library WHERE source_id=? AND available=1 "
        "AND purchase_match_pending=0 ORDER BY id LIMIT ?",
        (source, MAX_VERSIONS + 1),
    ).fetchall()
    if len(versions) > MAX_VERSIONS:
        _LOGGER.warning("Automatic purchase matching exceeded its Library limit")
        return 0
    groups, titles, urls = {}, defaultdict(set), defaultdict(set)
    versions_by_id = {row["id"]: row for row in versions}
    for row in versions:
        group = row["source_group"]
        item = groups.setdefault(group, {"id": row["id"], "years": set()})
        if type(row["year"]) is int:
            item["years"].add(row["year"])
        titles[title_key(row["title"])].add(group)
        paths = [row["href"]]
        if row["store_id"] and row["store_id"] == row["bound_id"]:
            paths.append(row["store_url"])
        for value in paths:
            if path := store_path(value):
                urls[path].add(group)
    for row in db.execute(
        "SELECT p.href,t.source_group,t.id FROM purchase_records p "
        "JOIN library t ON t.id=p.library_id WHERE t.source_id=? "
        "AND t.available=1 AND t.purchase_match_pending=0 AND p.href IS NOT NULL",
        (source,),
    ):
        if time.monotonic() - started > BUDGET_SECONDS:
            _LOGGER.warning("Automatic purchase matching exceeded its time budget")
            return 0
        if path := store_path(row["href"]):
            urls[path].add(row["source_group"])
            groups[row["source_group"]]["id"] = row["id"]
    planned = []
    for record in pending:
        if time.monotonic() - started > BUDGET_SECONDS:
            _LOGGER.warning("Automatic purchase matching exceeded its time budget")
            return 0
        raw_title = record["title"]
        year_suffix = YEAR_SUFFIX.fullmatch(raw_title.strip())
        title = year_suffix[1] if year_suffix else raw_title
        path = store_path(record["href"])
        alternate, url_year = store_title(path)
        suffix_year = int(year_suffix[2]) if year_suffix else None
        if suffix_year and url_year and suffix_year != url_year:
            continue
        year = suffix_year or url_year
        exact_url = urls.get(path, set()) if path else set()
        primary = titles.get(title_key(title), set())
        linked = titles.get(title_key(alternate), set()) if alternate else set()
        if primary and linked and not primary & linked:
            continue
        if exact_url and primary and not exact_url & primary:
            continue
        if exact_url and linked and not exact_url & linked:
            continue
        candidates = exact_url or (
            primary & linked if primary and linked else primary | linked
        )
        if year is not None:
            candidates = {
                group for group in candidates if year in groups[group]["years"]
            }
        if len(candidates) == 1:
            target = groups[next(iter(candidates))]["id"]
            version = versions_by_id[target]
            if not version["has_purchases"] and any(
                version[field] is not None
                and record[field] is not None
                and version[field] != record[field]
                for field in ("purchase_price", "retail_price")
            ):
                continue
            planned.append((target, record["id"]))
    for target, purchase in planned:
        db.execute(
            "UPDATE purchase_records SET library_id=?,issue=NULL "
            "WHERE id=? AND library_id IS NULL",
            (target, purchase),
        )
    return len(planned)

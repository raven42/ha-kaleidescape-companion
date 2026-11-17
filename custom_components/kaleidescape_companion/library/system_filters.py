"""Source-scoped, administrator-only Library maintenance filters."""

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from ..core.models import JournalError
from ..enrichment.selection import FIELDS, OPTIONS
from ..enrichment.selection import read as source_preferences
from .formats import CANONICAL, facet_labels, quality
from .purchases import price_cents
from .summary import completeness

SYSTEM_FILTERS = frozenset(
    {
        "missing_metadata",
        "missing_artwork",
        "missing_purchase_information",
        "missing_retail_price",
        "currency_mismatch",
        "edited",
        "badges_updated",
        "upgraded",
        "metadata_edited",
        "artwork_unavailable",
        "metadata_unavailable",
        "metadata_conflict",
        "journal_edited",
        "manual_viewing",
        "split_viewings",
    }
)


def _selected_source(field, preferred, original, enrichment):
    values = {"original": original.get(field)}
    for provider in ("kaleidescape", "tmdb"):
        if provider in OPTIONS[field]:
            values[provider] = enrichment.get(provider, {}).get(field)
    if preferred == "auto":
        return next(
            (
                key
                for key in ("original", "kaleidescape", "tmdb")
                if values.get(key) not in (None, "", [])
            ),
            "original",
        )
    if preferred != "original" and values.get(preferred) in (None, "", []):
        return next(
            (
                key
                for key in (*OPTIONS[field][2:], "original")
                if values.get(key) not in (None, "", [])
            ),
            "original",
        )
    return preferred


def groups(db, source, selected, timezone="UTC"):
    """Union the selected categories; each result is a source-defined movie group."""
    selected = set(selected)
    result = set()
    if selected & {"missing_metadata", "missing_artwork"}:
        metadata, artwork, _, _, _ = completeness(
            db, source, all_providers=True, per_version_artwork=True
        )
        if "missing_metadata" in selected:
            result.update(metadata)
        if "missing_artwork" in selected:
            result.update(artwork)
    simple = {
        "metadata_conflict": (
            "EXISTS (SELECT 1 FROM json_each(t.enrichment, '$.conflicts') "
            "WHERE key IN ('tmdb','kaleidescape'))"
        ),
        "artwork_unavailable": (
            "EXISTS (SELECT 1 FROM json_each(t.enrichment, '$.unavailable_artwork') "
            "WHERE value=1 AND type='true')"
        ),
        "metadata_unavailable": (
            "EXISTS (SELECT 1 FROM json_each(t.enrichment, '$.unavailable') "
            "WHERE value=1 AND type='true')"
        ),
        "edited": (
            "(t.sort_title IS NOT NULL OR EXISTS (SELECT 1 FROM "
            "json_each(t.enrichment, '$.manual_edit_fields') WHERE value IN "
            "('title','sort_title','year','rating','synopsis','actors','directors',"
            "'writers','producers','studios','genres')))"
        ),
    }
    for key, predicate in simple.items():
        if key in selected:
            result.update(
                row[0]
                for row in db.execute(
                    "SELECT DISTINCT t.source_group FROM library t "
                    "WHERE t.source_id=? AND t.available=1 "
                    "AND t.purchase_match_pending=0 AND " + predicate,
                    (source,),
                )
            )
    if "upgraded" in selected:
        editions = {}
        for group, raw, first_seen in db.execute(
            "SELECT source_group,data,first_seen FROM library "
            "WHERE source_id=? AND available=1 AND purchase_match_pending=0",
            (source,),
        ):
            rank = quality(raw)
            if not rank or not first_seen:
                continue
            try:
                detected = datetime.fromisoformat(first_seen)
                if detected.utcoffset() is None:
                    continue
            except TypeError, ValueError:
                continue
            bucket = editions.setdefault(group, {})
            earliest, latest = bucket.get(rank, (detected, detected))
            bucket[rank] = (min(earliest, detected), max(latest, detected))
        for group, ranks in editions.items():
            if any(
                (later - earlier).total_seconds() > 2 * 86400
                for high_rank, (_, later) in ranks.items()
                for low_rank, (earlier, _) in ranks.items()
                if high_rank > low_rank
            ):
                result.add(group)
    if "badges_updated" in selected:
        for group, raw, encoded in db.execute(
            "SELECT source_group,data,enrichment FROM library "
            "WHERE source_id=? AND available=1 AND purchase_match_pending=0",
            (source,),
        ):
            enrichment = json.loads(encoded)
            override = enrichment.get("format_override")
            if isinstance(override, dict) and override.get("mode") == "custom":
                continue
            scanned = set(json.loads(facet_labels(raw))) & CANONICAL
            current = set(json.loads(facet_labels(raw, enrichment))) & CANONICAL
            if current - scanned:
                result.add(group)
    if selected & {
        "missing_purchase_information",
        "missing_retail_price",
        "currency_mismatch",
    }:
        rows = db.execute(
            """SELECT t.source_group, max(t.available) available,
            max(t.purchase_information_unavailable) unavailable,
            max(coalesce(t.purchased_on,p.purchased_on) IS NOT NULL) has_date,
            max(coalesce(t.purchase_price,p.purchase_price) IS NOT NULL) has_paid,
            max(coalesce(t.retail_price,p.retail_price) IS NOT NULL) has_retail,
            max(coalesce(t.order_id,p.order_id) IS NOT NULL) has_order
            FROM library t LEFT JOIN purchase_records p ON p.library_id=t.id
            WHERE t.source_id=? AND t.purchase_match_pending=0
            GROUP BY t.source_group""",
            (source,),
        ).fetchall()
        for group, available, unavailable, date, paid, retail, order in rows:
            if not available or unavailable:
                continue
            if "missing_purchase_information" in selected and not (
                date and paid and order
            ):
                result.add(group)
            if "missing_retail_price" in selected and not retail:
                result.add(group)
        if "currency_mismatch" in selected:
            currencies = {}
            for group, paid, retail in db.execute(
                """SELECT t.source_group,p.purchase_price,p.retail_price
                FROM purchase_records p JOIN library t ON t.id=p.library_id
                WHERE t.source_id=? AND t.purchase_match_pending=0
                UNION ALL SELECT source_group,purchase_price,retail_price
                FROM library WHERE source_id=? AND purchase_match_pending=0""",
                (source, source),
            ):
                bucket = currencies.setdefault(group, set())
                for value in (paid, retail):
                    try:
                        parsed = price_cents(value)
                    except JournalError:
                        continue
                    if parsed:
                        bucket.add(parsed[0])
            result.update(
                group for group, values in currencies.items() if len(values) > 1
            )
    if "metadata_edited" in selected:
        preferences = source_preferences(db)
        for group, raw, value in db.execute(
            """SELECT source_group,data,enrichment FROM library t
            WHERE source_id=? AND available=1 AND purchase_match_pending=0
            AND EXISTS (SELECT 1 FROM json_each(t.enrichment, '$.field_sources'))""",
            (source,),
        ):
            original, enrichment = json.loads(raw), json.loads(value)
            for field, preferred in enrichment.get("field_sources", {}).items():
                if (
                    field not in FIELDS
                    or field in {"artwork", "backdrop"}
                    or preferred not in OPTIONS[field]
                ):
                    continue
                default = preferences.get(field, "auto")
                if _selected_source(
                    field, preferred, original, enrichment
                ) != _selected_source(field, default, original, enrichment):
                    result.add(group)
                    break
    if selected & {"journal_edited", "manual_viewing"}:
        for group, origin, fields in db.execute(
            """SELECT DISTINCT t.source_group,v.origin,v.manual_fields
            FROM viewings v JOIN library t ON t.id=v.library_title_id
            WHERE t.source_id=? AND t.purchase_match_pending=0
            AND v.deleted_at IS NULL""",
            (source,),
        ):
            if "manual_viewing" in selected and origin == "manual":
                result.add(group)
            if "journal_edited" in selected and json.loads(fields):
                result.add(group)

    if "split_viewings" in selected:
        zone = ZoneInfo(timezone)
        for group, start, end, duration in db.execute(
            """SELECT t.source_group,v.started_at,coalesce(v.ended_at,v.completed_at),
            coalesce(v.duration_seconds,json_extract(t.data,'$.duration_seconds'))
            FROM viewings v JOIN library t ON t.id=v.library_title_id
            WHERE t.source_id=? AND t.purchase_match_pending=0
            AND v.deleted_at IS NULL AND v.status='completed'""",
            (source,),
        ):
            if not start or not end or not duration:
                continue
            try:
                started = datetime.fromisoformat(start)
                ended = datetime.fromisoformat(end)
                if (
                    started.astimezone(zone).date() != ended.astimezone(zone).date()
                    and (ended - started).total_seconds() - duration >= 6 * 3600
                ):
                    result.add(group)
            except TypeError, ValueError:
                continue
    return result

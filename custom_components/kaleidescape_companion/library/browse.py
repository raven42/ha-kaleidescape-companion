"""Worker-only, bounded catalog projections and source-defined browsing groups."""

import hashlib
import json
import re

from ..core.models import JournalError, invalid
from .config import excluded_collections

MAX_PAGE_SIZE = 1000
MAX_PAGE_BYTES = 8 * 1024 * 1024
PURCHASE_SQL = """coalesce(t.purchased_on,(SELECT min(p.purchased_on)
    FROM library_purchases p WHERE p.source_id=t.source_id
    AND p.source_group=t.source_group))"""

FAVORITE_SQL = """EXISTS (SELECT 1 FROM library_titles ft JOIN library_memberships fm
    ON fm.title_id=ft.id WHERE ft.source_id=t.source_id
    AND ft.source_group=t.source_group
    AND ft.available=1 AND lower(fm.collection)='favorites')"""
RECENT_SQL = """s.recently_added_batch IS NOT NULL AND EXISTS
    (SELECT 1 FROM library_titles rt WHERE rt.source_id=t.source_id
    AND rt.source_group=t.source_group AND rt.addition_batch=s.recently_added_batch)"""


def bounded_page(page):
    """Reject oversized pages rather than silently dropping requested entries."""
    if len(json.dumps(page, ensure_ascii=True).encode()) > MAX_PAGE_BYTES:
        raise JournalError(
            "library_page_too_large", "Reduce the library entries per page"
        )
    return page


def batches(values):
    """Stay below SQLite builds with a 999-parameter limit."""
    for start in range(0, len(values), 500):
        yield values[start : start + 500]


ARRAY_FIELDS = ("actors", "directors", "writers", "studios", "genres")
PUBLIC_FIELDS = (
    *ARRAY_FIELDS,
    "rating",
    "year",
    "edition",
    "duration_seconds",
    "synopsis",
    "formats",
)
# Work-level descriptions can fill a sparse edition. Runtime, format, artwork,
# dates, memberships and source identities always belong to the exact version.
SHARED_FIELDS = (*ARRAY_FIELDS, "rating", "year", "synopsis")
STATUS_SQL = """CASE WHEN s.collections_synced_at IS NULL
    OR t.first_seen>s.collections_synced_at THEN 'unknown'
    WHEN EXISTS (SELECT 1 FROM library_memberships m WHERE m.title_id=t.id
        AND lower(m.collection)='paused') THEN 'in_progress'
    WHEN EXISTS (SELECT 1 FROM library_memberships m WHERE m.title_id=t.id
        AND lower(m.collection)='played') THEN 'watched'
    ELSE 'unwatched' END"""


def hidden_names(db, source, excluded):
    names = excluded_collections(excluded)
    return tuple(
        row[0]
        for row in db.execute(
            "SELECT name FROM library_collections WHERE source_id=? "
            "AND available=1 ORDER BY name",
            (source,),
        )
        if row[0].casefold() in names
    )


def formats(data):
    known = data.get("formats") or [data.get("edition", "")]
    return sorted(
        {value for value in known if value and value.casefold() != "multiple"},
        key=str.casefold,
    )[:100]


def group_metadata(db, source, groups):
    """Prefer a detailed main version, filling only empty descriptive fields.

    Resolve at read time so a later source correction replaces inherited values;
    the raw source rows and independent versions are never rewritten or merged.
    """
    result = {}
    fields = ",".join(f"json_extract(data,'$.{key}') {key}" for key in SHARED_FIELDS)
    for batch in batches(list(dict.fromkeys(groups))):
        for row in db.execute(
            f"SELECT source_group,{fields} FROM library_titles "
            "WHERE source_id=? AND available=1 AND source_group IN ("
            + ",".join("?" for _ in batch)
            + ") ORDER BY metadata_synced_at IS NOT NULL DESC,length(data) DESC,id",
            (source, *batch),
        ):
            main = result.setdefault(row["source_group"], {})
            for key in SHARED_FIELDS:
                value = row[key]
                if key in ARRAY_FIELDS and value is not None:
                    value = json.loads(value)
                if value not in (None, "", []) and key not in main:
                    main[key] = value
    return result


def public_title(row, memberships, shared=None):
    data = json.loads(row["data"])
    for key, value in (shared or {}).items():
        if data.get(key) in (None, "", []):
            data[key] = value
    return {
        **{key: data.get(key) for key in PUBLIC_FIELDS},
        **{
            key: row[key]
            for key in (
                "id",
                "title",
                "first_seen",
                "last_seen",
                "metadata_synced_at",
                "artwork_key",
                "watched_status",
            )
        },
        "is_favorite": bool(row["is_favorite"]),
        "is_recently_added": bool(row["is_recently_added"]),
        "formats": formats(data),
        "collections": memberships,
        "purchased_on": row["effective_purchased_on"],
    }


def memberships_for(db, source, keys, hidden, *, by_id=False):
    if not keys:
        return {}
    result = {}
    for batch in batches(keys):
        for row in db.execute(
            "SELECT m.title_id,m.collection FROM library_memberships m "
            "JOIN library_titles t ON t.id=m.title_id WHERE t.source_id=? "
            "AND t.available=1 AND "
            + ("t.id" if by_id else "t.source_group")
            + " IN ("
            + ",".join("?" for _ in batch)
            + ") ORDER BY m.collection",
            (source, *batch),
        ):
            if row[1] not in hidden:
                result.setdefault(row[0], []).append(row[1])
    return result


def library_info(db, source, excluded=""):
    row = db.execute(
        """SELECT last_synced_at,collections_synced_at,revision FROM
            library_sources WHERE id=?""",
        (source,),
    ).fetchone()
    hidden = hidden_names(db, source, excluded)
    return {
        "preferences_key": hashlib.sha256(
            json.dumps(hidden, ensure_ascii=False).encode()
        ).hexdigest(),
        "name_count": db.execute(
            "SELECT count(DISTINCT title_search) FROM library_titles "
            "WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        **(
            dict(row)
            if row
            else {"last_synced_at": None, "collections_synced_at": None, "revision": 0}
        ),
        "title_count": db.execute(
            "SELECT count(*) FROM library_titles WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        "group_count": db.execute(
            "SELECT count(DISTINCT source_group) FROM library_titles "
            "WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        "collection_count": db.execute(
            """SELECT count(*) FROM library_collections WHERE source_id=? AND
                available=1""",
            (source,),
        ).fetchone()[0]
        - len(hidden),
        "collection_names": [
            row[0]
            for row in db.execute(
                "SELECT name FROM library_collections WHERE source_id=? "
                "AND available=1 ORDER BY name",
                (source,),
            )
        ],
        "artwork_bytes": db.execute(
            "SELECT coalesce(sum(byte_size),0) FROM library_artwork"
        ).fetchone()[0],
    }


def library_list(db, source, filters, excluded=""):
    """Query local SQLite with parameters and fixed sort expressions."""
    allowed = {
        "query",
        "fuzzy",
        "collection",
        "actor",
        "director",
        "rating",
        "genre",
        "year",
        "format",
        "status",
        "sort",
        "descending",
        "offset",
        "revision",
        "grouped",
        "preferences_key",
        "limit",
    }
    if not isinstance(filters, dict) or set(filters) - allowed:
        raise invalid("Unknown library filters")
    limit = filters.get("limit", 50)
    if type(limit) is not int or not 1 <= limit <= MAX_PAGE_SIZE:
        raise invalid("Library page size must be between 1 and 1000")
    offset = filters.get("offset", 0)
    descending = filters.get("descending", False)
    if (
        type(offset) is not int
        or not 0 <= offset <= 10_000
        or type(descending) is not bool
    ):
        raise invalid("Invalid library page")
    grouped = filters.get("grouped", False)
    if type(grouped) is not bool:
        raise invalid("Invalid library grouping")
    hidden = hidden_names(db, source, excluded)
    collection_sql = (
        "(SELECT min(collection COLLATE NOCASE) FROM library_memberships "
        "WHERE title_id=t.id"
        + (
            " AND collection NOT IN (" + ",".join("?" for _ in hidden) + ")"
            if hidden
            else ""
        )
        + ")"
    )
    sort = filters.get("sort", "name")
    sorts = {
        "name": "t.title_search",
        "length": "json_extract(t.data,'$.duration_seconds')",
        "watched": "watched_status",
        "year": "json_extract(t.data,'$.year')",
        "collection": collection_sql,
        "added": f"coalesce({PURCHASE_SQL},t.first_seen)",
    }
    if not isinstance(sort, str) or sort not in sorts:
        raise invalid("Invalid library sort")
    info = library_info(db, source, excluded)
    preferences = filters.get("preferences_key")
    if preferences is not None and preferences != info["preferences_key"]:
        raise JournalError(
            "refresh_required", "Library preferences changed; refresh the first page"
        )
    revision = filters.get("revision")
    if revision is not None and (
        type(revision) is not int or revision != info["revision"]
    ):
        raise JournalError(
            "refresh_required", "Library changed; refresh the first page"
        )
    clauses, values = ["t.source_id=?", "t.available=1"], [source]
    query = filters.get("query", "")
    if not isinstance(query, str) or len(query) > 500 or "\x00" in query:
        raise invalid("Invalid library search")
    fuzzy = filters.get("fuzzy", False)
    if type(fuzzy) is not bool:
        raise invalid("Invalid fuzzy search option")
    if query:
        term = query.casefold()
        clauses.append("""(companion_matches(t.title,?,?) OR EXISTS (
            SELECT 1 FROM library_titles credits,
            json_each(credits.data,'$.actors') person
            WHERE credits.source_id=t.source_id AND credits.source_group=t.source_group
            AND credits.available=1 AND companion_matches(person.value,?,?))
            OR EXISTS (SELECT 1 FROM library_titles credits,
            json_each(credits.data,'$.directors') person
            WHERE credits.source_id=t.source_id AND credits.source_group=t.source_group
            AND credits.available=1
            AND companion_matches(person.value,?,?)))""")
        values.extend((term, fuzzy, term, fuzzy, term, fuzzy))
    # Match any selected value within a facet, and all populated facets together.
    # Keep single strings compatible with existing API clients.
    for key in (
        "collection",
        "actor",
        "director",
        "rating",
        "genre",
        "year",
        "format",
        "status",
    ):
        selected = filters.get(key, [])
        if isinstance(selected, str):
            selected = [selected] if selected else []
        if (
            not isinstance(selected, list)
            or len(selected) > 100
            or any(
                not isinstance(value, str)
                or not value
                or len(value) > 500
                or "\x00" in value
                for value in selected
            )
        ):
            raise invalid("Invalid library filter")
        selected = list(dict.fromkeys(selected))
        if not selected:
            continue
        if key == "collection":
            selected = [name for name in selected if name not in hidden]
            if not selected:
                clauses.append("0")
                continue
        # One bound JSON array per facet keeps the expanded filters below
        # older SQLite builds' 999-variable limit, including hidden names.
        placeholders = "SELECT value FROM json_each(?)"
        if key == "collection":
            clauses.append(
                "EXISTS (SELECT 1 FROM library_memberships m "
                f"WHERE m.title_id=t.id AND m.collection IN ({placeholders}))"
            )
        elif key in {"actor", "director", "genre"}:
            path = {"actor": "actors", "director": "directors", "genre": "genres"}[key]
            clauses.append(
                f"EXISTS (SELECT 1 FROM json_each(t.data,'$.{path}') "
                f"WHERE value IN ({placeholders}))"
            )
        elif key == "rating":
            clauses.append(
                "coalesce(nullif(json_extract(t.data,'$.rating'),''),'Unrated') "
                f"IN ({placeholders})"
            )
        elif key == "year":
            if any(not re.fullmatch(r"[0-9]{1,4}", value) for value in selected):
                raise invalid("Invalid library year")
            clauses.append(
                f"CAST(json_extract(t.data,'$.year') AS TEXT) IN ({placeholders})"
            )
        elif key == "format":
            clauses.append(
                "EXISTS (SELECT 1 FROM json_each(companion_formats(t.data)) "
                f"WHERE value IN ({placeholders}))"
            )
        else:
            if set(selected) - {"watched", "unwatched", "in_progress", "unknown"}:
                raise invalid("Invalid library status")
            clauses.append(f"({STATUS_SQL}) IN ({placeholders})")
        values.append(json.dumps(selected))
    where = " AND ".join(clauses)
    join = "library_titles t JOIN library_sources s ON s.id=t.source_id"
    if grouped:
        return grouped_page(
            db,
            source,
            where,
            values,
            collection_sql,
            hidden,
            sort,
            descending,
            offset,
            info,
            limit,
        )
    total = db.execute(f"SELECT count(*) FROM {join} WHERE {where}", values).fetchone()[
        0
    ]
    order = sorts[sort] + (" DESC" if descending else " ASC")
    rows = db.execute(
        f"""SELECT t.*,({STATUS_SQL}) watched_status,
            {PURCHASE_SQL} effective_purchased_on,
            ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added
        FROM {join} WHERE {where}
        ORDER BY {order},t.id LIMIT ? OFFSET ?""",
        (*values, *(hidden if sort == "collection" else ()), limit + 1, offset),
    ).fetchall()
    memberships = memberships_for(
        db, source, [row["id"] for row in rows[:limit]], hidden, by_id=True
    )
    shared = group_metadata(db, source, [row["source_group"] for row in rows[:limit]])
    items = []
    byte_size = 0
    for row in rows[:limit]:
        item = public_title(
            row, memberships.get(row["id"], []), shared.get(row["source_group"])
        )
        byte_size += len(json.dumps(item, ensure_ascii=True).encode())
        if byte_size > MAX_PAGE_BYTES:
            raise JournalError(
                "library_page_too_large", "Reduce the library entries per page"
            )
        items.append(item)
    facets, truncated = library_facets(db, source, hidden)
    return bounded_page(
        {
            "items": items,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": len(rows) > limit,
            "revision": info["revision"],
            "preferences_key": info["preferences_key"],
            "facets": facets,
            "truncated_facets": truncated,
        }
    )


def library_facets(db, source, hidden):
    facets = {}
    truncated = []
    for key in ("actors", "directors", "genres"):
        options = [
            row[0]
            for row in db.execute(
                """SELECT DISTINCT value FROM library_titles t,json_each(t.data,?)
                    WHERE source_id=? AND available=1 ORDER BY value LIMIT 501""",
                (f"$.{key}", source),
            )
        ]
        if len(options) > 500:
            truncated.append(key)
        facets[key] = options[:500]
    facets["rating"] = [
        row[0]
        for row in db.execute(
            "SELECT DISTINCT "
            "coalesce(nullif(json_extract(data,'$.rating'),''),'Unrated') "
            "FROM library_titles WHERE source_id=? AND available=1 "
            "ORDER BY 1 LIMIT 500",
            (source,),
        )
    ]
    facets["year"] = [
        str(row[0])
        for row in db.execute(
            "SELECT DISTINCT json_extract(data,'$.year') FROM library_titles "
            "WHERE source_id=? AND available=1 "
            "AND json_extract(data,'$.year') IS NOT NULL "
            "ORDER BY 1 DESC LIMIT 500",
            (source,),
        )
    ]
    options = [
        row[0]
        for row in db.execute(
            "SELECT DISTINCT value FROM library_titles t,"
            "json_each(companion_formats(t.data)) "
            "WHERE source_id=? AND available=1 ORDER BY value LIMIT 501",
            (source,),
        )
    ]
    facets["format"] = options[:500]
    if len(options) > 500:
        truncated.append("format")
    facets["collections"] = [
        row[0]
        for row in db.execute(
            """SELECT name FROM library_collections WHERE source_id=? AND
                available=1 ORDER BY name""",
            (source,),
        )
    ]
    facets["collections"] = [
        name for name in facets["collections"] if name not in hidden
    ]
    return facets, truncated


def grouped_page(
    db,
    source,
    where,
    values,
    collection_sql,
    hidden,
    sort,
    descending,
    offset,
    info,
    limit,
):
    """Filter per version, group before pagination, and summarize all versions."""
    join = "library_titles t JOIN library_sources s ON s.id=t.source_id"
    total = db.execute(
        f"SELECT count(DISTINCT t.source_group) FROM {join} WHERE {where}", values
    ).fetchone()[0]
    sorts = {
        "name": "title_search",
        "year": "year",
        "collection": "collection_sort COLLATE NOCASE",
        "length": "duration_seconds",
        "watched": "status_rank",
        "added": "coalesce(purchased_on,first_seen)",
    }
    direction = "DESC" if descending else "ASC"
    groups = db.execute(
        f"""WITH matching AS (
        SELECT DISTINCT t.source_group FROM {join} WHERE {where}
    ), versions AS (
        SELECT t.*,({STATUS_SQL}) watched_status,{collection_sql} collection_sort,
        ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added,
        {PURCHASE_SQL} effective_purchased_on
        FROM {join} WHERE t.source_id=? AND t.available=1
    ) SELECT source_group,min(title_search) title_search,min(id) id,
        min(title) title,count(*) version_count,
        max(is_favorite) is_favorite,max(is_recently_added) is_recently_added,
        min(json_extract(data,'$.year')) year,
        min(json_extract(data,'$.duration_seconds')) duration_seconds,
        max(json_extract(data,'$.duration_seconds')) maximum_duration_seconds,
        min(first_seen) first_seen,max(last_seen) last_seen,
        min(effective_purchased_on) purchased_on,
        min(collection_sort COLLATE NOCASE) collection_sort,
        min(CASE watched_status WHEN 'in_progress' THEN 0 WHEN 'watched' THEN 1
            WHEN 'unknown' THEN 2 ELSE 3 END) status_rank
        FROM versions WHERE source_group IN (SELECT source_group FROM matching)
        GROUP BY source_group
        ORDER BY {sorts[sort]} {direction},title_search,source_group
        LIMIT ? OFFSET ?""",
        (*values, *hidden, source, limit + 1, offset),
    ).fetchall()
    page = groups[:limit]
    if not page:
        items = []
    else:
        groups_on_page = [row["source_group"] for row in page]
        memberships = memberships_for(db, source, groups_on_page, hidden)
        representatives = {}
        for batch in batches([row["id"] for row in page]):
            for row in db.execute(
                "SELECT id,artwork_key,metadata_synced_at,"
                "json_extract(data,'$.rating') rating,"
                "json_extract(data,'$.edition') edition "
                "FROM library_titles WHERE source_id=? AND id IN ("
                + ",".join("?" for _ in batch)
                + ")",
                (source, *batch),
            ):
                representatives[row["id"]] = row
        # Other versions need only small summary fields, not synopses/credits.
        variants = {}
        for batch in batches(groups_on_page):
            for row in db.execute(
                "SELECT id,source_group,artwork_key,"
                "json_extract(data,'$.formats') formats,"
                "json_extract(data,'$.rating') rating,"
                "json_extract(data,'$.edition') edition,"
                "json_extract(data,'$.year') year "
                "FROM library_titles WHERE source_id=? AND available=1 "
                "AND source_group IN ("
                + ",".join("?" for _ in batch)
                + ") ORDER BY id",
                (source, *batch),
            ):
                variants.setdefault(row["source_group"], []).append(row)
        items = []
        byte_size = 0
        for group in page:
            rows = variants[group["source_group"]]
            known_formats = sorted(
                {
                    value
                    for row in rows
                    for value in formats(
                        {
                            "formats": json.loads(row["formats"])
                            if row["formats"]
                            else None,
                            "edition": row["edition"],
                        }
                    )
                },
                key=str.casefold,
            )
            collections = sorted(
                {name for row in rows for name in memberships.get(row["id"], [])},
                key=str.casefold,
            )
            representative = representatives[group["id"]]
            items.append(
                {
                    "collections": collections,
                    "is_favorite": bool(group["is_favorite"]),
                    "is_recently_added": bool(group["is_recently_added"]),
                    "year": group["year"],
                    "edition": representative["edition"],
                    "rating": representative["rating"]
                    or next((row["rating"] for row in rows if row["rating"]), None),
                    "metadata_synced_at": representative["metadata_synced_at"],
                    **{
                        key: group[key]
                        for key in (
                            "id",
                            "title",
                            "version_count",
                            "first_seen",
                            "purchased_on",
                            "last_seen",
                            "duration_seconds",
                            "maximum_duration_seconds",
                        )
                    },
                    "formats": known_formats[:100],
                    "formats_truncated": len(known_formats) > 100,
                    "years": sorted(
                        {row["year"] for row in rows if row["year"] is not None}
                    )[:100],
                    "artwork_key": representative["artwork_key"]
                    or next(
                        (row["artwork_key"] for row in rows if row["artwork_key"]), None
                    ),
                    "watched_status": (
                        "in_progress",
                        "watched",
                        "unknown",
                        "unwatched",
                    )[group["status_rank"]],
                }
            )
            byte_size += len(json.dumps(items[-1], ensure_ascii=True).encode())
            if byte_size > MAX_PAGE_BYTES:
                raise JournalError(
                    "library_page_too_large", "Reduce the library entries per page"
                )
    facets, truncated = library_facets(db, source, hidden)
    return bounded_page(
        {
            "items": items,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": len(groups) > limit,
            "revision": info["revision"],
            "preferences_key": info["preferences_key"],
            "facets": facets,
            "truncated_facets": truncated,
        }
    )


def library_versions(db, source, title, offset=0, revision=None, excluded=""):
    """An opaque version key selects its source-defined group in this source only."""
    if (
        not isinstance(title, str)
        or not re.fullmatch(r"[a-f0-9]{64}", title)
        or type(offset) is not int
        or not 0 <= offset <= 10000
    ):
        raise invalid("Invalid library title page")
    info = library_info(db, source, excluded)
    if revision is not None and (
        type(revision) is not int or revision != info["revision"]
    ):
        raise JournalError("refresh_required", "Library changed; reopen the title")
    row = db.execute(
        "SELECT source_group FROM library_titles WHERE id=? AND source_id=? "
        "AND available=1",
        (title, source),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Library title is unavailable")
    group = row[0]
    total = db.execute(
        "SELECT count(*) FROM library_titles WHERE source_id=? AND available=1 "
        "AND source_group=?",
        (source, group),
    ).fetchone()[0]
    rows = db.execute(
        f"""SELECT t.*,({STATUS_SQL}) watched_status,
            {PURCHASE_SQL} effective_purchased_on,
            ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added
        FROM library_titles t
        JOIN library_sources s ON s.id=t.source_id WHERE t.source_id=?
        AND t.available=1 AND t.source_group=? ORDER BY
        json_extract(data,'$.year'),json_extract(data,'$.edition'),t.id
        LIMIT 51 OFFSET ?""",
        (source, group, offset),
    ).fetchall()
    memberships = memberships_for(
        db,
        source,
        [row["id"] for row in rows[:50]],
        hidden_names(db, source, excluded),
        by_id=True,
    )
    shared = group_metadata(db, source, [group]).get(group)
    return bounded_page(
        {
            "items": [
                public_title(row, memberships.get(row["id"], []), shared)
                for row in rows[:50]
            ],
            "total": total,
            "offset": offset,
            "has_more": len(rows) > 50,
            "revision": info["revision"],
            "preferences_key": info["preferences_key"],
        }
    )


def suggestions(db, source, field, query, fuzzy=False):
    """Bounded people-name completion over the full current cached catalog."""
    if (
        type(fuzzy) is not bool
        or field not in ("actor", "director")
        or not isinstance(query, str)
        or len(query) > 100
        or "\x00" in query
    ):
        raise invalid("Invalid suggestion request")
    path = "$.actors" if field == "actor" else "$.directors"
    rows = [
        row[0]
        for row in db.execute(
            "SELECT DISTINCT person.value FROM library_titles t,"
            "json_each(t.data,?) person "
            "WHERE t.source_id=? AND t.available=1 AND person.type='text' "
            "AND companion_matches(person.value,?,?) "
            "ORDER BY companion_casefold(person.value),person.value LIMIT 21",
            (path, source, query.casefold(), fuzzy),
        )
    ]
    return {"items": rows[:20], "has_more": len(rows) > 20}

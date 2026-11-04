"""Worker-only, bounded catalog projections and source-defined browsing groups."""

import hashlib
import json
import re

from ..core.models import JournalError, invalid
from .config import excluded_collections

MAX_PAGE_SIZE = 1000
MAX_PAGE_BYTES = 8 * 1024 * 1024
PURCHASE_SQL = """coalesce(t.purchased_on,(SELECT
    min(json_extract(p.purchase_history,'$[0].purchased_on'))
    FROM library p WHERE p.source_id=t.source_id
    AND p.source_group=t.source_group))"""

FAVORITE_SQL = """EXISTS (SELECT 1 FROM library ft JOIN library_memberships fm
    ON fm.title_id=ft.id WHERE ft.source_id=t.source_id
    AND ft.source_group=t.source_group
    AND ft.available=1 AND lower(fm.collection)='favorites')"""
RECENT_SQL = """s.recently_added_batch IS NOT NULL AND EXISTS
    (SELECT 1 FROM library rt WHERE rt.source_id=t.source_id
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


ARRAY_FIELDS = ("actors", "directors", "writers", "producers", "studios", "genres")
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


def scalar_sql(field, prefix=""):
    """Read version facts without merging unrelated provider credits.

    Year/rating are original facts unless explicitly reviewed. JSON null is an
    intentional override, so COALESCE would incorrectly restore the old value.
    Keep this fixed allowlist aligned with enrichment.store.effective.
    """
    if field not in {"year", "rating"} or prefix not in {"", "t."}:
        raise ValueError("Unsupported display scalar")
    return (
        f"CASE WHEN json_type({prefix}enrichment,'$.reviewed.{field}') IS NOT NULL "
        f"THEN json_extract({prefix}enrichment,'$.reviewed.{field}') "
        f"ELSE json_extract({prefix}data,'$.{field}') END"
    )


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
    from ..enrichment.selection import read as source_preferences
    from ..enrichment.store import public as public_enrichment

    sources = source_preferences(db)
    result = {}
    fields = ",".join(f"json_extract(data,'$.{key}') {key}" for key in SHARED_FIELDS)
    for batch in batches(list(dict.fromkeys(groups))):
        for row in db.execute(
            f"SELECT source_group,enrichment,sort_title,{fields} FROM library "
            "WHERE source_id=? AND available=1 AND source_group IN ("
            + ",".join("?" for _ in batch)
            + ") ORDER BY metadata_synced_at IS NOT NULL DESC,length(data) DESC,id",
            (source, *batch),
        ):
            main = result.setdefault(row["source_group"], {"_sources": sources})
            if row["sort_title"]:
                main.setdefault("_sort_title", row["sort_title"])
            for provider, metadata in public_enrichment(
                json.loads(row["enrichment"])
            ).items():
                main.setdefault("_providers", {}).setdefault(provider, metadata)
            for key in SHARED_FIELDS:
                value = row[key]
                if key in ARRAY_FIELDS and value is not None:
                    value = json.loads(value)
                if value not in (None, "", []) and key not in main:
                    main[key] = value
    return result


def public_title(row, memberships, shared=None):
    from ..enrichment.matching import has_conflict
    from ..enrichment.selection import image as selected_image
    from ..enrichment.store import effective
    from ..enrichment.store import public as public_enrichment

    enrichment = {
        **(shared or {}).get("_providers", {}),
        **json.loads(row["enrichment"]),
    }
    sources = (shared or {}).get("_sources", {})
    data = json.loads(effective(row["data"], enrichment, sources))
    for key, value in (shared or {}).items():
        if data.get(key) in (None, "", []):
            data[key] = value
    return {
        **{key: data.get(key) for key in PUBLIC_FIELDS},
        "enrichment": public_enrichment(enrichment),
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
        "title": enrichment.get("reviewed", {}).get("title") or row["title"],
        "sort_title": row["sort_title"] or (shared or {}).get("_sort_title"),
        "artwork_key": selected_image(row["artwork_key"], enrichment, sources),
        "backdrop_key": selected_image(None, enrichment, sources, "backdrop"),
        "ratings": {
            key: data.get(key)
            for key in (
                "critic_score",
                "audience_score",
                "audience_rating",
                "audience_votes",
            )
        },
        "scraper_conflict": has_conflict(json.loads(row["enrichment"]), sources),
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
            "JOIN library t ON t.id=m.title_id WHERE t.source_id=? "
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
    statuses = dict(
        db.execute(
            f"""SELECT status,count(*) FROM (
            SELECT CASE min(CASE ({STATUS_SQL})
                WHEN 'in_progress' THEN 0 WHEN 'watched' THEN 1
                WHEN 'unknown' THEN 2 ELSE 3 END)
                WHEN 0 THEN 'in_progress' WHEN 1 THEN 'watched'
                WHEN 2 THEN 'unknown' ELSE 'unwatched' END status
            FROM library t JOIN library_sources s ON s.id=t.source_id
            WHERE t.source_id=? AND t.available=1 GROUP BY t.source_group)
            GROUP BY status""",
            (source,),
        )
    )
    return {
        "status_counts": {
            key: statuses.get(key, 0)
            for key in ("unwatched", "watched", "in_progress", "unknown")
        },
        "preferences_key": hashlib.sha256(
            json.dumps(hidden, ensure_ascii=False).encode()
        ).hexdigest(),
        "name_count": db.execute(
            "SELECT count(DISTINCT title_search) FROM library "
            "WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        **(
            dict(row)
            if row
            else {"last_synced_at": None, "collections_synced_at": None, "revision": 0}
        ),
        "title_count": db.execute(
            "SELECT count(*) FROM library WHERE source_id=? AND available=1",
            (source,),
        ).fetchone()[0],
        "group_count": db.execute(
            "SELECT count(DISTINCT source_group) FROM library "
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


def shuffle_key(value, seed):
    """Keep one stable shuffle across pages until its seed changes."""
    return hashlib.sha256(f"{seed}:{value}".encode()).digest()


def matching_people(db, source, query, fuzzy):
    """Search each distinct credit once, then resolve its source-defined groups.

    Materialize before matching: otherwise SQLite may push the Python matcher
    into the version/person join, repeating fuzzy comparisons for every edition
    and again for the count and page reads. No title identities are inferred.
    """
    return json.dumps(
        [
            row[0]
            for row in db.execute(
                """WITH people AS MATERIALIZED (
                    SELECT credits.source_group,person.value name
                    FROM library credits,
                    json_each(companion_metadata(
                        credits.data,credits.enrichment)) roles,
                    json_each(CASE WHEN roles.type='array'
                        THEN roles.value ELSE '[]' END) person
                    WHERE credits.source_id=? AND credits.available=1
                    AND roles.key IN
                        ('actors','directors','writers','producers','studios')
                    AND person.type='text'
                ), names AS MATERIALIZED (SELECT DISTINCT name FROM people),
                matches AS MATERIALIZED (
                    SELECT name FROM names WHERE companion_matches(name,?,?)
                ) SELECT DISTINCT source_group FROM people
                    WHERE name IN (SELECT name FROM matches)""",
                (source, query, fuzzy),
            )
        ]
    )


def library_list(db, source, filters, excluded="", cache=None):
    """Query local SQLite with parameters and fixed sort expressions."""
    allowed = {
        "query",
        "scraper_conflict",
        "missing_metadata_artwork",
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
        "random_seed",
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
    seed = filters.get("random_seed", "")
    if not isinstance(seed, str) or (seed and not re.fullmatch(r"[a-f0-9]{32}", seed)):
        raise invalid("Invalid Library shuffle seed")
    sorts = {
        "name": "coalesce(nullif(t.sort_title,''),"
        "json_extract(t.enrichment,'$.reviewed.title'),t.title_search) COLLATE NOCASE",
        "length": "json_extract(t.data,'$.duration_seconds')",
        "watched": "watched_status",
        "year": scalar_sql("year", "t."),
        "collection": collection_sql,
        "added": f"coalesce({PURCHASE_SQL},t.first_seen)",
        "random": "companion_shuffle(t.id,?)",
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
    conflict = filters.get("scraper_conflict", False)
    if type(conflict) is not bool:
        raise invalid("Invalid scraper conflict filter")
    if conflict:
        clauses.append("companion_conflict(t.enrichment)")
    missing = filters.get("missing_metadata_artwork", False)
    if type(missing) is not bool:
        raise invalid("Invalid missing metadata or artwork filter")
    if not isinstance(query, str) or len(query) > 500 or "\x00" in query:
        raise invalid("Invalid library search")
    fuzzy = filters.get("fuzzy", False)
    if type(fuzzy) is not bool:
        raise invalid("Invalid fuzzy search option")
    people_parameter = None
    if query:
        term = query.casefold()
        clauses.append("""(companion_matches(coalesce(
            json_extract(t.enrichment,'$.reviewed.title'),t.title),?,?)
            OR t.source_group IN (SELECT value FROM json_each(?)))""")
        values.extend((term, fuzzy, None))
        people_parameter = len(values) - 1
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
                "EXISTS (SELECT 1 FROM "
                f"json_each(companion_metadata(t.data,t.enrichment),'$.{path}') "
                f"WHERE value IN ({placeholders}))"
            )
        elif key == "rating":
            clauses.append(
                f"coalesce(nullif(({scalar_sql('rating', 't.')}),''),'Unrated') "
                f"IN ({placeholders})"
            )
        elif key == "year":
            if any(not re.fullmatch(r"[0-9]{1,4}", value) for value in selected):
                raise invalid("Invalid library year")
            clauses.append(
                f"CAST(({scalar_sql('year', 't.')}) AS TEXT) IN ({placeholders})"
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
    # Validate all facets before doing full-catalog completeness or people work.
    if missing:
        from .summary import completeness

        metadata_groups, artwork_groups, _, _, _ = completeness(db, source)
        clauses.append("t.source_group IN (SELECT value FROM json_each(?))")
        values.append(json.dumps(sorted(metadata_groups | artwork_groups)))
    if people_parameter is not None:
        values[people_parameter] = matching_people(db, source, query.casefold(), fuzzy)
    where = " AND ".join(clauses)
    join = "library t JOIN library_sources s ON s.id=t.source_id"
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
            seed,
            cache,
        )
    total = db.execute(f"SELECT count(*) FROM {join} WHERE {where}", values).fetchone()[
        0
    ]
    order = sorts[sort] + (" DESC" if descending and sort != "random" else " ASC")
    sort_values = (
        (seed,) if sort == "random" else hidden if sort == "collection" else ()
    )
    rows = db.execute(
        f"""SELECT t.*,({STATUS_SQL}) watched_status,
            {PURCHASE_SQL} effective_purchased_on,
            ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added
        FROM {join} WHERE {where}
        ORDER BY {order},t.id LIMIT ? OFFSET ?""",
        (*values, *sort_values, limit + 1, offset),
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
    facets, truncated = facets_for(db, source, hidden, info["revision"], cache)
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


def facets_for(db, source, hidden, revision, cache):
    if cache is None:
        return library_facets(db, source, hidden)
    return cache.facets.call(library_facets, db, source, hidden, revision)


def library_facets(db, source, hidden, _revision=None):
    # _revision is part of the memoization key. Every catalog/collection/metadata
    # mutation advances it; changes to hidden labels additionally change hidden.
    # Resolve each version once even when the catalog is larger than the memory
    # cache. Separate per-facet passes would repeatedly remerge provider credits.
    facets = {key: [] for key in ("actors", "directors", "genres", "rating", "year")}
    for row in db.execute(
        """WITH metadata AS MATERIALIZED (
            SELECT companion_metadata(data,enrichment) data FROM library
            WHERE source_id=? AND available=1
        ), options AS (
            SELECT roles.key field,person.value value FROM metadata,
                json_each(metadata.data) roles,
                json_each(CASE WHEN roles.type='array'
                    THEN roles.value ELSE '[]' END) person
                WHERE roles.key IN ('actors','directors','genres')
                AND person.type='text'
            UNION SELECT 'rating',coalesce(nullif(json_extract(data,'$.rating'),''),
                'Unrated') FROM metadata
            UNION SELECT 'year',json_extract(data,'$.year') FROM metadata
                WHERE json_extract(data,'$.year') IS NOT NULL
        ), ranked AS (
            SELECT field,value,row_number() OVER (PARTITION BY field ORDER BY
                CASE WHEN field='year' THEN value END DESC,value) position
            FROM options
        ) SELECT field,value FROM ranked WHERE position<=501
            ORDER BY field,position""",
        (source,),
    ):
        facets[row[0]].append(str(row[1]) if row[0] == "year" else row[1])
    truncated = [
        key for key in ("actors", "directors", "genres") if len(facets[key]) > 500
    ]
    facets = {key: options[:500] for key, options in facets.items()}
    options = [
        row[0]
        for row in db.execute(
            "SELECT DISTINCT value FROM library t,"
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
    seed="",
    cache=None,
):
    """Filter per version, group before pagination, and summarize all versions."""
    join = "library t JOIN library_sources s ON s.id=t.source_id"
    total = db.execute(
        f"SELECT count(DISTINCT t.source_group) FROM {join} WHERE {where}", values
    ).fetchone()[0]
    sorts = {
        "name": "sort_title COLLATE NOCASE",
        "year": "year",
        "collection": "collection_sort COLLATE NOCASE",
        "length": "duration_seconds",
        "watched": "status_rank",
        "added": "coalesce(purchased_on,first_seen)",
        "random": "companion_shuffle(source_group,?)",
    }
    direction = "DESC" if descending and sort != "random" else "ASC"
    groups = db.execute(
        f"""WITH matching AS (
        SELECT DISTINCT t.source_group FROM {join} WHERE {where}
    ), versions AS (
        SELECT t.*,({STATUS_SQL}) watched_status,{collection_sql} collection_sort,
        ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added,
        {PURCHASE_SQL} effective_purchased_on
        FROM {join} WHERE t.source_id=? AND t.available=1
    ) SELECT source_group,min(title_search) title_search,min(id) id,
        min(coalesce(json_extract(enrichment,'$.reviewed.title'),title)) title,
        coalesce(min(nullif(sort_title,'')),
            min(json_extract(enrichment,'$.reviewed.title')),
            min(title_search)) sort_title,
        count(*) version_count,
        max(companion_conflict(enrichment)) scraper_conflict,
        max(is_favorite) is_favorite,max(is_recently_added) is_recently_added,
        min({scalar_sql("year")}) year,
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
        (
            *values,
            *hidden,
            source,
            *((seed,) if sort == "random" else ()),
            limit + 1,
            offset,
        ),
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
                "SELECT id,companion_artwork(artwork_key,enrichment,'artwork') "
                "artwork_key,metadata_synced_at,"
                f"({scalar_sql('rating')}) rating,"
                "json_extract(data,'$.edition') edition "
                "FROM library WHERE source_id=? AND id IN ("
                + ",".join("?" for _ in batch)
                + ")",
                (source, *batch),
            ):
                representatives[row["id"]] = row
        # Other versions need only small summary fields, not synopses/credits.
        variants = {}
        for batch in batches(groups_on_page):
            for row in db.execute(
                "SELECT id,source_group,companion_artwork(artwork_key,enrichment,"
                "'artwork') "
                "artwork_key,"
                "json_extract(enrichment,'$.reviewed.poster_key') reviewed_poster,"
                "json_extract(data,'$.formats') formats,"
                f"({scalar_sql('rating')}) rating,"
                "json_extract(data,'$.edition') edition,"
                f"({scalar_sql('year')}) year "
                "FROM library WHERE source_id=? AND available=1 "
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
                    "scraper_conflict": bool(group["scraper_conflict"]),
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
                    "content_ratings": sorted(
                        {row["rating"] for row in rows if row["rating"]},
                        key=str.casefold,
                    )[:100],
                    "formats_truncated": len(known_formats) > 100,
                    "years": sorted(
                        {row["year"] for row in rows if row["year"] is not None}
                    )[:100],
                    "artwork_key": next(
                        (
                            row["reviewed_poster"]
                            for row in rows
                            if row["reviewed_poster"]
                        ),
                        None,
                    )
                    or representative["artwork_key"]
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
    facets, truncated = facets_for(db, source, hidden, info["revision"], cache)
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


def library_versions(
    db, source, title, offset=0, revision=None, excluded="", admin=False
):
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
        "SELECT source_group FROM library WHERE id=? AND source_id=? AND available=1",
        (title, source),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Library title is unavailable")
    group = row[0]
    total = db.execute(
        "SELECT count(*) FROM library WHERE source_id=? AND available=1 "
        "AND source_group=?",
        (source, group),
    ).fetchone()[0]
    rows = db.execute(
        f"""SELECT t.*,({STATUS_SQL}) watched_status,
            {PURCHASE_SQL} effective_purchased_on,
            ({FAVORITE_SQL}) is_favorite,({RECENT_SQL}) is_recently_added
        FROM library t
        JOIN library_sources s ON s.id=t.source_id WHERE t.source_id=?
        AND t.available=1 AND t.source_group=? ORDER BY
        companion_quality(data) DESC,json_extract(data,'$.duration_seconds') DESC,t.id
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
                {
                    **public_title(row, memberships.get(row["id"], []), shared),
                    **(
                        {"purchase_history": json.loads(row["purchase_history"])}
                        if admin
                        else {}
                    ),
                }
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
            "WITH names AS MATERIALIZED ("
            "SELECT DISTINCT person.value name FROM library t,"
            "json_each(companion_metadata(t.data,t.enrichment),?) person "
            "WHERE t.source_id=? AND t.available=1 AND person.type='text' "
            ") SELECT name FROM names WHERE companion_matches(name,?,?) "
            "ORDER BY companion_casefold(name),name LIMIT 21",
            (path, source, query.casefold(), fuzzy),
        )
    ]
    return {"items": rows[:20], "has_more": len(rows) > 20}

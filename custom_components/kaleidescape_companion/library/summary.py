"""Worker-only library sensor projections and durable addition-batch snapshots."""

import json
from uuid import uuid4

from ..core.sensor_data import sensor_titles
from ..enrichment.activity import read as scrape_activity
from ..enrichment.matching import has_conflict, has_provider_data
from ..enrichment.selection import image
from ..enrichment.selection import read as source_preferences
from .browse import STATUS_SQL
from .purchases import missing_information


def record_additions(db, source, rows, seen):
    """First catalog establishes a baseline; only new groups replace the batch.

    Compare all previously known groups, including unavailable/imported versions.
    Extra formats, returning titles, metadata edits and purchase imports are not
    newly discovered movies. Called inside the catalog transaction, before upserts.
    """
    previous = db.execute(
        "SELECT last_synced_at,recently_added_batch FROM library_sources WHERE id=?",
        (source,),
    ).fetchone()
    if not previous[0]:
        return None, set()
    known = {
        row[0]
        for row in db.execute(
            "SELECT DISTINCT source_group FROM library WHERE source_id=?",
            (source,),
        )
    }
    added = {}
    for row in rows:
        group, title = row["source_group"], row["title"]
        if group not in known and (group not in added or title < added[group]):
            added[group] = title
    if not added:
        batch = previous["recently_added_batch"]
        groups = (
            {
                row[0]
                for row in db.execute(
                    "SELECT DISTINCT source_group FROM library "
                    "WHERE source_id=? AND addition_batch=?",
                    (source, batch),
                )
            }
            if batch
            else set()
        )
        return batch, groups
    titles = sensor_titles(
        {"title": title}
        for _, title in sorted(
            added.items(), key=lambda item: (item[1].casefold(), item[0])
        )
    )
    batch = str(uuid4())
    db.execute(
        """UPDATE library_sources SET recently_added_batch=?,recently_added_count=?,
            recently_added_movies=?,recently_added_at=? WHERE id=?""",
        (batch, len(added), json.dumps(titles, ensure_ascii=False), seen, source),
    )

    return batch, set(added)


def completeness(db, source, selected_groups=None):
    """Compute missing data and conflicts for all or selected source groups."""
    sources = source_preferences(db)
    cached_images = {
        row[0] for row in db.execute("SELECT cache_key FROM library_artwork")
    }
    groups, conflicts, stamps, titles = {}, set(), [], {}
    # Project only image references, conflicts and times; never decode full credits.
    projected = [
        "'conflicts',json(coalesce(json_extract(enrichment,'$.conflicts'),'{}'))",
        "'unavailable',json(coalesce(json_extract(enrichment,'$.unavailable'),'{}'))",
        "'unavailable_artwork',json(coalesce(json_extract(enrichment,'$.unavailable_artwork'),'{}'))",
        "'matches',json(coalesce(json_extract(enrichment,'$.matches'),'{}'))",
        *(
            f"'{provider}',json_object("
            + ",".join(
                f"'{key}',json_extract(enrichment,'$.{provider}.{key}')"
                for key in (
                    "fetched_at",
                    "poster_key",
                    "backdrop_key",
                    "backdrop_removed",
                    "provider",
                    "provider_id",
                    "title",
                    "year",
                    "url",
                )
            )
            + ")"
            for provider in ("tmdb", "kaleidescape", "reviewed")
        ),
    ]
    group_clause = (
        " AND source_group IN (SELECT value FROM json_each(?))"
        if selected_groups is not None
        else ""
    )
    arguments = (
        (source,) if selected_groups is None else (source, json.dumps(selected_groups))
    )
    for row in db.execute(
        "SELECT source_group,title,artwork_key,json_object("
        + ",".join(projected)
        + ") enrichment FROM library "
        "WHERE source_id=? AND available=1 AND purchase_match_pending=0" + group_clause,
        arguments,
    ):
        enrichment = json.loads(row["enrichment"])
        titles[row["source_group"]] = min(
            titles.get(row["source_group"], row["title"]), row["title"]
        )
        group = groups.setdefault(
            row["source_group"],
            {
                "images": [False, False],
                "cached": set(),
                "metadata_excluded": set(),
                "artwork_excluded": set(),
            },
        )
        group["images"][0] |= (
            image(row["artwork_key"], enrichment, sources) in cached_images
        )
        group["images"][1] |= (
            image(None, enrichment, sources, "backdrop") in cached_images
        )
        group["metadata_excluded"].update(
            provider
            for provider, value in enrichment["unavailable"].items()
            if value is True
        )
        group["artwork_excluded"].update(
            kind
            for kind, value in enrichment["unavailable_artwork"].items()
            if value is True
        )
        if has_conflict(enrichment, sources):
            conflicts.add(row["source_group"])
        for provider in ("tmdb", "kaleidescape", "reviewed"):
            stamp = enrichment.get(provider, {}).get("fetched_at")
            if stamp:
                stamps.append(stamp)
            if provider != "reviewed" and has_provider_data(enrichment, provider):
                group["cached"].add(provider)
    enabled = set(sources.get("_enabled", [])) & {"tmdb", "kaleidescape"}
    missing_metadata = {
        name
        for name, group in groups.items()
        if enabled - group["cached"] - group["metadata_excluded"]
    }
    missing = {
        name
        for name, group in groups.items()
        if (not group["images"][0] and "poster" not in group["artwork_excluded"])
        or (not group["images"][1] and "backdrop" not in group["artwork_excluded"])
    }

    return missing_metadata, missing, conflicts, stamps, titles


def missing_for_notification(db, source):
    """Return all affected groups using the same criteria as the Library filter."""
    info = db.execute(
        "SELECT last_synced_at FROM library_sources WHERE id=?", (source,)
    ).fetchone()
    if info is None or info["last_synced_at"] is None:
        return None
    metadata, artwork, _, _, titles = completeness(db, source)
    return {
        "missing_metadata": len(metadata),
        "missing_artwork": len(artwork),
        "movies": [
            {
                "title": titles[group],
                "metadata": group in metadata,
                "artwork": group in artwork,
            }
            for group in sorted(
                metadata | artwork, key=lambda group: (titles[group].casefold(), group)
            )
        ],
    }


def library_summary(db, source):
    """Use the same Paused > Played > unknown > unwatched grouping as browsing."""
    result = {
        "total_movies": None,
        "unwatched_movies": None,
        "watched_movies": None,
        "unknown_movies": 0,
        "collections_synced_at": None,
        "last_library_sync": None,
        "last_scrape_date": None,
        "scraper_failures": 0,
        "scraper_conflicts": None,
        "missing_metadata": None,
        "missing_metadata_movies": [],
        "missing_metadata_truncated": False,
        "missing_purchase_information": None,
        "missing_purchase_information_movies": [],
        "missing_purchase_information_truncated": False,
        "missing_artwork": None,
        "missing_artwork_movies": [],
        "missing_artwork_truncated": False,
        "scraper_conflicts_movies": [],
        "scraper_conflicts_truncated": False,
        "recently_added": None,
        "recently_added_movies": [],
        "recently_added_truncated": False,
        "recently_added_at": None,
        # Artwork files are deduplicated across sources; count the whole cache.
        "artwork_cache_bytes": db.execute(
            "SELECT coalesce(sum(byte_size),0) FROM library_artwork"
        ).fetchone()[0],
    }
    if source is None:
        return result
    info = db.execute("SELECT * FROM library_sources WHERE id=?", (source,)).fetchone()
    if info is None or info["last_synced_at"] is None:
        return result
    counts = db.execute(
        f"""SELECT count(*),coalesce(sum(status_rank=3),0),
            coalesce(sum(status_rank=2),0),coalesce(sum(status_rank=1),0) FROM (
            SELECT t.source_group,min(CASE ({STATUS_SQL})
                WHEN 'in_progress' THEN 0 WHEN 'watched' THEN 1
                WHEN 'unknown' THEN 2 WHEN 'unwatched' THEN 3 ELSE 4 END) status_rank
            FROM library t JOIN library_sources s ON s.id=t.source_id
            WHERE t.source_id=? AND t.available=1 GROUP BY t.source_group)""",
        (source,),
    ).fetchone()
    status_known = info["collections_synced_at"] is not None and not counts[2]
    membership_counts = dict(
        db.execute(
            "SELECT lower(m.collection),count(DISTINCT t.source_group) "
            "FROM library t JOIN library_memberships m ON m.title_id=t.id "
            "WHERE t.source_id=? AND t.available=1 "
            "AND lower(m.collection) IN ('new','played') "
            "GROUP BY lower(m.collection)",
            (source,),
        )
    )
    movies = json.loads(info["recently_added_movies"])
    missing_metadata, missing, conflicts, stamps, titles = completeness(db, source)
    missing_purchases = missing_information(db, source)
    activity = scrape_activity(db, source)
    if activity["last_scrape_date"]:
        stamps.append(activity["last_scrape_date"])

    def names(selected):
        return sensor_titles(
            {"title": titles[group]}
            for group in sorted(
                selected, key=lambda group: (titles[group].casefold(), group)
            )
        )

    missing_names, metadata_names, conflict_names = (
        names(missing),
        names(missing_metadata),
        names(conflicts),
    )
    purchase_names = names(missing_purchases)
    return {
        **result,
        **activity,
        "missing_purchase_information": len(missing_purchases),
        "missing_purchase_information_movies": purchase_names,
        "missing_purchase_information_truncated": len(purchase_names)
        < len(missing_purchases),
        "last_scrape_date": max(stamps, default=None),
        "scraper_conflicts": len(conflicts),
        "missing_metadata": len(missing_metadata),
        "missing_metadata_movies": metadata_names,
        "missing_metadata_truncated": len(metadata_names) < len(missing_metadata),
        "missing_artwork": len(missing),
        "missing_artwork_movies": missing_names,
        "missing_artwork_truncated": len(missing_names) < len(missing),
        "scraper_conflicts_movies": conflict_names,
        "scraper_conflicts_truncated": len(conflict_names) < len(conflicts),
        "total_movies": counts[0],
        "unwatched_movies": membership_counts.get("new", 0) if status_known else None,
        "watched_movies": membership_counts.get("played", 0) if status_known else None,
        "unknown_movies": counts[2],
        "collections_synced_at": info["collections_synced_at"],
        "last_library_sync": info["last_synced_at"],
        "recently_added": info["recently_added_count"],
        "recently_added_movies": movies,
        "recently_added_truncated": info["recently_added_count"] > len(movies),
        "recently_added_at": info["recently_added_at"],
    }

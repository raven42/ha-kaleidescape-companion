"""Worker-only library sensor projections and durable addition-batch snapshots."""

import json
from uuid import uuid4

from ..core.sensor_data import sensor_titles
from ..enrichment.activity import read as scrape_activity
from ..enrichment.matching import has_conflict
from ..enrichment.selection import image
from ..enrichment.selection import read as source_preferences
from .browse import STATUS_SQL


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
                WHEN 'unknown' THEN 2 ELSE 3 END) status_rank
            FROM library t JOIN library_sources s ON s.id=t.source_id
            WHERE t.source_id=? AND t.available=1 GROUP BY t.source_group)""",
        (source,),
    ).fetchone()
    status_known = info["collections_synced_at"] is not None and not counts[2]
    movies = json.loads(info["recently_added_movies"])
    sources = source_preferences(db)
    cached_images = {
        row[0] for row in db.execute("SELECT cache_key FROM library_artwork")
    }
    groups, conflicts, stamps, titles = {}, set(), [], {}
    # Project only image references, conflicts and times; never decode full credits.
    projected = [
        "'conflicts',json(coalesce(json_extract(enrichment,'$.conflicts'),'{}'))",
        "'unavailable',json(coalesce(json_extract(enrichment,'$.unavailable'),'{}'))",
        *(
            f"'{provider}',json_object("
            + ",".join(
                f"'{key}',json_extract(enrichment,'$.{provider}.{key}')"
                for key in ("fetched_at", "poster_key", "backdrop_key")
            )
            + ")"
            for provider in ("tmdb", "kaleidescape", "reviewed")
        ),
    ]
    for row in db.execute(
        "SELECT source_group,title,artwork_key,json_object("
        + ",".join(projected)
        + ") enrichment FROM library "
        "WHERE source_id=? AND available=1 AND purchase_match_pending=0",
        (source,),
    ):
        enrichment = json.loads(row["enrichment"])
        titles[row["source_group"]] = min(
            titles.get(row["source_group"], row["title"]), row["title"]
        )
        images = groups.setdefault(row["source_group"], [False, False])
        images[0] |= image(row["artwork_key"], enrichment, sources) in cached_images
        images[1] |= image(None, enrichment, sources, "backdrop") in cached_images
        if has_conflict(enrichment, sources):
            conflicts.add(row["source_group"])
        for provider in ("tmdb", "kaleidescape", "reviewed"):
            stamp = enrichment.get(provider, {}).get("fetched_at")
            if stamp:
                stamps.append(stamp)
    activity = scrape_activity(db, source)
    if activity["last_scrape_date"]:
        stamps.append(activity["last_scrape_date"])
    missing = {group for group, images in groups.items() if not all(images)}

    def names(selected):
        return sensor_titles(
            {"title": titles[group]}
            for group in sorted(
                selected, key=lambda group: (titles[group].casefold(), group)
            )
        )

    missing_names, conflict_names = names(missing), names(conflicts)
    return {
        **result,
        **activity,
        "last_scrape_date": max(stamps, default=None),
        "scraper_conflicts": len(conflicts),
        "missing_artwork": len(missing),
        "missing_artwork_movies": missing_names,
        "missing_artwork_truncated": len(missing_names) < len(missing),
        "scraper_conflicts_movies": conflict_names,
        "scraper_conflicts_truncated": len(conflict_names) < len(conflicts),
        "total_movies": counts[0],
        "unwatched_movies": counts[1] if status_known else None,
        "watched_movies": counts[3] if status_known else None,
        "unknown_movies": counts[2],
        "collections_synced_at": info["collections_synced_at"],
        "last_library_sync": info["last_synced_at"],
        "recently_added": info["recently_added_count"],
        "recently_added_movies": movies,
        "recently_added_truncated": info["recently_added_count"] > len(movies),
        "recently_added_at": info["recently_added_at"],
    }

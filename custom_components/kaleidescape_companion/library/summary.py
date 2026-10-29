"""Worker-only library sensor projections and durable addition-batch snapshots."""

import json

from ..core.sensor_data import sensor_titles
from .browse import STATUS_SQL


def record_additions(db, source, rows, seen):
    """First catalog establishes a baseline; only new groups replace the batch.

    Compare all previously known groups, including unavailable/imported versions.
    Extra formats, returning titles, metadata edits and purchase imports are not
    newly discovered movies. Called inside the catalog transaction, before upserts.
    """
    previous = db.execute(
        "SELECT last_synced_at FROM library_sources WHERE id=?", (source,)
    ).fetchone()
    if not previous[0]:
        return
    known = {
        row[0]
        for row in db.execute(
            "SELECT DISTINCT source_group FROM library_titles WHERE source_id=?",
            (source,),
        )
    }
    added = {}
    for row in rows:
        group, title = row["source_group"], row["title"]
        if group not in known and (group not in added or title < added[group]):
            added[group] = title
    if not added:
        return
    titles = sensor_titles(
        {"title": title}
        for _, title in sorted(
            added.items(), key=lambda item: (item[1].casefold(), item[0])
        )
    )
    db.execute(
        """UPDATE library_sources SET recently_added_count=?,
            recently_added_movies=?,recently_added_at=? WHERE id=?""",
        (len(added), json.dumps(titles, ensure_ascii=False), seen, source),
    )


def library_summary(db, source):
    """Use the same Paused > Played > unknown > unwatched grouping as browsing."""
    result = {
        "total_movies": None,
        "unwatched_movies": None,
        "unknown_movies": 0,
        "collections_synced_at": None,
        "last_library_sync": None,
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
            coalesce(sum(status_rank=2),0) FROM (
            SELECT t.source_group,min(CASE ({STATUS_SQL})
                WHEN 'in_progress' THEN 0 WHEN 'watched' THEN 1
                WHEN 'unknown' THEN 2 ELSE 3 END) status_rank
            FROM library_titles t JOIN library_sources s ON s.id=t.source_id
            WHERE t.source_id=? AND t.available=1 GROUP BY t.source_group)""",
        (source,),
    ).fetchone()
    movies = json.loads(info["recently_added_movies"])
    return {
        **result,
        "total_movies": counts[0],
        "unwatched_movies": counts[1]
        if info["collections_synced_at"] is not None and not counts[2]
        else None,
        "unknown_movies": counts[2],
        "collections_synced_at": info["collections_synced_at"],
        "last_library_sync": info["last_synced_at"],
        "recently_added": info["recently_added_count"],
        "recently_added_movies": movies,
        "recently_added_truncated": info["recently_added_count"] > len(movies),
        "recently_added_at": info["recently_added_at"],
    }

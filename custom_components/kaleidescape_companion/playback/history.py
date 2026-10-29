"""Worker-only read models for household watch-history sensors."""

import sqlite3

from ..core.sensor_data import MAX_SENSOR_MOVIES, sensor_titles


def history_summary(db: sqlite3.Connection, upper: str, cutoffs: list[str]) -> dict:
    """Query bounded household summaries on the repository's owning worker."""
    completed = (
        "WITH watched AS (SELECT id, title, "
        "coalesce(ended_at, completed_at, started_at) AS watched_at FROM viewings "
        "WHERE status = 'completed' AND deleted_at IS NULL) "
    )
    last = db.execute(
        completed + "SELECT title, watched_at FROM watched WHERE watched_at <= ? "
        "ORDER BY watched_at DESC, id DESC LIMIT 1",
        (upper,),
    ).fetchone()
    counts = db.execute(
        completed + "SELECT count(CASE WHEN watched_at > ? THEN 1 END), "
        "count(CASE WHEN watched_at > ? THEN 1 END), count(*) FROM watched "
        "WHERE watched_at > ? AND watched_at <= ?",
        (cutoffs[0], cutoffs[1], cutoffs[2], upper),
    ).fetchone()
    result = {
        "last_watched_movie": last["title"] if last else None,
        "last_watched_at": last["watched_at"] if last else None,
        **{
            f"completed_{days}_days": counts[index]
            for index, days in enumerate((7, 30, 365))
        },
    }
    for index, days in enumerate((7, 30)):
        rows = db.execute(
            completed + "SELECT title FROM watched WHERE watched_at > ? "
            "AND watched_at <= ? ORDER BY watched_at DESC, id DESC LIMIT ?",
            (cutoffs[index], upper, MAX_SENSOR_MOVIES),
        ).fetchall()
        titles = sensor_titles(rows)
        result[f"movies_{days}_days"] = titles
        result[f"movies_{days}_days_truncated"] = counts[index] > len(titles)
    partial = "status = 'partial' AND deleted_at IS NULL AND started_at <= ?"
    count = db.execute(
        f"SELECT count(*) FROM viewings WHERE {partial}", (upper,)
    ).fetchone()[0]
    rows = db.execute(
        f"SELECT title FROM viewings WHERE {partial} "
        "ORDER BY coalesce(ended_at, started_at) DESC, id DESC LIMIT ?",
        (upper, MAX_SENSOR_MOVIES),
    ).fetchall()
    result.update(partial_count=count, partial_movies=sensor_titles(rows))
    result["partial_movies_truncated"] = count > len(result["partial_movies"])
    return result

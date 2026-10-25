"""Worker-only persistence of absolute playback checkpoints."""

import json
import sqlite3
from datetime import datetime, timedelta
from uuid import uuid4

from .tracker import RULE_VERSION


def save_session(
    db: sqlite3.Connection, snapshot: dict, minimum_seconds: float, resume_hours: float
) -> str:
    """Commit a checkpoint and its derived viewing atomically and idempotently."""
    previous = db.execute(
        "SELECT * FROM sessions WHERE id = ?", (snapshot["id"],)
    ).fetchone()
    if previous and previous["revision"] >= snapshot["revision"]:
        return previous["viewing_id"]
    created = False
    with db:
        if previous:
            viewing_id = previous["viewing_id"]
        else:
            candidates = []
            if resume_hours > 0:
                cutoff = (
                    datetime.fromisoformat(snapshot["started_at"])
                    - timedelta(hours=resume_hours)
                ).isoformat(timespec="microseconds")
                candidates = db.execute(
                    """SELECT v.id FROM viewings v
                    JOIN sessions s ON s.viewing_id = v.id
                    WHERE v.deleted_at IS NULL AND v.status = 'partial'
                    AND v.origin = 'observed'
                    AND s.player_id = ? AND s.raw_content_id = ?
                    AND s.closed_at IS NOT NULL AND s.closed_at >= ?
                    AND s.closed_at <= ? GROUP BY v.id
                    ORDER BY max(s.closed_at) DESC LIMIT 2""",
                    (
                        snapshot["player_id"],
                        snapshot["raw_content_id"],
                        cutoff,
                        snapshot["started_at"],
                    ),
                ).fetchall()
            if len(candidates) == 1:
                viewing_id = candidates[0]["id"]
            else:
                viewing_id = str(uuid4())
                created = True
                db.execute(
                    """INSERT INTO viewings (id, title, title_search, started_at,
                    duration_seconds, watched_seconds, status, source_id, player_id,
                    raw_content_id, notes, origin, created_at, updated_at,
                    revision, rule_version)
                    VALUES (?, ?, ?, ?, ?, 0, 'partial', 'home_assistant', ?, ?, '',
                    'observed', ?, ?, 1, ?)""",
                    (
                        viewing_id,
                        snapshot["title"],
                        snapshot["title"].casefold(),
                        snapshot["started_at"],
                        snapshot["duration_seconds"],
                        snapshot["player_id"],
                        snapshot["raw_content_id"],
                        snapshot["started_at"],
                        snapshot["last_observed_at"],
                        RULE_VERSION,
                    ),
                )
        stored = {**snapshot, "viewing_id": viewing_id}
        columns = ", ".join(stored)
        updates = ", ".join(f"{key} = excluded.{key}" for key in stored if key != "id")
        placeholders = ", ".join("?" for _ in stored)
        db.execute(
            f"INSERT INTO sessions ({columns}) VALUES ({placeholders}) "
            f"ON CONFLICT(id) DO UPDATE SET {updates}",
            tuple(stored.values()),
        )
        viewing = db.execute(
            "SELECT * FROM viewings WHERE id = ?", (viewing_id,)
        ).fetchone()
        if viewing["deleted_at"] is None:
            corrected = set(json.loads(viewing["manual_fields"]))
            total, open_count, end_at = db.execute(
                "SELECT sum(watched_seconds), sum(closed_at IS NULL), max(closed_at) "
                "FROM sessions WHERE viewing_id = ?",
                (viewing_id,),
            ).fetchone()
            changes = {
                "updated_at": snapshot["last_observed_at"],
                "revision": viewing["revision"] + (0 if created else 1),
            }
            if "watched_seconds" not in corrected:
                changes["watched_seconds"] = total
            if "ended_at" not in corrected:
                changes["ended_at"] = None if open_count else end_at
            # The threshold applies at the credits edge, not at a later checkpoint.
            at_credits = (
                total
                - snapshot["watched_seconds"]
                + snapshot["credits_watched_seconds"]
            )
            if (
                "status" not in corrected
                and viewing["status"] != "completed"
                and snapshot["credits_confirmed"]
                and at_credits >= minimum_seconds
            ):
                changes.update(
                    status="completed",
                    completed_at=snapshot["credits_at"],
                    completion_reason="credits",
                    rule_version=RULE_VERSION,
                )
            if (
                viewing["duration_seconds"] is None
                and "duration_seconds" not in corrected
            ):
                changes["duration_seconds"] = snapshot["duration_seconds"]
            assignments = ", ".join(f"{key} = ?" for key in changes)
            db.execute(
                f"UPDATE viewings SET {assignments} WHERE id = ?",
                (*changes.values(), viewing_id),
            )
        db.execute("UPDATE schema_metadata SET revision = revision + 1")
    return viewing_id

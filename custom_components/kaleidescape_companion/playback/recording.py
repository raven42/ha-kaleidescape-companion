"""Worker-only persistence of absolute playback checkpoints."""

import json
import sqlite3
from datetime import datetime, timedelta
from uuid import uuid4

from .metadata import missing_changes
from .tracker import RULE_VERSION


# A checkpoint is retained immediately, but a brief attempt is not sufficient
# evidence that a later playback resumed the same viewing.
def _resume_candidate(
    db, snapshot, resume_hours, minimum_partial_seconds, exclude=None
):
    if resume_hours <= 0:
        return None
    cutoff = (
        datetime.fromisoformat(snapshot["started_at"])
        - timedelta(hours=min(resume_hours, 1))
    ).isoformat(timespec="microseconds")
    candidates = db.execute(
        """SELECT v.id FROM viewings v JOIN sessions s ON s.viewing_id=v.id
        WHERE v.deleted_at IS NULL AND v.status='partial' AND v.origin='observed'
        AND v.id != ? AND s.player_id=? AND s.raw_content_id=?
        AND s.watched_seconds>=? AND s.closed_at IS NOT NULL
        AND julianday(s.closed_at)>=julianday(?)
        AND julianday(s.closed_at)<=julianday(?)
        GROUP BY v.id ORDER BY max(s.closed_at) DESC LIMIT 2""",
        (
            exclude or "",
            snapshot["player_id"],
            snapshot["raw_content_id"],
            minimum_partial_seconds,
            cutoff,
            snapshot["started_at"],
        ),
    ).fetchall()
    return candidates[0]["id"] if len(candidates) == 1 else None


def _can_move_provisional(db, viewing_id):
    """Never automatically merge a viewing that has been edited or published."""
    return (
        db.execute(
            """SELECT 1 FROM viewings v WHERE v.id=? AND v.deleted_at IS NULL
        AND v.origin='observed' AND v.status='partial' AND v.notes=''
        AND v.manual_fields='[]'
        AND (SELECT count(*) FROM sessions WHERE viewing_id=v.id)=1
        AND NOT EXISTS (SELECT 1 FROM manual_audit WHERE viewing_id=v.id)
        AND NOT EXISTS (SELECT 1 FROM calendar_publications WHERE viewing_id=v.id)
        AND NOT EXISTS (SELECT 1 FROM calendar_managed_events WHERE viewing_id=v.id)
        AND NOT EXISTS (SELECT 1 FROM calendar_sync_items WHERE viewing_id=v.id)""",
            (viewing_id,),
        ).fetchone()
        is not None
    )


def save_session(
    db: sqlite3.Connection,
    snapshot: dict,
    minimum_seconds: float,
    resume_hours: float,
    calendar: dict | None = None,
    library_source: str | None = None,
    minimum_partial_seconds: float = 600,
) -> str:
    """Commit a checkpoint and its derived viewing atomically and idempotently."""
    previous = db.execute(
        "SELECT * FROM sessions WHERE id = ?", (snapshot["id"],)
    ).fetchone()
    if previous and previous["revision"] >= snapshot["revision"]:
        return previous["viewing_id"]
    created = False
    with db:
        qualified = snapshot["watched_seconds"] >= minimum_partial_seconds
        if previous:
            viewing_id = previous["viewing_id"]
            # A resumed segment becomes eligible after ten minutes, or when it
            # reaches confirmed credits after an established partial viewing.
            if (qualified or snapshot["credits_confirmed"]) and _can_move_provisional(
                db, viewing_id
            ):
                candidate = _resume_candidate(
                    db, snapshot, resume_hours, minimum_partial_seconds, viewing_id
                )
                if candidate and not qualified:
                    prior = db.execute(
                        "SELECT watched_seconds FROM viewings WHERE id=?", (candidate,)
                    ).fetchone()[0]
                    if prior + snapshot["credits_watched_seconds"] < minimum_seconds:
                        candidate = None
                if candidate:
                    db.execute(
                        "UPDATE sessions SET viewing_id=? WHERE id=?",
                        (candidate, snapshot["id"]),
                    )
                    db.execute(
                        "UPDATE viewings SET deleted_at=?,revision=revision+1 "
                        "WHERE id=?",
                        (snapshot["last_observed_at"], viewing_id),
                    )
                    viewing_id = candidate
        else:
            candidate = (
                _resume_candidate(db, snapshot, resume_hours, minimum_partial_seconds)
                if (qualified or snapshot["credits_confirmed"])
                else None
            )
            if candidate and not qualified:
                prior = db.execute(
                    "SELECT watched_seconds FROM viewings WHERE id=?", (candidate,)
                ).fetchone()[0]
                if prior + snapshot["credits_watched_seconds"] < minimum_seconds:
                    candidate = None
            if candidate:
                viewing_id = candidate
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
                **missing_changes(db, viewing, library_source),
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
            if changes.get("status") == "completed":
                from ..calendar.store import enqueue

                enqueue(db, viewing_id, calendar)
        db.execute("UPDATE schema_metadata SET revision = revision + 1")
    return viewing_id

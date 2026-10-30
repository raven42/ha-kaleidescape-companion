"""Worker-only completion outbox; no remote calls or automatic uncertain retries."""

import json
from datetime import UTC, datetime


def enqueue(db, viewing_id, config):
    if not config:
        return
    db.execute(
        """INSERT OR IGNORE INTO calendar_publications
        SELECT id,?,?,'queued',?,? FROM viewings
        WHERE id=? AND status='completed' AND deleted_at IS NULL""",
        (config["target"], config["fingerprint"], now(), now(), viewing_id),
    )


def now():
    return datetime.now(UTC).isoformat()


def configure(db, config):
    with db:
        changed = db.execute(
            "UPDATE calendar_publications SET state='uncertain',updated_at=? "
            "WHERE state='sending'",
            (now(),),
        ).rowcount
        changed += db.execute(
            "UPDATE calendar_publications SET state='cancelled',updated_at=? "
            "WHERE state='queued' AND config_hash!=?",
            (now(), config["fingerprint"] if config else ""),
        ).rowcount
        if changed:
            db.execute("UPDATE schema_metadata SET revision=revision+1")
        changed = db.execute(
            "UPDATE calendar_sync_items SET state='uncertain',updated_at=? "
            "WHERE state='sending'",
            (now(),),
        ).rowcount
        changed += db.execute(
            "UPDATE calendar_sync_items SET state='cancelled',updated_at=? "
            "WHERE state IN ('queued','checking')",
            (now(),),
        ).rowcount
        changed += db.execute(
            "UPDATE calendar_sync_jobs SET finished_at=? WHERE finished_at IS NULL",
            (now(),),
        ).rowcount
        if changed:
            db.execute("UPDATE schema_metadata SET revision=revision+1")


def claim(db, config):
    with db:
        # Missing/tombstoned rows cannot cause later calendar writes.
        cancelled = db.execute(
            "UPDATE calendar_publications SET state='cancelled',updated_at=? "
            "WHERE state='queued' AND viewing_id NOT IN "
            "(SELECT id FROM viewings WHERE deleted_at IS NULL AND status='completed')",
            (now(),),
        ).rowcount
        if cancelled:
            db.execute("UPDATE schema_metadata SET revision=revision+1")
        row = db.execute(
            """SELECT v.*,p.target FROM calendar_publications p
            JOIN viewings v ON v.id=p.viewing_id WHERE p.state='queued'
            AND p.config_hash=? ORDER BY p.created_at,p.viewing_id LIMIT 1""",
            (config["fingerprint"],),
        ).fetchone()
        if row is None:
            return None
        db.execute(
            "UPDATE calendar_publications SET state='sending',updated_at=? "
            "WHERE viewing_id=?",
            (now(), row["id"]),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
        return projection(db, row, config)


def projection(db, row, config):
    from ..playback.metadata import missing_changes

    result = dict(row)
    # Older journals can be rendered before an explicit persistent repair.
    result.update(missing_changes(db, row, config.get("source")))
    result["metadata"] = json.loads(result["library_metadata"])
    return result


def finish(db, viewing_id, state):
    assert state in {"sent", "uncertain", "cancelled"}
    with db:
        if db.execute(
            "UPDATE calendar_publications SET state=?,updated_at=? "
            "WHERE viewing_id=? AND state='sending'",
            (state, now(), viewing_id),
        ).rowcount:
            db.execute("UPDATE schema_metadata SET revision=revision+1")

"""Worker-only job receipts and per-viewing progress for explicit calendar export."""

import hashlib
import json

from ..core.models import JournalError, invalid
from .store import now, projection


def begin(db, request, actor, config):
    digest = hashlib.sha256(
        json.dumps(
            ["calendar_sync", actor, config["fingerprint"]], sort_keys=True
        ).encode()
    ).hexdigest()
    receipt = db.execute(
        "SELECT * FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if receipt:
        if receipt["fingerprint"] != digest:
            raise JournalError("conflict", "Request belongs to different data or actor")
        return json.loads(receipt["response"])
    if db.execute(
        "SELECT 1 FROM calendar_sync_items WHERE state IN "
        "('queued','checking','sending') LIMIT 1"
    ).fetchone():
        raise JournalError("busy", "A journal calendar export is already running")
    count = db.execute(
        "SELECT count(*) FROM viewings WHERE status='completed' AND deleted_at IS NULL"
    ).fetchone()[0]
    if count > 10000:
        raise invalid("Calendar export supports at most 10000 completed viewings")
    result = {"job_id": request, "total": count}
    with db:
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)", (request, digest, json.dumps(result))
        )
        db.execute(
            "INSERT INTO calendar_sync_jobs VALUES (?,?,?,?,?,?)",
            (
                request,
                actor,
                config["target"],
                config["fingerprint"],
                now(),
                None if count else now(),
            ),
        )
        db.execute(
            "INSERT INTO calendar_sync_items SELECT ?,id,'queued',? FROM "
            "viewings WHERE status='completed' AND deleted_at IS NULL",
            (request, now()),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return result


def status(db, job=None):
    row = db.execute(
        "SELECT * FROM calendar_sync_jobs "
        + ("WHERE request_id=?" if job else "ORDER BY created_at DESC LIMIT 1"),
        (job,) if job else (),
    ).fetchone()
    completed = db.execute(
        "SELECT count(*) FROM viewings WHERE status='completed' AND deleted_at IS NULL"
    ).fetchone()[0]
    if row is None:
        return {"completed_viewings": completed, "job": None}
    counts = {
        item[0]: item[1]
        for item in db.execute(
            "SELECT state,count(*) FROM calendar_sync_items WHERE request_id=? "
            "GROUP BY state",
            (row["request_id"],),
        )
    }
    return {
        "completed_viewings": completed,
        "job": {
            "job_id": row["request_id"],
            "total": sum(counts.values()),
            "counts": counts,
            "finished": row["finished_at"] is not None,
        },
    }


def claim(db, job, config):
    with db:
        item = db.execute(
            "SELECT i.viewing_id FROM calendar_sync_items i LEFT JOIN viewings v "
            "ON v.id=i.viewing_id WHERE i.request_id=? AND i.state='queued' "
            "ORDER BY v.started_at,i.viewing_id LIMIT 1",
            (job,),
        ).fetchone()
        if item is None:
            if db.execute(
                "UPDATE calendar_sync_jobs SET finished_at=? WHERE request_id=? "
                "AND finished_at IS NULL",
                (now(), job),
            ).rowcount:
                db.execute("UPDATE schema_metadata SET revision=revision+1")
            return None
        key = item[0]
        row = db.execute(
            "SELECT * FROM viewings WHERE id=? AND status='completed' AND "
            "deleted_at IS NULL",
            (key,),
        ).fetchone()
        db.execute(
            "UPDATE calendar_sync_items SET state=?,updated_at=? WHERE "
            "request_id=? AND viewing_id=?",
            ("checking" if row else "skipped", now(), job, key),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
        if row is None:
            return {"id": key, "skip": True}
        result = projection(db, row, config)
        # An unconfirmed prior attempt may have created an event. A remote match
        # may resolve it, but an absent match must not cause a blind second write.
        result["uncertain"] = bool(
            db.execute(
                "SELECT 1 FROM calendar_publications WHERE viewing_id=? AND "
                "config_hash=? AND state IN ('sending','uncertain')",
                (key, config["fingerprint"]),
            ).fetchone()
            or db.execute(
                "SELECT 1 FROM calendar_sync_items i JOIN calendar_sync_jobs j "
                "USING(request_id) WHERE i.viewing_id=? AND j.config_hash=? AND "
                "i.state IN ('sending','uncertain') AND i.request_id!=? LIMIT 1",
                (key, config["fingerprint"], job),
            ).fetchone()
        )
        return result


def ready(db, job, row):
    with db:
        current = db.execute(
            "SELECT revision,status,deleted_at FROM viewings WHERE id=?", (row["id"],)
        ).fetchone()
        if (
            not current
            or current[0] != row["revision"]
            or current[1] != "completed"
            or current[2] is not None
        ):
            finish(db, job, row["id"], "skipped")
            return False
        changed = db.execute(
            "UPDATE calendar_sync_items SET state='sending',updated_at=? WHERE "
            "request_id=? AND viewing_id=? AND state='checking'",
            (now(), job, row["id"]),
        ).rowcount
        if not changed:
            return False
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return True


def finish(db, job, key, state):
    if state not in {"created", "matched", "uncertain", "failed", "skipped"}:
        raise invalid("Invalid calendar export state")
    with db:
        db.execute(
            "UPDATE calendar_sync_items SET state=?,updated_at=? WHERE "
            "request_id=? AND viewing_id=?",
            (state, now(), job, key),
        )
        if state in {"created", "matched", "uncertain"}:
            config = db.execute(
                "SELECT target,config_hash FROM calendar_sync_jobs WHERE request_id=?",
                (job,),
            ).fetchone()
            db.execute(
                "INSERT OR IGNORE INTO calendar_publications VALUES (?,?,?,?,?,?)",
                (
                    key,
                    *config,
                    "uncertain" if state == "uncertain" else "sent",
                    now(),
                    now(),
                ),
            )
            db.execute(
                "UPDATE calendar_publications SET state=?,updated_at=? "
                "WHERE viewing_id=? AND config_hash=? AND state IN "
                "('queued','uncertain')",
                (
                    "uncertain" if state == "uncertain" else "sent",
                    now(),
                    key,
                    config[1],
                ),
            )
            if state == "matched":
                db.execute(
                    "UPDATE calendar_sync_items SET "
                    "state='matched',updated_at=? WHERE viewing_id=? AND "
                    "state='uncertain' AND request_id IN (SELECT request_id "
                    "FROM calendar_sync_jobs WHERE config_hash=?)",
                    (now(), key, config[1]),
                )
        db.execute("UPDATE schema_metadata SET revision=revision+1")


def cancel(db, job):
    with db:
        db.execute(
            "UPDATE calendar_sync_items SET state='cancelled',updated_at=? "
            "WHERE request_id=? AND state IN ('queued','checking')",
            (now(), job),
        )
        db.execute(
            "UPDATE calendar_sync_jobs SET finished_at=? WHERE request_id=?",
            (now(), job),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")

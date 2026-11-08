"""Durable, bounded collection work and restart-safe status records."""

import hashlib
import json
from datetime import UTC, datetime

from ..core.models import JournalError, identifier, invalid
from .collections import RESERVED, snapshot
from .config import excluded_collections

MAX_ACTIVE = 10
MAX_HISTORY = 50
BUILTINS = {"favorites", "watchsoon", "new", "played", "paused"}


def normalized(value):
    return value.casefold().replace(" ", "").replace("-", "").replace("_", "")


def choices(db, source, excluded):
    hidden = excluded_collections(excluded)
    return [
        row[0]
        for row in db.execute(
            "SELECT name FROM library_collections "
            "WHERE source_id=? AND available=1 ORDER BY name",
            (source,),
        )
        if row[0].casefold() not in hidden
        and (normalized(row[0]) in BUILTINS or row[0].casefold() not in RESERVED)
    ]


def fingerprint(source, request, title, collection, operation, revision, actor):
    return hashlib.sha256(
        json.dumps(
            [source, request, title, collection, operation, revision, actor],
            separators=(",", ":"),
        ).encode()
    ).hexdigest()


def enqueue(
    db, source, request, title, collection, operation, revision, actor, excluded
):
    identifier(request)
    if operation not in {"add", "remove"} or not isinstance(collection, str):
        raise invalid("Invalid collection operation")
    key = normalized(collection)
    if not collection or len(collection) > 256 or any(ord(c) < 32 for c in collection):
        raise invalid("Invalid collection")
    if operation == "add" and key == "paused":
        raise invalid("In Progress requires starting playback")
    if operation == "remove" and key not in BUILTINS:
        raise invalid("Removal is available only for supported built-in collections")
    if key in RESERVED - {"new", "played", "paused"}:
        raise invalid("This collection cannot be changed")
    if type(revision) is not int or revision < 0:
        raise invalid("Invalid source revision")
    token = fingerprint(source, request, title, collection, operation, revision, actor)
    with db:
        previous = db.execute(
            "SELECT fingerprint,status FROM collection_jobs WHERE request_id=?",
            (request,),
        ).fetchone()
        if previous:
            if previous["fingerprint"] != token:
                raise JournalError("conflict", "Request UUID belongs to different work")
            return {"request_id": request, "status": previous["status"]}
        if db.execute(
            "SELECT 1 FROM requests WHERE request_id=?", (request,)
        ).fetchone():
            raise JournalError("conflict", "Request UUID was already used")
        state = snapshot(db, source, title, excluded)
        if state["revision"] != revision:
            raise JournalError(
                "refresh_required", "Library changed; refresh title details"
            )
        working = {
            row[0]
            for row in db.execute(
                "SELECT request_id FROM collection_jobs "
                "WHERE source_id=? AND status='working'",
                (source,),
            )
        }
        if any(item["request_id"] not in working for item in state["pending"]):
            raise JournalError(
                "collection_uncertain",
                "Resolve the unconfirmed collection change first",
            )
        names = [
            r[0]
            for r in db.execute(
                "SELECT name FROM library_collections "
                "WHERE source_id=? AND available=1",
                (source,),
            )
        ]
        if (
            collection.casefold() in excluded_collections(excluded)
            or collection not in names
            or (key not in BUILTINS and collection not in state["collections"])
        ):
            raise invalid("Unknown or hidden collection")
        active = db.execute(
            "SELECT title_id,collection FROM collection_jobs WHERE source_id=? "
            "AND status IN ('queued','working','syncing')",
            (source,),
        ).fetchall()
        if len(active) >= MAX_ACTIVE:
            raise JournalError("busy", "Collection queue is full (10 changes)")
        if any(
            row["title_id"] == title
            and (
                normalized(row["collection"]) == key
                or (
                    normalized(row["collection"]) in {"new", "played"}
                    and key in {"new", "played"}
                )
            )
            for row in active
        ):
            raise JournalError(
                "busy", "Wait for this movie's related collection change"
            )
        stamp = datetime.now(UTC).isoformat()
        db.execute(
            "INSERT INTO collection_jobs VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)",
            (
                request,
                token,
                source,
                title,
                collection,
                operation,
                actor,
                revision,
                "queued",
                stamp,
                stamp,
            ),
        )
        db.execute(
            "DELETE FROM collection_jobs WHERE request_id IN "
            "(SELECT request_id FROM collection_jobs "
            "WHERE source_id=? AND status IN ('confirmed','failed','interrupted') "
            "ORDER BY updated_at DESC LIMIT -1 OFFSET ?)",
            (source, MAX_HISTORY),
        )
    return {"request_id": request, "status": "queued"}


def status(db, source):
    return [
        dict(row)
        for row in db.execute(
            "SELECT q.request_id,q.title_id,q.collection,q.operation,q.status,q.error,"
            "coalesce(t.title,'Unavailable title') title,"
            "coalesce((SELECT min(g.id) FROM library g WHERE g.source_id=q.source_id "
            "AND g.source_group=t.source_group AND g.available=1),q.title_id) group_id "
            "FROM collection_jobs q LEFT JOIN library t ON t.id=q.title_id "
            "WHERE q.source_id=? ORDER BY q.created_at DESC LIMIT ?",
            (source, MAX_HISTORY + MAX_ACTIVE),
        )
    ]


def verified(db, source, request):
    """Check the post-scan cached membership for the selected exact version."""
    row = db.execute(
        "SELECT title_id,collection,operation FROM collection_jobs "
        "WHERE source_id=? AND request_id=?",
        (source, request),
    ).fetchone()
    if (
        not row
        or not db.execute(
            "SELECT 1 FROM library WHERE source_id=? AND id=? AND available=1",
            (source, row["title_id"]),
        ).fetchone()
    ):
        return False
    names = {
        normalized(item[0])
        for item in db.execute(
            "SELECT collection FROM library_memberships "
            "WHERE source_id=? AND title_id=?",
            (source, row["title_id"]),
        )
    }
    key = normalized(row["collection"])
    expected = row["operation"] == "add"
    if (key in names) != expected:
        return False
    if key in {"new", "played"}:
        return (("played" if key == "new" else "new") in names) != expected
    return True


def update(db, source, request, status, error=None):
    if status not in {
        "queued",
        "working",
        "syncing",
        "confirmed",
        "failed",
        "uncertain",
        "interrupted",
    }:
        raise invalid("Invalid collection status")
    with db:
        db.execute(
            "UPDATE collection_jobs SET status=?,error=?,updated_at=? "
            "WHERE source_id=? AND request_id=?",
            (status, error, datetime.now(UTC).isoformat(), source, request),
        )


def dismiss(db, source, request):
    """Remove a finished notification, never an active or uncertain receipt."""
    identifier(request)
    with db:
        row = db.execute(
            "SELECT status FROM collection_jobs WHERE source_id=? AND request_id=?",
            (source, request),
        ).fetchone()
        if row is None:
            return {"dismissed": True}
        if row[0] not in {"confirmed", "failed", "interrupted"}:
            raise JournalError("busy", "This collection change still needs attention")
        if db.execute(
            "SELECT 1 FROM library_collection_intents WHERE source_id=? "
            "AND request_id=? AND status='uncertain'",
            (source, request),
        ).fetchone():
            raise JournalError("collection_uncertain", "Resolve the unconfirmed change")
        db.execute(
            "DELETE FROM collection_jobs WHERE source_id=? AND request_id=?",
            (source, request),
        )
    return {"dismissed": True}


def recover(db, source):
    """Never automatically resend work after restart or an interrupted send."""
    with db:
        db.execute(
            "UPDATE collection_jobs SET status=CASE "
            "WHEN EXISTS(SELECT 1 FROM library_collection_intents i "
            "WHERE i.request_id=collection_jobs.request_id AND i.status='uncertain') "
            "THEN 'uncertain' ELSE 'interrupted' END,"
            "error='integration_restarted',updated_at=? WHERE source_id=? "
            "AND status IN ('queued','working','syncing')",
            (datetime.now(UTC).isoformat(), source),
        )

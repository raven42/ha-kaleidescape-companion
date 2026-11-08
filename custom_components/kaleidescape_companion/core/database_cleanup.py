"""Conservative cleanup of selected finalized operation histories."""

from datetime import UTC, datetime, timedelta

from .models import JournalError, invalid

# Fixed SQL only: replay barriers live separately in requests and are retained.
CATEGORIES = {
    "calendar": (
        "calendar_reconcile_intents",
        "state IN ('confirmed','reviewed','cancelled')",
    ),
    "collections": (
        "library_collection_intents",
        "status IN ('confirmed','abandoned') AND NOT EXISTS "
        "(SELECT 1 FROM collection_jobs j "
        "WHERE j.request_id=library_collection_intents.request_id "
        "AND j.status IN ('queued','working','syncing','uncertain'))",
    ),
    "playback": ("playback_controls", "status IN ('finished','reviewed')"),
}


def policies_checked(policies):
    if not isinstance(policies, dict) or set(policies) - CATEGORIES.keys():
        raise invalid("Invalid cleanup categories")
    result = {key: policies.get(key, 0) for key in CATEGORIES}
    if any(type(days) is not int or not 0 <= days <= 3650 for days in result.values()):
        raise invalid(
            "Cleanup retention must be between 1 and 3650 days, or 0 to keep all"
        )
    return result


def counts(db, policies, stamp):
    results = {}
    for key, (table, predicate) in CATEGORIES.items():
        days = policies[key]
        cutoff = (stamp - timedelta(days=days)).isoformat()
        results[key] = (
            db.execute(
                f"SELECT count(*) FROM {table} WHERE {predicate} "
                "AND julianday(updated_at) <= julianday(?)",
                (cutoff,),
            ).fetchone()[0]
            if days
            else 0
        )
    return results


def preview(db, policies):
    selected = policies_checked(policies)
    stamp = datetime.now(UTC)
    return {
        "as_of": stamp.isoformat(),
        "counts": counts(db, selected, stamp),
        "policies": selected,
        "revision": db.execute("SELECT revision FROM schema_metadata").fetchone()[0],
    }


def clean(db, policies, as_of=None, revision=None):
    selected = policies_checked(policies)
    now = datetime.now(UTC)
    if as_of is None:
        stamp = now
    else:
        try:
            stamp = datetime.fromisoformat(as_of)
            if (
                stamp.tzinfo is None
                or stamp > now
                or now - stamp > timedelta(minutes=30)
            ):
                raise ValueError
        except TypeError, ValueError:
            raise invalid(
                "Cleanup review expired or has an invalid timestamp"
            ) from None
    with db:
        current = db.execute("SELECT revision FROM schema_metadata").fetchone()[0]
        if revision is not None and (type(revision) is not int or revision != current):
            raise JournalError("conflict", "Database changed; review cleanup again")
        removed = {}
        for key, (table, predicate) in CATEGORIES.items():
            days = selected[key]
            if not days:
                removed[key] = 0
                continue
            cutoff = (stamp - timedelta(days=days)).isoformat()
            removed[key] = db.execute(
                f"DELETE FROM {table} WHERE {predicate} "
                "AND julianday(updated_at) <= julianday(?)",
                (cutoff,),
            ).rowcount
        if any(removed.values()):
            db.execute("UPDATE schema_metadata SET revision=revision+1")
    return {"removed": removed}

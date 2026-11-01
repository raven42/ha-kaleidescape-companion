"""Content-free durable scrape activity, owned by the database worker."""

import json
from datetime import UTC, datetime


def read(db, source):
    row = db.execute(
        "SELECT value FROM settings WHERE owner=? AND key='scrape_activity'",
        (f"source:{source}",),
    ).fetchone()
    return (
        json.loads(row[0]) if row else {"last_scrape_date": None, "scraper_failures": 0}
    )


def record(db, source, failed):
    """Count failed top-level operations, not nested requests or cancellations."""
    value = read(db, source)
    stamp = datetime.now(UTC).isoformat()
    value["last_scrape_date"] = stamp
    value["scraper_failures"] += int(failed)
    with db:
        db.execute(
            "INSERT INTO settings(owner,key,value,revision,updated_at) "
            "VALUES (?,'scrape_activity',?,1,?) ON CONFLICT(owner,key) DO UPDATE "
            "SET value=excluded.value,revision=settings.revision+1,"
            "updated_at=excluded.updated_at",
            (f"source:{source}", json.dumps(value), stamp),
        )

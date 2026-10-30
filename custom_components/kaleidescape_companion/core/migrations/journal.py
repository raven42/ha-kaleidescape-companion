"""Backfill exact historical viewing links without guessing movie identities."""

import sqlite3

from ...playback.metadata import library_row


def link_viewings(db):
    factory = db.row_factory
    db.row_factory = sqlite3.Row
    try:
        _link_viewings(db)
    finally:
        db.row_factory = factory


def _link_viewings(db):
    sources = [row[0] for row in db.execute("SELECT id FROM library_sources LIMIT 2")]
    changed = 0
    for viewing in db.execute(
        "SELECT * FROM viewings v WHERE library_title_id IS NULL "
        "AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM sessions s "
        "WHERE s.viewing_id=v.id AND s.closed_at IS NULL)"
    ):
        # Older observed rows identify HA, not the browser origin. Only bridge
        # those automatically when there is one unambiguous cached source.
        source = viewing["source_id"]
        if source == "home_assistant":
            source = sources[0] if len(sources) == 1 else None
        row = library_row(db, viewing, source)
        if row is not None and not row["purchase_match_pending"]:
            db.execute(
                "UPDATE viewings SET library_title_id=?,revision=revision+1 WHERE id=?",
                (row["id"], viewing["id"]),
            )
            changed += 1
    if changed:
        db.execute("UPDATE schema_metadata SET revision=revision+1")

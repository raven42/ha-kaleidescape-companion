"""Helpers for tests that reconstruct pre-collection-queue database schemas."""


def remove_collection_queue_schema(db):
    """Remove schema-28 additions before marking a synthetic database older."""
    db.execute("DROP TABLE IF EXISTS collection_jobs")
    columns = {
        row[1] for row in db.execute("PRAGMA table_info(library_collection_intents)")
    }
    for name in ("operation", "other_collection", "expected_other_hash"):
        if name in columns:
            db.execute(f"ALTER TABLE library_collection_intents DROP COLUMN {name}")

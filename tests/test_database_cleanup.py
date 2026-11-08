"""Selected cleanup preserves pending work and durable retry barriers."""

import sqlite3
import unittest
from datetime import UTC, datetime, timedelta

from custom_components.kaleidescape_companion.core.database_cleanup import (
    clean,
    preview,
)
from custom_components.kaleidescape_companion.core.models import JournalError


class DatabaseCleanupTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE schema_metadata (revision INTEGER NOT NULL);
            INSERT INTO schema_metadata VALUES (7);
            CREATE TABLE calendar_reconcile_intents
                (request_id TEXT, state TEXT, updated_at TEXT);
            CREATE TABLE library_collection_intents
                (request_id TEXT, status TEXT, updated_at TEXT);
            CREATE TABLE collection_jobs (request_id TEXT, status TEXT);
            CREATE TABLE playback_controls
                (request_id TEXT, status TEXT, updated_at TEXT);
            CREATE TABLE requests (request_id TEXT);
            INSERT INTO requests VALUES ('barrier');
        """)
        old = (datetime.now(UTC) - timedelta(days=200)).isoformat()
        recent = datetime.now(UTC).isoformat()
        self.db.executemany(
            "INSERT INTO calendar_reconcile_intents VALUES (?, ?, ?)",
            [
                ("old-confirmed", "confirmed", old),
                ("old-reviewed", "reviewed", old),
                ("old-cancelled", "cancelled", old),
                ("old-uncertain", "uncertain", old),
                ("new-confirmed", "confirmed", recent),
                ("bad-date", "confirmed", "invalid"),
            ],
        )
        self.db.executemany(
            "INSERT INTO library_collection_intents VALUES (?, ?, ?)",
            [
                ("collection-complete", "confirmed", old),
                ("collection-uncertain", "uncertain", old),
                ("collection-active", "confirmed", old),
            ],
        )
        self.db.execute(
            "INSERT INTO collection_jobs VALUES ('collection-active', 'syncing')"
        )
        self.db.executemany(
            "INSERT INTO playback_controls VALUES (?, ?, ?)",
            [
                ("playback-complete", "finished", old),
                ("playback-reviewed", "reviewed", old),
                ("playback-uncertain", "uncertain", old),
                ("playback-sending", "sending", old),
            ],
        )
        self.db.commit()

    def test_selection_and_ages_preserve_pending_recent_and_barriers(self):
        policy = {"calendar": 180, "collections": 0, "playback": 90}
        review = preview(self.db, policy)
        self.assertEqual(
            review["counts"], {"calendar": 3, "collections": 0, "playback": 2}
        )
        result = clean(self.db, policy, review["as_of"], review["revision"])
        self.assertEqual(result["removed"], review["counts"])
        self.assertEqual(
            self.db.execute(
                "SELECT count(*) FROM library_collection_intents"
            ).fetchone()[0],
            3,
        )
        self.assertEqual(
            {r[0] for r in self.db.execute("SELECT request_id FROM playback_controls")},
            {"playback-uncertain", "playback-sending"},
        )
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM requests").fetchone()[0], 1
        )
        self.assertEqual(
            self.db.execute("SELECT revision FROM schema_metadata").fetchone()[0], 8
        )
        result = clean(self.db, {"collections": 30})
        self.assertEqual(result["removed"]["collections"], 1)
        self.assertEqual(
            self.db.execute(
                "SELECT count(*) FROM library_collection_intents"
            ).fetchone()[0],
            2,
        )

    def test_stale_review_invalid_policy_and_timestamp_rejected(self):
        review = preview(self.db, {"calendar": 90})
        for args in (
            ({"calendar": 90}, review["as_of"], 6),
            ({"calendar": -1}, review["as_of"], 7),
            ({"unknown": 30}, review["as_of"], 7),
            ({"calendar": 90}, "2099-01-01T00:00:00+00:00", 7),
        ):
            with self.assertRaises(JournalError):
                clean(self.db, *args)
        self.assertEqual(preview(self.db, {"calendar": 90})["counts"]["calendar"], 3)

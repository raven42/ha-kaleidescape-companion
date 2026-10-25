"""Deterministic observation and persistence acceptance scenarios."""

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from custom_components.kaleidescape_companion import migrations
from custom_components.kaleidescape_companion.repository import JournalRepository
from custom_components.kaleidescape_companion.tracker import (
    Observation,
    PlaybackTracker,
)


def observation(time, **overrides):
    return Observation(
        at=(datetime(2026, 10, 25, tzinfo=UTC) + timedelta(seconds=time)).isoformat(
            timespec="microseconds"
        ),
        monotonic=time,
        **{
            "content_id": "raw-A",
            "title": "Example A",
            "duration": 1000,
            "available": True,
            "play_status": "playing",
            "location": "content",
            **overrides,
        },
    )


class TrackerTest(unittest.TestCase):
    def test_title_change_before_content_id_does_not_confirm_wrong_credits(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        tracker.apply(observation(40, title="Example B", location="credits"))
        self.assertFalse(tracker.session.credits_seen)
        tracker.apply(
            observation(41, title="Example B", content_id="raw-B", location="credits")
        )
        self.assertIsNone(tracker.session)

    def test_pause_scan_and_repeated_credits(self):
        tracker = PlaybackTracker("player")
        self.assertEqual(tracker.apply(observation(0)), [])
        tracker.apply(observation(0.5))
        tracker.apply(observation(10, play_status="paused"))
        tracker.apply(observation(20))
        tracker.apply(observation(30, play_status="forward"))
        tracker.apply(observation(40))
        result = tracker.apply(observation(60, location="credits"))[-1]
        self.assertAlmostEqual(result["watched_seconds"], 39.5)
        self.assertTrue(result["credits_confirmed"])
        tracker.apply(observation(100, location="credits"))
        self.assertAlmostEqual(tracker.session.watched_seconds, 39.5)
        self.assertEqual(tracker.session.id, result["id"])

    def test_identity_rollover_does_not_attach_old_credits_to_new_film(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        ended = tracker.apply(
            observation(10, content_id="raw-B", title="Example B", location="credits")
        )[-1]
        self.assertEqual(ended["end_reason"], "identity_changed")
        self.assertFalse(ended["credits_seen"])
        self.assertIsNone(tracker.session)
        tracker.apply(observation(20, content_id="raw-B", title="Example B"))
        tracker.apply(observation(20.5, content_id="raw-B", title="Example B"))
        self.assertEqual(tracker.session.raw_content_id, "raw-B")
        self.assertEqual(tracker.session.watched_seconds, 0)

    def test_missing_identity_and_overflow_never_count_the_gap(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        tracker.apply(observation(10, content_id=None))
        tracker.apply(observation(100, content_id=None, location="credits"))
        tracker.apply(observation(110))
        tracker.apply(observation(110.5))
        tracker.apply(tracker.gap(observation(500)))
        self.assertAlmostEqual(tracker.session.watched_seconds, 9.5)
        self.assertFalse(tracker.session.credits_seen)
        self.assertGreaterEqual(tracker.session.gap_count, 2)

    def test_short_stop_grace_and_stable_new_session(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        original = tracker.session.id
        tracker.apply(observation(10, location="none"))
        tracker.apply(observation(11))
        self.assertEqual(tracker.session.id, original)
        tracker.apply(observation(20, location="none"))
        ended = tracker.apply(observation(22, location="none"))[-1]
        self.assertAlmostEqual(ended["watched_seconds"], 18.5)
        self.assertEqual(ended["closed_at"], observation(20).at)
        tracker.apply(observation(30))
        tracker.apply(observation(30.5))
        self.assertNotEqual(tracker.session.id, original)

    def test_paused_credits_are_evidence_until_normal_playback_confirms(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0))
        tracker.apply(observation(0.5))
        tracker.apply(observation(20, play_status="paused", location="credits"))
        self.assertTrue(tracker.session.credits_seen)
        self.assertFalse(tracker.session.credits_confirmed)
        tracker.apply(observation(30, location="credits"))
        self.assertTrue(tracker.session.credits_confirmed)
        self.assertEqual(tracker.session.watched_seconds, 19.5)


class AutomaticRepositoryTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "journal.sqlite3"
        self.repository = JournalRepository(self.path)
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)
        self.tracker = PlaybackTracker("player-one")
        self.minimum = 30
        self.resume = 24

    async def apply(self, time, **overrides):
        for snapshot in self.tracker.apply(observation(time, **overrides)):
            await self.repository.async_save_session(
                snapshot, self.minimum, self.resume
            )

    async def records(self):
        return (await self.repository.async_list())["items"]

    async def test_completion_and_rewatch_after_a_real_stop(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(40, location="credits")
        records = await self.records()
        self.assertEqual(records[0]["status"], "completed")
        self.assertEqual(records[0]["completion_reason"], "credits")
        await self.apply(80, location="credits")
        self.assertEqual(len(await self.records()), 1)
        await self.apply(90, location="none")
        await self.apply(92, location="none")
        await self.apply(100)
        await self.apply(100.5)
        self.assertEqual(len(await self.records()), 2)

    async def test_incomplete_resume_merges_exact_identity_only(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(10, location="none")
        await self.apply(12, location="none")
        await self.apply(20)
        await self.apply(20.5)
        await self.apply(50, location="credits")
        records = await self.records()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "completed")
        self.assertAlmostEqual(records[0]["watched_seconds"], 39)
        sessions = await self.repository.async_sessions(records[0]["id"])
        self.assertEqual(len(sessions["items"]), 2)
        await self.apply(60, content_id="other-edition")
        await self.apply(60.5, content_id="other-edition")
        self.assertEqual(len(await self.records()), 2)

    async def test_threshold_is_evaluated_at_credits_not_later_main_content(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(5, location="credits")
        await self.apply(10)
        await self.apply(50)
        self.assertEqual((await self.records())[0]["status"], "partial")
        await self.apply(51, location="credits")
        self.assertEqual((await self.records())[0]["status"], "completed")

    async def test_manual_corrections_and_tombstones_survive_checkpoints(self):
        await self.apply(0)
        await self.apply(0.5)
        record = (await self.records())[0]
        await self.repository.async_update(
            str(uuid4()),
            record["id"],
            record["revision"],
            {"title": "Corrected", "status": "partial", "watched_seconds": 7},
        )
        await self.apply(60, location="credits")
        record = (await self.records())[0]
        self.assertEqual(
            (record["title"], record["status"], record["watched_seconds"]),
            ("Corrected", "partial", 7),
        )
        await self.repository.async_delete(
            str(uuid4()), record["id"], record["revision"]
        )
        await self.apply(100, location="credits")
        await self.apply(110)
        await self.apply(140)
        self.assertEqual(await self.records(), [])
        await self.apply(150, location="none")
        await self.apply(152, location="none")
        await self.apply(160)
        await self.apply(160.5)
        self.assertEqual(len(await self.records()), 1)

    async def test_restart_recovers_checkpoint_without_downtime_or_duplicates(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(31)
        session = await self.repository.async_open_session("player-one")
        original = session["id"]
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        await self.repository.async_open()
        self.addAsyncCleanup(self.repository.async_close)
        self.tracker = PlaybackTracker("player-one")
        self.tracker.restore(session)
        await self.apply(500)
        await self.apply(500.5)
        await self.apply(510, location="credits")
        record = (await self.records())[0]
        self.assertAlmostEqual(record["watched_seconds"], 40)
        recovered = await self.repository.async_open_session("player-one")
        self.assertEqual(recovered["id"], original)
        self.assertGreater(recovered["gap_count"], 0)
        snapshot = self.tracker.session.snapshot()
        before = (await self.repository.async_info())["revision"]
        await self.repository.async_save_session(snapshot, 30, 24)
        self.assertEqual(before, (await self.repository.async_info())["revision"])

    async def test_different_players_do_not_merge(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(10, location="none")
        await self.apply(12, location="none")
        self.tracker = PlaybackTracker("player-two")
        await self.apply(20)
        await self.apply(20.5)
        self.assertEqual(len(await self.records()), 2)

    async def test_partial_merge_window_can_be_disabled_or_expire(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(10, location="none")
        await self.apply(12, location="none")
        self.resume = 0
        await self.apply(20)
        await self.apply(20.5)
        self.assertEqual(len(await self.records()), 2)
        await self.apply(30, location="none")
        await self.apply(32, location="none")
        self.resume = 24
        await self.apply(90000)
        await self.apply(90000.5)
        self.assertEqual(len(await self.records()), 3)

    async def test_json_export_includes_session_evidence(self):
        await self.apply(0)
        await self.apply(0.5)
        await self.apply(40, location="credits")
        path = await self.repository.async_export("json")
        self.addCleanup(path.unlink, missing_ok=True)
        data = json.loads(path.read_text())
        self.assertTrue(data["sessions"][0]["credits_confirmed"])
        self.assertEqual(data["viewings"][0]["origin"], "observed")


class UpgradeTest(unittest.TestCase):
    def test_v1_manual_data_and_retry_results_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "journal.sqlite3"
            with closing(sqlite3.connect(path)) as db:
                with patch.object(migrations, "SCHEMA_VERSION", 1):
                    migrations.migrate(db, path)
                dataset = db.execute(
                    "SELECT dataset_id FROM schema_metadata"
                ).fetchone()[0]
                with db:
                    db.execute(
                        "INSERT INTO viewings VALUES (?, ?, ?, ?, NULL, NULL, 60, "
                        "'completed', NULL, NULL, NULL, '', 'manual', ?, ?, 1, NULL)",
                        (
                            "old-record",
                            "Manual film",
                            "manual film",
                            observation(0).at,
                            observation(0).at,
                            observation(0).at,
                        ),
                    )
                    db.execute(
                        "INSERT INTO requests VALUES "
                        "('request', 'fingerprint', 'original-response')"
                    )
                migrations.migrate(db, path)
                self.assertEqual(
                    db.execute("PRAGMA user_version").fetchone()[0],
                    migrations.SCHEMA_VERSION,
                )
                self.assertEqual(
                    db.execute("SELECT dataset_id FROM schema_metadata").fetchone()[0],
                    dataset,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT title, origin, completion_reason FROM viewings"
                    ).fetchone(),
                    ("Manual film", "manual", "manual"),
                )
                self.assertEqual(
                    db.execute("SELECT response FROM requests").fetchone()[0],
                    "original-response",
                )
                self.assertTrue(list(path.parent.glob("*.bak")))

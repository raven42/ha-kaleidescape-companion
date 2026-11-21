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

from custom_components.kaleidescape_companion.core import migrations
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.playback.tracker import (
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

    def test_each_session_has_its_own_stop_grace(self):
        tracker = PlaybackTracker("player")
        for time in (0, 0.5):
            tracker.apply(observation(time))
        for time in (10, 12):
            tracker.apply(observation(time, location="none"))
        self.assertIsNone(tracker.session)
        for time in (20, 20.5):
            tracker.apply(observation(time))
        session_id = tracker.session.id
        tracker.apply(observation(21, location="none"))
        tracker.apply(observation(22, location="none"))
        self.assertEqual(tracker.session.id, session_id)
        ended = tracker.apply(observation(23, location="none"))[-1]
        self.assertEqual(ended["closed_at"], observation(21).at)
        self.assertAlmostEqual(ended["watched_seconds"], 0.5)
        self.assertIsNone(tracker.session)

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
        # Inspect recorder persistence, including short diagnostic attempts.
        return await self.repository._call(
            lambda: [
                dict(row)
                for row in self.repository._db().execute(
                    "SELECT * FROM viewings WHERE deleted_at IS NULL "
                    "ORDER BY started_at DESC"
                )
            ]
        )

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
        await self.apply(610, location="none")
        await self.apply(612, location="none")
        await self.apply(620)
        await self.apply(620.5)
        await self.apply(650, location="credits")
        records = await self.records()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "completed")
        self.assertAlmostEqual(records[0]["watched_seconds"], 639)
        sessions = await self.repository.async_sessions(records[0]["id"])
        self.assertEqual(len(sessions["items"]), 2)
        await self.apply(660, content_id="other-edition")
        await self.apply(660.5, content_id="other-edition")
        self.assertEqual(len(await self.records()), 2)

    async def test_resume_waits_for_qualification_and_anchors_at_stop(self):
        from custom_components.kaleidescape_companion.playback.tracker import Session

        base = datetime(2026, 10, 25, tzinfo=UTC)

        def stamp(seconds):
            return (base + timedelta(seconds=seconds)).isoformat(
                timespec="microseconds"
            )

        def session(start, end, watched):
            return Session(
                id=str(uuid4()),
                player_id="player-one",
                raw_content_id="raw-A",
                title="Example A",
                duration_seconds=20000,
                started_at=stamp(start),
                last_observed_at=stamp(end),
                boot_id="boot",
                watched_seconds=watched,
                closed_at=stamp(end),
                end_reason="stopped",
                revision=1,
            ).snapshot()

        first = session(0, 7200, 3600)
        first_id = await self.repository.async_save_session(first, 30, 24)
        short = session(8000, 8021, 21)
        short_id = await self.repository.async_save_session(short, 30, 24)
        self.assertNotEqual(first_id, short_id)
        self.assertEqual(len((await self.repository.async_list())["items"]), 1)
        # 2.5 hours from start, but only 30 minutes from the actual stop.
        continued = session(9000, 9001, 1)
        provisional = await self.repository.async_save_session(continued, 30, 24)
        self.assertNotEqual(provisional, first_id)
        continued.update(
            watched_seconds=601,
            revision=2,
            closed_at=stamp(9601),
            last_observed_at=stamp(9601),
        )
        merged = await self.repository.async_save_session(continued, 30, 24)
        self.assertEqual(merged, first_id)
        self.assertEqual(
            len((await self.repository.async_sessions(first_id))["items"]), 2
        )
        self.assertEqual(
            (await self.repository.async_get(first_id))["watched_seconds"], 4201
        )

    async def test_short_attempt_does_not_extend_resume_window(self):
        from custom_components.kaleidescape_companion.playback.tracker import Session

        base = datetime(2026, 10, 25, tzinfo=UTC)

        def snapshot(start, seconds):
            opened = base + timedelta(seconds=start)
            closed = opened + timedelta(seconds=seconds)
            return Session(
                id=str(uuid4()),
                player_id="player-one",
                raw_content_id="raw-A",
                title="Example A",
                duration_seconds=7200,
                started_at=opened.isoformat(),
                last_observed_at=closed.isoformat(),
                boot_id="boot",
                watched_seconds=seconds,
                closed_at=closed.isoformat(),
                end_reason="stopped",
                revision=1,
            ).snapshot()

        first = await self.repository.async_save_session(snapshot(0, 600), 30, 24)
        await self.repository.async_save_session(snapshot(4000, 21), 30, 24)
        later = await self.repository.async_save_session(snapshot(4500, 600), 30, 24)
        self.assertNotEqual(first, later)
        self.assertEqual(len((await self.repository.async_list())["items"]), 2)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 2)

    async def test_partial_minimum_controls_visibility_and_resume(self):
        from custom_components.kaleidescape_companion.playback.tracker import Session

        base = datetime(2026, 10, 25, tzinfo=UTC)

        def snapshot(start):
            opened = base + timedelta(seconds=start)
            ended = opened + timedelta(seconds=180)
            return Session(
                id=str(uuid4()),
                player_id="player-one",
                raw_content_id="raw-A",
                title="Example A",
                duration_seconds=7200,
                started_at=opened.isoformat(),
                last_observed_at=ended.isoformat(),
                boot_id="boot",
                watched_seconds=180,
                closed_at=ended.isoformat(),
                end_reason="stopped",
                revision=1,
            ).snapshot()

        first = await self.repository.async_save_session(snapshot(0), 30, 1)
        self.assertEqual((await self.repository.async_list())["items"], [])
        await self.repository.async_partial_minimum(2)
        self.assertEqual(len((await self.repository.async_list())["items"]), 1)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)
        resumed = await self.repository.async_save_session(snapshot(600), 30, 1)
        self.assertEqual(first, resumed)
        self.assertEqual(len((await self.repository.async_sessions(first))["items"]), 2)
        await self.repository.async_partial_minimum(4)
        self.assertEqual((await self.repository.async_list())["items"], [])

    async def test_legacy_group_of_short_attempts_is_not_a_viewing(self):
        from custom_components.kaleidescape_companion.playback.tracker import Session

        base = datetime(2026, 10, 25, tzinfo=UTC)
        ids = []
        for hour in (0, 1, 2):
            start = base + timedelta(hours=hour)
            end = start + timedelta(seconds=250)
            snap = Session(
                id=str(uuid4()),
                player_id="player-one",
                raw_content_id="raw-A",
                title="Example A",
                duration_seconds=7200,
                started_at=start.isoformat(),
                last_observed_at=end.isoformat(),
                boot_id="boot",
                watched_seconds=250,
                closed_at=end.isoformat(),
                end_reason="stopped",
                revision=1,
            ).snapshot()
            ids.append(
                (await self.repository.async_save_session(snap, 30, 24), snap["id"])
            )

        def legacy_group():
            db = self.repository._db()
            for viewing_id, session_id in ids[1:]:
                db.execute(
                    "UPDATE sessions SET viewing_id=? WHERE id=?",
                    (ids[0][0], session_id),
                )
                db.execute(
                    "UPDATE viewings SET deleted_at=? WHERE id=?",
                    (base.isoformat(), viewing_id),
                )
            db.execute(
                "UPDATE viewings SET watched_seconds=750 WHERE id=?", (ids[0][0],)
            )
            db.commit()

        await self.repository._call(legacy_group)
        self.assertEqual((await self.repository.async_list())["items"], [])
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)
        self.assertEqual(
            len((await self.repository.async_sessions(ids[0][0]))["items"]), 3
        )

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

"""Movie-runtime admission is separate from completion and accumulated watch time."""

import unittest
from uuid import uuid4

import test_repository as repository_tests
from test_tracking import observation

from custom_components.kaleidescape_companion.tracker import PlaybackTracker


class RuntimeFilterTest(unittest.TestCase):
    def test_default_cutoff_uses_total_runtime_and_includes_exactly_ten_minutes(self):
        for duration in (0, 120, 599.999, 600, 7200):
            with self.subTest(duration=duration):
                tracker = PlaybackTracker("player")
                tracker.apply(observation(0, duration=duration))
                created = tracker.apply(observation(0.5, duration=duration))
                if duration < 600:
                    self.assertEqual(created, [])
                    self.assertIsNone(tracker.session)
                else:
                    self.assertEqual(len(created), 1)
                    self.assertEqual(created[0]["watched_seconds"], 0)

    def test_unknown_or_late_short_runtime_never_opens_a_session(self):
        tracker = PlaybackTracker("player")
        for time in (0, 0.5, 30):
            self.assertEqual(tracker.apply(observation(time, duration=None)), [])
        for time in (31, 31.5, 60):
            self.assertEqual(tracker.apply(observation(time, duration=120)), [])
        self.assertEqual(
            tracker.apply(observation(120, duration=120, location="credits")), []
        )
        self.assertEqual(tracker.finish(observation(121, duration=120)), [])
        self.assertIsNone(tracker.session)

    def test_late_eligible_runtime_starts_after_settling_without_backfilling(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0, duration=None))
        tracker.apply(observation(30, duration=600))
        created = tracker.apply(observation(30.5, duration=600))[-1]
        self.assertEqual(created["started_at"], observation(30.5).at)
        self.assertEqual(created["watched_seconds"], 0)

    def test_custom_cutoff_and_disabled_filter(self):
        tracker = PlaybackTracker("player", minimum_runtime_seconds=1200)
        tracker.apply(observation(0, duration=1000))
        self.assertEqual(tracker.apply(observation(0.5, duration=1000)), [])
        tracker.apply(observation(1, duration=1200))
        self.assertEqual(len(tracker.apply(observation(1.5, duration=1200))), 1)
        for duration in (None, 0, 120):
            with self.subTest(duration=duration):
                tracker = PlaybackTracker("player", minimum_runtime_seconds=0)
                tracker.apply(observation(0, duration=duration))
                self.assertEqual(
                    len(tracker.apply(observation(0.5, duration=duration))), 1
                )

    def test_missing_runtime_suspends_one_session_without_counting_the_gap(self):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0, duration=600))
        tracker.apply(observation(0.5, duration=600))
        session_id = tracker.session.id
        for time in (10, 20, 25):
            tracker.apply(
                observation(
                    time,
                    duration=None,
                    location="credits" if time == 20 else "content",
                )
            )
        self.assertEqual(tracker.session.gap_count, 1)
        self.assertFalse(tracker.session.credits_confirmed)
        self.assertAlmostEqual(tracker.session.watched_seconds, 9.5)
        tracker.apply(observation(30, duration=600))
        tracker.apply(observation(30.5, duration=600))
        result = tracker.apply(observation(40, duration=600, location="credits"))[-1]
        self.assertEqual(result["id"], session_id)
        self.assertAlmostEqual(result["watched_seconds"], 19)

    def test_short_playback_on_the_same_id_closes_the_movie_and_cannot_confirm_credits(
        self,
    ):
        tracker = PlaybackTracker("player")
        tracker.apply(observation(0, duration=600))
        tracker.apply(observation(0.5, duration=600))
        ended = tracker.apply(observation(10, duration=120, location="credits"))[-1]
        self.assertEqual(ended["end_reason"], "below_minimum_runtime")
        self.assertFalse(ended["credits_confirmed"])
        self.assertAlmostEqual(ended["watched_seconds"], 9.5)
        self.assertIsNone(tracker.session)
        self.assertEqual(tracker.apply(observation(100, duration=120)), [])


class RuntimeFilterStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp

    async def process(self, tracker, time, **values):
        for snapshot in tracker.apply(observation(time, **values)):
            await self.repository.async_save_session(snapshot, 1, 24)

    async def test_trailers_create_no_viewings_and_manual_short_entries_remain_allowed(
        self,
    ):
        tracker = PlaybackTracker("player")
        for time, values in (
            (0, {"duration": None}),
            (0.5, {"duration": None}),
            (1, {"duration": 120}),
            (1.5, {"duration": 120}),
            (120, {"duration": 120, "location": "credits"}),
        ):
            await self.process(tracker, time, **values)
        self.assertEqual((await self.repository.async_list())["items"], [])
        self.assertEqual((await self.repository.async_info())["revision"], 0)
        record = await self.repository.async_create(
            str(uuid4()),
            {
                "title": "Explicit fictional short",
                "duration_seconds": 120,
                "started_at": observation(0).at,
            },
        )
        self.assertEqual(record["viewing"]["duration_seconds"], 120)

    async def test_filtering_an_intervening_trailer_preserves_partial_resume(self):
        tracker = PlaybackTracker("player")
        for time, duration in (
            (0, 600),
            (0.5, 600),
            (10, 120),
            (30, 120),
            (60, 600),
            (60.5, 600),
        ):
            await self.process(tracker, time, duration=duration)
        await self.process(tracker, 70, duration=600, location="credits")
        records = (await self.repository.async_list())["items"]
        self.assertEqual(len(records), 1)
        self.assertAlmostEqual(records[0]["watched_seconds"], 19)
        sessions = (await self.repository.async_sessions(records[0]["id"]))["items"]
        self.assertEqual(len(sessions), 2)
        self.assertEqual(sessions[-1]["end_reason"], "below_minimum_runtime")

    async def test_reload_higher_cutoff_retains_history_without_new_entry(
        self,
    ):
        original = PlaybackTracker("player", minimum_runtime_seconds=0)
        await self.process(original, 0, duration=120)
        await self.process(original, 0.5, duration=120)
        recovered = await self.repository.async_open_session("player")
        tracker = PlaybackTracker("player")
        tracker.restore(recovered)
        await self.process(tracker, 100, duration=120)
        await self.process(tracker, 130, duration=120, location="credits")
        records = (await self.repository.async_list())["items"]
        self.assertEqual(len(records), 1)
        self.assertIsNone(records[0]["deleted_at"])
        self.assertEqual(records[0]["status"], "partial")
        self.assertIsNone(await self.repository.async_open_session("player"))

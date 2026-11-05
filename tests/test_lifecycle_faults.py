"""Offline lifecycle fault injection with fictional owners."""

import asyncio
import unittest
from contextlib import ExitStack
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, Mock, patch

from custom_components.kaleidescape_companion import (
    _async_close_runtime,
    async_setup_entry,
)
from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)

PREFIX = "custom_components.kaleidescape_companion"
NAMES = ("controls", "calendar", "enrichment", "library", "observer", "repository")


def runtime(events, failed=None, failure=RuntimeError("fictional")):
    owners = {}
    for name in NAMES:

        async def operation(*args, name=name):
            events.append(name)
            if name == failed:
                raise failure

        owners[name] = NS(
            async_stop=operation,
            async_close=operation,
            async_resume=operation,
            async_pause=AsyncMock(),
        )
    return NS(ready=True, **owners)


class LifecycleFaultTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        for logger in (f"{PREFIX}._LOGGER.error", f"{PREFIX}.backup._LOGGER.error"):
            patcher = patch(logger)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def test_each_stop_failure_still_closes_every_owner_in_order(self):
        for failed in NAMES:
            for failure in (RuntimeError("private"), asyncio.CancelledError()):
                with self.subTest(failed=failed, failure=type(failure)):
                    events = []
                    item = runtime(events, failed, failure)
                    with self.assertRaises(type(failure)):
                        await _async_close_runtime(item)
                    self.assertFalse(item.ready)
                    self.assertEqual(events, list(NAMES))

    async def test_repeated_cancellation_does_not_interrupt_cleanup(self):
        events = []
        item = runtime(events)
        entered, release = asyncio.Event(), asyncio.Event()

        async def blocked():
            events.append("controls")
            entered.set()
            await release.wait()

        item.controls.async_stop = blocked
        task = asyncio.create_task(_async_close_runtime(item))
        await entered.wait()
        task.cancel()
        await asyncio.sleep(0)
        task.cancel()
        release.set()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(events, list(NAMES))

    async def test_each_resume_failure_attempts_all_resumes(self):
        expected = [
            "repository",
            "controls",
            "observer",
            "enrichment",
            "library",
            "calendar",
        ]
        for failed in expected:
            with self.subTest(failed=failed):
                events = []
                item = runtime(events, failed)
                with patch(
                    f"{PREFIX}.backup.loaded_runtimes", return_value=[("entry", item)]
                ):
                    with self.assertRaises(RuntimeError):
                        await async_post_backup(None)
                self.assertEqual(events, expected)

    async def test_failed_pause_recovers_all_owners_even_when_resume_fails(self):
        events = []
        item = runtime(events, "observer")
        item.calendar.async_pause.side_effect = ValueError("preparation")
        with patch(f"{PREFIX}.backup.loaded_runtimes", return_value=[("entry", item)]):
            with self.assertRaisesRegex(ValueError, "preparation"):
                await async_pre_backup(None)
        self.assertEqual(
            events,
            ["repository", "controls", "observer", "enrichment", "library", "calendar"],
        )

    async def test_setup_cancellation_during_blueprint_and_refused_rollback(self):
        for refused in (False, True):
            with self.subTest(refused=refused):
                repo = NS(
                    async_open=AsyncMock(),
                    async_seed_ui_preferences=AsyncMock(),
                    async_metadata_sources=AsyncMock(),
                    async_info=AsyncMock(return_value={"dataset_id": "fixture"}),
                    async_recording_library=AsyncMock(),
                    async_close=AsyncMock(),
                )
                controls = NS(async_start=AsyncMock(), async_stop=AsyncMock())
                calendar = NS(async_start=AsyncMock(), async_stop=AsyncMock())
                entries = NS(
                    async_forward_entry_setups=AsyncMock(),
                    async_unload_platforms=AsyncMock(return_value=not refused),
                )
                hass = NS(
                    config=NS(path=Mock(return_value="/tmp/fixture")),
                    data={
                        "kaleidescape_companion.api_registered": True,
                        "blueprint": {"automation": object()},
                    },
                    config_entries=entries,
                    bus=NS(async_listen_once=Mock(return_value=Mock())),
                )
                entry = NS(
                    title="Companion", options={}, data={}, async_on_unload=Mock()
                )
                entered = asyncio.Event()

                async def blueprint(*args):
                    entered.set()
                    await asyncio.Future()

                with ExitStack() as stack:
                    for name, replacement in {
                        "loaded_runtimes": Mock(return_value=[]),
                        "JournalRepository": Mock(return_value=repo),
                        "PlaybackControls": Mock(return_value=controls),
                        "CalendarPublisher": Mock(return_value=calendar),
                        "async_setup_panel": AsyncMock(return_value=True),
                        "async_remove_panel": Mock(),
                        "async_register_services": Mock(),
                        "async_install_missing": blueprint,
                    }.items():
                        stack.enter_context(patch(f"{PREFIX}.{name}", replacement))
                    task = asyncio.create_task(async_setup_entry(hass, entry))
                    await entered.wait()
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                self.assertEqual(entry.runtime_data.ready, refused)
                self.assertEqual(repo.async_close.await_count, 0 if refused else 1)
                self.assertEqual(controls.async_stop.await_count, 0 if refused else 1)
                entry.async_on_unload.assert_not_called()
                self.assertEqual(
                    hass.bus.async_listen_once.return_value.call_count,
                    0 if refused else 1,
                )

"""Privacy and ownership checks for operational logging."""

import asyncio
import logging
import tempfile
import threading
import traceback
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from homeassistant.exceptions import ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers.update_coordinator import UpdateFailed

from custom_components.kaleidescape_companion import async_setup_entry
from custom_components.kaleidescape_companion.calendar.publisher import (
    CalendarPublisher,
)
from custom_components.kaleidescape_companion.core.logging import safe_exception
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.diagnostics import (
    async_get_config_entry_diagnostics,
)
from custom_components.kaleidescape_companion.library.sync import LibrarySync
from custom_components.kaleidescape_companion.sensor import HistoryCoordinator
from custom_components.kaleidescape_companion.ui.settings_transfer import transfer
from custom_components.kaleidescape_companion.ui.websocket import async_handle

SECRET = "private-title-token-192.168.1.42"
NAMESPACE = "custom_components.kaleidescape_companion"


def chained_error():
    try:
        raise OSError(SECRET)
    except OSError as cause:
        try:
            raise JournalError("storage_error", SECRET) from cause
        except JournalError as error:
            return error


class LoggingTest(unittest.IsolatedAsyncioTestCase):
    def test_safe_exception_does_not_render_message_or_chain(self):
        summary = safe_exception(chained_error())
        self.assertIn("JournalError", summary)
        self.assertNotIn(SECRET, summary)

    async def test_coordinator_suppresses_unsafe_chain_in_formatted_traceback(self):
        coordinator = object.__new__(HistoryCoordinator)
        coordinator.repository = SimpleNamespace(
            async_history_summary=AsyncMock(side_effect=chained_error())
        )
        with self.assertRaises(UpdateFailed) as caught:
            await coordinator._async_update_data()
        rendered = "".join(traceback.format_exception(caught.exception))
        self.assertIn("Journal history is unavailable", rendered)
        self.assertNotIn(SECRET, rendered)

    async def test_diagnostics_survives_storage_failure_without_private_values(self):
        runtime = SimpleNamespace(
            ready=True,
            repository=SimpleNamespace(
                async_info=AsyncMock(side_effect=chained_error())
            ),
        )
        with self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs:
            result = await async_get_config_entry_diagnostics(
                None, SimpleNamespace(runtime_data=runtime)
            )
        self.assertFalse(result["storage_available"])
        self.assertNotIn(SECRET, str(result) + str(logs.output))
        self.assertTrue(all(record.exc_info is None for record in logs.records))
        self.assertNotIn(SECRET, repr([record.__dict__ for record in logs.records]))

    async def test_setup_suppresses_private_storage_exception_chain(self):
        repository = SimpleNamespace(
            async_open=AsyncMock(side_effect=chained_error()), async_close=AsyncMock()
        )
        hass = SimpleNamespace(config=SimpleNamespace(path=Mock(return_value=SECRET)))
        entry = SimpleNamespace(title="Companion", options={}, data={})
        with (
            patch(f"{NAMESPACE}.loaded_runtimes", return_value=[]),
            patch(f"{NAMESPACE}.JournalRepository", return_value=repository),
            self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
        ):
            with self.assertRaises(ConfigEntryNotReady) as caught:
                await async_setup_entry(hass, entry)
        rendered = "".join(traceback.format_exception(caught.exception))
        self.assertIn("Could not open the journal database", rendered)
        self.assertNotIn(SECRET, rendered + str(logs.output))

    async def test_initialization_keeps_exception_type_without_private_chain(self):
        repository = SimpleNamespace(
            async_open=AsyncMock(),
            async_seed_ui_preferences=AsyncMock(),
            async_metadata_sources=AsyncMock(),
            async_info=AsyncMock(return_value={"dataset_id": SECRET}),
            async_close=AsyncMock(),
        )
        controls = SimpleNamespace(
            async_start=AsyncMock(side_effect=RuntimeError(SECRET)),
            async_stop=AsyncMock(),
        )
        hass = SimpleNamespace(
            config=SimpleNamespace(path=Mock(return_value=SECRET)),
            data={},
            http=SimpleNamespace(register_view=Mock()),
        )
        entry = SimpleNamespace(title="Companion", options={}, data={})
        with (
            patch(f"{NAMESPACE}.loaded_runtimes", return_value=[]),
            patch(f"{NAMESPACE}.JournalRepository", return_value=repository),
            patch(f"{NAMESPACE}.async_register_commands"),
            patch(f"{NAMESPACE}.PlaybackControls", return_value=controls),
            self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
        ):
            with self.assertRaises(RuntimeError) as caught:
                await async_setup_entry(hass, entry)
        rendered = "".join(traceback.format_exception(caught.exception))
        self.assertNotIn(SECRET, rendered + repr([r.__dict__ for r in logs.records]))

    async def test_calendar_repeated_claim_failure_is_bounded_and_recovers(self):
        repository = SimpleNamespace(
            async_calendar_claim=AsyncMock(
                side_effect=[OSError(SECRET), OSError(SECRET), None]
            )
        )
        publisher = CalendarPublisher(
            Mock(), repository, SimpleNamespace(options={}, data={})
        )
        publisher.allowed = Mock(return_value=True)
        with self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs:
            await publisher._publish_one()
            await publisher._publish_one()
            await publisher._publish_one()
        self.assertEqual(sum(r.levelno >= logging.ERROR for r in logs.records), 1)
        self.assertTrue(any("recovered" in message for message in logs.output))
        self.assertNotIn(SECRET, str(logs.output))

    async def test_settings_transfer_log_omits_values_and_actor(self):
        repository = SimpleNamespace(async_transfer_settings=AsyncMock(return_value={}))
        entry = SimpleNamespace(options={}, data={})
        data = {
            "format": "companion-settings",
            "version": 1,
            "categories": {"shared": {"hidden_collections": [SECRET]}},
        }
        with self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs:
            await transfer(
                None, entry, repository, SECRET, "apply", ["shared"], data, SECRET
            )
        self.assertIn("Settings transfer processed", str(logs.output))
        self.assertNotIn(SECRET, repr([record.__dict__ for record in logs.records]))

    async def test_unexpected_websocket_failure_uses_ha_generic_response(self):
        connection = SimpleNamespace(
            user=SimpleNamespace(is_active=True, is_admin=True), send_error=Mock()
        )
        with (
            patch(
                f"{NAMESPACE}.ui.websocket.loaded_runtimes",
                side_effect=RuntimeError(SECRET),
            ),
            self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
        ):
            await async_handle(
                None, connection, {"id": 1, "type": f"{NAMESPACE.split('.')[-1]}/info"}
            )
        connection.send_error.assert_called_once_with(
            1, "unknown_error", "Unknown error"
        )
        self.assertNotIn(SECRET, repr([record.__dict__ for record in logs.records]))

    async def test_websocket_preserves_ha_timeout_and_error_responses(self):
        for error, code, message in (
            (TimeoutError(SECRET), "timeout", "Timeout"),
            (HomeAssistantError(SECRET), "home_assistant_error", SECRET),
        ):
            connection = SimpleNamespace(
                user=SimpleNamespace(is_active=True, is_admin=True), send_error=Mock()
            )
            with (
                self.subTest(code=code),
                patch(f"{NAMESPACE}.ui.websocket.loaded_runtimes", side_effect=error),
                self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
            ):
                await async_handle(
                    None, connection, {"id": 1, "type": "kaleidescape_companion/info"}
                )
                self.assertEqual(
                    connection.send_error.call_args.args, (1, code, message)
                )
                self.assertNotIn(SECRET, repr([r.__dict__ for r in logs.records]))

    async def test_cancelled_caller_does_not_hide_worker_failure(self):
        entered = threading.Event()
        release = threading.Event()

        def fail():
            entered.set()
            release.wait(5)
            raise OSError(SECRET)

        with tempfile.TemporaryDirectory() as directory:
            repository = JournalRepository(Path(directory) / "journal.sqlite3")
            loop = asyncio.get_running_loop()
            with (
                self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
                patch.object(loop, "call_exception_handler") as unhandled,
            ):
                task = asyncio.create_task(repository._call(fail))
                self.assertTrue(await asyncio.to_thread(entered.wait, 5))
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                release.set()
                await repository.async_close()
                unhandled.assert_not_called()
            self.assertTrue(
                any("stopped waiting" in message for message in logs.output)
            )
            self.assertNotIn(SECRET, repr([record.__dict__ for record in logs.records]))

    async def test_library_reports_failure_once_and_recovery(self):
        sync = LibrarySync(Mock(), Mock(), {"library_host": ""})
        sync.paused = True
        sync._sync = AsyncMock(side_effect=[OSError(SECRET), OSError(SECRET), None])
        with self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs:
            await sync._run()
            await sync._run()
            await sync._run()
        errors = [record for record in logs.records if record.levelno >= logging.ERROR]
        self.assertEqual(len(errors), 1)
        self.assertTrue(any("recovered" in message for message in logs.output))
        self.assertNotIn(SECRET, str(logs.output))

    async def test_calendar_reports_uncertain_action_and_records_receipt(self):
        repository = SimpleNamespace(
            async_calendar_claim=AsyncMock(return_value={"id": SECRET}),
            async_calendar_finish=AsyncMock(),
        )
        hass = SimpleNamespace(
            services=SimpleNamespace(
                async_call=AsyncMock(side_effect=TimeoutError(SECRET))
            )
        )
        publisher = CalendarPublisher(
            hass, repository, SimpleNamespace(options={}, data={})
        )
        publisher.allowed = Mock(return_value=True)
        with (
            patch(
                "custom_components.kaleidescape_companion.calendar.publisher.event_data",
                return_value={},
            ),
            patch(
                "custom_components.kaleidescape_companion.calendar.publisher.target",
                return_value=None,
            ),
            self.assertLogs(NAMESPACE, level=logging.DEBUG) as logs,
        ):
            await publisher._publish_one()
        repository.async_calendar_finish.assert_awaited_once_with(SECRET, "uncertain")
        self.assertTrue(any("uncertain" in message for message in logs.output))
        self.assertNotIn(SECRET, str(logs.output))

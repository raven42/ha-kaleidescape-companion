"""Missing-data notifications use the Library filter's group-level rules."""

import asyncio
import json
import sqlite3
import unittest
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import test_library as library
from homeassistant.core import HomeAssistant

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library import sync as sync_module


class LibraryNotificationTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = library.LibraryStorageTest.asyncSetUp
    connector = library.LibrarySyncTest.connector
    seed = library.LibraryStorageTest.seed

    async def test_creates_and_resolves_a_real_home_assistant_notification(self):
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        hass = HomeAssistant(str(self.path.parent))
        self.addAsyncCleanup(hass.async_stop, force=True)
        sync.hass = hass
        with self.assertLogs(sync_module.__name__, level="INFO") as logs:
            await sync._run()
        self.assertTrue(
            any(
                "2 movies missing metadata or artwork (metadata=0, artwork=2)" in line
                for line in logs.output
            )
        )
        self.assertNotIn(library.ROWS[0]["title"], str(logs.output))
        self.assertIn("View library with missing metadata filter", str(logs.output))
        self.assertIn(sync_module.MISSING_LIBRARY_LINK, str(logs.output))
        notices = (
            sync_module.persistent_notification._async_get_or_create_notifications(hass)
        )
        notice = notices[sync_module.MISSING_NOTICE_ID]
        self.assertIn(library.ROWS[0]["title"], notice["message"])
        self.assertIn(
            "[View library with missing metadata filter]"
            f"({sync_module.MISSING_LIBRARY_LINK})",
            notice["message"],
        )
        self.assertIn("missing metadata or artwork", notice["title"])
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET enrichment=? WHERE source_id=?",
                (
                    json.dumps(
                        {"unavailable_artwork": {"poster": True, "backdrop": True}}
                    ),
                    library.SOURCE,
                ),
            )
        sync._sync = AsyncMock()
        await sync._run()
        self.assertNotIn(sync_module.MISSING_NOTICE_ID, notices)

    async def test_startup_manual_and_scheduled_sync_update_same_notice(self):
        await self.repository.async_metadata_sources({"metadata_store_enabled": True})
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        sync.hass.async_create_background_task = lambda coro, name: asyncio.create_task(
            coro
        )
        session = SimpleNamespace(detach=Mock())
        with (
            patch.object(
                sync_module, "async_create_clientsession", return_value=session
            ),
            patch.object(sync_module.persistent_notification, "async_create") as create,
            patch.object(
                sync_module.persistent_notification, "async_dismiss"
            ) as dismiss,
        ):
            await sync.async_start()
            await sync.task
            sync.request_sync()  # Manual UI/action and scheduled action use this path.
            await sync.task
            sync.request_sync(manual=False)
            await sync.task
            self.assertEqual(create.call_count, 3)
            dismiss.assert_not_called()
            for call in create.call_args_list:
                message = call.args[1]
                self.assertIn("2 movies have missing metadata or artwork", message)
                self.assertIn("Missing metadata: 2; missing artwork: 2", message)
                self.assertEqual(message.count(library.ROWS[0]["title"]), 1)
                self.assertEqual(
                    message.count(
                        sync_module._notification_title(library.ROWS[1]["title"])
                    ),
                    1,
                )
                self.assertEqual(message.count("(metadata and artwork)"), 2)
                self.assertEqual(call.args[3], sync_module.MISSING_NOTICE_ID)
            await sync.async_stop()
            session.detach.assert_called_once()

    async def test_reports_every_group_even_beyond_sensor_attribute_limit(self):
        rows = [
            {
                **library.ROWS[0],
                "source_group": f"group-{i}",
                "source_handle": f"handle-{i}",
                "title": f"Fictional movie {i:03d}",
            }
            for i in range(70)
        ]
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        sync.browser.movies = AsyncMock(return_value=(rows, []))
        with (
            patch.object(sync_module.persistent_notification, "async_create") as create,
            patch.object(sync_module.persistent_notification, "async_dismiss"),
        ):
            await sync._run()
        message = create.call_args.args[1]
        self.assertIn("70 movies have missing metadata or artwork", message)
        self.assertEqual(
            len([line for line in message.splitlines() if line.startswith("- ")]), 70
        )
        self.assertIn("Fictional movie 069", message)
        summary = await self.repository.async_library_summary(library.SOURCE)
        self.assertTrue(summary["missing_artwork_truncated"])

    async def test_respects_expectations_and_dismisses_resolved_notice(self):
        await self.seed()
        sync = await self.connector()
        sync._sync = AsyncMock()
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(
                "UPDATE library SET enrichment=? WHERE source_id=?",
                (
                    json.dumps(
                        {"unavailable_artwork": {"poster": True, "backdrop": True}}
                    ),
                    library.SOURCE,
                ),
            )
        with (
            patch.object(sync_module.persistent_notification, "async_create") as create,
            patch.object(
                sync_module.persistent_notification, "async_dismiss"
            ) as dismiss,
        ):
            await sync._run()
            create.assert_not_called()
            dismiss.assert_called_once_with(sync.hass, sync_module.MISSING_NOTICE_ID)
            dismiss.reset_mock()

            async def partial():
                sync.error = "library_format"

            sync._sync = partial
            await sync._run()
            create.assert_not_called()
            dismiss.assert_not_called()

    async def test_notification_categories_match_the_library_filter(self):
        await self.repository.async_metadata_sources({"metadata_store_enabled": True})
        await self.seed()
        with closing(sqlite3.connect(self.path)) as db, db:
            for group, enrichment in (
                (
                    "group-a",
                    {"unavailable_artwork": {"poster": True, "backdrop": True}},
                ),
                ("group-b", {"unavailable": {"kaleidescape": True}}),
            ):
                db.execute(
                    "UPDATE library SET enrichment=? WHERE source_id=? "
                    "AND source_group=?",
                    (json.dumps(enrichment), library.SOURCE, group),
                )
        sync = await self.connector()
        sync._sync = AsyncMock()
        with patch.object(
            sync_module.persistent_notification, "async_create"
        ) as create:
            await sync._run()
        message = create.call_args.args[1]
        self.assertIn("Missing metadata: 1; missing artwork: 1", message)
        self.assertIn(f"- {library.ROWS[0]['title']} (metadata)", message)
        self.assertIn(
            f"- {sync_module._notification_title(library.ROWS[1]['title'])} (artwork)",
            message,
        )
        page = await self.repository.async_library_list(
            library.SOURCE, {"grouped": True, "missing_metadata_artwork": True}
        )
        self.assertEqual(
            {row["title"] for row in page["items"]},
            {library.ROWS[0]["title"], library.ROWS[1]["title"]},
        )

    async def test_failed_or_cancelled_sync_does_not_clear_or_publish_notice(self):
        sync = await self.connector()
        with (
            patch.object(sync_module.persistent_notification, "async_create") as create,
            patch.object(
                sync_module.persistent_notification, "async_dismiss"
            ) as dismiss,
        ):
            sync._sync = AsyncMock(
                side_effect=JournalError("library_unreachable", "offline")
            )
            await sync._run()
            sync._sync = AsyncMock(side_effect=asyncio.CancelledError)
            with self.assertRaises(asyncio.CancelledError):
                await sync._run()
            create.assert_not_called()
            dismiss.assert_not_called()

    async def test_incomplete_sync_reports_cached_data_and_escapes_title(self):
        rows = [
            {**library.ROWS[0], "title": "<script> [sample](https://example.invalid)"}
        ]
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        sync.browser.movies = AsyncMock(return_value=(rows, None))
        actual_sync = sync._sync

        async def partial():
            await actual_sync()
            sync.error = "library_format"

        sync._sync = partial
        with patch.object(
            sync_module.persistent_notification, "async_create"
        ) as create:
            await sync._run()
        message = create.call_args.args[1]
        self.assertIn("sync was incomplete", message)
        self.assertNotIn("<script>", message)
        self.assertIn("&lt;script&gt;", message)
        self.assertIn(r"\[sample\]", message)

    async def test_notification_failure_does_not_make_sync_fail(self):
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        with patch.object(
            sync_module.persistent_notification,
            "async_create",
            side_effect=RuntimeError("private"),
        ):
            with self.assertLogs(sync_module.__name__, level="WARNING") as logs:
                await sync._run()
        self.assertIsNone(sync.error)
        self.assertNotIn("private", str(logs.output))

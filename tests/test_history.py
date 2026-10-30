"""Household read permissions and history sensors using isolated fictional records."""

import json
import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import test_backend as backend_tests
import test_repository as repository_tests
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from custom_components.kaleidescape_companion import (
    async_setup_entry,
    async_unload_entry,
)
from custom_components.kaleidescape_companion.core.journal_store import PUBLIC_FIELDS
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.sensor_data import sensor_titles
from custom_components.kaleidescape_companion.sensor import (
    async_setup_entry as setup_sensors,
)


class HouseholdReadTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call
    create = backend_tests.BackendTest.create

    async def test_inactive_and_anonymous_readers_are_denied_and_scope_is_bound(self):
        user = SimpleNamespace(id="reader", is_active=False, is_admin=False)
        with patch(
            "custom_components.kaleidescape_companion.ui.websocket.get_runtime",
            side_effect=AssertionError("Unauthorized runtime lookup"),
        ):
            for account in (None, user):
                for command, data in (
                    ("journal/list", {}),
                    ("journal/get", {"viewing_id": str(uuid4())}),
                ):
                    self.assertEqual(
                        (await self.call(command, user=account, **self.scope, **data))[
                            "code"
                        ],
                        "unauthorized",
                    )
        user.is_active = True
        scope = {**self.scope, "dataset_id": str(uuid4())}
        self.assertEqual(
            (await self.call("journal/list", user=user, **scope))["code"], "not_found"
        )

    async def test_regular_user_reads_safe_records_but_cannot_manage(self):
        record = (await self.create())["result"]["viewing"]
        user = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        info = (await self.call("info", user=user))["result"]["entries"][0]
        self.assertEqual(
            set(info),
            {
                "entry_id",
                "dataset_id",
                "revision",
                "viewing_count",
                "api_version",
                "library_enabled",
                "ui_defaults",
                "permissions",
            },
        )
        self.assertEqual(
            info["permissions"], {"read": True, "edit": False, "export": False}
        )
        for command, data in (
            ("journal/list", {}),
            ("journal/get", {"viewing_id": record["id"]}),
        ):
            result = await self.call(command, user=user, **self.scope, **data)
            public = (
                result["result"]["items"][0]
                if command.endswith("list")
                else result["result"]
            )
            self.assertEqual(set(public), PUBLIC_FIELDS)
            self.assertNotIn("Private note", json.dumps(public))
            self.assertNotIn("notes", public)
        with patch(
            "custom_components.kaleidescape_companion.ui.websocket.get_runtime",
            side_effect=AssertionError("Unauthorized runtime lookup"),
        ):
            for command, data in (
                ("journal/create", {"request_id": str(uuid4()), "data": {}}),
                (
                    "journal/update",
                    {
                        "request_id": str(uuid4()),
                        "viewing_id": record["id"],
                        "expected_revision": 1,
                        "patch": {},
                    },
                ),
                (
                    "journal/delete",
                    {
                        "request_id": str(uuid4()),
                        "viewing_id": record["id"],
                        "expected_revision": 1,
                    },
                ),
                ("journal/sessions", {"viewing_id": record["id"]}),
                ("now_playing", {}),
            ):
                self.assertEqual(
                    (await self.call(command, user=user, **self.scope, **data))["code"],
                    "unauthorized",
                )

    async def test_reader_revocation_or_role_change_withholds_inflight_results(self):
        await self.create()
        repository = self.entry.runtime_data.repository
        original = repository.async_list
        for change in ("inactive", "downgrade", "upgrade"):
            user = SimpleNamespace(
                id="reader", is_active=True, is_admin=change == "downgrade"
            )

            async def revoke(**kwargs):
                result = await original(**kwargs)
                if change == "inactive":
                    user.is_active = False
                else:
                    user.is_admin = not user.is_admin
                return result

            with patch.object(repository, "async_list", revoke):
                result = await self.call("journal/list", user=user, **self.scope)
            self.assertEqual(result["code"], "unauthorized")
            self.assertNotIn("result", result)

    async def test_sensor_platform_failure_closes_runtime_and_unload_failure_keeps_it(
        self,
    ):
        self.hass.config_entries.async_unload_platforms.return_value = False
        self.assertFalse(await async_unload_entry(self.hass, self.entry))
        self.assertTrue(self.entry.runtime_data.ready)
        self.hass.config_entries.async_unload_platforms.return_value = True
        await async_unload_entry(self.hass, self.entry)
        self.hass.config_entries.async_forward_entry_setups.side_effect = RuntimeError(
            "fixture platform failure"
        )
        with self.assertRaises(RuntimeError):
            await async_setup_entry(self.hass, self.entry)
        self.assertFalse(self.entry.runtime_data.ready)


class HistorySummaryTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp

    def test_title_budget_accounts_for_utf8_and_json_escaping(self):
        titles = ["🎬" * 500] * 4 + ["x" * 172]
        self.assertEqual(len(json.dumps(titles, ensure_ascii=False).encode()), 8192)
        self.assertEqual(
            sensor_titles([{"title": title} for title in [*titles, "Overflow"]]),
            titles,
        )
        escaped = ['"\\\n' * 166] * 10
        result = sensor_titles([{"title": title} for title in escaped])
        self.assertLess(len(result), len(escaped))
        self.assertLessEqual(len(json.dumps(result, ensure_ascii=False).encode()), 8192)
        self.assertGreater(
            len(json.dumps([*result, escaped[0]], ensure_ascii=False).encode()), 8192
        )

    async def add(self, title, end, status="completed"):
        return (
            await self.repository.async_create(
                str(uuid4()),
                {
                    "title": title,
                    "started_at": (end - timedelta(hours=2)).isoformat(),
                    "ended_at": end.isoformat(),
                    "status": status,
                    "notes": "Private notes never belong in sensors",
                    "raw_content_id": "private-ID",
                },
            )
        )["viewing"]

    async def test_windows_rewatches_future_records_and_corrections(self):
        now = datetime(2026, 10, 25, 12, tzinfo=UTC)
        self.assertIsNone(
            (await self.repository.async_history_summary(now=now))["last_watched_movie"]
        )
        for days, title in (
            (1, "Film A"),
            (2, "Film A"),
            (7, "Seven-day boundary"),
            (20, "Film B"),
            (30, "Thirty-day boundary"),
            (300, "Film C"),
            (365, "Year boundary"),
            (-1, "Future film"),
        ):
            await self.add(title, now - timedelta(days=days))
        partial = await self.add("Unfinished", now - timedelta(hours=1), "partial")
        deleted = await self.add("Deleted", now - timedelta(minutes=1))
        await self.repository.async_delete(
            str(uuid4()), deleted["id"], deleted["revision"]
        )
        summary = await self.repository.async_history_summary(now=now)
        self.assertEqual(
            [summary[f"completed_{days}_days"] for days in (7, 30, 365)], [2, 4, 6]
        )
        self.assertEqual(summary["movies_7_days"], ["Film A", "Film A"])
        self.assertEqual(summary["last_watched_movie"], "Film A")
        self.assertEqual(summary["partial_movies"], ["Unfinished"])
        self.assertNotIn("Private notes", json.dumps(summary))
        await self.repository.async_update(
            str(uuid4()), partial["id"], 1, {"status": "completed"}
        )
        summary = await self.repository.async_history_summary(now=now)
        self.assertEqual(summary["partial_count"], 0)
        self.assertEqual(summary["last_watched_movie"], "Unfinished")
        # Correcting the end date must move an entry between windows even if the
        # originally inferred completed_at has not changed.
        await self.repository.async_update(
            str(uuid4()),
            partial["id"],
            2,
            {
                "ended_at": (now - timedelta(days=50)).isoformat(),
                "started_at": (now - timedelta(days=51)).isoformat(),
            },
        )
        summary = await self.repository.async_history_summary(now=now)
        self.assertEqual(summary["completed_7_days"], 2)
        expired = await self.repository.async_history_summary(
            now=now + timedelta(days=7)
        )
        self.assertNotIn("Film A", expired["movies_7_days"])

    async def test_title_lists_are_bounded_without_losing_exact_counts(self):
        now = datetime(2026, 10, 25, tzinfo=UTC)
        for index in range(55):
            await self.add(
                f"Film {index}", now - timedelta(minutes=index + 1), "partial"
            )
        for index in range(6):
            await self.add("🎬" * 500, now - timedelta(minutes=index + 1))
        summary = await self.repository.async_history_summary(now=now)
        self.assertEqual(summary["partial_count"], 55)
        self.assertEqual(len(summary["partial_movies"]), 50)
        self.assertTrue(summary["partial_movies_truncated"])
        self.assertEqual(summary["completed_7_days"], 6)
        self.assertLess(len(summary["movies_7_days"]), 6)
        self.assertTrue(summary["movies_7_days_truncated"])
        self.assertLessEqual(
            len(json.dumps(summary["movies_7_days"], ensure_ascii=False).encode()), 8192
        )

    async def test_sensor_setup_shared_refresh_availability_and_cleanup(self):
        hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(hass.async_stop, force=True)
        entry = backend_tests.entry()
        object.__setattr__(entry, "state", ConfigEntryState.SETUP_IN_PROGRESS)
        dataset_id = (await self.repository.async_info())["dataset_id"]
        entry.runtime_data = SimpleNamespace(
            repository=self.repository, dataset_id=dataset_id
        )
        added = Mock()
        await setup_sensors(hass, entry, added)
        entities = added.call_args.args[0]
        coordinator = entities[0].coordinator
        self.addAsyncCleanup(coordinator.async_shutdown)
        self.addAsyncCleanup(entities[7].coordinator.async_shutdown)
        self.assertEqual(len(entities), 14)
        self.assertEqual(len({sensor.unique_id for sensor in entities}), 14)
        self.assertEqual(coordinator.update_interval.total_seconds(), 30)
        self.assertTrue(
            all(entity.coordinator is coordinator for entity in entities[:7])
        )
        await self.add("X" * 500, datetime.now(UTC) - timedelta(minutes=1))
        await coordinator.async_refresh()
        last = entities[0]
        self.assertEqual(len(last.native_value), 255)
        self.assertEqual(last.extra_state_attributes["movie"], "X" * 500)
        self.assertEqual(entities[1].native_value, 1)
        self.assertEqual(entities[1].extra_state_attributes["movies"], ["X" * 500])
        with (
            patch.object(
                self.repository,
                "async_history_summary",
                side_effect=JournalError("storage_error", "fixture failure"),
            ),
            self.assertLogs(
                "custom_components.kaleidescape_companion.sensor", level="ERROR"
            ),
        ):
            await coordinator.async_refresh()
        self.assertFalse(last.available)
        await coordinator.async_refresh()
        self.assertTrue(last.available)
        remove = coordinator.async_add_listener(Mock())
        self.assertIsNotNone(coordinator._unsub_refresh)
        remove()
        self.assertIsNone(coordinator._unsub_refresh)

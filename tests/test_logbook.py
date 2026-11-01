"""Private operational retention and selectable settings transfer boundaries."""

import asyncio
import json
import sqlite3
import unittest
import weakref
from contextlib import closing
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_repository as repository
from kaleidescape_api.logging import (
    Level,
    Operation,
    Outcome,
    Resource,
    Subsystem,
    Trigger,
)

from custom_components.kaleidescape_companion.core import logbook
from custom_components.kaleidescape_companion.core.models import JournalError


class LogbookTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp

    async def test_minimum_severity_applies_to_pages_and_exports(self):
        await self.repository.async_logs("configure", {"level": "DEBUG"})
        for level in Level:
            self.repository.logger.emit(
                Subsystem.TRANSPORT, Operation.READ, Outcome.SUCCEEDED, level=level
            )
        levels = list(Level)
        for index, level in enumerate(levels):
            filters = {"level": level.value, "logger": Subsystem.TRANSPORT.value}
            first = await self.repository.async_logs("list", {**filters, "limit": 2})
            items = list(first["items"])
            before = first["before"]
            while before is not None:
                page = await self.repository.async_logs(
                    "list", {**filters, "before": before, "limit": 2}
                )
                items.extend(page["items"])
                before = page["before"]
            exported = await self.repository.async_logs("export", filters)
            expected = [v.value for v in reversed(levels[index:])]
            self.assertEqual([r["level"] for r in items], expected)
            self.assertEqual(exported["items"], items)

    async def test_request_context_crosses_worker_and_reference_filters_relations(self):
        logger = self.repository.logger
        with logger.context(
            actor=(Resource.USER, "fictional-user"),
            trace=(Resource.REQUEST, "fictional-request"),
            trigger=Trigger.USER_REQUEST,
        ):
            await self.repository._call(
                lambda: logger.emit(
                    Subsystem.DATABASE,
                    Operation.UPDATE,
                    Outcome.STARTED,
                    related=(Resource.VIEWING, "fictional-viewing"),
                )
            )
        reference = logger.alias(Resource.REQUEST, "fictional-request")
        page = await self.repository.async_logs("list", {"reference": reference})
        self.assertEqual(len(page["items"]), 1)
        self.assertEqual(
            page["items"][0]["actor"], logger.alias(Resource.USER, "fictional-user")
        )
        linked = await self.repository.async_logs(
            "list", {"reference": logger.alias(Resource.VIEWING, "fictional-viewing")}
        )
        self.assertEqual(page["items"], linked["items"])
        with self.assertRaises(JournalError):
            await self.repository.async_logs(
                "list", {"reference": "private-user@example.invalid"}
            )

    async def test_close_releases_repository_while_shared_logger_remains_usable(self):
        async def close_repository():
            repo = repository.JournalRepository(
                self.path.with_name("transient.sqlite3")
            )
            await repo.async_open()
            logger = repo.logger
            events = []
            logger.register(events.append)
            await repo.async_close()
            return logger, events, weakref.ref(repo)

        logger, events, closed = await close_repository()
        # Let completed futures release their callbacks, without forcing GC.
        for _ in range(3):
            await asyncio.sleep(0)
        self.assertIsNone(closed())
        previous = len(events)
        logger.emit(Subsystem.APPLICATION, Operation.DISCONNECT, Outcome.SUCCEEDED)
        self.assertEqual(len(events), previous + 1)
        self.assertEqual(logger.sink_failures, 0)

    async def test_no_private_values_in_queue_memory_or_database_and_live_levels(self):
        logger = self.repository.logger
        identity = "fictional-user:password@192.0.2.7/token/secret"
        logger.emit(
            Subsystem.PLAYBACK,
            Operation.CONTROL,
            Outcome.STARTED,
            resource=(Resource.DEVICE, identity),
        )
        page = await self.repository.async_logs()
        alias = [r["resource"] for r in page["items"] if r.get("resource")][-1]
        for private in ("fictional-user", "password", "192.0.2.7", "/token/secret"):
            self.assertNotIn(private, json.dumps(page))
            self.assertNotIn(private, repr(logger.snapshot()))
        logger.emit(
            Subsystem.PLAYBACK, Operation.READ, Outcome.STARTED, level=Level.DEBUG
        )
        self.assertNotIn(
            "DEBUG", {r["level"] for r in (await self.repository.async_logs())["items"]}
        )
        await self.repository.async_logs("configure", {"level": "DEBUG"})
        logger.emit(
            Subsystem.PLAYBACK,
            Operation.READ,
            Outcome.STARTED,
            level=Level.DEBUG,
            resource=(Resource.DEVICE, identity),
        )
        page = await self.repository.async_logs()
        self.assertEqual(page["items"][0]["resource"], alias)
        self.assertEqual(page["items"][0]["level"], "DEBUG")

    async def test_hide_clear_and_bounded_retention_include_hidden(self):
        for _ in range(8):
            self.repository.logger.emit(
                Subsystem.CALENDAR, Operation.VERIFY, Outcome.MISMATCH
            )
        first = await self.repository.async_logs()
        await self.repository.async_logs("clear", {"through": first["through"]})
        visible = await self.repository.async_logs()
        self.assertTrue(all(r["id"] > first["through"] for r in visible["items"]))
        retained = await self.repository.async_logs("list", {"hidden": True})
        self.assertGreaterEqual(retained["retained"], first["retained"])
        with patch.object(logbook, "MAX_BYTES", 1000):
            for _ in range(100):
                self.repository.logger.emit(
                    Subsystem.CALENDAR, Operation.SYNC, Outcome.SUCCEEDED
                )
            page = await self.repository.async_logs("list", {"hidden": True})
        self.assertLessEqual(page["bytes"], 1000)
        self.assertLess(page["retained"], retained["retained"] + 100)
        self.assertIn("Privacy:", page["banner"])

    async def test_alias_key_survives_restart_but_never_portable_export(self):
        first = self.repository.logger.alias(Resource.DEVICE, "fictional-device")
        export = await self.repository.async_export("sqlite")
        with closing(sqlite3.connect(export)) as db:
            self.assertEqual(
                db.execute("SELECT COUNT(*) FROM operation_logs").fetchone()[0], 0
            )
            self.assertEqual(
                db.execute("SELECT COUNT(*) FROM log_state").fetchone()[0], 0
            )
        await self.repository.async_close()
        self.repository = repository.JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(
            self.repository.logger.alias(Resource.DEVICE, "fictional-device"), first
        )

    async def test_values_override_is_limited_and_sensitive_patterns_are_removed(self):
        title = (
            "Fictional Film person@example.test 192.0.2.1 "
            "token=very-private-token /private/account"
        )
        value = logbook.movie_value(self.repository.logger, "fictional", title)
        self.assertEqual(value["values"]["title"], "[private]")
        plain = logbook.movie_value(
            self.repository.logger, "fictional", "Fictional Film"
        )
        self.assertEqual(plain["values"]["title"], "Fictional Film")
        mapped = logbook.movie_value(
            self.repository.logger, "fictional", "::ffff:192.0.2.7"
        )
        self.assertEqual(mapped["values"]["title"], "[private]")
        for private in (
            "person@example",
            "192.0.2.1",
            "very-private-token",
            "/private/account",
        ):
            self.assertNotIn(private, json.dumps(value))
        for invalid_patch in (
            {"level": "secret"},
            {"log_values": "yes"},
            {"sql": "private"},
        ):
            with self.assertRaises(JournalError):
                await self.repository.async_logs("configure", invalid_patch)
        with self.assertRaises(JournalError):
            await self.repository.async_logs("list", {"logger": "private"})

    async def test_settings_category_validation_and_atomic_ui_import(self):
        data = {
            "browsing": {"library": {"view": "covers"}},
            "logging": {"level": "DEBUG", "log_values": False},
        }
        request = str(uuid4())
        await self.repository.async_transfer_settings(
            "preview", "fictional", request, data
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("fictional"))["values"]["view"],
            "list",
        )
        await self.repository.async_transfer_settings(
            "apply", "fictional", request, data
        )
        await self.repository.async_transfer_settings(
            "apply", "fictional", request, data
        )
        self.assertEqual(
            (await self.repository.async_ui_preferences("fictional"))["values"]["view"],
            "covers",
        )
        self.assertEqual(self.repository.logger.level, Level.DEBUG)
        bad = {"browsing": {"library": {"view": "list"}, "journal": {"unknown": True}}}
        with self.assertRaises(JournalError):
            await self.repository.async_transfer_settings(
                "apply", "fictional", str(uuid4()), bad
            )
        self.assertEqual(
            (await self.repository.async_ui_preferences("fictional"))["values"]["view"],
            "covers",
        )

    async def test_failed_log_storage_preserves_functional_writes_and_privacy(
        self,
    ):
        with patch.object(
            logbook,
            "append",
            side_effect=sqlite3.OperationalError("private-secret@192.0.2.9"),
        ):
            result = await self.repository.async_create(
                str(uuid4()), repository.viewing()
            )
            page = await self.repository.async_logs()
        self.assertEqual(result["viewing"]["title"], "Example Film")
        self.assertGreater(page["storage_failures"], 0)
        self.assertNotIn("private-secret", str(page))
        self.assertNotIn("192.0.2.9", str(self.repository.logger.snapshot()))

    async def test_queue_overflow_reports_drops_without_exceeding_retention_budget(
        self,
    ):
        for _ in range(1200):
            self.repository.logger.emit(
                Subsystem.CALENDAR, Operation.VERIFY, Outcome.MISMATCH
            )
        page = await self.repository.async_logs()
        self.assertGreater(page["dropped"], 0)
        self.assertLessEqual(page["bytes"], logbook.MAX_BYTES)

    async def test_legacy_rows_gain_messages_without_fabricating_source_locations(self):
        def old_row():
            logbook.append(
                self.repository._db(),
                [
                    {
                        "timestamp": "2026-10-31T12:00:00Z",
                        "level": "ERROR",
                        "logger": "calendar",
                        "operation": "write",
                        "outcome": "failed",
                        "failure": "provider",
                    }
                ],
            )

        await self.repository._call(old_row)
        page = await self.repository.async_logs()
        row = next(r for r in page["items"] if r.get("failure") == "provider")
        self.assertIn("provider raised", row["message"])
        self.assertNotIn("file", row)
        self.assertNotIn("line", row)


class LogbookBackendTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_logs_and_settings_transfer_require_active_admin(self):
        reader = SimpleNamespace(id="fictional-reader", is_active=True, is_admin=False)
        for operation, extra in (
            ("logs/list", {}),
            ("logs/clear", {"through": 0}),
            ("logs/configure", {"data": {"level": "DEBUG"}}),
            ("settings/transfer", {"operation": "export", "categories": ["rules"]}),
        ):
            result = await self.call(operation, user=reader, **self.scope, **extra)
            self.assertEqual(result["code"], "unauthorized")
        result = await self.call("logs/list", **self.scope)
        self.assertTrue(result["success"])
        result = await self.call(
            "logs/configure", **self.scope, data={"level": "DEBUG"}
        )
        self.assertEqual(result["result"]["config"]["level"], "DEBUG")
        self.admin.is_active = False
        self.assertEqual(
            (await self.call("logs/list", **self.scope))["code"], "unauthorized"
        )

    async def test_settings_export_omits_credentials_and_limits_private_categories(
        self,
    ):
        from types import MappingProxyType

        object.__setattr__(
            self.entry,
            "options",
            MappingProxyType(
                {
                    "library_host": "http://fictional.local",
                    "metadata_tmdb_credential": "fictional-secret",
                    "calendar_title": "private custom text",
                    "minimum_seconds": 300,
                }
            ),
        )
        result = await self.call(
            "settings/transfer", **self.scope, operation="export", categories=["rules"]
        )
        self.assertTrue(result["success"])
        self.assertNotIn("fictional-secret", json.dumps(result))
        self.assertNotIn("fictional.local", json.dumps(result))
        result = await self.call(
            "settings/transfer",
            **self.scope,
            operation="export",
            categories=["connections", "templates"],
        )
        self.assertIn("fictional.local", json.dumps(result))
        self.assertNotIn("fictional-secret", json.dumps(result))
        artifact = {
            "format": "companion-settings",
            "version": 1,
            "categories": {"rules": {"metadata_tmdb_credential": "secret"}},
        }
        result = await self.call(
            "settings/transfer",
            **self.scope,
            operation="preview",
            categories=["rules"],
            data=artifact,
        )
        self.assertEqual(result["code"], "invalid_request")

    async def test_role_change_during_log_read_withholds_result(self):
        repo = self.entry.runtime_data.repository
        original = repo.async_logs

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(repo, "async_logs", side_effect=revoke):
            result = await self.call("logs/list", **self.scope)
        self.assertFalse(result["success"])
        self.assertEqual(result["code"], "unauthorized")

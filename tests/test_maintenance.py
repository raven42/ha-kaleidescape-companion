"""Private inspection, permanent purging, and native options-flow boundaries."""

import asyncio
import json
import sqlite3
import threading
import unittest
from contextlib import closing
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_backend as backend_tests
import test_repository as repository_tests
from homeassistant.config_entries import OptionsFlowManager
from test_tracking import observation

from custom_components.kaleidescape_companion.config_flow import KaleidescapeOptionsFlow
from custom_components.kaleidescape_companion.core.migrations import (
    UnsupportedSchemaError,
)
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.playback.tracker import PlaybackTracker
from custom_components.kaleidescape_companion.ui.settings import options_request


class MaintenanceStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp
    assert_error = repository_tests.RepositoryTest.assert_error

    async def create(self, **values):
        request = str(uuid4())
        record = await self.repository.async_create(
            request, repository_tests.viewing(**values), actor_id="fictional-admin"
        )
        return request, record["viewing"]

    async def purge(
        self,
        ids=None,
        *,
        request=None,
        revision=None,
        all=False,
        actor="fictional-admin",
    ):
        return await self.repository.async_purge(
            request or str(uuid4()),
            (await self.repository.async_info())["revision"]
            if revision is None
            else revision,
            ids or [],
            all,
            "PURGE ALL" if all else "PURGE",
            actor_id=actor,
        )

    async def test_selected_purge_removes_references_and_preserves_other_rows(
        self,
    ):
        tracker = PlaybackTracker("fictional-player")
        tracker.apply(observation(0))
        snapshot = tracker.apply(observation(0.5))[-1]
        viewing_id = await self.repository.async_save_session(snapshot, 300, 24)
        edited_request = str(uuid4())
        await self.repository.async_update(
            edited_request,
            viewing_id,
            1,
            {"notes": "Private fictional note"},
            actor_id="fictional-admin",
        )
        row = await self.repository.async_get(viewing_id)
        await self.repository.async_delete(
            str(uuid4()), viewing_id, row["revision"], actor_id="fictional-admin"
        )
        other_request, other = await self.create(title="Keep this fictional viewing")
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "INSERT INTO requests VALUES (?, 'legacy-hash', ?)",
                (
                    str(uuid4()),
                    json.dumps(
                        {
                            "viewing": {
                                "id": viewing_id,
                                "notes": "Legacy fictional note",
                            }
                        }
                    ),
                ),
            )
            db.commit()
        result = await self.purge([viewing_id])
        self.assertEqual(result["purged_count"], 1)
        page = await self.repository.async_inspect("viewings")
        self.assertEqual([item["id"] for item in page["items"]], [other["id"]])
        for table in ("sessions", "manual_audit", "requests"):
            raw = json.dumps((await self.repository.async_inspect(table))["items"])
            self.assertNotIn(viewing_id, raw)
            self.assertNotIn("Private fictional note", raw)
            self.assertNotIn("Legacy fictional note", raw)
        self.assertEqual(
            (await self.repository.async_inspect("manual_audit"))["tables"][
                "manual_audit"
            ],
            1,
        )
        with self.assert_error("not_found"):
            await self.repository.async_update(
                edited_request,
                viewing_id,
                1,
                {"notes": "Private fictional note"},
                actor_id="fictional-admin",
            )
        self.assertEqual(
            (
                await self.repository.async_create(
                    other_request,
                    repository_tests.viewing(title=other["title"]),
                    actor_id="fictional-admin",
                )
            )["viewing"],
            other,
        )

    async def test_purge_all_survives_reload_and_blocks_create_replay(
        self,
    ):
        request, original = await self.create()
        purge_request = str(uuid4())
        revision = (await self.repository.async_info())["revision"]
        result = await self.purge(all=True, request=purge_request, revision=revision)
        await self.repository.async_close()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(
            await self.purge(all=True, request=purge_request, revision=revision), result
        )
        with self.assert_error("not_found"):
            await self.repository.async_create(
                request, repository_tests.viewing(), actor_id="fictional-admin"
            )
        self.assertEqual(
            (await self.repository.async_inspect("viewings"))["tables"]["viewings"], 0
        )
        audit = (await self.repository.async_inspect("maintenance_audit"))["items"]
        self.assertEqual(len(audit), 1)
        self.assertEqual(audit[0]["actor_id"], "fictional-admin")
        self.assertNotIn(original["id"], json.dumps(audit))
        with self.assert_error("conflict"):
            await self.purge(
                all=True, request=purge_request, revision=revision, actor="other-admin"
            )

    async def test_stale_revision_bad_confirmation_and_unknown_rows_do_not_delete(self):
        _, record = await self.create()
        with self.assert_error("conflict"):
            await self.purge([record["id"]], revision=0)
        with self.assert_error("not_found"):
            await self.purge([str(uuid4())])
        for args in (
            ([], False, "PURGE"),
            ([record["id"]], True, "PURGE ALL"),
            ([], True, "purge all"),
            ([record["id"]] * 2, False, "PURGE"),
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_purge(str(uuid4()), 1, *args)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_backup_export_and_transaction_failure_block_purge_atomically(self):
        _, record = await self.create()
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.purge([record["id"]])
        await self.repository.async_resume()
        async with self.repository.async_export_snapshot("sqlite"):
            with self.assert_error("busy"):
                await self.purge([record["id"]])
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_purge BEFORE INSERT ON maintenance_audit "
                "BEGIN SELECT RAISE(ABORT, 'test'); END"
            )
        with self.assert_error("storage_error"):
            await self.purge([record["id"]])
        self.assertEqual((await self.repository.async_info())["revision"], 1)
        self.assertEqual(
            (await self.repository.async_get(record["id"]))["id"], record["id"]
        )
        page = await self.repository.async_inspect("requests")
        self.assertNotIn("purged", page["items"][0]["response"])

    async def test_inspection_is_bounded_literal_and_invalidates_changed_pages(self):
        for index in range(27):
            await self.create(title=f"Fictional viewing {index}")
        page = await self.repository.async_inspect("viewings")
        self.assertEqual(len(page["items"]), 25)
        self.assertTrue(page["has_more"])
        second = await self.repository.async_inspect("viewings", 25, page["revision"])
        self.assertEqual(len(second["items"]), 2)
        self.assertFalse(second["has_more"])
        await self.create()
        with self.assert_error("refresh_required"):
            await self.repository.async_inspect("viewings", 25, page["revision"])
        for table, offset in (
            ("sqlite_master", 0),
            ("viewings; DROP TABLE viewings", 0),
            ("viewings", -1),
            ("viewings", True),
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_inspect(table, offset)

    async def test_inspection_page_sizes_search_sort_and_byte_budget(self):
        await self.create(title="Fictional viewing 000")

        def seed():
            db = self.repository._db()
            row = dict(db.execute("SELECT * FROM viewings").fetchone())
            with db:
                db.executemany(
                    "INSERT INTO viewings ("
                    + ",".join(row)
                    + ") VALUES ("
                    + ",".join("?" for _ in row)
                    + ")",
                    [
                        tuple(
                            {
                                **row,
                                "id": str(uuid4()),
                                "title": f"Fictional viewing {index:03}",
                            }.values()
                        )
                        for index in range(1, 503)
                    ],
                )

        await self.repository._call(seed)
        for limit in (10, 25, 100, 500):
            page = await self.repository.async_inspect(
                "viewings", limit=limit, sort="title"
            )
            self.assertEqual(len(page["items"]), limit)
            self.assertEqual(page["limit"], limit)
            self.assertEqual(page["total"], 503)
            self.assertTrue(page["has_more"])
            self.assertEqual(page["items"][0]["title"], "Fictional viewing 000")
        final = await self.repository.async_inspect(
            "viewings", 500, page["revision"], limit=500, sort="title"
        )
        self.assertEqual(len(final["items"]), 3)
        self.assertFalse(final["has_more"])
        descending = await self.repository.async_inspect(
            "viewings", limit=10, sort="title", descending=True
        )
        self.assertEqual(descending["items"][0]["title"], "Fictional viewing 502")
        found = await self.repository.async_inspect(
            "viewings", query="VIEWING 50", sort="title"
        )
        self.assertEqual(found["total"], 3)
        self.assertEqual(found["tables"]["viewings"], 503)
        self.assertIn("title", found["columns"])
        await self.create(title="Literal 100%_ marker")
        literal = await self.repository.async_inspect("viewings", query="%_")
        self.assertEqual(literal["total"], 1)
        self.assertEqual(literal["items"][0]["title"], "Literal 100%_ marker")
        for arguments in (
            {"limit": 26},
            {"limit": True},
            {"limit": "500"},
            {"limit": None},
            {"query": "x" * 2001},
            {"query": "\x00"},
            {"query": 3},
            {"sort": "title DESC; DROP TABLE viewings"},
            {"sort": "sqlite_master"},
            {"sort": []},
            {"descending": 1},
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_inspect("viewings", **arguments)
        with patch(
            "custom_components.kaleidescape_companion.core.maintenance.MAX_PAGE_BYTES",
            1000,
        ):
            with self.assert_error("database_page_too_large"):
                await self.repository.async_inspect("viewings", limit=500)

    async def test_cancelled_request_still_commits_and_retry_returns_receipt(self):
        _, record = await self.create()
        request = str(uuid4())
        started, release = threading.Event(), threading.Event()
        original = self.repository._purge

        def held(*args):
            started.set()
            if not release.wait(2):
                raise AssertionError("Worker barrier timed out")
            return original(*args)

        with patch.object(self.repository, "_purge", side_effect=held):
            task = asyncio.create_task(
                self.purge([record["id"]], request=request, revision=1)
            )
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            finally:
                release.set()
        result = await self.purge([record["id"]], request=request, revision=1)
        self.assertEqual(result["purged_count"], 1)
        self.assertEqual((await self.repository.async_info())["revision"], 2)

    async def test_schema_three_upgrade_preserves_data_and_keeps_private_backup(self):
        _, record = await self.create()
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("DROP TABLE maintenance_audit")
            db.execute("DROP TABLE import_audit")
            for table in (
                "database_audit",
                "settings",
                "library_collection_intents",
                "library_memberships",
                "library_collections",
                "library",
                "library_artwork",
                "library_sources",
            ):
                db.execute(f"DROP TABLE {table}")
            db.execute("ALTER TABLE schema_metadata DROP COLUMN settings_revision")
            db.execute("DROP TABLE calendar_sync_items")
            db.execute("DROP TABLE calendar_sync_jobs")
            db.execute("DROP TABLE calendar_publications")
            db.execute("DROP INDEX viewings_completed")
            db.execute("DROP INDEX viewings_library_title")
            db.execute("ALTER TABLE viewings DROP COLUMN library_title_id")
            db.execute("ALTER TABLE viewings DROP COLUMN library_metadata")
            db.execute("DROP TABLE playback_controls")
            db.execute("DROP TABLE calendar_managed_events")
            db.execute("DROP TABLE calendar_reconcile_candidates")
            db.execute("DROP TABLE calendar_reconcile_intents")
            db.execute("PRAGMA user_version=3")
            db.commit()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(
            (await self.repository.async_get(record["id"]))["title"], record["title"]
        )
        self.assertEqual((await self.repository.async_info())["schema_version"], 20)
        backup = next(self.path.parent.glob("journal.sqlite3.v3.*.bak"))
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
        with closing(sqlite3.connect(backup)) as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 3)
        await self.repository.async_close()
        older = JournalRepository(self.path)
        self.addAsyncCleanup(older.async_close)
        with patch(
            "custom_components.kaleidescape_companion.core.migrations.SCHEMA_VERSION", 3
        ):
            with self.assertRaises(UnsupportedSchemaError):
                await older.async_open()


class MaintenanceApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call
    create = backend_tests.BackendTest.create

    async def test_new_commands_deny_non_admins_before_access(
        self,
    ):
        for user in (
            None,
            SimpleNamespace(is_active=False, is_admin=True),
            SimpleNamespace(is_active=True, is_admin=False),
        ):
            for operation, data in (
                ("database/inspect", {"table": "viewings"}),
                (
                    "database/purge",
                    {
                        "request_id": str(uuid4()),
                        "expected_revision": 0,
                        "viewing_ids": [],
                        "all": True,
                        "confirmation": "PURGE ALL",
                    },
                ),
                ("settings/start", {}),
                ("settings/cancel", {"flow_id": "fictional"}),
                ("settings/submit", {"flow_id": "fictional", "data": {}}),
            ):
                with self.subTest(operation=operation, user=user):
                    with patch(
                        "custom_components.kaleidescape_companion.ui.websocket.get_runtime",
                        side_effect=AssertionError("Storage must not be accessed"),
                    ):
                        result = await self.call(
                            operation, user=user, **self.scope, **data
                        )
                    self.assertEqual(result["code"], "unauthorized")

    async def test_purge_refuses_active_recorder_and_checks_revision(self):
        await self.create()
        args = {
            **self.scope,
            "request_id": str(uuid4()),
            "expected_revision": (
                await self.entry.runtime_data.repository.async_info()
            )["revision"],
            "viewing_ids": [],
            "all": True,
            "confirmation": "PURGE ALL",
        }
        self.entry.runtime_data.observer = SimpleNamespace()
        result = await self.call("database/purge", **args)
        self.assertEqual(result["code"], "tracking_enabled")
        self.entry.runtime_data.observer = None
        result = await self.call("database/purge", **args)
        self.assertEqual(result["result"]["purged_count"], 1)

    async def test_inspection_withholds_result_if_admin_access_is_revoked(self):
        repository = self.entry.runtime_data.repository
        original = repository.async_inspect

        async def revoke(*args, **kwargs):
            result = await original(*args, **kwargs)
            self.admin.is_admin = False
            return result

        with patch.object(repository, "async_inspect", side_effect=revoke):
            result = await self.call(
                "database/inspect",
                **self.scope,
                table="requests",
                limit=500,
                query="fictional",
                sort="request_id",
                descending=True,
            )
        self.assertEqual(result["code"], "unauthorized")

    async def prepare_flow(self):
        manager = OptionsFlowManager(self.hass)
        self.hass.config_entries.options = manager
        self.hass.config_entries.async_get_known_entry.return_value = self.entry

        def update(entry, *, options):
            object.__setattr__(entry, "options", MappingProxyType(options))
            return True

        self.hass.config_entries.async_update_entry.side_effect = update
        self.create_flow = patch.object(
            manager,
            "async_create_flow",
            side_effect=lambda *args, **kwargs: KaleidescapeOptionsFlow(),
        )
        self.preview = patch.object(manager, "_async_setup_preview", new=AsyncMock())
        self.create_flow.start()
        self.preview.start()
        self.addCleanup(self.create_flow.stop)
        self.addCleanup(self.preview.stop)
        result = await self.call("settings/start", **self.scope)
        self.assertTrue(result["success"])
        return result["result"]

    async def test_page_settings_use_real_ha_flow_validation_update_and_reload(self):
        form = await self.prepare_flow()
        defaults = {field["name"]: field.get("default") for field in form["fields"]}
        self.assertEqual(defaults["minimum_runtime_minutes"], 10)
        result = await self.call(
            "settings/submit",
            **self.scope,
            flow_id=form["flow_id"],
            data={"tracking_enabled": False, "minimum_runtime_minutes": -1},
        )
        self.assertEqual(result["code"], "invalid_request")
        result = await self.call(
            "settings/submit",
            **self.scope,
            flow_id=form["flow_id"],
            data={"tracking_enabled": True},
        )
        self.assertEqual(result["result"]["errors"]["base"], "missing_entities")
        result = await self.call(
            "settings/submit",
            **self.scope,
            flow_id=form["flow_id"],
            data={"tracking_enabled": False, "minimum_runtime_minutes": 20},
        )
        self.assertEqual(result["result"], {"type": "create_entry"})
        self.assertEqual(self.entry.options["minimum_runtime_minutes"], 20)
        self.assertTrue(self.entry.runtime_data.preserve_panel_on_reload)
        self.hass.config_entries.async_schedule_reload.assert_called_once_with(
            self.entry.entry_id
        )

    async def test_settings_bind_flow_to_actor_entry_and_current_configuration(self):
        form = await self.prepare_flow()
        other = SimpleNamespace(is_active=True, is_admin=True, id="another-admin")
        result = await self.call(
            "settings/cancel", user=other, **self.scope, flow_id=form["flow_id"]
        )
        self.assertEqual(result["code"], "unauthorized")
        object.__setattr__(
            self.entry, "options", MappingProxyType({"minimum_runtime_minutes": 12})
        )
        result = await self.call(
            "settings/submit",
            **self.scope,
            flow_id=form["flow_id"],
            data={"tracking_enabled": False},
        )
        self.assertEqual(result["code"], "conflict")
        self.assertEqual(self.entry.options["minimum_runtime_minutes"], 12)

    async def test_cancel_does_not_save_and_arbitrary_settings_fields_are_rejected(
        self,
    ):
        form = await self.prepare_flow()
        with self.assertRaises(JournalError):
            await options_request(
                self.hass,
                self.entry,
                self.admin.id,
                "settings/submit",
                {"flow_id": form["flow_id"], "data": {"sql": "DELETE FROM viewings"}},
            )
        result = await self.call(
            "settings/cancel", **self.scope, flow_id=form["flow_id"]
        )
        self.assertEqual(result["result"], {"type": "abort"})
        self.hass.config_entries.async_update_entry.assert_not_called()

    async def test_dialog_replaces_own_flow_and_rejects_a_foreign_entry_flow(self):
        original = await self.prepare_flow()
        replacement = await self.call("settings/start", **self.scope)
        self.assertNotEqual(original["flow_id"], replacement["result"]["flow_id"])
        ended = await self.call(
            "settings/cancel", **self.scope, flow_id=original["flow_id"]
        )
        self.assertEqual(ended["code"], "not_found")
        foreign = await self.hass.config_entries.options.async_init(
            "another-entry", context={"companion_user": self.admin.id}
        )
        result = await self.call(
            "settings/cancel", **self.scope, flow_id=foreign["flow_id"]
        )
        self.assertEqual(result["code"], "unauthorized")

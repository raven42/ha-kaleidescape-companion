"""Exercise backend lifecycle and registered HA handlers without household devices."""

import asyncio
import json
import tempfile
import unittest
import warnings
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import probatio
from aiohttp import web
from aiohttp.test_utils import make_mocked_request
from aiohttp.web_exceptions import NotAppKeyWarning
from homeassistant.components import frontend
from homeassistant.components.http import KEY_HASS
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import (
    ConfigEntryError,
    ConfigEntryNotReady,
    HomeAssistantError,
)

from custom_components.kaleidescape_companion import (
    async_setup_entry,
    async_unload_entry,
)
from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.const import DOMAIN, NAME
from custom_components.kaleidescape_companion.core.migrations import (
    UnsupportedSchemaError,
)
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.diagnostics import (
    async_get_config_entry_diagnostics,
)
from custom_components.kaleidescape_companion.ui.http import JournalExportView
from custom_components.kaleidescape_companion.vendor import kaleidescape


def entry():
    return ConfigEntry(
        version=1,
        minor_version=1,
        domain=DOMAIN,
        title=NAME,
        data={},
        options={},
        source="user",
        unique_id=DOMAIN,
        discovery_keys=MappingProxyType({}),
        subentries_data=None,
    )


class Connection:
    """Collect an actual registered websocket handler's response."""

    def __init__(self, user):
        self.user = user
        self.result = asyncio.get_running_loop().create_future()

    def send_result(self, message_id, result):
        self.result.set_result({"success": True, "result": result})

    def send_error(self, message_id, code, message):
        self.result.set_result({"success": False, "code": code, "message": message})


class BackendTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.hass = HomeAssistant(self.directory.name)
        self.hass.data[frontend.DATA_EXTRA_MODULE_URL] = frontend.UrlManager(
            lambda *_: None, []
        )
        self.hass.http = Mock()
        self.hass.http.async_register_static_paths = AsyncMock()
        self.hass.config_entries = Mock()
        self.hass.config_entries.async_forward_entry_setups = AsyncMock()
        self.hass.config_entries.async_unload_platforms = AsyncMock(return_value=True)
        self.entry = entry()
        self.hass.config_entries.async_entries.return_value = [self.entry]
        self.hass.config_entries.async_get_entry.side_effect = lambda entry_id: (
            self.entry if entry_id == self.entry.entry_id else None
        )
        self.admin = SimpleNamespace(
            id=uuid4().hex,
            is_active=True,
            is_admin=True,
            permissions=SimpleNamespace(check_entity=Mock(return_value=True)),
        )
        await async_setup_entry(self.hass, self.entry)
        self.addAsyncCleanup(self.hass.async_stop, force=True)
        self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
        self.scope = {
            "entry_id": self.entry.entry_id,
            "dataset_id": self.entry.runtime_data.dataset_id,
        }

    async def call(self, command, *, user="admin", **data):
        name = f"{DOMAIN}/{command}"
        handler, schema = self.hass.data["websocket_api"][name]
        connection = Connection(self.admin if user == "admin" else user)
        message = {"id": 1, "type": name, **data}
        handler(self.hass, connection, schema(message))
        return await asyncio.wait_for(connection.result, 2)

    async def create(self):
        from custom_components.kaleidescape_companion.library.store import (
            source_id,
            title_id,
        )

        origin = "http://fictional.local"
        repository = self.entry.runtime_data.repository
        if self.entry.runtime_data.library is None:
            await repository.async_library_catalog(
                origin,
                [
                    {
                        "source_handle": "fictional",
                        "source_group": "fictional",
                        "title": "Fictional Film",
                        "duration_seconds": 7200,
                    }
                ],
            )
            self.entry.runtime_data.library = SimpleNamespace(
                source=source_id(origin),
                origin=origin,
                error=None,
                async_stop=AsyncMock(),
                async_pause=AsyncMock(),
                async_resume=AsyncMock(),
            )
            object.__setattr__(
                self.entry,
                "data",
                {**self.entry.data, "library_enabled": True, "library_host": origin},
            )
        return await self.call(
            "journal/create",
            **self.scope,
            request_id=str(uuid4()),
            data={
                "library_title_id": title_id(source_id(origin), "fictional"),
                "started_at": "2026-10-23T00:00:00Z",
                "status": "partial",
                "watched_seconds": 3600,
                "notes": "Private note",
            },
        )

    async def test_registered_api_roundtrip(self):
        info = await self.call("info")
        self.assertEqual(
            info["result"]["entries"][0]["dataset_id"], self.scope["dataset_id"]
        )
        self.assertTrue(info["result"]["entries"][0]["features"]["automatic_tracking"])
        self.assertEqual(
            info["result"]["entries"][0]["pyk_version"], kaleidescape.__version__
        )
        self.assertFalse(info["result"]["entries"][0]["tracking_enabled"])
        created = await self.create()
        self.assertTrue(created["success"])
        record = created["result"]["viewing"]
        result = await self.call("journal/get", **self.scope, viewing_id=record["id"])
        self.assertEqual(result["result"], record)
        result = await self.call(
            "journal/list", **self.scope, query="fictional", status="partial"
        )
        self.assertEqual(len(result["result"]["items"]), 1)
        result = await self.call(
            "journal/update",
            **self.scope,
            request_id=str(uuid4()),
            viewing_id=record["id"],
            expected_revision=1,
            patch={"status": "completed"},
        )
        self.assertEqual(result["result"]["viewing"]["revision"], 2)
        result = await self.call(
            "journal/delete",
            **self.scope,
            request_id=str(uuid4()),
            viewing_id=record["id"],
            expected_revision=2,
        )
        self.assertIsNotNone(result["result"]["viewing"]["deleted_at"])

    async def test_permissions_checked_before_database(self):
        for user in (
            None,
            SimpleNamespace(is_active=False, is_admin=True),
        ):
            with self.subTest(user=user):
                with patch.object(
                    self.entry.runtime_data.repository,
                    "async_info",
                    side_effect=AssertionError("Unauthorized storage access"),
                ):
                    result = await self.call("info", user=user)
                self.assertEqual(result["code"], "unauthorized")
                result = await self.call(
                    "journal/create",
                    user=user,
                    **self.scope,
                    request_id=str(uuid4()),
                    data={"title": "x"},
                )
                self.assertEqual(result["code"], "unauthorized")

    async def test_purchase_repair_requires_and_rechecks_admin(self):
        user = SimpleNamespace(id="viewer", is_active=True, is_admin=False)
        arguments = {
            **self.scope,
            "action": "void",
            "key": "a" * 64,
            "token": "b" * 64,
            "changes": {},
        }
        repository = self.entry.runtime_data.repository
        with patch.object(
            repository, "async_purchase_repair_preview", new_callable=AsyncMock
        ) as preview:
            result = await self.call("purchases/repair/preview", user=user, **arguments)
            self.assertEqual(result["code"], "unauthorized")
            preview.assert_not_awaited()

        async def revoked(*_args):
            self.admin.is_admin = False
            return {"before": {"title": "private fictional invoice"}}

        with patch.object(
            repository, "async_purchase_repair_preview", side_effect=revoked
        ):
            result = await self.call("purchases/repair/preview", **arguments)
        self.assertEqual(result["code"], "unauthorized")
        self.assertNotIn("private fictional invoice", str(result))

    async def test_invalid_scope_and_payload(self):
        result = await self.call(
            "journal/list", **{**self.scope, "entry_id": "missing-entry"}
        )
        self.assertEqual(result["code"], "not_ready")
        with patch.object(
            self.hass.config_entries,
            "async_get_entry",
            return_value=SimpleNamespace(
                domain="unrelated", runtime_data=self.entry.runtime_data
            ),
        ):
            result = await self.call("journal/list", **self.scope)
        self.assertEqual(result["code"], "not_ready")
        result = await self.call(
            "journal/list", **{**self.scope, "dataset_id": str(uuid4())}
        )
        self.assertEqual(result["code"], "not_found")
        result = await self.call(
            "journal/create",
            **self.scope,
            request_id=str(uuid4()),
            data={"title": "Missing time"},
        )
        self.assertEqual(result["code"], "library_disabled")
        _, schema = self.hass.data["websocket_api"][f"{DOMAIN}/journal/list"]
        with self.assertRaises(probatio.Invalid):
            schema(
                {
                    "id": 2,
                    "type": f"{DOMAIN}/journal/list",
                    **self.scope,
                    "limit": "not a number",
                }
            )

    async def test_reload_reuses_dataset_and_registered_routes(self):
        created = await self.create()
        await async_unload_entry(self.hass, self.entry)
        self.assertEqual((await self.call("info"))["result"], {"entries": []})
        result = await self.call("journal/list", **self.scope)
        self.assertEqual(result["code"], "not_ready")
        with patch(
            "custom_components.kaleidescape_companion.library.sync.LibrarySync.async_start",
            new_callable=AsyncMock,
        ):
            await async_setup_entry(self.hass, self.entry)
        self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
        self.assertEqual(self.entry.runtime_data.dataset_id, self.scope["dataset_id"])
        result = await self.call(
            "journal/get", **self.scope, viewing_id=created["result"]["viewing"]["id"]
        )
        self.assertTrue(result["success"])
        self.assertEqual(self.hass.http.register_view.call_count, 4)
        self.assertEqual(
            len(
                {
                    call.args[0].name
                    for call in self.hass.http.register_view.call_args_list
                }
            ),
            4,
        )

    async def test_shutdown_drains_and_closes(self):
        await self.create()
        self.hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
        await self.hass.async_block_till_done()
        self.assertFalse(self.entry.runtime_data.ready)
        with self.assertRaises(JournalError):
            await self.entry.runtime_data.repository.async_info()

    async def test_backup_hooks_and_redacted_diagnostics(self):
        await self.create()
        await async_pre_backup(self.hass)
        self.assertEqual((await self.create())["code"], "backup_in_progress")
        await async_post_backup(self.hass)
        self.assertTrue((await self.create())["success"])
        diagnostics = await async_get_config_entry_diagnostics(self.hass, self.entry)
        self.assertEqual(diagnostics["viewing_count"], 2)
        serialized = json.dumps(diagnostics)
        for private in (
            "Fictional",
            "Private note",
            self.scope["dataset_id"],
            self.directory.name,
        ):
            self.assertNotIn(private, serialized)

    def export_request(self, user, query=""):
        request = make_mocked_request(
            "GET", "/export" + query, app={KEY_HASS: self.hass}
        )
        if user is not None:
            # HA's request auth key is currently a legacy string key.
            with warnings.catch_warnings(action="ignore", category=NotAppKeyWarning):
                request["hass_user"] = user
        return request

    async def test_http_export_rejects_unauthorized_and_invalid_scope(self):
        view = JournalExportView()
        self.assertTrue(view.requires_auth)
        for user in (None, SimpleNamespace(is_active=True, is_admin=False)):
            with self.assertRaises(web.HTTPForbidden):
                await view.get(self.export_request(user), **self.scope)
        response = await view.get(
            self.export_request(self.admin), self.entry.entry_id, str(uuid4())
        )
        self.assertEqual(response.status, 404)
        response = await view.get(
            self.export_request(self.admin, "?format=unknown"), **self.scope
        )
        self.assertEqual(response.status, 400)

    async def test_http_export_streams_snapshot_and_removes_temporary_file(self):
        await self.create()
        response = SimpleNamespace(
            prepare=AsyncMock(), write=AsyncMock(), write_eof=AsyncMock()
        )
        repository = self.entry.runtime_data.repository
        export = repository.async_export
        paths = []

        async def capture(format):
            path = await export(format)
            paths.append(path)
            return path

        with (
            patch.object(repository, "async_export", capture),
            patch(
                "custom_components.kaleidescape_companion.ui.http.web.StreamResponse",
                return_value=response,
            ),
        ):
            await JournalExportView().get(self.export_request(self.admin), **self.scope)
        data = b"".join(call.args[0] for call in response.write.call_args_list)
        self.assertEqual(json.loads(data)["viewings"][0]["title"], "Fictional Film")
        self.assertFalse(paths[0].exists())

    async def test_http_export_cleans_up_after_disconnect(self):
        response = SimpleNamespace(
            prepare=AsyncMock(),
            write=AsyncMock(side_effect=ConnectionResetError),
            write_eof=AsyncMock(),
        )
        repository = self.entry.runtime_data.repository
        export = repository.async_export
        paths = []

        async def capture(format):
            path = await export(format)
            paths.append(path)
            return path

        with (
            patch.object(repository, "async_export", capture),
            patch(
                "custom_components.kaleidescape_companion.ui.http.web.StreamResponse",
                return_value=response,
            ),
        ):
            with self.assertRaises(ConnectionResetError):
                await JournalExportView().get(
                    self.export_request(self.admin), **self.scope
                )
        self.assertFalse(paths[0].exists())

    async def test_http_cancelled_snapshot_cleans_up_when_worker_finishes(self):
        repository = self.entry.runtime_data.repository
        export = repository.async_export
        started = asyncio.Event()
        finish = asyncio.Event()
        paths = []

        async def slow_export(format):
            path = await export(format)
            paths.append(path)
            started.set()
            await finish.wait()
            return path

        with patch.object(repository, "async_export", slow_export):
            request = asyncio.create_task(
                JournalExportView().get(self.export_request(self.admin), **self.scope)
            )
            await asyncio.wait_for(started.wait(), 2)
            request.cancel()
            finish.set()
            with self.assertRaises(asyncio.CancelledError):
                await request
        self.assertFalse(paths[0].exists())

    async def test_incoming_database_references_require_administrator(self):
        viewer = SimpleNamespace(id="viewer", is_active=True, is_admin=False)
        result = await self.call(
            "database/referenced_by",
            user=viewer,
            **self.scope,
            table="viewings",
            key={"id": "fictional"},
            token="x",
            revision=1,
        )
        self.assertEqual(result["code"], "unauthorized")

    async def test_cleanup_requires_admin_and_service_preserves_selected_policy(self):
        viewer = SimpleNamespace(id="viewer", is_active=True, is_admin=False)
        result = await self.call(
            "database/cleanup/preview",
            user=viewer,
            **self.scope,
            policies={"calendar": 90},
        )
        self.assertEqual(result["code"], "unauthorized")
        result = await self.call(
            "database/cleanup/preview", **self.scope, policies={"calendar": 90}
        )
        self.assertTrue(result["success"])
        review = result["result"]
        applied = await self.call(
            "database/cleanup/apply",
            **self.scope,
            policies=review["policies"],
            as_of=review["as_of"],
            revision=review["revision"],
        )
        self.assertTrue(applied["success"])
        with patch.object(
            self.hass,
            "auth",
            SimpleNamespace(async_get_user=AsyncMock(return_value=viewer)),
            create=True,
        ):
            with self.assertRaises(HomeAssistantError):
                await self.hass.services.async_call(
                    DOMAIN,
                    "database_cleanup",
                    {"calendar": 90},
                    blocking=True,
                    context=Context(user_id="viewer"),
                )
        with patch.object(
            self.entry.runtime_data.repository,
            "async_database_cleanup",
            AsyncMock(
                return_value={
                    "removed": {"calendar": 0, "collections": 0, "playback": 0}
                }
            ),
        ) as cleanup:
            await self.hass.services.async_call(
                DOMAIN,
                "database_cleanup",
                {"calendar": 30, "playback": 365},
                blocking=True,
            )
            cleanup.assert_awaited_once_with(
                {"calendar": 30, "collections": 0, "playback": 365}
            )

    async def test_native_sync_actions_use_the_active_entry_and_unload(self):
        from unittest.mock import Mock

        runtime = self.entry.runtime_data
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime.library = SimpleNamespace(request_sync=Mock(), async_stop=AsyncMock())
        maintenance = SimpleNamespace(check=Mock(), request=Mock())
        runtime.calendar = SimpleNamespace(
            maintenance=maintenance, _tick=Mock(), async_stop=AsyncMock()
        )
        await self.hass.services.async_call(DOMAIN, "library_sync", {}, blocking=True)
        await self.hass.services.async_call(
            DOMAIN, "calendar_full_sync", {}, blocking=True
        )
        runtime.library.request_sync.assert_called_once_with()
        maintenance.check.assert_called_once_with()
        maintenance.request.assert_called_once_with()
        runtime.calendar._tick.assert_called_once_with()
        self.assertTrue(self.hass.services.has_service(DOMAIN, "library_sync"))
        await async_unload_entry(self.hass, self.entry)
        self.assertFalse(self.hass.services.has_service(DOMAIN, "library_sync"))
        self.assertFalse(self.hass.services.has_service(DOMAIN, "calendar_full_sync"))
        self.assertFalse(self.hass.services.has_service(DOMAIN, "database_cleanup"))

    async def test_library_buttons_are_available_when_platform_is_forwarded(self):
        from custom_components.kaleidescape_companion.button import (
            async_setup_entry as setup_buttons,
        )

        await async_unload_entry(self.hass, self.entry)
        object.__setattr__(
            self.entry,
            "data",
            {"library_enabled": True, "metadata_store_enabled": True},
        )
        observed = {}

        async def forward(entry, _platforms):
            def add_entities(entities):
                observed.update(
                    {
                        entity.entity_description.key: entity.available
                        for entity in entities
                    }
                )

            await setup_buttons(self.hass, entry, add_entities)

        self.hass.config_entries.async_forward_entry_setups.side_effect = forward
        with patch(
            "custom_components.kaleidescape_companion.library.sync.LibrarySync.async_start",
            new_callable=AsyncMock,
        ):
            await async_setup_entry(self.hass, self.entry)
        self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
        self.assertTrue(observed["library_sync"])
        self.assertTrue(observed["refresh_metadata"])
        self.assertFalse(observed["calendar_full_sync"])
        await async_unload_entry(self.hass, self.entry)

    async def test_failed_setup_releases_worker_and_exposes_clear_error(self):
        await async_unload_entry(self.hass, self.entry)
        for error, expected in (
            (UnsupportedSchemaError("newer schema"), ConfigEntryError),
            (JournalError("storage_error", "disk failure"), ConfigEntryNotReady),
        ):
            with (
                patch.object(JournalRepository, "async_open", side_effect=error),
                patch.object(
                    JournalRepository, "async_close", new_callable=AsyncMock
                ) as close,
            ):
                with self.assertRaises(expected):
                    await async_setup_entry(self.hass, self.entry)
                close.assert_awaited_once()
            self.assertFalse(self.entry.runtime_data.ready)

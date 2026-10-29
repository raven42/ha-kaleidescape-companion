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
from homeassistant.components.http import KEY_HASS
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady

from custom_components.kaleidescape_companion import (
    async_setup_entry,
    async_unload_entry,
)
from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.const import DOMAIN, NAME
from custom_components.kaleidescape_companion.diagnostics import (
    async_get_config_entry_diagnostics,
)
from custom_components.kaleidescape_companion.http import JournalExportView
from custom_components.kaleidescape_companion.journal import JournalError
from custom_components.kaleidescape_companion.migrations import UnsupportedSchemaError
from custom_components.kaleidescape_companion.repository import JournalRepository


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
        return await self.call(
            "journal/create",
            **self.scope,
            request_id=str(uuid4()),
            data={
                "title": "Fictional Film",
                "started_at": "2026-10-23T00:00:00Z",
                "notes": "Private note",
            },
        )

    async def test_registered_api_roundtrip(self):
        info = await self.call("info")
        self.assertEqual(
            info["result"]["entries"][0]["dataset_id"], self.scope["dataset_id"]
        )
        self.assertTrue(info["result"]["entries"][0]["features"]["automatic_tracking"])
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
        self.assertEqual(result["code"], "invalid_request")
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
        await async_setup_entry(self.hass, self.entry)
        self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
        self.assertEqual(self.entry.runtime_data.dataset_id, self.scope["dataset_id"])
        result = await self.call(
            "journal/get", **self.scope, viewing_id=created["result"]["viewing"]["id"]
        )
        self.assertTrue(result["success"])
        self.assertEqual(self.hass.http.register_view.call_count, 4)

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
                "custom_components.kaleidescape_companion.http.web.StreamResponse",
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
                "custom_components.kaleidescape_companion.http.web.StreamResponse",
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

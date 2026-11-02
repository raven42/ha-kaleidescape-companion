"""Test dashboard plans and administrator scope with fictional HA/SQLite state."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_backend as backend
import test_library as library
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.dashboard import LovelaceStorage
from homeassistant.util import yaml as yaml_util
from test_repository import viewing

from custom_components.kaleidescape_companion.ui.test_dashboard import MARKER, guide


class DashboardGeneratorTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def configure(self):
        object.__setattr__(
            self.entry,
            "options",
            {
                "library_enabled": True,
                "library_host": library.ORIGIN,
                "control_enabled": True,
                "control_host": "fictional-player.local",
                "control_player": "088000000729",
                "control_allow_launch": False,
                "media_player": "media_player.fictional_cinema",
            },
        )
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(source=library.SOURCE, async_stop=AsyncMock())
        runtime.controls = SimpleNamespace(
            players=lambda: [{"id": "a" * 64, "name": "Private device label"}],
            async_stop=AsyncMock(),
        )
        runtime.observer = SimpleNamespace(
            entities={"media_player": "media_player.fictional_cinema"},
            async_stop=AsyncMock(),
        )
        self.hass.states.async_set("media_player.fictional_cinema", "idle")
        self.hass.data[LOVELACE_DATA] = SimpleNamespace(dashboards={})
        await runtime.repository.async_library_catalog(library.ORIGIN, library.ROWS, {})
        await runtime.repository.async_create(
            str(uuid4()), viewing(title="Private movie label")
        )

    async def preview(self, **values):
        return await self.call(
            "dashboard/preview",
            **self.scope,
            request_id=values.pop("request_id", str(uuid4())),
            name=values.pop("name", "Test cinema"),
            **values,
        )

    async def test_preflight_fails_without_config_and_reader_is_denied(self):
        result = await self.preview()
        self.assertEqual(result["code"], "dashboard_prerequisites")
        self.assertIn("Save settings", result["message"])
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        result = await self.preview(user=reader)
        self.assertEqual(result["code"], "unauthorized")

    async def test_plan_has_seven_area_views_all_card_types_and_no_household_text(self):
        await self.configure()
        response = await self.preview()
        self.assertTrue(response["success"], response)
        plan = response["result"]
        self.assertEqual(len(plan["views"]), 7)
        self.assertEqual(yaml_util.parse_yaml(plan["yaml"]), plan["config"])
        self.assertEqual(self.hass.data[LOVELACE_DATA].dashboards, {})
        encoded = json.dumps(plan)
        for value in (
            "Private movie label",
            "Private device label",
            "088000000729",
            "fictional-player.local",
            library.ORIGIN,
        ):
            self.assertNotIn(value, encoded)
        for kind in (
            "remote",
            "now-playing",
            "library-covers",
            "library-search",
            "library",
            "journal-calendar",
        ):
            self.assertIn(f"custom:kaleidescape-{kind}-card", encoded)
        self.assertIn("Movie launch is disabled", encoded)
        self.assertEqual(plan["config"]["views"][5]["type"], "panel")

    async def test_verify_reads_actual_ha_config_and_rejects_changed_marker(self):
        await self.configure()
        request = str(uuid4())
        plan = (await self.preview(request_id=request))["result"]
        result = await self.call("dashboard/verify", **self.scope, request_id=request)
        self.assertEqual(result["code"], "dashboard_incomplete")
        dashboard = LovelaceStorage(
            self.hass,
            {
                "id": plan["url_path"],
                "url_path": plan["url_path"],
                "title": plan["title"],
                "mode": "storage",
            },
        )
        self.hass.data[LOVELACE_DATA].dashboards[plan["url_path"]] = dashboard
        result = await self.call("dashboard/verify", **self.scope, request_id=request)
        self.assertEqual(result["code"], "dashboard_incomplete")
        await dashboard.async_save(plan["config"])
        result = await self.call("dashboard/verify", **self.scope, request_id=request)
        self.assertEqual(result["result"]["views"], 7)
        plan["config"][MARKER] = {"request_id": "different"}
        await dashboard.async_save(plan["config"])
        result = await self.call("dashboard/verify", **self.scope, request_id=request)
        self.assertEqual(result["code"], "dashboard_conflict")

    async def test_role_changes_withhold_the_prepared_yaml(self):
        await self.configure()

        async def downgrade(*_args):
            self.admin.is_admin = False
            return {"yaml": "private prepared payload"}

        with patch(
            "custom_components.kaleidescape_companion.ui.test_dashboard.prepare",
            side_effect=downgrade,
        ):
            result = await self.preview()
        self.assertEqual(result["code"], "unauthorized")
        self.assertNotIn("result", result)

    async def test_name_and_scope_are_validated_and_generation_is_repeatable(self):
        await self.configure()
        result = await self.preview(name="bad\nname")
        self.assertEqual(result["code"], "invalid_request")
        request = str(uuid4())
        first = await self.preview(request_id=request)
        second = await self.preview(request_id=request)
        self.assertEqual(first["result"], second["result"])
        for operation in ("dashboard/preview", "dashboard/verify"):
            reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
            result = await self.call(
                operation,
                user=reader,
                **self.scope,
                request_id=request,
                **({"name": "Test"} if operation.endswith("preview") else {}),
            )
            self.assertEqual(result["code"], "unauthorized")

    async def test_control_host_may_use_the_configured_library_host(self):
        await self.configure()
        object.__setattr__(
            self.entry, "options", {**self.entry.options, "control_host": ""}
        )
        result = await self.call(
            "dashboard/preview",
            **self.scope,
            request_id=str(uuid4()),
            name="Fictional guide",
        )
        self.assertTrue(result["success"], result)

    async def test_default_hosts_and_default_player_source_need_no_tracking_observer(
        self,
    ):
        await self.configure()
        self.entry.runtime_data.observer = None
        object.__setattr__(
            self.entry,
            "options",
            {
                **self.entry.options,
                "control_host": "",
                "library_host": "",
                "media_player": "",
            },
        )
        with patch(
            "custom_components.kaleidescape_companion.ui.test_dashboard.source_entity",
            return_value="media_player.fictional_cinema",
        ) as entity:
            result = await self.preview()
        self.assertTrue(result["success"], result)
        entity.assert_called_once_with(self.hass, self.entry.options["control_player"])

    async def test_prerequisite_logs_identify_the_exact_missing_setting(self):
        await self.configure()
        object.__setattr__(
            self.entry, "options", {**self.entry.options, "control_player": ""}
        )
        result = await self.preview()
        self.assertEqual(result["code"], "dashboard_prerequisites")
        self.assertIn("select and save a default player", result["message"])
        self.assertNotIn("enable playback controls", result["message"])
        events = self.entry.runtime_data.repository.logger.snapshot()
        reasons = [event.reason for event in events]
        self.assertIn("dashboard_default_player", reasons)
        self.assertNotIn("dashboard_controls_disabled", reasons)


class GuideContentTest(unittest.TestCase):
    def test_examples_and_views_stay_bounded(self):
        plan = guide("Example", "entry", ["a" * 64] * 1000, str(uuid4()), True)
        self.assertLess(len(plan["yaml"].encode()), 262144)
        self.assertNotIn("Movie launch is disabled", plan["yaml"])
        self.assertIn("Search at the bottom", plan["yaml"])
        self.assertIn("Toolbar off / list layout", plan["yaml"])

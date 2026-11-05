"""Configuration entities use the same validation and sync entry points."""

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from homeassistant.exceptions import HomeAssistantError

from custom_components.kaleidescape_companion.button import (
    DESCRIPTIONS as BUTTONS,
)
from custom_components.kaleidescape_companion.button import (
    CompanionButton,
)
from custom_components.kaleidescape_companion.switch import (
    DESCRIPTIONS as SWITCHES,
)
from custom_components.kaleidescape_companion.switch import (
    CompanionSwitch,
)


class ActionEntitiesTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.library = SimpleNamespace(request_sync=Mock())
        self.metadata = SimpleNamespace(request_sync=Mock())
        self.maintenance = SimpleNamespace(enabled=True, check=Mock(), request=Mock())
        self.calendar = SimpleNamespace(maintenance=self.maintenance, _tick=Mock())
        self.runtime = SimpleNamespace(
            dataset_id="test-dataset",
            ready=True,
            library=self.library,
            enrichment=self.metadata,
            calendar=self.calendar,
            preserve_panel_on_reload=False,
        )
        self.entry = SimpleNamespace(
            runtime_data=self.runtime, options={}, data={}, entry_id="test-entry"
        )
        self.hass = SimpleNamespace(
            config_entries=SimpleNamespace(
                async_update_entry=Mock(), async_reload=AsyncMock()
            ),
            async_create_task=asyncio.create_task,
            states=SimpleNamespace(get=Mock(return_value=None)),
        )

    def switch(self, key):
        entity = CompanionSwitch(self.entry, next(x for x in SWITCHES if x.key == key))
        entity.hass = self.hass
        entity.async_write_ha_state = Mock()
        return entity

    async def test_buttons_request_existing_background_operations(self):
        self.entry.options = {"library_enabled": True}
        for description in BUTTONS:
            button = CompanionButton(self.entry, description)
            self.assertTrue(button.available)
            await button.async_press()
        self.library.request_sync.assert_called_once_with()
        self.metadata.request_sync.assert_called_once_with(force=True)
        self.maintenance.check.assert_called_once_with()
        self.maintenance.request.assert_called_once_with()
        self.calendar._tick.assert_called_once_with()
        self.entry.options = {"library_enabled": False}
        self.assertFalse(button.available)
        with self.assertRaises(HomeAssistantError):
            await button.async_press()

    async def test_switch_updates_options_and_schedules_reload(self):
        entity = self.switch("library_enabled")
        with patch(
            "custom_components.kaleidescape_companion.switch.entity_ids",
            return_value={},
        ):
            await entity.async_turn_on()
        self.assertTrue(
            self.hass.config_entries.async_update_entry.call_args.kwargs["options"][
                "library_enabled"
            ]
        )
        self.assertTrue(self.runtime.preserve_panel_on_reload)
        await asyncio.sleep(0)
        self.hass.config_entries.async_reload.assert_awaited_once_with("test-entry")

    async def test_missing_tracking_or_calendar_configuration_is_rejected(self):
        for key in ("tracking_enabled", "calendar_enabled"):
            entity = self.switch(key)
            with (
                patch(
                    "custom_components.kaleidescape_companion.switch.entity_ids",
                    return_value={},
                ),
                patch(
                    "custom_components.kaleidescape_companion.core.settings.er.async_get",
                    return_value=Mock(),
                ),
            ):
                with self.assertRaises(HomeAssistantError):
                    await entity.async_turn_on()
        self.hass.config_entries.async_update_entry.assert_not_called()
        self.hass.config_entries.async_reload.assert_not_awaited()

    async def test_turning_off_keeps_unrelated_options(self):
        self.entry.options = {
            "calendar_enabled": True,
            "tracking_enabled": False,
            "metadata_store_enabled": True,
        }
        entity = self.switch("calendar_enabled")
        with patch(
            "custom_components.kaleidescape_companion.switch.entity_ids",
            return_value={},
        ):
            await entity.async_turn_off()
        options = self.hass.config_entries.async_update_entry.call_args.kwargs[
            "options"
        ]
        self.assertFalse(options["calendar_enabled"])
        self.assertTrue(options["metadata_store_enabled"])
        await asyncio.sleep(0)


class SyncActionsTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from custom_components.kaleidescape_companion.services import (
            async_register_services,
        )

        self.library = SimpleNamespace(request_sync=Mock())
        self.maintenance = SimpleNamespace(enabled=True, check=Mock(), request=Mock())
        self.calendar = SimpleNamespace(maintenance=self.maintenance, _tick=Mock())
        self.runtime = SimpleNamespace(
            ready=True, library=self.library, calendar=self.calendar
        )
        self.entry = SimpleNamespace(
            runtime_data=self.runtime, options={"library_enabled": True}, data={}
        )
        self.hass = SimpleNamespace(
            services=SimpleNamespace(async_register=Mock()),
            auth=SimpleNamespace(async_get_user=AsyncMock()),
            config_entries=SimpleNamespace(
                async_get_entry=Mock(return_value=self.entry)
            ),
        )
        async_register_services(self.hass)
        self.handlers = {
            call.args[1]: (call.args[2], call.kwargs["schema"])
            for call in self.hass.services.async_register.call_args_list
        }

    async def call(self, name, user_id=None):
        from homeassistant.core import Context, ServiceCall

        handler, schema = self.handlers[name]
        call = ServiceCall(
            self.hass,
            "kaleidescape_companion",
            name,
            schema({}),
            context=Context(user_id=user_id),
        )
        with patch(
            "custom_components.kaleidescape_companion.services.loaded_runtimes",
            return_value=[("entry", self.runtime)],
        ):
            await handler(call)

    async def test_actions_request_the_same_operations_as_buttons(self):
        await self.call("library_sync")
        await self.call("calendar_full_sync")
        self.library.request_sync.assert_called_once_with()
        self.maintenance.check.assert_called_once_with()
        self.maintenance.request.assert_called_once_with()
        self.calendar._tick.assert_called_once_with()

    async def test_actions_reject_non_admin_or_unready_features(self):
        self.hass.auth.async_get_user.return_value = SimpleNamespace(
            is_active=True, is_admin=False
        )
        for action in ("library_sync", "calendar_full_sync"):
            with self.assertRaises(HomeAssistantError):
                await self.call(action, "reader")
        self.library.request_sync.assert_not_called()
        self.maintenance.request.assert_not_called()
        self.entry.options = {"library_enabled": False}
        with self.assertRaises(HomeAssistantError):
            await self.call("library_sync")
        self.maintenance.check.side_effect = ValueError("calendar disabled")
        with self.assertRaises(HomeAssistantError):
            await self.call("calendar_full_sync")
        self.maintenance.request.assert_not_called()

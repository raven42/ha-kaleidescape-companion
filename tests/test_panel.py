"""Verify sidebar lifecycle and the static asset trust boundary."""

import unittest
from unittest.mock import AsyncMock, patch

import test_backend as backend_tests
from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntries

from custom_components.kaleidescape_companion import (
    async_setup_entry,
    async_unload_entry,
)
from custom_components.kaleidescape_companion.const import NAME
from custom_components.kaleidescape_companion.panel import ASSET, ASSET_URL, PANEL_PATH


class PanelTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp

    async def test_admin_sidebar_and_static_module_are_scoped_to_code(self):
        panel = self.hass.data[frontend.DATA_PANELS][PANEL_PATH]
        self.assertFalse(panel.require_admin)
        self.assertEqual(panel.sidebar_title, NAME)
        config = panel.config["_panel_custom"]
        self.assertEqual(config["name"], "kaleidescape-panel")
        self.assertTrue(config["module_url"].startswith(ASSET_URL + "?v="))
        paths = self.hass.http.async_register_static_paths.call_args.args[0]
        self.assertEqual(len(paths), 1)
        self.assertEqual(paths[0].path, str(ASSET))
        self.assertFalse(paths[0].cache_headers)
        self.assertNotIn(self.directory.name, paths[0].path)
        await async_unload_entry(self.hass, self.entry)
        self.assertFalse(frontend.async_panel_exists(self.hass, PANEL_PATH))
        await async_setup_entry(self.hass, self.entry)
        self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
        self.assertTrue(frontend.async_panel_exists(self.hass, PANEL_PATH))
        self.assertEqual(self.hass.http.async_register_static_paths.call_count, 1)

    async def test_legacy_default_title_updates_and_custom_title_is_preserved(self):
        await async_unload_entry(self.hass, self.entry)
        self.hass.config_entries = ConfigEntries(self.hass, {})
        # Register the existing entry without invoking HA's integration loader.
        self.hass.config_entries._entries[self.entry.entry_id] = self.entry
        # HA config-entry persistence is outside this isolated lifecycle fixture.
        with (
            patch.object(self.hass.config_entries, "_async_schedule_save"),
            patch.object(
                self.hass.config_entries,
                "async_forward_entry_setups",
                new_callable=AsyncMock,
            ),
            patch.object(
                self.hass.config_entries,
                "async_unload_platforms",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            for title, expected in (
                ("Kaleidescape", NAME),
                ("My theater journal", "My theater journal"),
            ):
                with self.subTest(title=title):
                    self.hass.config_entries.async_update_entry(self.entry, title=title)
                    await async_setup_entry(self.hass, self.entry)
                    self.addAsyncCleanup(self.entry.runtime_data.repository.async_close)
                    self.assertEqual(self.entry.title, expected)
                    self.assertEqual(
                        self.entry.runtime_data.dataset_id, self.scope["dataset_id"]
                    )
                    await async_unload_entry(self.hass, self.entry)

    async def test_foreign_panel_collision_does_not_overwrite_or_remove_it(self):
        await async_unload_entry(self.hass, self.entry)
        frontend.async_register_built_in_panel(
            self.hass, "foreign", frontend_url_path=PANEL_PATH
        )
        with self.assertRaises(ValueError):
            await async_setup_entry(self.hass, self.entry)
        self.assertEqual(
            self.hass.data[frontend.DATA_PANELS][PANEL_PATH].component_name, "foreign"
        )

    async def test_failed_panel_registration_closes_backend(self):
        await async_unload_entry(self.hass, self.entry)
        with patch(
            "custom_components.kaleidescape_companion.async_setup_panel",
            side_effect=RuntimeError("fictional setup error"),
        ):
            with self.assertRaises(RuntimeError):
                await async_setup_entry(self.hass, self.entry)
        self.assertFalse(self.entry.runtime_data.ready)
        self.assertFalse(frontend.async_panel_exists(self.hass, PANEL_PATH))

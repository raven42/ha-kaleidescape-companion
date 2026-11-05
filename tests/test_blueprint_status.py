"""Verify blueprint installation, update safety and notifications."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from homeassistant import loader
from homeassistant.components.automation.helpers import async_get_blueprints
from homeassistant.core import HomeAssistant

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.ui import (
    automation_templates as templates,
)

FIXTURES = Path(__file__).parent / "fixtures" / "blueprints"


class BlueprintStatusTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(self.hass.async_stop, force=True)
        loader.async_setup(self.hass)
        self.manager = async_get_blueprints(self.hass)
        self.manager.async_populate = AsyncMock()
        self.manager._reload_blueprint_consumers = AsyncMock()
        self.root = (
            Path(self.directory.name) / "blueprints/automation/kaleidescape_companion"
        )
        self.root.mkdir(parents=True)

    def write(self, kind, content):
        (self.root / templates.TEMPLATES[kind]).write_text(content)

    def old(self, kind):
        return (FIXTURES / templates.TEMPLATES[kind]).read_text()

    async def test_fingerprints_match_packaged_and_previous_versions(self):
        for kind in templates.TEMPLATES:
            content = templates.read_template(kind)["yaml"]
            version = 3 if kind == "purchase_email" else 1
            self.assertIn(f"Blueprint version: {version}.", content)
            self.assertEqual(templates.fingerprint(content), templates.CURRENT[kind])
            self.assertEqual(
                templates.fingerprint(templates.blueprint(content).yaml()),
                templates.CURRENT[kind],
            )
            self.assertIn(
                templates.fingerprint(self.old(kind)), templates.KNOWN_OLDER[kind]
            )
        previous_receipts = (FIXTURES / "purchase_email_parser_v2.yaml").read_text()
        self.assertIn(
            templates.fingerprint(previous_receipts),
            templates.KNOWN_OLDER["purchase_email"],
        )

    async def test_install_missing_preserves_existing_and_warns_outdated(self):
        old = self.old("library_schedule")
        modified = templates.read_template("metadata_schedule")["yaml"].replace(
            "Schedule metadata refresh", "My metadata refresh"
        )
        self.write("library_schedule", old)
        self.write("metadata_schedule", modified)
        self.write("calendar_schedule", self.old("calendar_schedule"))
        with (
            patch.object(templates.persistent_notification, "async_create") as notify,
            patch.object(templates.persistent_notification, "async_dismiss"),
            self.assertLogs(templates._LOGGER, level="WARNING") as logs,
        ):
            await templates.async_install_missing(self.hass)
        self.assertEqual(
            logs.output,
            [
                f"WARNING:{templates._LOGGER.name}:Companion automation blueprints "
                "are out of date: Schedule library sync, Schedule calendar full sync"
            ],
        )
        state = await templates.async_status(self.hass, notify=False)
        self.assertEqual(state["purchase_email"]["installed_version"], 3)
        self.assertEqual(state["purchase_email"]["latest_version"], 3)
        self.assertIsNone(state["library_schedule"]["installed_version"])
        self.assertEqual(state["library_schedule"]["latest_version"], 1)
        self.assertEqual(
            [state[k]["status"] for k in templates.TEMPLATES],
            ["current", "outdated", "modified", "outdated"],
        )
        self.assertEqual(
            (self.root / templates.TEMPLATES["library_schedule"]).read_text(), old
        )
        self.assertEqual(
            (self.root / templates.TEMPLATES["metadata_schedule"]).read_text(), modified
        )
        notify.assert_called_once()
        self.assertIn(
            "Updates are available for:\n\n"
            "- Schedule library sync\n- Schedule calendar full sync\n\n"
            "Open Kaleidescape Companion Settings",
            notify.call_args.args[1],
        )
        self.assertEqual(
            notify.call_args.args[2], "Kaleidescape Companion blueprints need an update"
        )
        self.manager.async_populate.assert_awaited_once()

    async def test_explicit_update_reloads_and_notifies(self):
        for kind in templates.TEMPLATES:
            self.write(
                kind,
                self.old(kind)
                if kind == "library_schedule"
                else templates.read_template(kind)["yaml"],
            )
        before = await templates.async_status(self.hass, notify=False)
        with (
            patch.object(templates.persistent_notification, "async_create") as notify,
            patch.object(templates.persistent_notification, "async_dismiss"),
        ):
            result = await templates.async_update(
                self.hass,
                "library_schedule",
                before["library_schedule"]["revision"],
                lambda: True,
            )
        self.assertEqual(result["library_schedule"]["status"], "current")
        self.manager._reload_blueprint_consumers.assert_awaited_once()
        self.assertIn("blueprint updated", notify.call_args.args[2])

    async def test_changed_or_unauthorized_update_does_not_write(self):
        self.write("library_schedule", self.old("library_schedule"))
        before = await templates.async_status(self.hass, notify=False)
        revision = before["library_schedule"]["revision"]
        with self.assertRaises(JournalError):
            await templates.async_update(
                self.hass, "library_schedule", revision, lambda: False
            )
        changed = self.old("library_schedule").replace(
            "Schedule library sync", "Custom library sync"
        )
        self.write("library_schedule", changed)
        with self.assertRaises(JournalError):
            await templates.async_update(
                self.hass, "library_schedule", revision, lambda: True
            )
        self.assertEqual(
            (self.root / templates.TEMPLATES["library_schedule"]).read_text(), changed
        )
        self.manager._reload_blueprint_consumers.assert_not_awaited()

    async def test_reload_failure_reports_uncertain_result(self):
        self.write("library_schedule", self.old("library_schedule"))
        before = await templates.async_status(self.hass, notify=False)
        self.manager._reload_blueprint_consumers.side_effect = RuntimeError("private")
        with patch.object(templates.persistent_notification, "async_create") as notify:
            with self.assertRaises(JournalError):
                await templates.async_update(
                    self.hass,
                    "library_schedule",
                    before["library_schedule"]["revision"],
                    lambda: True,
                )
        self.assertIn("uncertain", notify.call_args.args[2])
        self.assertNotIn("private", str(notify.call_args))
        after = await templates.async_status(self.hass, notify=False)
        self.assertEqual(after["library_schedule"]["status"], "current")

    async def test_unreadable_and_symlink_are_not_replaced(self):
        target = self.root / "other.yaml"
        target.write_text("private")
        (self.root / templates.TEMPLATES["library_schedule"]).symlink_to(target)
        with (
            patch.object(templates.persistent_notification, "async_create"),
            patch.object(templates.persistent_notification, "async_dismiss"),
        ):
            await templates.async_install_missing(self.hass)
        result = await templates.async_status(self.hass, notify=False)
        self.assertEqual(result["library_schedule"]["status"], "unavailable")
        self.assertEqual(target.read_text(), "private")

"""HA blueprint validation and fictional purchase-receipt template rendering."""

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import test_backend as backend
from homeassistant import loader
from homeassistant.components.automation.config import (
    AUTOMATION_BLUEPRINT_SCHEMA,
    async_validate_config_item,
)
from homeassistant.components.blueprint.models import Blueprint, BlueprintInputs
from homeassistant.core import Context, HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import condition, trigger
from homeassistant.helpers.script import Script
from homeassistant.helpers.template import Template
from homeassistant.util.yaml import load_yaml

from custom_components.kaleidescape_companion.library.purchase_email import normalize
from custom_components.kaleidescape_companion.services import async_register_services
from custom_components.kaleidescape_companion.ui.automation_templates import TEMPLATES

TEMPLATE_DIR = (
    Path(__file__).resolve().parents[1]
    / "custom_components/kaleidescape_companion/templates"
)
BODY = """Order ID EXAMPLE123
Order Date: October 13, 2026
Item Quality Price
[image: Cover]
The Fictional Voyage <https://e.invalid/movie-store/movie/voyage-2025> $19.99 $9.99
[image: Cover]
Example Set <https://www.kaleidescape.com/movie-store/set/example_set> $20.00 $10.00
First Movie <https://www.kaleidescape.com/movie-store/movie/details/123> Included
Second Movie <https://www.kaleidescape.com/movie-store/movie/details/456> Included
Subtotal $19.99
Taxes $1.00
Total $20.99"""


class BlueprintTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(self.hass.async_stop, force=True)

    async def render(self, body, subject="Kaleidescape Store Receipt", date=None):
        doc = load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"]))
        values = {
            "email": {"text": body, "date": date},
            "trigger": SimpleNamespace(
                event=SimpleNamespace(data={"subject": subject})
            ),
        }
        for action in doc["actions"]:
            for key, value in action.get("variables", {}).items():
                values[key] = Template(value, self.hass).async_render(
                    values, parse_result=True
                )
        return values

    async def test_blueprints_use_native_schema_and_substitute_inputs(self):
        loader.async_setup(self.hass)
        await trigger.async_setup(self.hass)
        await condition.async_setup(self.hass)
        inputs = {
            "purchase_email": {"imap_entry": "fictional-imap"},
            "library_schedule": {},
            "metadata_schedule": {},
            "calendar_schedule": {},
        }
        for kind, filename in TEMPLATES.items():
            with self.subTest(kind=kind):
                blueprint = Blueprint(
                    load_yaml(str(TEMPLATE_DIR / filename)),
                    expected_domain="automation",
                    schema=AUTOMATION_BLUEPRINT_SCHEMA,
                )
                instance = BlueprintInputs(
                    blueprint,
                    {"use_blueprint": {"path": filename, "input": inputs[kind]}},
                )
                instance.validate()
                value = instance.async_substitute()
                self.assertIn("triggers", value)
                self.assertIn("actions", value)
                with patch("homeassistant.loader._LOGGER.warning"):
                    validated = await async_validate_config_item(
                        self.hass, "test", value
                    )
                self.assertEqual(validated.validation_status, "ok")
                if kind == "calendar_schedule":
                    self.assertEqual(value["actions"][1]["delay"], "00:11:00")
                    self.assertEqual(
                        [value["actions"][i]["action"] for i in (0, 2)],
                        ["kaleidescape_companion.calendar_full_sync"] * 2,
                    )
                if kind == "library_schedule":
                    self.assertEqual(
                        value["actions"][0]["action"],
                        "kaleidescape_companion.library_sync",
                    )
                if kind in {"library_schedule", "calendar_schedule"}:
                    # Automations created from the prior blueprint may retain
                    # the obsolete selection. HA must still substitute them.
                    old = BlueprintInputs(
                        blueprint,
                        {
                            "use_blueprint": {
                                "path": filename,
                                "input": {"sync_button": "button.old"},
                            }
                        },
                    )
                    old.validate()
                    self.assertEqual(
                        old.async_substitute()["actions"][0], value["actions"][0]
                    )
                if kind == "metadata_schedule":
                    selector = blueprint.inputs["providers"]["selector"]["select"]
                    self.assertTrue(selector["multiple"])
                    self.assertTrue(selector["custom_value"])

    async def test_receipt_parses_set_and_calls_import_with_reconciled_values(self):
        values = await self.render(BODY)
        self.assertTrue(values["receipt_valid"])
        result = normalize(values["receipt"])
        self.assertEqual(len(result), 3)
        self.assertEqual(
            sum(
                int(row["purchase_price"].replace("$", "").replace(".", ""))
                for row in result
            ),
            1999,
        )
        doc = load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"]))
        sequence = doc["actions"][-1]["choose"][0]["sequence"]
        self.assertEqual(
            sequence[0]["action"], "kaleidescape_companion.import_purchase_email"
        )
        self.assertNotIn("system_log.write", str(doc))

    async def test_receipt_script_fetches_and_calls_the_real_import_action(self):
        loader.async_setup(self.hass)
        await trigger.async_setup(self.hass)
        await condition.async_setup(self.hass)
        doc = load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"]))
        blueprint = Blueprint(
            doc, expected_domain="automation", schema=AUTOMATION_BLUEPRINT_SCHEMA
        )
        inputs = BlueprintInputs(
            blueprint,
            {
                "use_blueprint": {
                    "path": "receipt.yaml",
                    "input": {"imap_entry": "fictional-imap"},
                }
            },
        )
        inputs.validate()
        with patch("homeassistant.loader._LOGGER.warning"):
            validated = await async_validate_config_item(
                self.hass, "test", inputs.async_substitute()
            )

        current_body = [BODY]

        async def fetch(call):
            self.assertEqual(call.data["entry"], "fictional-imap")
            return {"text": current_body[0], "date": None}

        notifications = []
        self.hass.services.async_register(
            "persistent_notification",
            "create",
            lambda call: notifications.append(call.data),
        )
        self.hass.services.async_register(
            "imap", "fetch", fetch, supports_response=SupportsResponse.ONLY
        )
        async_register_services(self.hass)
        repo = SimpleNamespace(
            async_purchase_email=AsyncMock(return_value={"status": "imported"})
        )
        runtime = SimpleNamespace(repository=repo)
        script = Script(self.hass, validated["actions"], "receipt-test", "automation")
        event = SimpleNamespace(
            data={
                "entry_id": "fictional-imap",
                "uid": "123",
                "subject": "Kaleidescape Store Receipt",
            }
        )
        with patch(
            "custom_components.kaleidescape_companion.services.loaded_runtimes",
            return_value=[("entry", runtime)],
        ):
            await script.async_run(
                {"trigger": SimpleNamespace(event=event)}, context=Context()
            )
            payload = repo.async_purchase_email.await_args.args[0]
            self.assertEqual(len(normalize(payload)), 3)
            repo.async_purchase_email.return_value = {
                "status": "needs_review",
                "imported_count": 2,
                "updated_count": 0,
                "unchanged_count": 0,
                "issues": [{"title": "Private title", "reason": "unmatched"}],
                "review_records": [],
            }
            await script.async_run(
                {"trigger": SimpleNamespace(event=event)}, context=Context()
            )
            self.assertIn("2 purchases imported", notifications[0]["message"])
            self.assertIn("1 need review", notifications[0]["message"])
            self.assertNotIn("Private title", notifications[0]["message"])
            current_body[0] = BODY.replace("Total $20.99", "Total $21.00")
            await script.async_run(
                {"trigger": SimpleNamespace(event=event)}, context=Context()
            )
        self.assertEqual(repo.async_purchase_email.await_count, 2)
        self.assertEqual(len(notifications), 2)

    async def test_incomplete_duplicate_or_one_cent_disagreement_is_rejected(self):
        for body in (
            BODY.replace("Subtotal $19.99", "Subtotal $20.00"),
            BODY.replace("Total $20.99", "Total $21.00"),
            BODY.replace("Example Set <", " <"),
            BODY.replace("Second Movie <", "First Movie <").replace(
                "details/456", "details/123"
            ),
            BODY.replace("$19.99 $9.99", ""),
        ):
            with self.subTest(body=body):
                self.assertFalse((await self.render(body))["receipt_valid"])

    async def test_header_spacing_and_sender_filter(self):
        values = await self.render(
            BODY.replace("Item Quality Price", "ITEM  Quality   Price")
        )
        self.assertTrue(values["receipt_valid"])
        doc = load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"]))
        expression = doc["conditions"][0]["value_template"]
        trigger_value = SimpleNamespace(
            event=SimpleNamespace(
                data={
                    "subject": "kaleidescape store receipt",
                    "sender": "Store <shop@example.invalid>",
                }
            )
        )
        self.assertTrue(
            Template(expression, self.hass).async_render(
                {"trigger": trigger_value, "sender_filter": "shop@example.invalid"},
                parse_result=True,
            )
        )
        self.assertFalse(
            Template(expression, self.hass).async_render(
                {"trigger": trigger_value, "sender_filter": "other@example.invalid"},
                parse_result=True,
            )
        )

    async def test_iso_date_fallback_and_forward_does_not_use_forward_date(self):
        body = BODY.replace("Order Date: October 13, 2026\n", "")
        values = await self.render(body, date="2026-10-13T12:30:00+00:00")
        self.assertEqual(values["purchased_on"], "2026-10-13")
        forward = await self.render(
            body,
            subject="FW: Kaleidescape Store Receipt",
            date="2026-10-13T12:30:00+00:00",
        )
        self.assertIsNone(forward["purchased_on"])
        self.assertFalse(forward["receipt_valid"])


class BlueprintAccessTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_templates_require_admin_and_fixed_names(self):
        response = await self.call(
            "automations/template", **self.scope, template="metadata_schedule"
        )
        self.assertTrue(response["success"])
        self.assertIn(
            "kaleidescape_companion.refresh_metadata", response["result"]["yaml"]
        )
        reader = SimpleNamespace(id="reader", is_admin=False, is_active=True)
        response = await self.call(
            "automations/template",
            user=reader,
            **self.scope,
            template="metadata_schedule",
        )
        self.assertEqual(response["code"], "unauthorized")

    async def test_status_and_updates_require_admin(self):
        reader = SimpleNamespace(id="reader", is_admin=False, is_active=True)
        for operation, extra in (
            ("automations/status", {}),
            ("automations/update", {"template": "library_schedule", "revision": "old"}),
        ):
            response = await self.call(operation, user=reader, **self.scope, **extra)
            self.assertEqual(response["code"], "unauthorized")


class MetadataActionTest(unittest.IsolatedAsyncioTestCase):
    async def test_service_passes_selection_and_rejects_non_admin(self):
        hass = SimpleNamespace(
            services=SimpleNamespace(async_register=Mock()),
            auth=SimpleNamespace(async_get_user=AsyncMock()),
        )
        async_register_services(hass)
        registration = next(
            call
            for call in hass.services.async_register.call_args_list
            if call.args[1] == "refresh_metadata"
        )
        handler, schema = registration.args[2], registration.kwargs["schema"]
        data = schema({"providers": ["tmdb"], "only_missing": True})
        sync = SimpleNamespace(request_sync=Mock())
        runtime = SimpleNamespace(enrichment=sync)
        with patch(
            "custom_components.kaleidescape_companion.services.loaded_runtimes",
            return_value=[("entry", runtime)],
        ):
            call = ServiceCall(hass, "kaleidescape_companion", "refresh_metadata", data)
            await handler(call)
            sync.request_sync.assert_called_once_with(
                None, force=True, providers=("tmdb",), only_missing=True
            )
            call.context = Context(user_id="reader")
            hass.auth.async_get_user.return_value = SimpleNamespace(
                is_active=True, is_admin=False
            )
            with self.assertRaises(HomeAssistantError):
                await handler(call)
        import voluptuous as vol

        with self.assertRaises(vol.Invalid):
            schema({"providers": ["other"]})

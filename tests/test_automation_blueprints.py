"""HA blueprint validation and fictional purchase-receipt template rendering."""

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from zoneinfo import ZoneInfo

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

LEGACY_RECEIPT = (
    Path(__file__).parent / "fixtures/blueprints/purchase_email_parser_v6.yaml"
)

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

UNLINKED_BODY = """Order Information
Order ID EXAMPLE123
Item

Quality

Price
The Fictional Voyage

    $19.99

    $9.99

Another Fictional Movie

    $14.99

    $4.99

The Last Example

    $9.99

    $9.99

    &nbsp;
Subtotal $24.97
Taxes $2.00
Total $26.97"""


class BlueprintTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.hass = HomeAssistant(self.directory.name)
        self.addAsyncCleanup(self.hass.async_stop, force=True)

    async def render(self, body, subject="Kaleidescape Store Receipt", date=None):
        doc = load_yaml(str(LEGACY_RECEIPT))
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
        doc = load_yaml(str(LEGACY_RECEIPT))
        sequence = doc["actions"][-1]["choose"][0]["sequence"]
        self.assertEqual(
            sequence[1]["action"], "kaleidescape_companion.import_purchase_email"
        )
        self.assertNotIn("system_log.write", str(doc))

    async def test_receipt_script_fetches_html_and_passes_selected_fields_to_action(
        self,
    ):
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
                    "input": {
                        "imap_entry": "fictional-imap",
                        "import_fields": ["purchase-price"],
                    },
                }
            },
        )
        inputs.validate()
        with patch("homeassistant.loader._LOGGER.warning"):
            validated = await async_validate_config_item(
                self.hass, "test", inputs.async_substitute()
            )

        async def fetch(call):
            return {
                "text": UNLINKED_BODY,
                "date": "2026-10-13T12:30:00+00:00",
                "parts": {"1": {"content_type": "text/html"}},
            }

        async def fetch_part(call):
            self.assertEqual(str(call.data["part"]), "1")
            return {
                "content_type": "text/html",
                "content_transfer_encoding": "quoted-printable",
                "part_data": "<p>Fictional HTML</p>",
            }

        notifications = []
        self.hass.services.async_register(
            "persistent_notification",
            "create",
            lambda call: notifications.append(call.data),
        )
        self.hass.services.async_register(
            "imap", "fetch", fetch, supports_response=SupportsResponse.ONLY
        )
        self.hass.services.async_register(
            "imap", "fetch_part", fetch_part, supports_response=SupportsResponse.ONLY
        )
        async_register_services(self.hass)
        repo = SimpleNamespace(
            async_purchase_email=AsyncMock(
                return_value={
                    "status": "needs_review",
                    "imported_count": 2,
                    "pending_count": 1,
                    "issues": [{"title": "Private title", "reason": "unmatched"}],
                }
            )
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
        with (
            patch(
                "custom_components.kaleidescape_companion.services.loaded_runtimes",
                return_value=[("entry", runtime)],
            ),
            patch("custom_components.kaleidescape_companion.services._LOGGER.warning"),
        ):
            await script.async_run(
                {
                    "trigger": SimpleNamespace(event=event),
                    "import_fields": ["purchase-price"],
                },
                context=Context(),
            )
        payload = repo.async_purchase_email.await_args.args[0]
        self.assertEqual(payload["email"]["text"], UNLINKED_BODY)
        self.assertEqual(payload["selected_fields"], ["purchase-price"])
        self.assertEqual(payload["html_part"]["part_data"], "<p>Fictional HTML</p>")
        self.assertIn("1 saved without a Library match", notifications[0]["message"])

    async def test_receipt_blueprint_imports_text_when_html_fetch_fails(self):
        from custom_components.kaleidescape_companion.core.repository import (
            JournalRepository,
        )

        loader.async_setup(self.hass)
        await trigger.async_setup(self.hass)
        await condition.async_setup(self.hass)
        blueprint = Blueprint(
            load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"])),
            expected_domain="automation",
            schema=AUTOMATION_BLUEPRINT_SCHEMA,
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

        async def fetch(call):
            return {
                "text": UNLINKED_BODY,
                "date": "2026-10-13T12:30:00+00:00",
                "parts": {"1": {"content_type": "text/html"}},
            }

        async def fail_part(call):
            raise HomeAssistantError("fictional fetch failure")

        self.hass.services.async_register(
            "imap", "fetch", fetch, supports_response=SupportsResponse.ONLY
        )
        self.hass.services.async_register(
            "imap", "fetch_part", fail_part, supports_response=SupportsResponse.ONLY
        )
        self.hass.services.async_register(
            "persistent_notification", "create", lambda call: None
        )
        async_register_services(self.hass)
        repo = JournalRepository(Path(self.directory.name) / "journal.sqlite3")
        await repo.async_open()
        self.addAsyncCleanup(repo.async_close)
        script = Script(self.hass, validated["actions"], "receipt-test", "automation")
        event = SimpleNamespace(
            data={
                "entry_id": "fictional-imap",
                "uid": "123",
                "subject": "Kaleidescape Store Receipt",
            }
        )
        fields = ["transaction-id", "purchase-price", "retail-price", "purchase-date"]
        with (
            patch(
                "custom_components.kaleidescape_companion.services.loaded_runtimes",
                return_value=[("entry", SimpleNamespace(repository=repo))],
            ),
            patch(
                "custom_components.kaleidescape_companion.services._LOGGER.warning"
            ) as warning,
            patch.object(Script, "_log"),
        ):
            await script.async_run(
                {"trigger": SimpleNamespace(event=event), "import_fields": fields},
                context=Context(),
            )
        rows = (await repo.async_inspect("purchase_records"))["items"]
        self.assertEqual(len(rows), 3)
        self.assertTrue(
            any("html_part_unavailable" in str(call) for call in warning.call_args_list)
        )

    async def test_receipt_blueprint_rejects_empty_field_selection(self):
        loader.async_setup(self.hass)
        await trigger.async_setup(self.hass)
        await condition.async_setup(self.hass)
        blueprint = Blueprint(
            load_yaml(str(TEMPLATE_DIR / TEMPLATES["purchase_email"])),
            expected_domain="automation",
            schema=AUTOMATION_BLUEPRINT_SCHEMA,
        )
        inputs = BlueprintInputs(
            blueprint,
            {
                "use_blueprint": {
                    "path": "receipt.yaml",
                    "input": {"imap_entry": "fictional-imap", "import_fields": []},
                }
            },
        )
        inputs.validate()
        with patch("homeassistant.loader._LOGGER.warning"):
            validated = await async_validate_config_item(
                self.hass, "test", inputs.async_substitute()
            )
        script = Script(self.hass, validated["actions"], "receipt-test", "automation")
        with patch.object(Script, "_log") as script_log:
            await script.async_run(
                {
                    "trigger": SimpleNamespace(event=SimpleNamespace(data={})),
                    "import_fields": [],
                },
                context=Context(),
            )
        self.assertTrue(
            any(
                "Select at least one receipt field" in str(call)
                for call in script_log.call_args_list
            ),
            script_log.call_args_list,
        )

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

    async def test_original_receipt_without_links_imports_complete_price_pairs(self):
        values = await self.render(UNLINKED_BODY, date="2026-10-13T12:30:00+00:00")
        self.assertTrue(values["receipt_valid"])
        self.assertEqual(values["purchased_on"], "2026-10-13")
        purchases = values["purchases"]
        self.assertEqual(
            [item["title"] for item in purchases],
            ["The Fictional Voyage", "Another Fictional Movie", "The Last Example"],
        )
        self.assertEqual(
            [item["purchase_price"] for item in purchases],
            ["$9.99", "$4.99", "$9.99"],
        )
        self.assertTrue(all(item["href"] is None for item in purchases))
        self.assertEqual(len(normalize(values["receipt"])), 3)

    async def test_original_receipt_without_links_rejects_ambiguous_items(self):
        for body in (
            UNLINKED_BODY.replace("    $19.99\n", "", 1),
            UNLINKED_BODY.replace("    $9.99\n\n    &nbsp;", "\n    &nbsp;", 1),
            UNLINKED_BODY.replace("The Last Example", "The Fictional Voyage"),
            UNLINKED_BODY.replace("The Last Example", "The Last Example Included"),
            UNLINKED_BODY.replace("Subtotal $24.97", "Subtotal $24.98"),
        ):
            with self.subTest(body=body):
                values = await self.render(body, date="2026-10-13T12:30:00+00:00")
                self.assertFalse(values["receipt_valid"])

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

    async def test_original_utc_email_date_uses_home_assistant_timezone(self):
        body = BODY.replace("Order Date: October 13, 2026\n", "")
        with patch(
            "homeassistant.util.dt.DEFAULT_TIME_ZONE", ZoneInfo("America/Chicago")
        ):
            values = await self.render(body, date="2026-10-14T04:35:00+00:00")
        self.assertTrue(values["receipt_valid"])
        self.assertEqual(values["purchased_on"], "2026-10-13")

    async def test_nested_forward_strips_quotes_and_uses_original_receipt_date(self):
        receipt = """From: Kaleidescape Movie Store <store@kaleidescape.com>
Date: Tue, Oct 13, 2026 at 9:01\u202fAM
Subject: Kaleidescape Store Receipt (Order ID EXAMPLE123)

Order Information - 2 Items Order ID EXAMPLE123
Item Quality Price
The Fictional Voyage
<https://store.kaleidescape.com/movie-store/movie/details/123> [image:
HD] $19.99 $9.99
Another Fictional Movie <https://store.kaleidescape.com/movie-store/movie/details/456>
[image:
4K] $14.99 $4.99
    Subtotal $14.98
    Taxes $1.00
    Total $15.98"""
        for prefix in ("> ", "> > "):
            with self.subTest(prefix=prefix):
                quoted = "\r\n".join(prefix + line for line in receipt.splitlines())
                body = (
                    "From: Forwarder <forwarder@example.invalid>\r\n"
                    "Date: Wed, Oct 14, 2026 at 8:08\u202fPM\r\n"
                    "Subject: Fwd: Kaleidescape Store Receipt\r\n\r\n" + quoted
                )
                values = await self.render(
                    body,
                    subject="Fwd: Kaleidescape Store Receipt",
                    date="2026-10-15T12:30:00+00:00",
                )
                self.assertTrue(values["receipt_valid"])
                self.assertEqual(values["purchased_on"], "2026-10-13")
                self.assertEqual(values["total"], 15.98)
                self.assertEqual(
                    [item["title"] for item in values["purchases"]],
                    ["The Fictional Voyage", "Another Fictional Movie"],
                )
                self.assertEqual(
                    [item["purchase_price"] for item in values["purchases"]],
                    ["$9.99", "$4.99"],
                )

    async def test_forward_with_cover_and_title_links_for_each_movie(self):
        body = """From: Kaleidescape Movie Store <store@kaleidescape.com>
Date: Tue, Oct 13, 2026 at 9:01 AM
Subject: Kaleidescape Store Receipt (Order ID EXAMPLE123)

Item Quality Price
[image: Cover]
<https://store.kaleidescape.com/movie-store/movie/details/123> The Fictional
Voyage Beyond
<https://store.kaleidescape.com/movie-store/movie/details/123> [image:
HD] $19.99 $9.99
[image: Cover]
<https://store.kaleidescape.com/movie-store/movie/details/456> Another Fictional
Film <https://store.kaleidescape.com/movie-store/movie/details/456>
[image:
HD] $14.99 $4.99
[image: Cover]
<https://store.kaleidescape.com/movie-store/movie/details/789> The Last
Example
<https://store.kaleidescape.com/movie-store/movie/details/789> [image:
4K] $9.99 $9.99
Subtotal $24.97
Taxes $2.00
Total $26.97"""
        values = await self.render(body, subject="Fwd: Kaleidescape Store Receipt")
        self.assertTrue(values["receipt_valid"])
        self.assertEqual(
            [item["title"] for item in values["purchases"]],
            [
                "The Fictional Voyage Beyond",
                "Another Fictional Film",
                "The Last Example",
            ],
        )
        self.assertEqual(
            [item["purchase_price"] for item in values["purchases"]],
            ["$9.99", "$4.99", "$9.99"],
        )
        self.assertEqual(len(normalize(values["receipt"])), 3)
        duplicate = body.replace("details/789", "details/123")
        values = await self.render(duplicate, subject="Fwd: Kaleidescape Store Receipt")
        self.assertTrue(values["parsed"]["duplicate_movie"])
        self.assertFalse(values["receipt_valid"])

    async def test_forward_without_original_receipt_date_is_rejected(self):
        body = (
            "From: Forwarder <forwarder@example.invalid>\n"
            "Date: Wed, Oct 14, 2026 at 8:08 PM\n"
            "Subject: Fwd: Kaleidescape Store Receipt\n\n"
            + "\n".join(
                "> " + line
                for line in BODY.replace(
                    "Order Date: October 13, 2026\n", ""
                ).splitlines()
            )
        )
        values = await self.render(body, subject="Fwd: Kaleidescape Store Receipt")
        self.assertIsNone(values["purchased_on"])
        self.assertFalse(values["receipt_valid"])


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

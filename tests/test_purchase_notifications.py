"""No-response receipt actions direct users to recovery that contains their data."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import test_importing as importing
import test_library as library
from homeassistant.core import ServiceCall
from homeassistant.exceptions import HomeAssistantError
from test_purchase_email import invoice, movie
from test_receipt_parser import HTML, envelope

from custom_components.kaleidescape_companion.services import async_register_services


class PurchaseNotificationTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    seed_library = importing.ImportStorageTest.seed_library

    async def call(self, payload, response=False):
        hass = SimpleNamespace(services=SimpleNamespace(async_register=Mock()))
        async_register_services(hass)
        handler = hass.services.async_register.call_args.args[2]
        with (
            patch(
                "custom_components.kaleidescape_companion.services.loaded_runtimes",
                return_value=[("entry", SimpleNamespace(repository=self.repository))],
            ),
            patch("custom_components.kaleidescape_companion.services._LOGGER"),
            patch(
                "homeassistant.components.persistent_notification.async_create"
            ) as notify,
        ):
            result = await handler(
                ServiceCall(
                    hass,
                    "kaleidescape_companion",
                    "import_purchase_email",
                    {"invoice": payload},
                    return_response=response,
                )
            )
        if response:
            notify.assert_not_called()
            return result
        self.assertIsNone(result)
        notify.assert_called_once()
        message = notify.call_args.args[1]
        for private in ("ORDER-123", "PRIVATE", "$", "£", "<table", "Fictional Voyage"):
            self.assertNotIn(private, message)
        return message

    async def test_missing_unsafe_and_empty_html_explain_no_import(self):
        for html, reason, wording in (
            (None, "html_part_unavailable", "HTML part was unavailable"),
            (
                "<table><tr><td>" + "<span>" * 5000,
                "html_items_unavailable",
                "parsed safely",
            ),
            (
                "<table><tr><td>No items</td></tr></table>",
                "html_items_unavailable",
                "parsed safely",
            ),
        ):
            with self.subTest(reason=reason):
                payload = envelope(
                    html_part={"content_type": "text/html", "part_data": html}
                )
                message = await self.call(payload)
                self.assertIn("Nothing was imported", message)
                self.assertIn(wording, message)
                self.assertIn("imap.fetch_part", message)
                self.assertIn("automation trace", message)
                self.assertNotIn("Reconcile purchases", message)
                result = await self.call(payload, response=True)
                self.assertEqual(result["status"], "needs_review")
                self.assertIn(reason, {issue["reason"] for issue in result["issues"]})
                self.assertEqual(result["extracted_records"], [])
                self.assertEqual(
                    (await self.repository.async_inspect("purchase_records"))["total"],
                    0,
                )
                self.assertEqual(
                    await self.repository.async_purchase_reconciliation("admin"),
                    {"empty": True},
                )

    def receipt(self, *, unmatched=False, incomplete=False):
        html = HTML.replace("Fictional Voyage", library.ROWS[0]["title"])
        html = html.replace(
            "Second Film",
            "PRIVATE Unmatched" if unmatched else library.ROWS[1]["title"],
        )
        if incomplete:
            html = html.replace("<s>$19.99</s>", "")
        return envelope(html)

    async def test_linked_incomplete_fields_direct_to_purchase_details(self):
        await self.seed_library()
        payload = self.receipt(incomplete=True)
        message = await self.call(payload)
        self.assertIn("Purchases were saved", message)
        self.assertIn("Purchase details", message)
        self.assertNotIn("Reconcile purchases", message)
        result = await self.call(payload, response=True)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["unchanged_count"], 2)
        self.assertEqual(
            await self.repository.async_purchase_reconciliation("admin"),
            {"empty": True},
        )

    async def test_unmatched_and_replayed_unmatched_direct_to_reconciliation(self):
        payload = self.receipt(unmatched=True)
        for _ in range(2):
            message = await self.call(payload)
            self.assertIn("Reconcile purchases", message)
            self.assertNotIn("Purchase details", message)
            plan = await self.repository.async_purchase_reconciliation("admin")
            self.assertEqual(len(plan["rows"]), 2)
        result = await self.call(payload, response=True)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual({issue["reason"] for issue in result["issues"]}, {"unmatched"})

    async def test_mixed_partial_results_include_both_destinations(self):
        await self.seed_library()
        payload = self.receipt(unmatched=True, incomplete=True)
        message = await self.call(payload)
        self.assertIn("Purchases were saved", message)
        self.assertIn("Reconcile purchases", message)
        self.assertIn("Purchase details", message)
        result = await self.call(payload, response=True)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(
            {issue["reason"] for issue in result["issues"]},
            {"retail_price_missing", "unmatched"},
        )

    async def test_conflict_and_duplicate_still_require_response(self):
        await self.seed_library()
        original = invoice(movie(library.ROWS[0]["title"]))
        await self.repository.async_purchase_email(original)
        for payload, reason in (
            (
                invoice(movie(library.ROWS[0]["title"], purchase_price="$1.00")),
                "conflict",
            ),
            (invoice(movie("PRIVATE Changed title")), "possible_duplicate"),
        ):
            with self.subTest(reason=reason):
                with self.assertRaisesRegex(
                    HomeAssistantError, "require a response variable"
                ):
                    await self.call(payload)
                result = await self.call(payload, response=True)
                self.assertEqual(result["issues"][0]["reason"], reason)
                self.assertEqual(
                    (await self.repository.async_inspect("purchase_records"))["total"],
                    1,
                )

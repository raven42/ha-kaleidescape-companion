"""Private invoice totals, exact arithmetic and administrator access."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import test_backend as backend
import test_database_admin as database
import test_importing as importing
import test_library as library
from test_purchase_importing import payload, purchase


class PurchaseTotalsTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    seed_library = importing.ImportStorageTest.seed_library
    preview = importing.ImportStorageTest.preview
    apply = importing.ImportStorageTest.apply
    assert_error = importing.ImportStorageTest.assert_error
    mutate = database.DatabaseStorageTest.mutate

    async def test_database_price_edit_updates_ledger_and_library_revision(self):
        target = await self.seed_library()
        await self.apply(await self.preview(payload(purchase(purchase_price=None))))
        before = await self.repository.async_purchase_totals(library.SOURCE)
        self.assertEqual(before["missing_purchase_prices"], 1)
        page = await self.repository.async_inspect("library", limit=100)
        index = next(i for i, row in enumerate(page["items"]) if row["id"] == target)
        await self.mutate(page, patch_data={"purchase_price": "$12.99"}, index=index)
        after = await self.repository.async_purchase_totals(library.SOURCE)
        self.assertGreater(after["revision"], before["revision"])
        self.assertEqual(after["missing_purchase_prices"], 0)

    async def test_exact_cents_repeat_orders_missing_prices_and_mixed_currencies(self):
        await self.seed_library()
        plan = await self.preview(
            payload(
                purchase(order_id="A", purchase_price="$0.10", retail_price="$0.30"),
                purchase(
                    title=library.ROWS[1]["title"],
                    order_id="A",
                    purchase_price="$0.20",
                    retail_price="$0.40",
                ),
                purchase(order_id="B", purchase_price="$1,234.56", retail_price=None),
                purchase(order_id="C", purchase_price="€2.00", retail_price="€3.00"),
                purchase(order_id=None, purchase_price=None, retail_price="$1.00"),
            )
        )
        await self.apply(plan)
        result = await self.repository.async_purchase_totals(library.SOURCE)
        self.assertEqual(result["purchase_count"], 5)
        self.assertEqual(result["unique_transactions"], 3)
        self.assertEqual(result["missing_purchase_prices"], 1)
        self.assertEqual(result["missing_retail_prices"], 1)
        self.assertEqual(result["missing_order_ids"], 1)
        self.assertEqual(result["unpaired_prices"], 2)
        self.assertEqual(
            result["currencies"],
            [
                {
                    "currency": "$",
                    "library_cost": "$1234.86",
                    "retail_price": "$1.70",
                    "savings": "$0.40",
                },
                {
                    "currency": "€",
                    "library_cost": "€2.00",
                    "retail_price": "€3.00",
                    "savings": "€1.00",
                },
            ],
        )
        self.assertEqual(
            (await self.repository.async_purchase_totals("other"))["purchase_count"], 0
        )
        # An unavailable owner still owns the invoice; availability is not spending.
        await self.repository.async_library_catalog(library.ORIGIN, [], {})
        self.assertEqual(
            (await self.repository.async_purchase_totals(library.SOURCE))["currencies"],
            result["currencies"],
        )

    async def test_zero_negative_savings_duplicate_versions_and_read_budget(self):
        await self.seed_library()
        await self.apply(
            await self.preview(
                payload(
                    purchase(purchase_price="$0.00", retail_price="$0.00"),
                    purchase(
                        order_id="SECOND", purchase_price="$10.00", retail_price="$9.00"
                    ),
                )
            )
        )

        # The ledger's primary key prevents recording one invoice twice.
        import sqlite3

        def duplicate(db):
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "INSERT INTO purchase_records "
                    "SELECT * FROM purchase_records LIMIT 1"
                )

        await self.repository._call(duplicate, self.repository._db())
        result = await self.repository.async_purchase_totals(library.SOURCE)
        self.assertEqual(result["purchase_count"], 2)
        self.assertEqual(result["duplicate_purchases"], 0)
        self.assertEqual(result["currencies"][0]["savings"], "-$1.00")
        from custom_components.kaleidescape_companion.library import purchases

        with patch.object(
            purchases, "time", SimpleNamespace(monotonic=Mock(side_effect=[0, 3]))
        ):
            with self.assert_error("purchase_totals_limit"):
                await self.repository.async_purchase_totals(library.SOURCE)


class PurchaseTotalsApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def test_financial_totals_are_admin_only_and_withheld_after_role_loss(self):
        runtime = self.entry.runtime_data
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime.library = SimpleNamespace(source=library.SOURCE, async_stop=AsyncMock())
        result = {"private_total": "$123.45"}
        user = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        with patch.object(
            runtime.repository,
            "async_purchase_totals",
            new=AsyncMock(return_value=result),
        ) as read:
            self.assertEqual(
                (await self.call("library/purchases/summary", user=user, **self.scope))[
                    "code"
                ],
                "unauthorized",
            )
            read.assert_not_awaited()
            user.is_admin = True
            response = await self.call(
                "library/purchases/summary", user=user, **self.scope
            )
            self.assertEqual(response["result"], result)
            read.assert_awaited_once_with(library.SOURCE)

            async def revoke(source):
                user.is_admin = False
                return result

            read.side_effect = revoke
            self.assertEqual(
                (await self.call("library/purchases/summary", user=user, **self.scope))[
                    "code"
                ],
                "unauthorized",
            )

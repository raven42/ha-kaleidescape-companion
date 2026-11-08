"""Receipt currency validation preserves partial invoices through the worker."""

import unittest

import test_importing as importing
import test_library as library
from test_receipt_parser import envelope


class ReceiptCurrencyTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = importing.ImportStorageTest.asyncSetUp
    seed_library = importing.ImportStorageTest.seed_library

    async def test_item_subtotal_validation_and_saved_outcomes(self):
        await self.seed_library()
        cases = (
            ("matching", ["$9.99"], "$9.99", True, True, set()),
            ("different", ["£9.99"], "$9.99", True, True, {"currency_mismatch"}),
            ("mixed", ["£9.99", "$4.99"], "$14.98", True, True, {"currency_mismatch"}),
            ("wrong_amount", ["$9.99"], "$8.99", True, False, {"subtotal_mismatch"}),
            ("no_tax", ["£9.99"], "$9.99", True, False, {"currency_mismatch"}),
            ("missing", [None], "$9.99", True, False, {"purchase_price_missing"}),
            (
                "missing_and_different",
                [None, "£4.99"],
                "$14.98",
                True,
                False,
                {"purchase_price_missing", "currency_mismatch"},
            ),
            ("zero", ["$0.00"], "$0.00", True, True, set()),
            ("zero_different", ["£0.00"], "$0.00", True, False, {"currency_mismatch"}),
            ("unselected", ["£9.99"], "$9.99", False, True, set()),
        )
        for case, (name, prices, subtotal, selected, taxes, reasons) in enumerate(
            cases
        ):
            with self.subTest(name=name):
                rows = "".join(
                    '<tr><td><a href="/movie-store/movie/details/'
                    f'{case * 10 + index + 1}">{library.ROWS[index]["title"]}</a></td>'
                    f"<td><s>$19.99</s> {paid or ''}</td></tr>"
                    for index, paid in enumerate(prices)
                )
                html = (
                    f"<div>Order ID {name}</div><table>"
                    f"<tr><th>Item</th><th>Price</th></tr>{rows}"
                    f"<tr><td>Subtotal {subtotal}</td></tr>"
                    + (
                        f"<tr><td>Tax $0.00</td></tr><tr><td>Total {subtotal}</td></tr>"
                        if taxes
                        else ""
                    )
                    + "</table>"
                )
                fields = ["transaction-id", "purchase-date", "retail-price"]
                if selected:
                    fields.append("purchase-price")
                result = await self.repository.async_purchase_email(
                    envelope(html, fields=fields)
                )
                self.assertEqual(
                    result["status"], "needs_review" if reasons else "imported"
                )
                self.assertEqual(
                    {issue["reason"] for issue in result.get("issues", [])}, reasons
                )
                self.assertEqual(result["imported_count"], len(prices))
                records = (await self.repository.async_inspect("purchase_records"))[
                    "items"
                ]
                saved = [row for row in records if row["order_id"] == name]
                self.assertEqual(len(saved), len(prices))
                by_title = {row["title"]: row for row in saved}
                for index, paid in enumerate(prices):
                    row = by_title[library.ROWS[index]["title"]]
                    self.assertTrue(row["library_id"])
                    self.assertEqual(row["purchase_price"], paid if selected else None)

    async def test_bundle_currency_is_checked_before_allocation(self):
        await self.seed_library()
        for index, currency in enumerate(("$", "£")):
            with self.subTest(currency=currency):
                members = "".join(
                    '<tr><td><a href="/movie-store/movie/details/'
                    f'{1000 + index * 10 + n}">'
                    f"{row['title']}</a></td><td>Included</td></tr>"
                    for n, row in enumerate(library.ROWS[:2])
                )
                html = (
                    f"<div>Order ID bundle-{index}</div><table>"
                    "<tr><th>Item</th><th>Price</th></tr><tr><td>"
                    '<a href="/movie-store/set/fictional">Fictional Set</a></td>'
                    f"<td><s>{currency}20.00</s> {currency}10.00</td></tr>"
                    f"{members}<tr><td>Subtotal $10.00</td></tr></table>"
                )
                result = await self.repository.async_purchase_email(envelope(html))
                self.assertEqual(
                    result["status"], "imported" if currency == "$" else "needs_review"
                )
                self.assertEqual(
                    result.get("issues", []),
                    [] if currency == "$" else [{"reason": "currency_mismatch"}],
                )
                self.assertEqual(result["imported_count"], 2)
                saved = (await self.repository.async_inspect("purchase_records"))[
                    "items"
                ]
                saved = [row for row in saved if row["order_id"] == f"bundle-{index}"]
                self.assertEqual(len(saved), 2)
                self.assertEqual(
                    {row["purchase_price"] for row in saved}, {f"{currency}5.00"}
                )
                self.assertEqual(
                    {row["retail_price"] for row in saved}, {f"{currency}10.00"}
                )

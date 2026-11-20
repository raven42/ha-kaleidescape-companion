"""Explicit read-only qualification of an owned local server browser."""

import os
import unittest

from kaleidescape_browser import KaleidescapeServerBrowser


@unittest.skipUnless(os.getenv("BROWSER_HARDWARE") == "1", "Hardware checks are opt-in")
class BrowserChecks(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_and_first_details(self):
        host = os.getenv("BROWSER_HOST")
        if not host:
            self.skipTest("Select the local server IP")
        browser = KaleidescapeServerBrowser(host, int(os.getenv("BROWSER_PORT", "80")))
        rows, collections = await browser.movies()
        self.assertTrue(all(row["source_handle"] for row in rows))
        self.assertTrue(collections is None or isinstance(collections, list))
        if rows:
            self.assertIn(
                "actors", await browser.version_details(rows[0]["source_handle"])
            )

"""Fictional Store policy changes across real metadata passes."""

import asyncio
import json
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch

from custom_components.kaleidescape_companion.enrichment.sync import MetadataSync
from custom_components.kaleidescape_companion.scrapers import Providers


class MetadataPolicyRefreshTest(unittest.IsolatedAsyncioTestCase):
    def make_sync(self, fetch):
        row = {
            "id": "fictional",
            "source_group": "fictional",
            "title": "The Fictional Voyage",
            "year": 2025,
            "href": "/movie-store/movie/the-fictional-voyage-2025",
            "enrichment": {},
        }
        self.saves = []

        async def enrichment(op, *args):
            if op == "candidates":
                return [row]
            if op == "save":
                self.saves.append(args)

        sync = MetadataSync(
            Mock(),
            NS(async_enrichment=enrichment),
            NS(
                options={},
                data={"library_enabled": True, "metadata_store_enabled": True},
            ),
        )
        sync.providers = Providers(fetch, requests_per_second=10)
        sync.create_session = lambda: NS(detach=lambda: None)
        return sync

    async def test_changed_policy_is_fetched_per_pass_and_budget_is_retained(self):
        calls = []
        deny = False
        payload = {
            "/movie-store/rest/movie/edition/the-fictional-voyage-2025": "123",
            "/movie-store/rest/movie/edition/id/123": {
                "movie_edition_id": "123",
                "uri_name": "the-fictional-voyage-2025",
                "title": "The Fictional Voyage",
                "release_year": 2025,
            },
        }
        body = (
            "<script>window.preloadedAjaxData=" + json.dumps(payload) + ";</script>"
        ).encode()

        async def fetch(url, headers):
            calls.append("robots" if url.endswith("/robots.txt") else "movie")
            if url.endswith("/robots.txt"):
                return (
                    b"User-agent: *\nDisallow: /\nRequest-rate: 5/1\n"
                    if deny
                    else b"User-agent: *\nAllow: /\n"
                )
            return body

        sync = self.make_sync(fetch)
        budget = sync.providers.transport.budget
        review = Providers(fetch, requests_per_second=10, budget=budget)
        await sync._run(True)
        deny = True
        with patch(
            "custom_components.kaleidescape_companion.enrichment.sync._LOGGER.error"
        ):
            await sync._run(True)
        self.assertEqual(calls, ["robots", "movie", "robots"])
        self.assertEqual(len(self.saves), 1)
        self.assertEqual(sync.error, "store_robots_denied")
        self.assertIs(sync.providers.transport.budget, budget)
        self.assertIs(review.transport.budget, budget)
        self.assertEqual(budget.interval, 0.2)

    async def test_cancelled_policy_fetch_does_not_poison_next_pass(self):
        entered = asyncio.Event()
        calls = []

        async def fetch(url, headers):
            calls.append(url)
            if len(calls) == 1:
                entered.set()
                await asyncio.Future()
            return b"User-agent: *\nDisallow: /\n"

        sync = self.make_sync(fetch)
        budget = sync.providers.transport.budget
        task = asyncio.create_task(sync._run(True))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        with patch(
            "custom_components.kaleidescape_companion.enrichment.sync._LOGGER.error"
        ):
            await sync._run(True)
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(url.endswith("/robots.txt") for url in calls))
        self.assertEqual(sync.error, "store_robots_denied")
        self.assertIs(sync.providers.transport.budget, budget)

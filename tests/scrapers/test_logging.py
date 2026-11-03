"""Provider logging does not expose caller-supplied identity or credentials."""

import unittest
from unittest.mock import AsyncMock

from scrapers import MovieQuery, ProviderError, Providers


class ProviderLoggingTest(unittest.IsolatedAsyncioTestCase):
    async def test_rejected_provider_and_rate_policy_are_private(self):
        secret = "private-title-token-192.168.1.42"
        providers = Providers(AsyncMock(), tmdb_credential=secret)
        with self.assertLogs("scrapers", level="DEBUG") as logs:
            with self.assertRaises(ProviderError):
                await providers.metadata(secret, MovieQuery(secret, 2025))
            providers.transport.defer(5)
        self.assertNotIn(secret, repr([record.__dict__ for record in logs.records]))
        self.assertEqual(len(logs.records), 2)

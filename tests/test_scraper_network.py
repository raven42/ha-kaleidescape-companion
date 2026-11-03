"""Fixed anonymous search/preview routes preserve opt-ins and public DNS pinning."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import test_enrichment as enrichment
from homeassistant.helpers.aiohttp_client import DATA_RESOLVER

from custom_components.kaleidescape_companion.scrapers import (
    ProviderError,
)


class ScraperNetworkTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.EnrichmentTest.asyncSetUp
    sync = enrichment.EnrichmentTest.sync

    async def test_store_routes_opt_ins_headers_and_dns(
        self,
    ):
        sync = self.sync(metadata_store_enabled=True, library_sync_artwork=True)
        sync.session = Mock()
        resolver = self.hass.data[DATA_RESOLVER] = SimpleNamespace(
            resolve=AsyncMock(return_value=[{"host": "1.1.1.1"}])
        )
        html = "https://www.kaleidescape.com/movie-store/search?text=Fictional"
        api = "https://www.kaleidescape.com/movie-store/rest/packages/search?text=Fictional&country_code=US&display_limit=15"
        cover = "https://images01.kaleidescape.com/transformed/covers/264x378s/123/12300000.jpg"
        headers = {
            "X-Kaleidescape-Application-Id": "store.js",
            "X-Kaleidescape-Application-Version": "2026.10-123",
        }
        for url, values in ((html, {}), (api, headers), (cover, {})):
            with self.assertRaises(ProviderError):
                await sync._get(url, values)
        resolver.resolve.assert_not_awaited()
        sync.review_network = True
        for url, values in (
            (html + "&account=x", {}),
            (api.replace("15", "1000"), headers),
            (api, {**headers, "Authorization": "fictional"}),
            (api, {**headers, "X-Kaleidescape-Application-Version": "private"}),
            (cover + "?token=private", {}),
            (cover.replace("images01", "evil"), {}),
        ):
            with self.assertRaises(ProviderError):
                await sync._get(url, values)
        sync.session.get.assert_not_called()
        body = b"fictional"

        async def chunks(size):
            yield body

        response = SimpleNamespace(
            status=200,
            content_type="text/html",
            content_length=None,
            headers={},
            content=SimpleNamespace(iter_chunked=chunks),
        )
        context = sync.session.get.return_value
        context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        self.assertEqual(await sync._get(html, {}), body)
        response.content_type = "application/json"
        self.assertEqual(await sync._get(api, headers), body)
        response.content_type = "image/jpeg"
        body = enrichment.IMAGE
        self.assertEqual(await sync._get(cover, {}), body)
        self.assertEqual(
            sync.session.get.call_args.kwargs["server_hostname"],
            "images01.kaleidescape.com",
        )
        self.assertNotIn("Authorization", sync.session.get.call_args.kwargs["headers"])
        before = sync.session.get.call_count
        resolver.resolve.return_value = [{"host": "127.0.0.1"}]
        with self.assertRaises(ProviderError):
            await sync._get(cover, {})
        self.assertEqual(sync.session.get.call_count, before)
        resolver.resolve.return_value = [{"host": "1.1.1.1"}]
        body = b"<svg>not a raster</svg>"
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(cover, {})
        response.status = 404
        with self.assertRaisesRegex(ProviderError, "store_not_found"):
            await sync._get(
                "https://www.kaleidescape.com/movie-store/movie/fictional-2025", {}
            )
        with self.assertRaisesRegex(ProviderError, "tmdb_not_found"):
            await sync._get("https://api.themoviedb.org/3/movie/42", {})

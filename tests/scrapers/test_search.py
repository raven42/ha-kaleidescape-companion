"""Offline candidate search and pinned identity contracts, with fictional data."""

import json
import unittest
from unittest.mock import AsyncMock

from scrapers import MovieQuery, ProviderError, Providers
from scrapers.providers.store_search import cover_url, packages
from test_providers import MOVIE, PATH, TITLE, YEAR, page


class ProviderSearchTest(unittest.IsolatedAsyncioTestCase):
    async def test_tmdb_choices_and_pinned_lookup(
        self,
    ):
        calls = []

        async def fetch(url, headers):
            calls.append(url)
            if "/search/movie?" in url:
                return json.dumps(
                    {
                        "results": [
                            {"id": id, "title": TITLE, "release_date": "2025-01-01"}
                            for id in (42, 43)
                        ]
                    }
                ).encode()
            id = 43 if "/43?" in url else 42
            return json.dumps(
                {
                    "id": id,
                    "title": TITLE,
                    "release_date": "2025-01-01",
                    "poster_path": "/FictionalPoster.jpg",
                    "genres": [{"name": "Adventure"}],
                    "credits": {
                        "cast": [{"name": "Lead Example", "order": 0}],
                        "crew": [{"name": "Director Example", "job": "Director"}],
                    },
                }
            ).encode()

        client = Providers(fetch, requests_per_second=10, tmdb_credential="fictional")
        rows = await client.search("tmdb", "Fictional")
        self.assertEqual([row["provider_id"] for row in rows], ["42", "43"])
        self.assertEqual(rows[0]["actors"], ["Lead Example"])
        self.assertEqual(rows[0]["directors"], ["Director Example"])
        calls.clear()
        resolved = await client.resolve("tmdb", rows[1])
        self.assertEqual(resolved["provider_id"], "43")
        self.assertEqual(len(calls), 1)
        self.assertNotIn("/search/", calls[0])
        with self.assertRaisesRegex(ProviderError, "tmdb_ambiguous"):
            await client.metadata("tmdb", MovieQuery(TITLE, YEAR))
        with self.assertRaises(ProviderError):
            await client.resolve(
                "tmdb", {**rows[0], "provider_id": "https://evil.invalid"}
            )

    async def test_store_search_headers_and_positive_projection(
        self,
    ):
        cover = "https://images01.kaleidescape.com/transformed/covers/264x378s/123/12300000.jpg"
        package = {
            "movie_edition_uri_name": PATH.rsplit("/", 1)[1],
            "is_television": False,
            "image_uris": {"small_2x": cover},
            "private_account": "must not copy",
            "base_price": {"dollars": 99},
        }
        calls = []

        async def fetch(url, headers):
            calls.append((url, headers))
            if url.endswith("/robots.txt"):
                return b"User-agent: *\n"
            if "/rest/packages/search?" in url:
                self.assertEqual(
                    headers,
                    {
                        "X-Kaleidescape-Application-Id": "store.js",
                        "X-Kaleidescape-Application-Version": "2026.10-123",
                    },
                )
                return json.dumps(
                    {
                        "groups": [
                            {"algorithm_id": 7, "packages": [package]},
                            {
                                "algorithm_id": 5,
                                "packages": [
                                    {
                                        **package,
                                        "movie_edition_uri_name": "related-movie-2000",
                                    }
                                ],
                            },
                        ]
                    }
                ).encode()
            if "/movie-store/search?" in url:
                return b'<body data-store_version="2026.10-123">'
            if url == cover:
                return b"\xff\xd8\xfffictional-cover"
            return page({**MOVIE, "genres": ["Adventure"]}).encode()

        client = Providers(fetch, requests_per_second=10)
        rows = await client.search("kaleidescape", "Fictional")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], TITLE)
        self.assertEqual(rows[0]["genres"], ["Adventure"])
        self.assertNotIn("private_account", json.dumps(rows))
        self.assertNotIn("base_price", json.dumps(rows))
        self.assertEqual(rows[0]["poster_url"], cover)
        self.assertFalse(any("related-movie" in url for url, _ in calls))
        resolved = await client.resolve("kaleidescape", rows[0])
        self.assertEqual(resolved["provider_id"], rows[0]["provider_id"])
        self.assertEqual(
            await client.image(
                "kaleidescape", {"kind": "poster", "path": cover}, thumbnail=True
            ),
            b"\xff\xd8\xfffictional-cover",
        )
        with self.assertRaisesRegex(ProviderError, "artwork_unavailable"):
            await client.image("kaleidescape", {"kind": "poster", "path": cover})

    async def test_store_search_reports_truncation_before_filtering_by_year(self):
        packages = [
            {"movie_edition_uri_name": f"fictional-{number}", "is_television": False}
            for number in range(8)
        ]

        async def fetch(url, _headers):
            if url.endswith("/robots.txt"):
                return b"User-agent: *\n"
            if "/rest/packages/search?" in url:
                return json.dumps(
                    {"groups": [{"algorithm_id": 7, "packages": packages}]}
                ).encode()
            if "/movie-store/search?" in url:
                return b'<body data-store_version="2026.10-123">'
            slug = url.rsplit("/", 1)[1]
            number = int(slug.rsplit("-", 1)[1])
            movie = {
                **MOVIE,
                "uri_name": slug,
                "release_year": YEAR if number == 0 else YEAR + 1,
            }
            data = {
                f"/movie-store/rest/movie/edition/{slug}": "123",
                "/movie-store/rest/movie/edition/id/123": movie,
            }
            return (
                "<script>window.preloadedAjaxData = " + json.dumps(data) + ";</script>"
            ).encode()

        client = Providers(fetch, requests_per_second=10)
        results = await client.search("kaleidescape", TITLE, YEAR)
        self.assertEqual(len(results), 1)
        self.assertTrue(results.truncated)

    async def test_search_inputs_and_untrusted_cover_routes_are_bounded(self):
        fetch = AsyncMock(return_value=b"{}")
        client = Providers(fetch, requests_per_second=10)
        for query in ("", "x" * 201, "a\x00b", None):
            with self.assertRaises(ProviderError):
                await client.search("tmdb", query)
        fetch.assert_not_awaited()
        for value in (
            "http://images01.kaleidescape.com/a.jpg",
            "https://127.0.0.1/a.jpg",
            "https://images01.kaleidescape.com.evil.invalid/a.jpg",
            "https://images01.kaleidescape.com/transformed/covers/264x378s/123/123.jpg?token=x",
            "https://images01.kaleidescape.com/transformed/covers/264x378s/../123.jpg",
        ):
            self.assertIsNone(cover_url(value))
        self.assertEqual(packages(b'{"groups":[]}'), [])
        with self.assertRaisesRegex(ProviderError, "format_changed"):
            packages(b'{"groups":{}}')

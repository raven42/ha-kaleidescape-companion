"""Offline provider contract tests with invented movies and credentials only."""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock

from kaleidescape_scrapers import MovieQuery, ProviderError, Providers
from kaleidescape_scrapers.providers import store, tmdb

TITLE = "The Fictional Voyage"
YEAR = 2025
PATH = "/movie-store/movie/the-fictional-voyage-2025"
MOVIE = {
    "movie_edition_id": "123",
    "uri_name": "the-fictional-voyage-2025",
    "title": TITLE,
    "release_year": YEAR,
    "persons": [
        {"given_name": "Avery", "family_name": "Example", "role_id": 52},
        {"given_name": "A", "family_name": "Writer", "role_id": 54},
        {"given_name": "A", "family_name": "Producer", "role_id": 50},
    ],
    "production_companies": [{"name": "Fictional Studio"}],
    "licensor_name": "Example Distributor",
    "rotten_tomatoes_movie": {"critic_score": 88, "audience_score": 92},
}


def page(movie=None):
    data = {
        "/movie-store/rest/movie/edition/the-fictional-voyage-2025": "123",
        "/movie-store/rest/movie/edition/id/123": movie or MOVIE,
        "/session/account": {"private": "must never be copied"},
    }
    return (
        "<script>window.preloadedAjaxData="
        + json.dumps(data)
        + ";alert('never execute')</script>"
    )


class ParsersTest(unittest.TestCase):
    def test_tmdb_cast_uses_billing_order_and_limits_untrusted_fields(self):
        data = tmdb.parse(
            {
                "id": 42,
                "title": TITLE,
                "release_date": "2025-01-01",
                "credits": {
                    "cast": [
                        {"name": "Supporting Example", "order": 9},
                        {"name": "Lead Example", "order": 0},
                        {"name": "Second Example", "order": 1},
                        {"name": "Unknown billing"},
                    ],
                    "crew": [],
                },
                "genres": [{"name": "Adventure"}],
                "overview": "Fictional synopsis",
            },
            42,
            TITLE,
            YEAR,
        )
        self.assertEqual(
            data["actors"],
            ["Lead Example", "Second Example", "Supporting Example", "Unknown billing"],
        )
        self.assertEqual(data["genres"], ["Adventure"])
        self.assertEqual(data["synopsis"], "Fictional synopsis")

    def test_store_extracts_credits_and_scores_without_account_bootstrap(self):
        data = store.parse(page(), PATH, TITLE, YEAR)
        self.assertEqual(data["actors"], ["Avery Example"])
        self.assertEqual(data["writers"], ["A Writer"])
        self.assertEqual(data["critic_score"], 88)
        self.assertNotIn("private", json.dumps(data))
        self.assertNotIn("alert", json.dumps(data))
        self.assertEqual(data["studios"], ["Fictional Studio"])
        self.assertEqual(data["distributor"], "Example Distributor")

    def test_fixed_store_routes_and_identity_refuse_unsafe_or_ambiguous_input(self):
        for path in (
            "http://www.kaleidescape.com" + PATH,
            "https://evil.example" + PATH,
            "https://www.kaleidescape.com:443" + PATH,
            PATH + "?x=1",
            PATH + "#x",
            "/movie-store/movie/%2e%2e",
            "//www.kaleidescape.com" + PATH,
            PATH + "/",
        ):
            with self.subTest(path=path), self.assertRaises(ProviderError):
                store.movie_path(path)
        for title, year in ((TITLE, 1990), ("Another title", YEAR), (TITLE, None)):
            with self.assertRaisesRegex(ProviderError, "identity"):
                store.parse(page(), PATH, title, year)
        with self.assertRaisesRegex(ProviderError, "format_changed"):
            store.parse(
                "<script>window.preloadedAjaxData=fetch('evil')</script>",
                PATH,
                TITLE,
                YEAR,
            )
        with self.assertRaisesRegex(ProviderError, "too_large"):
            store.parse("x" * (4 * 1024 * 1024 + 1), PATH, TITLE, YEAR)

    def test_tmdb_match_requires_unique_normalized_title_and_year(self):
        row = {"id": 42, "title": TITLE, "release_date": "2025-01-01"}
        self.assertEqual(
            tmdb.match(
                {"results": [row, {**row, "id": 43, "release_date": "2000-01-01"}]},
                TITLE,
                YEAR,
            ),
            42,
        )
        for rows in (
            [],
            [{**row, "title": "Different movie"}],
            [{**row, "release_date": "1990-01-01"}],
        ):
            with self.assertRaisesRegex(ProviderError, "not_found"):
                tmdb.match({"results": rows}, TITLE, YEAR)
        with self.assertRaisesRegex(ProviderError, "ambiguous"):
            tmdb.match({"results": [row, {**row, "id": 43}]}, TITLE, YEAR)

    def test_tmdb_credits_keep_audience_votes_separate_from_critic_percent(self):
        data = tmdb.parse(
            {
                "id": 42,
                "title": TITLE,
                "release_date": "2025-01-01",
                "credits": {
                    "cast": [{"name": "Avery Example"}],
                    "crew": [{"name": "A Writer", "job": "Screenplay"}],
                },
                "vote_average": 8.2,
                "vote_count": 123,
                "backdrop_path": "/FictionalBackdrop.jpg",
            },
            42,
            TITLE,
            YEAR,
        )
        self.assertEqual(data["audience_rating"], 8.2)
        self.assertNotIn("critic_score", data)
        self.assertEqual(data["writers"], ["A Writer"])
        self.assertEqual(data["backdrop_path"], "/FictionalBackdrop.jpg")


class ProviderClientTest(unittest.IsolatedAsyncioTestCase):
    async def test_gallery_keeps_fixed_paths_and_distinguishes_image_sizes(self):
        async def fetch(url, headers):
            if "/images?" in url:
                return json.dumps(
                    {
                        "id": 42,
                        "posters": [
                            {
                                "file_path": "/PosterExample.jpg",
                                "width": 500,
                                "height": 750,
                            },
                            {"file_path": "https://evil.example/image.jpg"},
                            {"file_path": "/PosterExample.jpg"},
                        ],
                        "backdrops": [{"file_path": "/HeroExample.jpg"}],
                    }
                ).encode()
            return b"\xff\xd8\xfffictional"

        fetch = AsyncMock(side_effect=fetch)
        client = Providers(fetch, requests_per_second=10, tmdb_credential="fictional")
        metadata = {"provider": "tmdb", "provider_id": "42"}
        images = await client.images("tmdb", metadata)
        self.assertEqual([item["kind"] for item in images], ["poster", "backdrop"])
        for image in images:
            await client.image("tmdb", image, thumbnail=True)
            self.assertIn("/w300/", fetch.call_args.args[0])
            self.assertEqual(fetch.call_args.args[1], {})
            await client.image("tmdb", image)
            self.assertIn(
                "/w500/" if image["kind"] == "poster" else "/w780/",
                fetch.call_args.args[0],
            )
        self.assertEqual(await client.images("kaleidescape", metadata), [])

    async def test_multiple_clients_share_one_rate_budget(self):
        times = []

        async def fetch(url, headers):
            times.append(asyncio.get_running_loop().time())
            return b"{}"

        first = Providers(fetch, requests_per_second=10)
        second = Providers(fetch, requests_per_second=10, budget=first.transport.budget)
        await asyncio.gather(
            first.transport.get("one"),
            second.transport.get("two"),
            first.transport.get("three"),
        )
        self.assertGreaterEqual(times[1] - times[0], 0.09)
        self.assertGreaterEqual(times[2] - times[1], 0.09)

    async def test_backdrop_uses_fixed_raster_path_shared_transport_and_no_secret(self):
        fetch = AsyncMock(return_value=b"\xff\xd8\xfffictional")
        client = Providers(
            fetch, requests_per_second=10, tmdb_credential="fictional-secret"
        )
        metadata = {"provider": "tmdb", "backdrop_path": "/FictionalBackdrop.jpg"}
        self.assertEqual(
            await client.artwork("tmdb", metadata), b"\xff\xd8\xfffictional"
        )
        fetch.assert_awaited_once_with(
            "https://image.tmdb.org/t/p/w780/FictionalBackdrop.jpg", {}
        )
        for path in (
            None,
            "https://evil.example/image.jpg",
            "/../image.jpg",
            "/image.svg",
            "/image.jpg?key=private",
            "/%2fimage.jpg",
        ):
            self.assertIsNone(
                await client.artwork("tmdb", {**metadata, "backdrop_path": path})
            )
        self.assertIsNone(await client.artwork("kaleidescape", metadata))
        self.assertEqual(fetch.await_count, 1)
        with self.assertRaisesRegex(ProviderError, "unknown_provider"):
            await client.artwork("missing", metadata)

    async def test_preferred_poster_is_optional_fixed_size_and_credential_free(self):
        fetch = AsyncMock(return_value=b"\xff\xd8\xfffictional")
        client = Providers(fetch, requests_per_second=10, tmdb_credential="fictional")
        metadata = {"provider": "tmdb", "poster_path": "/FictionalPoster.jpg"}
        self.assertEqual(
            await client.poster("tmdb", metadata), b"\xff\xd8\xfffictional"
        )
        fetch.assert_awaited_once_with(
            "https://image.tmdb.org/t/p/w500/FictionalPoster.jpg", {}
        )
        for path in (
            None,
            "https://evil.example/x.jpg",
            "/../x.jpg",
            "/x.svg",
            "/x.jpg?key=private",
        ):
            self.assertIsNone(
                await client.poster("tmdb", {**metadata, "poster_path": path})
            )
        self.assertIsNone(await client.poster("kaleidescape", metadata))
        self.assertEqual(fetch.await_count, 1)
        with self.assertRaisesRegex(ProviderError, "unknown_provider"):
            await client.poster("missing", metadata)

    async def test_tmdb_supports_bearer_and_v3_key_without_returning_them(self):
        for credential in ("fictional-read-token", "a" * 32):
            calls = []

            async def fetch(url, headers):
                calls.append((url, headers))
                if "/search/movie?" in url:
                    return json.dumps(
                        {
                            "results": [
                                {"id": 42, "title": TITLE, "release_date": "2025-01-01"}
                            ]
                        }
                    ).encode()
                return json.dumps(
                    {
                        "id": 42,
                        "title": TITLE,
                        "release_date": "2025-01-01",
                        "credits": {},
                    }
                ).encode()

            provider = Providers(
                fetch, requests_per_second=10, tmdb_credential=credential
            )
            result = await provider.metadata("tmdb", MovieQuery(TITLE, YEAR))
            self.assertEqual(len(calls), 2)
            self.assertNotIn(credential, json.dumps(result))
            if credential == "a" * 32:
                self.assertIn("api_key=", calls[0][0])
                self.assertEqual(calls[0][1], {})
            else:
                self.assertEqual(calls[0][1], {"Authorization": "Bearer " + credential})
                self.assertNotIn(credential, calls[0][0])

    async def test_missing_key_and_disallowed_robots_never_request_movie(self):
        fetch = AsyncMock(return_value=b"User-agent: *\nDisallow: /movie-store/\n")
        provider = Providers(fetch)
        with self.assertRaisesRegex(ProviderError, "key_required"):
            await provider.metadata("tmdb", MovieQuery(TITLE, YEAR))
        fetch.assert_not_awaited()
        with self.assertRaisesRegex(ProviderError, "robots_denied"):
            await provider.metadata("kaleidescape", MovieQuery(TITLE, YEAR, PATH))
        self.assertEqual(fetch.await_count, 1)
        self.assertEqual(fetch.call_args.args[0], store.HOST + "/robots.txt")

    async def test_throttle_shared_across_requests_and_failures_do_not_retry(self):
        times = []

        async def fetch(url, headers):
            times.append(asyncio.get_running_loop().time())
            return b"{}"

        provider = Providers(fetch, requests_per_second=10)
        await asyncio.gather(
            provider.transport.get("one"),
            provider.transport.get("two"),
            provider.transport.get("three"),
        )
        self.assertGreaterEqual(times[1] - times[0], 0.09)
        self.assertGreaterEqual(times[2] - times[1], 0.09)
        fetch = AsyncMock(side_effect=ProviderError("provider_rate_limited"))
        provider = Providers(fetch)
        with self.assertRaisesRegex(ProviderError, "rate_limited"):
            await provider.metadata("kaleidescape", MovieQuery(TITLE, YEAR, PATH))
        self.assertEqual(fetch.await_count, 1)
        for rate in (0, 11, float("nan"), True):
            with self.assertRaises(ValueError):
                Providers(fetch, requests_per_second=rate)

    async def test_oversized_robots_stop_before_any_movie_request(self):
        fetch = AsyncMock(return_value=b"x" * 65537)
        with self.assertRaisesRegex(ProviderError, "robots_too_large"):
            await Providers(fetch).metadata(
                "kaleidescape", MovieQuery(TITLE, YEAR, PATH)
            )
        self.assertEqual(fetch.await_count, 1)

    async def test_cancellation_does_not_fetch_later_requests(self):
        fetch = AsyncMock(return_value=b"{}")
        provider = Providers(fetch, requests_per_second=0.1)
        await provider.transport.get("one")
        task = asyncio.create_task(provider.transport.get("two"))
        await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(fetch.await_count, 1)

    async def test_common_api_dispatches_registered_adapters_and_rejects_unknown(self):
        fetch = AsyncMock()
        adapter = unittest.mock.Mock()
        adapter.metadata = AsyncMock(
            return_value={"provider": "fictional", "year": YEAR}
        )
        client = Providers(fetch, adapters={"fictional": adapter})
        movie = MovieQuery(TITLE, YEAR)
        result = await client.metadata("fictional", movie)
        self.assertEqual(result["provider"], "fictional")
        adapter.metadata.assert_awaited_once_with(movie)
        with self.assertRaisesRegex(ProviderError, "unknown_provider"):
            await client.metadata("missing", movie)
        fetch.assert_not_awaited()

    async def test_invalid_movie_identity_is_rejected_before_network_access(self):
        fetch = AsyncMock()
        client = Providers(fetch)
        for title, year in (("", YEAR), (TITLE, None), (TITLE, True), (TITLE, 0)):
            with (
                self.subTest(title=title, year=year),
                self.assertRaisesRegex(ProviderError, "identity_mismatch"),
            ):
                await client.metadata("tmdb", MovieQuery(title, year))
        fetch.assert_not_awaited()

    async def test_store_adapter_loads_robots_once_and_applies_it_before_movie(self):
        calls = []

        async def fetch(url, headers):
            calls.append(url)
            return (
                b"User-agent: *\nAllow: /\n"
                if url.endswith("robots.txt")
                else page().encode()
            )

        client = Providers(fetch, requests_per_second=10)
        movie = MovieQuery(TITLE, YEAR, PATH)
        results = await asyncio.gather(
            client.metadata("kaleidescape", movie),
            client.metadata("kaleidescape", movie),
        )
        self.assertEqual(
            calls, [store.HOST + "/robots.txt", store.HOST + PATH, store.HOST + PATH]
        )
        self.assertTrue(all(result["year"] == YEAR for result in results))

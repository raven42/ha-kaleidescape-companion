"""Fictional provider enrichment: storage, permissions, credentials and HTTPS gates."""

import hashlib
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import test_backend as backend
from homeassistant.helpers.aiohttp_client import DATA_RESOLVER

from custom_components.kaleidescape_companion._vendor.kaleidescape_scrapers import (
    ProviderError,
)
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.settings import form
from custom_components.kaleidescape_companion.enrichment import config
from custom_components.kaleidescape_companion.enrichment.sync import MetadataSync
from custom_components.kaleidescape_companion.library.store import title_id

ORIGIN = "http://fictional.local"
IMAGE = b"\xff\xd8\xfffictional-backdrop"


class EnrichmentTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def seed(self):
        await self.call("library/info", **self.scope)  # disabled API stays inert
        await backend.BackendTest.create(self)
        self.repo = self.entry.runtime_data.repository
        self.source = self.entry.runtime_data.library.source
        await self.repo.async_library_catalog(
            ORIGIN,
            [
                {
                    "source_handle": "fictional",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                    "actors": ["Original Actor"],
                },
                {
                    "source_handle": "other",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                },
                {
                    "source_handle": "remake",
                    "source_group": "remake",
                    "title": "Fictional Film",
                    "year": 2026,
                },
            ],
        )
        self.id = title_id(self.source, "fictional")
        self.data = {
            "provider": "tmdb",
            "provider_id": "42",
            "title": "Fictional Film",
            "year": 2025,
            "actors": ["Expanded Actor"],
            "writers": ["Example Writer"],
            "producers": ["Example Producer"],
            "url": "https://www.themoviedb.org/movie/42",
            "audience_rating": 8.1,
            "matched_title": "Fictional Film",
            "matched_group": "movie",
        }

    async def test_cache_extends_both_versions_without_overwriting_raw_or_remakes(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        page = await self.repo.async_library_versions(self.source, self.id)
        self.assertEqual(len(page["items"]), 2)
        for item in page["items"]:
            self.assertIn("Expanded Actor", item["actors"])
            self.assertEqual(item["producers"], ["Example Producer"])
            self.assertNotIn("matched_group", item["enrichment"]["tmdb"])
        raw = await self.repo.async_inspect("library")
        original = next(row for row in raw["items"] if row["id"] == self.id)
        self.assertEqual(json.loads(original["data"])["actors"], ["Original Actor"])
        remake = next(row for row in raw["items"] if row["source_handle"] == "remake")
        self.assertEqual(json.loads(remake["enrichment"]), {})
        result = await self.repo.async_library_list(
            self.source, {"query": "Expanded Actor", "grouped": True}
        )
        self.assertEqual(result["total"], 1)
        await self.repo.async_library_catalog(
            ORIGIN,
            [
                {
                    "source_handle": "fictional",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                }
            ],
        )
        page = await self.repo.async_library_versions(self.source, self.id)
        self.assertIn("Expanded Actor", page["items"][0]["actors"])

    async def test_new_format_inherits_cached_group_metadata_without_rescraping(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        await self.repo.async_library_catalog(
            ORIGIN,
            [
                {
                    "source_handle": "fictional",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                },
                {
                    "source_handle": "new-format",
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                },
            ],
        )
        page = await self.repo.async_library_versions(self.source, self.id)
        new = next(
            item
            for item in page["items"]
            if item["id"] == title_id(self.source, "new-format")
        )
        self.assertIn("Expanded Actor", new["actors"])
        self.assertEqual(new["enrichment"]["tmdb"]["provider_id"], "42")

    async def test_unknown_or_stale_source_identity_cannot_commit(self):
        await self.seed()
        for changes in (
            {"matched_title": "Other"},
            {"year": 2026},
            {"matched_group": "remake"},
        ):
            with self.assertRaises(JournalError) as error:
                await self.repo.async_enrichment(
                    "save", self.source, self.id, "tmdb", {**self.data, **changes}
                )
            self.assertEqual(error.exception.code, "refresh_required")
        await self.repo.async_pause()
        with self.assertRaises(JournalError) as error:
            await self.repo.async_enrichment(
                "save", self.source, self.id, "tmdb", self.data
            )
        self.assertEqual(error.exception.code, "backup_in_progress")

    async def test_backdrops_share_private_cache_preserve_posters_and_clear_on_eviction(
        self,
    ):
        await self.seed()
        poster = b"\xff\xd8\xfffictional-poster"
        await self.repo.async_library_artwork_save(
            self.source, self.id, poster, "image/jpeg", 1048576
        )
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        await self.repo.async_enrichment(
            "artwork", self.source, self.id, self.data, IMAGE, 1048576
        )
        key = hashlib.sha256(IMAGE).hexdigest()
        page = await self.repo.async_library_versions(self.source, self.id)
        self.assertEqual(
            {row["enrichment"]["tmdb"]["backdrop_key"] for row in page["items"]}, {key}
        )
        self.assertEqual(
            next(row for row in page["items"] if row["id"] == self.id)["artwork_key"],
            hashlib.sha256(poster).hexdigest(),
        )
        self.assertEqual(
            await self.repo.async_library_artwork(self.source, key),
            (IMAGE, "image/jpeg"),
        )
        with self.assertRaises(JournalError):
            await self.repo.async_library_artwork("another-source", key)
        # A metadata refresh retains a usable backdrop until a replacement succeeds.
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        self.assertEqual(
            await self.repo.async_library_artwork(self.source, key),
            (IMAGE, "image/jpeg"),
        )
        await self.repo.async_library_trim(0)
        page = await self.repo.async_library_versions(self.source, self.id)
        self.assertTrue(
            all(
                "backdrop_key" not in row["enrichment"]["tmdb"] for row in page["items"]
            )
        )
        with self.assertRaises(JournalError):
            await self.repo.async_library_artwork(self.source, key)

    async def test_backdrop_rejects_stale_groups_and_non_raster_bytes(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        for change in (
            {"matched_group": "remake"},
            {"provider_id": "43"},
            {"matched_title": "Another film"},
        ):
            with self.assertRaises(JournalError) as error:
                await self.repo.async_enrichment(
                    "artwork",
                    self.source,
                    self.id,
                    {**self.data, **change},
                    IMAGE,
                    1048576,
                )
            self.assertEqual(error.exception.code, "refresh_required")
        with self.assertRaises(JournalError) as error:
            await self.repo.async_enrichment(
                "artwork",
                self.source,
                self.id,
                self.data,
                b"<svg>unsafe</svg>",
                1048576,
            )
        self.assertEqual(error.exception.code, "library_artwork")
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)

    async def test_administrator_cache_deletion_clears_group_backdrop_links(self):
        await self.seed()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        await self.repo.async_enrichment(
            "artwork", self.source, self.id, self.data, IMAGE, 1048576
        )
        page = await self.repo.async_inspect("library_artwork")
        key = page["items"][0]["cache_key"]
        await self.repo.async_database_mutate(
            str(uuid4()),
            {
                "table": "library_artwork",
                "operation": "delete",
                "rows": [{"key": {"cache_key": key}, "token": page["row_tokens"][0]}],
                "patch": {},
                "expected_revision": page["dataset_revision"],
                "confirmation": "DELETE",
            },
            self.admin.id,
        )
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertTrue(
            all(
                "backdrop_key" not in row["enrichment"]["tmdb"]
                for row in versions["items"]
            )
        )
        self.assertFalse((self.repo._artwork_directory / (key + ".img")).exists())

    async def test_admin_opt_in_status_and_credential_are_isolated(self):
        user = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        for op in ("metadata/status", "metadata/sync"):
            response = await self.call(op, user=user, **self.scope)
            self.assertEqual(response["code"], "unauthorized")
        await self.seed()
        response = await self.call("metadata/sync", **self.scope)
        self.assertEqual(response["code"], "metadata_disabled")
        self.assertFalse(config.DEFAULTS["metadata_store_enabled"])
        self.assertFalse(config.DEFAULTS["metadata_tmdb_enabled"])
        secret = "fictional-credential-do-not-return"
        result = config.validate(
            {"metadata_tmdb_credential": ""}, {"metadata_tmdb_credential": secret}
        )
        self.assertEqual(result["metadata_tmdb_credential"], secret)
        schema = form(self.hass, result)
        self.assertNotIn(secret, str(schema.schema))
        result = config.validate({"metadata_clear_tmdb_key": True}, result)
        self.assertEqual(result["metadata_tmdb_credential"], "")
        for value in (True, 0, 11, float("inf"), float("nan")):
            with self.assertRaises(ValueError):
                config.validate({"metadata_requests_per_second": value}, {})

    def sync(self, **options):
        entry = SimpleNamespace(
            data={
                "library_enabled": True,
                "metadata_tmdb_enabled": True,
                "metadata_tmdb_credential": "fictional-key",
                **options,
            },
            options={},
        )
        return MetadataSync(self.hass, self.entry.runtime_data.repository, entry)

    async def test_backdrop_https_gates_credentials_routes_and_bodies(
        self,
    ):
        url = "https://image.tmdb.org/t/p/w780/FictionalBackdrop.jpg"
        sync = self.sync()
        sync.session = Mock()
        with self.assertRaisesRegex(ProviderError, "disabled"):
            await sync._get(url, {})
        sync.session.get.assert_not_called()
        sync = self.sync(library_sync_artwork=True)
        sync.session = Mock()
        for path, headers in (
            (url + "?x=1", {}),
            (url.replace("w780", "original"), {}),
            (url, {"Authorization": "Bearer fictional"}),
            (url.replace(".jpg", ".svg"), {}),
        ):
            with self.assertRaisesRegex(ProviderError, "destination"):
                await sync._get(path, headers)
        sync.session.get.assert_not_called()
        self.hass.data[DATA_RESOLVER] = SimpleNamespace(
            resolve=AsyncMock(return_value=[{"host": "1.1.1.1"}])
        )
        self.hass.data[DATA_RESOLVER].resolve.return_value = [{"host": "127.0.0.1"}]
        with self.assertRaisesRegex(ProviderError, "destination"):
            await sync._get(url, {})
        sync.session.get.assert_not_called()
        self.hass.data[DATA_RESOLVER].resolve.return_value = [{"host": "1.1.1.1"}]
        response = SimpleNamespace(
            status=200, content_type="image/jpeg", content_length=None, headers={}
        )

        async def chunks(size):
            yield IMAGE

        response.content = SimpleNamespace(iter_chunked=chunks)
        context = sync.session.get.return_value
        context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        self.assertEqual(await sync._get(url, {}), IMAGE)
        poster = url.replace("w780", "w500")
        with self.assertRaisesRegex(ProviderError, "destination"):
            await sync._get(poster, {})
        sync.entry.data["metadata_source_artwork"] = "tmdb"
        sync.config["metadata_source_artwork"] = "tmdb"
        self.assertEqual(await sync._get(poster, {}), IMAGE)
        with self.assertRaisesRegex(ProviderError, "destination"):
            await sync._get(url.replace("w780", "w300"), {})
        sync.entry.data["library_sync_artwork"] = False
        sync.config["library_sync_artwork"] = False
        with self.assertRaisesRegex(ProviderError, "disabled"):
            await sync._get(poster, {})
        sync.entry.data["library_sync_artwork"] = True
        sync.config["library_sync_artwork"] = True
        self.assertNotIn("Authorization", sync.session.get.call_args.kwargs["headers"])
        self.assertEqual(
            sync.session.get.call_args.kwargs["server_hostname"], "image.tmdb.org"
        )
        response.content_type = "text/html"
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(url, {})
        response.content_type = "image/jpeg"

        async def invalid(size):
            yield b"<svg>unsafe</svg>"

        response.content.iter_chunked = invalid
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(url, {})

    async def test_sync_fetches_backdrops_only_when_artwork_enabled(self):
        await self.seed()
        for artwork in (False, True):
            sync = self.sync(library_sync_artwork=artwork)
            row = {
                "id": "fictional-id",
                "source_group": "movie",
                "title": "Fictional Film",
                "year": 2025,
                "href": None,
                "enrichment": {},
            }
            repository = SimpleNamespace(
                async_enrichment=AsyncMock(
                    side_effect=[[row], None, None, None]
                    if artwork
                    else [[row], None, None]
                ),
            )
            sync.repository = repository
            sync.providers.metadata = AsyncMock(return_value=self.data)
            sync.providers.artwork = AsyncMock(return_value=IMAGE)
            session = SimpleNamespace(detach=Mock())
            with patch(
                "custom_components.kaleidescape_companion.enrichment.sync.async_create_clientsession",
                return_value=session,
            ):
                await sync._run(True)
            self.assertIsNone(sync.error)
            self.assertEqual(sync.providers.artwork.await_count, int(artwork))
            if artwork:
                self.assertEqual(
                    repository.async_enrichment.await_args_list[-2].args[0], "artwork"
                )
            self.assertEqual(
                repository.async_enrichment.call_args.args,
                ("activity", sync.source, False),
            )

    async def test_fixed_https_pins_dns_and_refuses_private_or_redirected_responses(
        self,
    ):
        sync = self.sync()
        session = sync.session = Mock()
        resolver = self.hass.data[DATA_RESOLVER] = SimpleNamespace(resolve=AsyncMock())
        for url in (
            "http://api.themoviedb.org/3/search/movie",
            "https://evil.example/",
            "https://www.kaleidescape.com/account",
            "https://api.themoviedb.org/3/account",
        ):
            with self.assertRaises(ProviderError):
                await sync._get(url, {})
        resolver.resolve.assert_not_awaited()
        url = "https://api.themoviedb.org/3/search/movie?query=Fictional"
        for addresses in (
            ["127.0.0.1"],
            ["10.0.0.5"],
            ["169.254.169.254"],
            ["1.1.1.1", "192.168.1.1"],
            [],
        ):
            resolver.resolve.return_value = [{"host": value} for value in addresses]
            with self.assertRaises(ProviderError):
                await sync._get(url, {})
        session.get.assert_not_called()
        resolver.resolve.return_value = [{"host": "1.1.1.1"}]
        response = SimpleNamespace(status=302)
        context = session.get.return_value
        context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        with self.assertRaisesRegex(ProviderError, "http_error"):
            await sync._get(url, {"Authorization": "Bearer fictional"})
        self.assertEqual(
            session.get.call_args.kwargs["server_hostname"], "api.themoviedb.org"
        )
        self.assertFalse(session.get.call_args.kwargs["allow_redirects"])
        self.assertEqual(session.get.call_args.args[0].host, "1.1.1.1")

    async def test_provider_stop_and_revocation_close_sessions_without_writes(self):
        await self.seed()
        sync = self.sync()
        sync.repository.async_enrichment = AsyncMock(
            return_value=[
                {
                    "id": self.id,
                    "source_group": "movie",
                    "title": "Fictional Film",
                    "year": 2025,
                    "href": None,
                    "enrichment": {},
                }
            ]
        )
        actor = SimpleNamespace(is_active=True, is_admin=True)
        sync.actor = actor

        async def provider(*args):
            actor.is_active = False
            return self.data

        sync.providers.metadata = provider
        session = SimpleNamespace(detach=Mock())
        with patch(
            "custom_components.kaleidescape_companion.enrichment.sync.async_create_clientsession",
            return_value=session,
        ):
            await sync._run(True)
        self.assertEqual(sync.error, "not_ready")
        session.detach.assert_called_once()
        self.assertEqual(sync.repository.async_enrichment.await_count, 1)
        self.assertIsNone(sync.session)

    async def test_failed_pass_updates_durable_activity_without_title_conflicts(self):
        await self.seed()
        sync = self.sync(library_host=ORIGIN)
        sync.providers.metadata = AsyncMock(
            side_effect=ProviderError("provider_http_error")
        )
        with patch(
            "custom_components.kaleidescape_companion.enrichment.sync.async_create_clientsession",
            return_value=SimpleNamespace(detach=Mock()),
        ):
            await sync._run(True)
            result = await self.repo.async_library_summary(self.source)
            self.assertEqual(result["scraper_failures"], 1)
            self.assertEqual(result["scraper_conflicts"], 0)
            self.assertIsNotNone(result["last_scrape_date"])
            sync.providers.metadata = AsyncMock(
                side_effect=ProviderError("tmdb_not_found")
            )
            await sync._run(True)
        self.assertEqual(
            (await self.repo.async_library_summary(self.source))["scraper_failures"], 1
        )

    async def test_success_rate_limit_and_body_limits(self):
        sync = self.sync()
        self.hass.data[DATA_RESOLVER] = SimpleNamespace(
            resolve=AsyncMock(return_value=[{"host": "1.1.1.1"}])
        )
        session = sync.session = Mock()
        response = SimpleNamespace(
            status=200, content_type="application/json", content_length=None, headers={}
        )

        async def chunks(size):
            yield b'{"result":true}'

        response.content = SimpleNamespace(iter_chunked=chunks)
        context = session.get.return_value
        context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        url = "https://api.themoviedb.org/3/movie/42"
        self.assertEqual(await sync._get(url, {}), b'{"result":true}')
        response.status = 429
        with self.assertRaisesRegex(ProviderError, "rate_limited"):
            await sync._get(url, {})
        response.status = 200
        response.content_length = 4 * 1024 * 1024 + 1
        with self.assertRaisesRegex(ProviderError, "too_large"):
            await sync._get(url, {})
        response.content_length = None

        async def huge(size):
            yield b"x" * (4 * 1024 * 1024 + 1)

        response.content.iter_chunked = huge
        with self.assertRaisesRegex(ProviderError, "too_large"):
            await sync._get(url, {})
        response.content_type = "text/html"
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(url, {})

    async def test_provider_images_accept_supported_rasters_with_canonical_delivery(
        self,
    ):
        # The CDN can transform a .jpg resource to PNG/WebP or return a generic
        # MIME type. All bytes still pass a supported raster signature check.
        sync = self.sync(library_sync_artwork=True)
        sync.session = Mock()
        self.hass.data[DATA_RESOLVER] = SimpleNamespace(
            resolve=AsyncMock(return_value=[{"host": "1.1.1.1"}])
        )
        body = IMAGE
        response = SimpleNamespace(
            status=200, content_type="image/jpeg", content_length=None, headers={}
        )

        async def chunks(size):
            yield body

        response.content = SimpleNamespace(iter_chunked=chunks)
        context = sync.session.get.return_value
        context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        url = "https://image.tmdb.org/t/p/w780/FictionalImage.jpg"
        for declared, image in (
            ("image/png", b"\x89PNG\r\n\x1a\nfictional"),
            ("image/webp", b"RIFF1234WEBPfictional"),
            ("application/octet-stream", IMAGE),
            ("image/jpeg", b"\x89PNG\r\n\x1a\nfictional"),
        ):
            response.content_type, body = declared, image
            self.assertEqual(await sync._get(url, {}), image)
        self.assertEqual(
            sync.session.get.call_args.kwargs["headers"]["Accept"],
            "image/jpeg, image/png, image/webp",
        )
        body = b"<svg>unsafe</svg>"
        response.content_type = "application/octet-stream"
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(url, {})
        body = IMAGE
        response.content_type = "text/html"
        with self.assertRaisesRegex(ProviderError, "content_type"):
            await sync._get(url, {})

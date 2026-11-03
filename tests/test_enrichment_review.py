"""Fictional title reviews: selection, atomic writes and access changes."""

import hashlib
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import test_enrichment as enrichment
from aiohttp import web
from homeassistant.components.http import KEY_HASS

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.enrichment.http import MetadataImageView
from custom_components.kaleidescape_companion.enrichment.review import search_title


class TitleReviewTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.EnrichmentTest.asyncSetUp
    seed = enrichment.EnrichmentTest.seed
    sync = enrichment.EnrichmentTest.sync
    call = enrichment.EnrichmentTest.call

    def test_search_title_strips_only_the_trailing_directors_cut(self):
        for suffix in (" (Director's Cut)", " (DIRECTOR’S CUT) "):
            self.assertEqual(search_title("Fictional Film" + suffix), "Fictional Film")
        self.assertEqual(search_title("Director's Cut"), "Director's Cut")
        self.assertEqual(
            search_title("Film (Director's Cut) Returns"),
            "Film (Director's Cut) Returns",
        )

    async def test_options_include_bounded_library_comparison_and_search_title(self):
        await self.setup_review()
        await self.repo.async_library_catalog(
            enrichment.ORIGIN,
            [
                {
                    "source_handle": "fictional",
                    "source_group": "movie",
                    "title": "Fictional Film (Director's Cut)",
                    "year": 2025,
                    "actors": [f"Example Actor {number}" for number in range(8)],
                    "directors": ["Example Director"],
                }
            ],
        )
        options = await self.manager.options(self.admin, self.id)
        self.assertEqual(options["search_title"], "Fictional Film")
        self.assertEqual(options["current"]["year"], 2025)
        self.assertEqual(options["current"]["directors"], ["Example Director"])
        self.assertEqual(len(options["current"]["actors"]), 5)
        self.assertEqual(options["title"], "Fictional Film (Director's Cut)")

    async def test_provider_unavailable_is_group_scoped_reversible_and_retry_safe(self):
        await self.setup_review()
        await self.repo.async_metadata_sources(
            {"metadata_tmdb_enabled": True, "metadata_store_enabled": True}
        )
        await self.repo.async_enrichment(
            "conflict",
            self.source,
            self.id,
            "tmdb",
            "tmdb_not_found",
            {"title": "Fictional Film", "source_group": "movie"},
        )
        self.assertEqual(
            (await self.repo.async_library_summary(self.source))["scraper_conflicts"], 1
        )
        options = await self.manager.options(self.admin, self.id)
        data = {
            "title_id": self.id,
            "snapshot": options["snapshot"],
            "provider": "tmdb",
            "unavailable": True,
        }
        request = str(uuid4())
        first = await self.manager.availability(self.admin, request, data)
        self.assertEqual(
            await self.manager.availability(self.admin, request, data), first
        )
        self.assertEqual(first["updated_count"], 2)
        self.assertEqual(
            (await self.repo.async_library_summary(self.source))["scraper_conflicts"], 0
        )
        options = await self.manager.options(self.admin, self.id)
        tmdb = next(row for row in options["providers"] if row["id"] == "tmdb")
        self.assertTrue(tmdb["unavailable"])
        self.assertFalse(tmdb["missing_data"])
        candidates = await self.repo.async_enrichment("candidates", self.source)
        self.assertEqual(
            next(row for row in candidates if row["source_group"] == "movie")[
                "unavailable"
            ],
            ["tmdb"],
        )
        self.assertEqual(
            next(row for row in candidates if row["source_group"] == "remake")[
                "unavailable"
            ],
            [],
        )
        with self.assertRaises(JournalError):
            await self.manager.availability(
                self.admin, str(uuid4()), {**data, "unavailable": False}
            )
        await self.manager.availability(
            self.admin,
            str(uuid4()),
            {**data, "snapshot": options["snapshot"], "unavailable": False},
        )
        options = await self.manager.options(self.admin, self.id)
        self.assertFalse(
            next(row for row in options["providers"] if row["id"] == "tmdb")[
                "unavailable"
            ]
        )
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        denied = await self.call(
            "metadata/title/availability",
            user=reader,
            **self.scope,
            request_id=str(uuid4()),
            data=data,
        )
        self.assertEqual(denied["code"], "unauthorized")

    async def test_artwork_unavailable_is_group_scoped_and_reversible(self):
        await self.setup_review()
        options = await self.manager.options(self.admin, self.id)
        data = {
            "title_id": self.id,
            "snapshot": options["snapshot"],
            "kind": "backdrop",
            "unavailable": True,
        }
        result = await self.manager.availability(self.admin, str(uuid4()), data)
        self.assertEqual(result["updated_count"], 2)
        options = await self.manager.options(self.admin, self.id)
        self.assertEqual(options["artwork_unavailable"], ["backdrop"])
        candidates = await self.repo.async_enrichment("candidates", self.source)
        self.assertEqual(
            next(row for row in candidates if row["source_group"] == "movie")[
                "unavailable_artwork"
            ],
            ["backdrop"],
        )
        await self.manager.availability(
            self.admin,
            str(uuid4()),
            {**data, "snapshot": options["snapshot"], "unavailable": False},
        )
        options = await self.manager.options(self.admin, self.id)
        self.assertEqual(options["artwork_unavailable"], [])

    async def test_expectation_switches_save_atomically_and_drive_group_counts(self):
        await self.setup_review()
        self.manager = self.sync(
            library_host=enrichment.ORIGIN,
            library_sync_artwork=True,
            metadata_store_enabled=True,
        ).title_reviews()
        self.addAsyncCleanup(self.manager.parent.async_stop)
        await self.repo.async_metadata_sources(
            {"metadata_tmdb_enabled": True, "metadata_store_enabled": True}
        )
        options = await self.manager.options(self.admin, self.id)
        self.assertEqual(
            options["artwork_present"], {"poster": False, "backdrop": False}
        )
        self.assertFalse(options["providers"][0]["has_data"])
        data = {
            "title_id": self.id,
            "snapshot": options["snapshot"],
            "providers": {"tmdb": False, "kaleidescape": False},
            "artwork": {"poster": False, "backdrop": False},
        }
        request = str(uuid4())
        saved = await self.manager.availability(self.admin, request, data)
        self.assertEqual(saved["updated_count"], 2)
        self.assertEqual(
            await self.manager.availability(self.admin, request, data), saved
        )
        summary = await self.repo.async_library_summary(self.source)
        self.assertEqual(summary["missing_metadata"], 1)
        self.assertEqual(summary["missing_artwork"], 1)
        options = await self.manager.options(self.admin, self.id)
        self.assertEqual(options["artwork_unavailable"], ["backdrop", "poster"])
        self.assertTrue(all(row["unavailable"] for row in options["providers"]))
        with self.assertRaises(JournalError) as error:
            await self.manager.availability(
                self.admin,
                str(uuid4()),
                {**data, "providers": {"unknown": False}},
            )
        self.assertEqual(error.exception.code, "metadata_disabled")

    async def test_title_search_passes_an_explicit_release_year(self):
        await self.setup_review()
        search = AsyncMock(return_value=[])
        with patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.search",
            search,
        ):
            await self.manager.search(
                self.admin, self.id, "tmdb", "Fictional Film", 2025
            )
            search.assert_awaited_once_with("tmdb", "Fictional Film", 2025)
            with self.assertRaises(JournalError) as error:
                await self.manager.search(
                    self.admin, self.id, "tmdb", "Fictional Film", 2101
                )
            self.assertEqual(error.exception.code, "invalid_request")

    async def test_unavailable_groups_are_skipped_by_automatic_scraping(self):
        await self.setup_review()
        candidates = await self.repo.async_enrichment("candidates", self.source)
        for row in candidates:
            options = await self.manager.options(self.admin, row["id"])
            await self.manager.availability(
                self.admin,
                str(uuid4()),
                {
                    "title_id": row["id"],
                    "provider": "tmdb",
                    "snapshot": options["snapshot"],
                    "unavailable": True,
                },
            )
        self.metadata.reset_mock()
        await self.manager.parent._run(True)
        self.metadata.assert_not_awaited()
        self.assertEqual(
            (await self.repo.async_library_summary(self.source))["scraper_failures"], 0
        )

    async def test_unavailable_provider_blocks_late_writes_but_not_other_providers(
        self,
    ):
        await self.setup_review()
        await self.repo.async_metadata_sources(
            {"metadata_tmdb_enabled": True, "metadata_store_enabled": True}
        )
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        options = await self.manager.options(self.admin, self.id)
        await self.manager.availability(
            self.admin,
            str(uuid4()),
            {
                "title_id": self.id,
                "provider": "tmdb",
                "snapshot": options["snapshot"],
                "unavailable": True,
            },
        )
        with self.assertRaises(JournalError) as error:
            await self.repo.async_enrichment(
                "artwork", self.source, self.id, self.data, enrichment.IMAGE, 1048576
            )
        self.assertEqual(error.exception.code, "refresh_required")
        expected = {"title": "Fictional Film", "source_group": "movie"}
        with self.assertRaises(JournalError):
            await self.repo.async_enrichment(
                "conflict", self.source, self.id, "tmdb", "tmdb_not_found", expected
            )
        await self.repo.async_enrichment(
            "conflict",
            self.source,
            self.id,
            "kaleidescape",
            "store_not_found",
            expected,
        )
        self.assertEqual(
            (await self.repo.async_library_summary(self.source))["scraper_conflicts"], 1
        )
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)

    async def test_availability_rechecks_role_when_the_worker_accepts_the_write(self):
        await self.setup_review()
        options = await self.manager.options(self.admin, self.id)
        actor = SimpleNamespace(id="another-admin", is_admin=True, is_active=True)
        original = self.repo._library_write

        def revoke(operation, *args):
            actor.is_active = False
            return original(operation, *args)

        with (
            patch.object(self.repo, "_library_write", revoke),
            self.assertRaises(JournalError) as error,
        ):
            await self.manager.availability(
                actor,
                str(uuid4()),
                {
                    "title_id": self.id,
                    "provider": "tmdb",
                    "snapshot": options["snapshot"],
                    "unavailable": True,
                },
            )
        self.assertEqual(error.exception.code, "unauthorized")
        options = await self.manager.options(self.admin, self.id)
        self.assertFalse(
            next(row for row in options["providers"] if row["id"] == "tmdb")[
                "unavailable"
            ]
        )

    async def test_options_report_missing_provider_data_for_the_exact_movie_group(self):
        await self.setup_review()
        self.metadata.reset_mock()
        manager = self.sync(
            library_host=enrichment.ORIGIN, metadata_store_enabled=True
        ).title_reviews()
        self.addAsyncCleanup(manager.parent.async_stop)
        options = await manager.options(self.admin, self.id)
        self.assertTrue(all(row["missing_data"] for row in options["providers"]))
        self.metadata.assert_not_awaited()
        await self.repo.async_enrichment(
            "save", self.source, self.id, "tmdb", self.data
        )
        options = await manager.options(self.admin, self.id)
        self.assertEqual(
            {row["id"]: row["missing_data"] for row in options["providers"]},
            {"tmdb": False, "kaleidescape": True},
        )
        versions = await self.repo.async_library_versions(self.source, self.id)
        other_version = next(
            row["id"] for row in versions["items"] if row["id"] != self.id
        )
        self.assertFalse(
            next(
                row
                for row in (await manager.options(self.admin, other_version))[
                    "providers"
                ]
                if row["id"] == "tmdb"
            )["missing_data"]
        )
        remake = next(
            row["id"]
            for row in (await self.repo.async_inspect("library"))["items"]
            if row["source_group"] == "remake"
        )
        self.assertTrue(
            all(
                row["missing_data"]
                for row in (await manager.options(self.admin, remake))["providers"]
            )
        )

    async def test_reviewed_provider_data_also_clears_missing_indicator(self):
        review = await self.setup_review()
        await self.manager.apply(
            self.admin,
            str(uuid4()),
            {"plan_id": review["plan_id"], "fields": ["actors"], "images": {}},
        )
        options = await self.manager.options(self.admin, self.id)
        self.assertFalse(options["providers"][0]["missing_data"])

    async def setup_review(self):
        await self.seed()
        self.manager = self.sync(
            library_host=enrichment.ORIGIN, library_sync_artwork=True
        ).title_reviews()
        self.entry.runtime_data.enrichment = self.manager.parent
        self.addAsyncCleanup(self.manager.parent.async_stop)
        self.data["actors"] = ["Lead Example", "Second Example", "Supporting Example"]
        self.data["directors"] = ["Director Example"]
        self.session = SimpleNamespace(detach=Mock())
        self.metadata = AsyncMock(return_value=self.data)
        self.images = AsyncMock(
            return_value=[
                {
                    "kind": "poster",
                    "path": "/PosterExample.jpg",
                    "width": 500,
                    "height": 750,
                },
                {
                    "kind": "backdrop",
                    "path": "/HeroExample.jpg",
                    "width": 780,
                    "height": 439,
                },
            ]
        )
        for name, value in (
            (
                "custom_components.kaleidescape_companion.enrichment.sync.async_create_clientsession",
                self.session,
            ),
        ):
            context = patch(name, return_value=value)
            context.start()
            self.addCleanup(context.stop)
        for method, mock in (
            ("metadata", self.metadata),
            ("images", self.images),
            ("image", AsyncMock(return_value=enrichment.IMAGE)),
        ):
            context = patch(
                "custom_components.kaleidescape_companion.enrichment.review.Providers."
                + method,
                mock,
            )
            context.start()
            self.addCleanup(context.stop)
        return await self.manager.preview(self.admin, self.id, "tmdb")

    async def test_explicit_review_apply_reenables_a_restored_source_only_group(self):
        await self.setup_review()
        target = await self.repo.async_library_edit(self.source, self.id)
        await self.repo.async_library_reset(
            self.source, self.id, self.admin.id, str(uuid4()), target["snapshot"]
        )
        self.assertNotIn(
            self.id,
            [
                row["id"]
                for row in await self.repo.async_enrichment("candidates", self.source)
            ],
        )
        review = await self.manager.preview(self.admin, self.id, "tmdb")
        await self.manager.apply(
            self.admin,
            str(uuid4()),
            {"plan_id": review["plan_id"], "fields": ["actors"], "images": {}},
        )
        self.assertIn(
            "Lead Example",
            (await self.repo.async_library_versions(self.source, self.id))["items"][0][
                "actors"
            ],
        )
        self.assertTrue(
            any(
                row["source_group"] == "movie"
                for row in await self.repo.async_enrichment("candidates", self.source)
            )
        )

    async def test_preview_is_read_only_and_apply_changes_only_selected_fields(self):
        review = await self.setup_review()
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertNotIn("Lead Example", versions["items"][0]["actors"])
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)
        self.assertNotIn("path", json.dumps(review))
        data = {"plan_id": review["plan_id"], "fields": ["actors"], "images": {}}
        request = str(uuid4())
        result = await self.manager.apply(self.admin, request, data)
        self.assertEqual(result["updated_count"], 2)
        versions = await self.repo.async_library_versions(self.source, self.id)
        for row in versions["items"]:
            self.assertEqual(row["actors"], self.data["actors"])
            self.assertEqual(row["writers"], [])
            self.assertEqual(row["directors"], [])
        self.manager.plans.clear()
        self.assertEqual(await self.manager.apply(self.admin, request, data), result)
        another = SimpleNamespace(id="another-admin", is_admin=True, is_active=True)
        with self.assertRaises(JournalError) as error:
            await self.manager.apply(another, request, data)
        self.assertEqual(error.exception.code, "conflict")
        await self.repo.async_enrichment(
            "save",
            self.source,
            self.id,
            "tmdb",
            {
                **self.data,
                "actors": ["Later automatic credit"],
                "matched_reference": {
                    key: self.data[key]
                    for key in ("provider_id", "title", "year", "url")
                },
            },
        )
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertEqual(versions["items"][0]["actors"], self.data["actors"])
        self.assertEqual(
            (
                await self.repo.async_library_list(
                    self.source, {"query": "Lead Example"}
                )
            )["total"],
            2,
        )

    async def test_selected_images_use_shared_cache_and_survive_device_covers(self):
        review = await self.setup_review()
        self.assertFalse(review["has_backdrop"])
        images = {image["kind"]: image["id"] for image in review["images"]}
        data = {"plan_id": review["plan_id"], "fields": [], "images": images}
        await self.manager.apply(self.admin, str(uuid4()), data)
        with patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.resolve",
            AsyncMock(return_value=self.data),
        ):
            refreshed = await self.manager.preview(self.admin, self.id, "tmdb")
        self.assertTrue(refreshed["has_backdrop"])
        key = hashlib.sha256(enrichment.IMAGE).hexdigest()
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 1)
        self.assertEqual(
            (await self.repo.async_library_artwork(self.source, key))[0],
            enrichment.IMAGE,
        )
        await self.repo.async_library_artwork_save(
            self.source, self.id, b"\xff\xd8\xffdevice-poster", "image/jpeg", 1048576
        )
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertTrue(
            all(
                row["artwork_key"] == key and row["backdrop_key"] == key
                for row in versions["items"]
            )
        )
        grouped = await self.repo.async_library_list(self.source, {"grouped": True})
        self.assertIn(key, [row["artwork_key"] for row in grouped["items"]])
        await self.repo.async_library_trim(0)
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertTrue(
            all(
                not row["backdrop_key"] and not row["artwork_key"]
                for row in versions["items"]
            )
        )

    async def test_stale_review_and_foreign_or_expired_plans_cannot_apply(self):
        review = await self.setup_review()
        actor = SimpleNamespace(id="other", is_admin=True, is_active=True)
        with self.assertRaises(JournalError):
            await self.manager.image(
                actor, review["plan_id"], review["images"][0]["id"]
            )
        await self.repo.async_library_details(
            self.source, self.id, {"actors": ["A correction"]}
        )
        data = {"plan_id": review["plan_id"], "fields": ["actors"], "images": {}}
        with self.assertRaises(JournalError) as error:
            await self.manager.apply(self.admin, str(uuid4()), data)
        self.assertEqual(error.exception.code, "refresh_required")
        self.manager.plans[review["plan_id"]]["expires"] = 0
        with self.assertRaises(JournalError):
            await self.manager.apply(self.admin, str(uuid4()), data)
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)

    async def test_unknown_fields_and_image_choices_do_not_commit(self):
        review = await self.setup_review()
        for fields, images in (
            (["year"], {}),
            (["actors"], {"poster": "backdrop-1"}),
            ([], {}),
            (["actors"], {"poster": "poster-900"}),
        ):
            with self.assertRaises(JournalError):
                await self.manager.apply(
                    self.admin,
                    str(uuid4()),
                    {"plan_id": review["plan_id"], "fields": fields, "images": images},
                )
        versions = await self.repo.async_library_versions(self.source, self.id)
        self.assertNotIn("Lead Example", versions["items"][0]["actors"])

    async def test_reader_denial_and_revocation_withhold_scrapes_and_images(self):
        review = await self.setup_review()
        reader = SimpleNamespace(id="reader", is_admin=False, is_active=True)
        for command, args in (
            ("metadata/title/options", {"title_id": self.id}),
            ("metadata/title/preview", {"title_id": self.id, "provider": "tmdb"}),
            ("metadata/title/apply", {"request_id": str(uuid4()), "data": {}}),
        ):
            response = await self.call(command, user=reader, **self.scope, **args)
            self.assertEqual(response["code"], "unauthorized")
        view = MetadataImageView()
        values = {"hass_user": reader}
        request = SimpleNamespace(app={KEY_HASS: self.hass}, query={}, get=values.get)
        with self.assertRaises(web.HTTPForbidden):
            await view.get(
                request,
                **self.scope,
                plan_id=review["plan_id"],
                choice=review["images"][0]["id"],
            )
        values["hass_user"] = self.admin
        response = await view.get(
            request,
            **self.scope,
            plan_id=review["plan_id"],
            choice=review["images"][0]["id"],
        )
        self.assertEqual(response.body, enrichment.IMAGE)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

        async def revoke(*args):
            self.admin.is_active = False
            return self.data

        self.metadata.side_effect = revoke
        with self.assertRaises(JournalError):
            await self.manager.preview(self.admin, self.id, "tmdb")
        self.session.detach.assert_called()

    async def test_atomic_image_failure_preserves_data_and_backup_clears_plans(self):
        review = await self.setup_review()
        data = {
            "plan_id": review["plan_id"],
            "fields": ["actors"],
            "images": {"poster": review["images"][0]["id"]},
        }
        plan = self.manager.plans[review["plan_id"]]
        with self.assertRaises(JournalError):
            await self.repo.async_enrichment(
                "review_apply",
                self.source,
                self.admin.id,
                str(uuid4()),
                data,
                plan,
                {"poster": b"<svg>unsafe</svg>"},
                1048576,
            )
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)
        self.assertNotIn(
            "Lead Example",
            (await self.repo.async_library_versions(self.source, self.id))["items"][0][
                "actors"
            ],
        )
        await self.manager.parent.async_pause()
        self.assertFalse(self.manager.plans)
        with self.assertRaises(JournalError):
            await self.manager.preview(self.admin, self.id, "tmdb")

    async def test_review_limits_versions_before_requesting_a_provider(self):
        await self.setup_review()
        self.metadata.reset_mock()
        await self.repo.async_library_catalog(
            enrichment.ORIGIN,
            [
                {
                    "source_handle": f"version-{index}",
                    "source_group": "large-group",
                    "title": "Fictional Film",
                    "year": 2025,
                }
                for index in range(101)
            ],
        )
        from custom_components.kaleidescape_companion.library.store import title_id

        with self.assertRaises(JournalError) as error:
            await self.manager.preview(
                self.admin, title_id(self.source, "version-0"), "tmdb"
            )
        self.assertEqual(error.exception.code, "metadata_limit")
        self.metadata.assert_not_awaited()

    async def test_cancel_review_stops_only_its_actor_bound_image_job(self):
        import asyncio

        review = await self.setup_review()
        other = SimpleNamespace(id="other-admin", is_active=True, is_admin=True)
        with self.assertRaises(JournalError):
            await self.manager.cancel(other, review["plan_id"])
        waiting = asyncio.Event()

        async def image(*args, **kwargs):
            waiting.set()
            await asyncio.Future()

        with patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.image",
            side_effect=image,
        ):
            task = asyncio.create_task(
                self.manager.apply(
                    self.admin,
                    str(uuid4()),
                    {
                        "plan_id": review["plan_id"],
                        "fields": [],
                        "images": {"poster": review["images"][0]["id"]},
                    },
                )
            )
            await asyncio.wait_for(waiting.wait(), 2)
            result = await self.manager.cancel(self.admin, review["plan_id"])
            self.assertTrue(result["cancelled"])
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual((await self.repo.async_inspect("library_artwork"))["total"], 0)
        self.assertNotIn(review["plan_id"], self.manager.plans)
        self.assertFalse(self.manager.jobs)

    async def test_png_review_preview_and_apply_store_the_verified_image_type(self):
        review = await self.setup_review()
        png = b"\x89PNG\r\n\x1a\nfictional-image"
        with patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.image",
            new=AsyncMock(return_value=png),
        ):
            request = SimpleNamespace(
                app={KEY_HASS: self.hass},
                query={},
                get={"hass_user": self.admin}.get,
            )
            response = await MetadataImageView().get(
                request,
                **self.scope,
                plan_id=review["plan_id"],
                choice=review["images"][0]["id"],
            )
            self.assertEqual(response.content_type, "image/png")
            await self.manager.apply(
                self.admin,
                str(uuid4()),
                {
                    "plan_id": review["plan_id"],
                    "fields": [],
                    "images": {"backdrop": review["images"][1]["id"]},
                },
            )
        cached = await self.repo.async_inspect("library_artwork")
        self.assertEqual(cached["total"], 1)
        self.assertEqual(cached["items"][0]["content_type"], "image/png")

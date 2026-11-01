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


class TitleReviewTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = enrichment.EnrichmentTest.asyncSetUp
    seed = enrichment.EnrichmentTest.seed
    sync = enrichment.EnrichmentTest.sync
    call = enrichment.EnrichmentTest.call

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
            {**self.data, "actors": ["Later automatic credit"]},
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
        images = {image["kind"]: image["id"] for image in review["images"]}
        data = {"plan_id": review["plan_id"], "fields": [], "images": images}
        await self.manager.apply(self.admin, str(uuid4()), data)
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

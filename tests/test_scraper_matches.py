"""Fictional match reviews, persistent provider bindings and conflict projections."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_enrichment_review as reviews

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.scrapers import (
    ProviderError,
)


class ScraperMatchingTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = reviews.TitleReviewTest.asyncSetUp
    seed = reviews.TitleReviewTest.seed
    sync = reviews.TitleReviewTest.sync
    call = reviews.TitleReviewTest.call
    setup_review = reviews.TitleReviewTest.setup_review

    async def prepare_matches(self):
        await self.setup_review()
        self.first = {
            **self.data,
            "poster_path": "/ExamplePoster.jpg",
            "genres": ["Adventure"],
        }
        self.second = {
            **self.first,
            "provider_id": "43",
            "year": 2026,
            "url": "https://www.themoviedb.org/movie/43",
            "directors": ["Other Director"],
        }
        self.metadata.side_effect = ProviderError("tmdb_ambiguous")
        self.search = AsyncMock(return_value=[self.first, self.second])
        context = patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.search",
            self.search,
        )
        context.start()
        self.addCleanup(context.stop)
        return await self.manager.preview(self.admin, self.id, "tmdb")

    async def test_ambiguous_preview_then_pinned_source(
        self,
    ):
        choices = await self.prepare_matches()
        self.assertEqual(len(choices["candidates"]), 2)
        self.assertNotIn("provider_id", json.dumps(choices))
        self.assertNotIn("ExamplePoster.jpg", json.dumps(choices))
        self.assertEqual(choices["candidates"][1]["directors"], ["Other Director"])
        self.assertEqual(choices["candidates"][0]["genres"], ["Adventure"])
        self.assertEqual(
            await self.manager.image(self.admin, choices["search_id"], "match-0"),
            b"\xff\xd8\xfffictional-backdrop",
        )
        page = await self.repo.async_library_list(
            self.source, {"grouped": True, "scraper_conflict": True}
        )
        self.assertEqual(page["total"], 1)
        self.assertTrue(page["items"][0]["scraper_conflict"])
        review = await self.manager.preview(
            self.admin, self.id, "tmdb", choices["search_id"], "match-1"
        )
        self.assertEqual(review["matched"]["year"], 2026)
        data = {
            "plan_id": review["plan_id"],
            "fields": [],
            "images": {},
            "save_match": True,
        }
        request = str(uuid4())
        result = await self.manager.apply(self.admin, request, data)
        self.assertEqual(await self.manager.apply(self.admin, request, data), result)
        raw = (await self.repo.async_inspect("library"))["items"]
        selected = next(row for row in raw if row["id"] == self.id)
        self.assertEqual(
            json.loads(selected["enrichment"])["matches"]["tmdb"]["provider_id"], "43"
        )
        self.assertEqual(json.loads(selected["data"])["year"], 2025)
        self.assertEqual(
            (
                await self.repo.async_library_list(
                    self.source, {"grouped": True, "scraper_conflict": True}
                )
            )["total"],
            0,
        )
        resolve = AsyncMock(return_value=self.second)
        self.metadata.reset_mock()
        with patch(
            "custom_components.kaleidescape_companion.enrichment.review.Providers.resolve",
            resolve,
        ):
            await self.manager.preview(self.admin, self.id, "tmdb")
        resolve.assert_awaited_once()
        self.assertEqual(resolve.call_args.args[1]["provider_id"], "43")
        self.metadata.assert_not_awaited()
        candidates = await self.repo.async_enrichment("candidates", self.source)
        pinned = next(row for row in candidates if row["source_group"] == "movie")
        self.assertEqual(pinned["matches"]["tmdb"]["provider_id"], "43")
        # Old, in-flight automatic results cannot replace a newly chosen source.
        with self.assertRaises(JournalError):
            await self.repo.async_enrichment(
                "save", self.source, self.id, "tmdb", self.data
            )
        await self.repo.async_enrichment(
            "save",
            self.source,
            self.id,
            "tmdb",
            {**self.second, "matched_reference": pinned["matches"]["tmdb"]},
        )
        sync = self.sync(
            library_host="http://fictional.local", library_sync_artwork=False
        )
        sync.providers.resolve = AsyncMock(return_value=self.second)
        sync.providers.metadata = AsyncMock(side_effect=ProviderError("tmdb_not_found"))
        await sync._run(True)
        self.assertIsNone(sync.error)
        self.assertEqual(sync.providers.resolve.await_count, 1)
        self.assertEqual(sync.providers.resolve.call_args.args[1]["provider_id"], "43")

    async def test_search_and_choice_scope_validation(
        self,
    ):
        choices = await self.prepare_matches()
        self.search.return_value = []
        empty = await self.manager.search(
            self.admin, self.id, "tmdb", "Different title"
        )
        self.assertEqual(empty["candidates"], [])
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        response = await self.call(
            "metadata/title/search",
            user=reader,
            **self.scope,
            title_id=self.id,
            provider="tmdb",
            query="Fictional",
        )
        self.assertEqual(response["code"], "unauthorized")
        another = SimpleNamespace(id="another", is_active=True, is_admin=True)
        for actor, title, choice in (
            (another, self.id, "match-0"),
            (self.admin, self.id, "match-99"),
        ):
            with self.assertRaises(JournalError):
                await self.manager.preview(
                    actor, title, "tmdb", choices["search_id"], choice
                )
        await self.repo.async_library_details(
            self.source, self.id, {"actors": ["Changed"]}
        )
        with self.assertRaises(JournalError) as error:
            await self.manager.preview(
                self.admin, self.id, "tmdb", choices["search_id"], "match-0"
            )
        self.assertEqual(error.exception.code, "refresh_required")
        await self.repo.async_metadata_sources(
            {"metadata_tmdb_enabled": False, "metadata_store_enabled": False}
        )
        self.assertEqual(
            (
                await self.repo.async_library_list(
                    self.source, {"grouped": True, "scraper_conflict": True}
                )
            )["total"],
            0,
        )

    async def test_search_revocation_and_provider_errors_do_not_create_match_plans(
        self,
    ):
        await self.prepare_matches()
        count = len(self.manager.plans)

        async def revoked(*args):
            self.admin.is_active = False
            return [self.first]

        self.search.side_effect = revoked
        with self.assertRaises(JournalError):
            await self.manager.search(self.admin, self.id, "tmdb", "Fictional")
        self.assertEqual(len(self.manager.plans), count)
        self.session.detach.assert_called()

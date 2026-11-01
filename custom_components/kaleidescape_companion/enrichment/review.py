"""Actor-bound, expiring title scrape previews; only an explicit apply writes data."""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from aiohttp import ClientError
from kaleidescape_api.logging import Resource, Trigger

from .._vendor.kaleidescape_scrapers import MovieQuery, ProviderError, Providers
from ..core.models import JournalError, invalid
from ..core.security import is_active_admin
from ..library.store import image_type
from .review_store import REVIEW_FIELDS, selection

REVIEW_SECONDS = 20 * 60


class TitleReviews:
    def __init__(self, parent):
        self.parent = parent
        self.plans = {}
        self.jobs = {}
        self.slots = asyncio.Semaphore(3)

    def ready(self, actor):
        self.parent._ready()
        if not is_active_admin(actor):
            raise JournalError("unauthorized", "Administrator access is required")

    def enabled(self, provider):
        config = self.parent.config
        if provider == "kaleidescape":
            return bool(config.get("metadata_store_enabled"))
        if provider == "tmdb":
            return bool(
                config.get("metadata_tmdb_enabled")
                and config.get("metadata_tmdb_credential")
            )
        return False

    async def options(self, actor, title):
        self.ready(actor)
        target = await self.parent.repository.async_enrichment(
            "review_target", self.parent.source, title
        )
        self.ready(actor)
        return {
            "providers": [
                {
                    "id": provider,
                    "label": label,
                    "available": bool(
                        target["year"]
                        and (
                            target["href"]
                            if provider == "kaleidescape"
                            else self.parent.config.get("metadata_tmdb_credential")
                        )
                    ),
                }
                for provider, label in (
                    ("kaleidescape", "Kaleidescape store"),
                    ("tmdb", "TMDB"),
                )
                if self.parent.config.get(
                    "metadata_store_enabled"
                    if provider == "kaleidescape"
                    else "metadata_tmdb_enabled"
                )
            ],
            "artwork_enabled": bool(self.parent.config.get("library_sync_artwork")),
        }

    @asynccontextmanager
    async def worker(self, actor, title):
        from .sync import MetadataSync

        self.ready(actor)
        if len(self.jobs) >= 12:
            raise JournalError("busy", "Wait for the current metadata requests")
        child = MetadataSync(
            self.parent.hass, self.parent.repository, self.parent.entry
        )
        child.actor, child.review_network = actor, True
        child.providers = Providers(
            child._get,
            requests_per_second=child.config["metadata_requests_per_second"],
            tmdb_credential=child.config["metadata_tmdb_credential"],
            budget=self.parent.providers.transport.budget,
        )
        child.review_title = title
        task = asyncio.current_task()
        self.jobs[task] = child
        try:
            async with asyncio.timeout(75), self.slots:
                self.ready(actor)
                child.session = child.create_session()
                with self.parent.repository.logger.context(
                    actor=(Resource.USER, actor.id),
                    resource=(Resource.MOVIE, title),
                    trigger=Trigger.USER_REQUEST,
                ):
                    yield child
                self.ready(actor)
        except ProviderError as error:
            raise JournalError(
                str(error),
                "Provider data could not be retrieved; check the operation logs",
            ) from None
        except (
            ClientError,
            OSError,
            TimeoutError,
            ValueError,
            TypeError,
            KeyError,
        ) as error:
            raise JournalError(
                "metadata_unavailable",
                "Metadata retrieval failed; check the operation logs",
            ) from error
        finally:
            if child.session:
                child.session.detach()
                child.session = None
            self.jobs.pop(task, None)

    def plan(self, actor, token):
        self.ready(actor)
        plan = self.plans.get(token)
        if (
            not plan
            or plan["actor"] != actor.id
            or plan["expires"] <= time.monotonic()
            or not self.enabled(plan["provider"])
        ):
            raise JournalError(
                "not_found", "Scrape review expired; scrape the title again"
            )
        return plan

    async def preview(self, actor, title, provider):
        self.ready(actor)
        if not self.enabled(provider):
            raise JournalError(
                "metadata_disabled", "Enable and configure this provider first"
            )
        target = await self.parent.repository.async_enrichment(
            "review_target", self.parent.source, title
        )
        async with self.worker(actor, title) as client:
            result = await client.providers.metadata(
                provider,
                MovieQuery(target["title"], target["year"], target["href"] or ""),
            )
            images = (
                await client.providers.images(provider, result)
                if self.parent.config.get("library_sync_artwork")
                else []
            )
        if len(json.dumps(result).encode()) > 128 * 1024:
            raise JournalError("metadata_limit", "Provider metadata is too large")
        self.plans = {
            key: value
            for key, value in self.plans.items()
            if value["expires"] > time.monotonic()
        }
        if len(self.plans) >= 8:
            del self.plans[next(iter(self.plans))]
        token = str(uuid4())
        choices = {
            f"{image['kind']}-{index}": image for index, image in enumerate(images)
        }
        self.plans[token] = {
            "id": token,
            "actor": actor.id,
            "expires": time.monotonic() + REVIEW_SECONDS,
            "target": target,
            "provider": provider,
            "metadata": result,
            "images": choices,
        }
        fields = {
            key: {"before": target["current"].get(key), "after": result[key]}
            for key in REVIEW_FIELDS
            if key in result and result[key] not in (None, "", [])
        }
        return {
            "plan_id": token,
            "title": target["title"],
            "fields": fields,
            "images": [
                {
                    "id": key,
                    **{
                        field: image.get(field) for field in ("kind", "width", "height")
                    },
                }
                for key, image in choices.items()
            ],
            "artwork_enabled": bool(self.parent.config.get("library_sync_artwork")),
        }

    async def image(self, actor, token, choice):
        plan = self.plan(actor, token)
        image = plan["images"].get(choice)
        if image is None or not self.parent.config.get("library_sync_artwork"):
            raise JournalError("not_found", "Image is unavailable")
        async with self.worker(actor, plan["target"]["id"]) as client:
            body = await client.providers.image(plan["provider"], image, thumbnail=True)
        self.plan(actor, token)
        if image_type(body) != "image/jpeg":
            raise JournalError("library_artwork", "Image was rejected")
        return body

    async def apply(self, actor, request, data):
        self.ready(actor)
        data = selection(data)
        cached = await self.parent.repository.async_enrichment(
            "review_lookup", actor.id, request, data
        )
        if cached is not None:
            return cached
        plan = self.plan(actor, data["plan_id"])
        images = {}
        if data["images"]:
            if not self.parent.config.get("library_sync_artwork"):
                raise invalid("Enable artwork sync first")
            async with self.worker(actor, plan["target"]["id"]) as client:
                for kind, choice in data["images"].items():
                    image = plan["images"].get(choice)
                    if image is None or image["kind"] != kind:
                        raise invalid("Image is not part of this review")
                    images[kind] = await client.providers.image(plan["provider"], image)
        self.plan(actor, data["plan_id"])
        return await self.parent.repository.async_enrichment(
            "review_apply",
            self.parent.source,
            actor.id,
            request,
            data,
            plan,
            images,
            self.parent.config.get("library_artwork_cache_mb", 512) * 1024 * 1024,
        )

    async def clear(self):
        self.plans.clear()
        tasks = list(self.jobs)
        for task in tasks:
            self.jobs[task].stopped = True
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

"""Actor-bound, expiring title scrape previews; only an explicit apply writes data."""

import asyncio
import json
import re
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from aiohttp import ClientError
from kaleidescape_api.logging import (
    Operation,
    Outcome,
    Reason,
    Resource,
    Stage,
    Subsystem,
    Trigger,
)

from .._vendor.kaleidescape_scrapers import MovieQuery, ProviderError, Providers
from ..core.models import JournalError, identifier, invalid
from ..core.security import is_active_admin
from ..library.store import image_type
from .matching import REASONS, reference
from .review_store import REVIEW_FIELDS, selection

REVIEW_SECONDS = 20 * 60


def search_title(title):
    """Remove only a trailing edition suffix; leave the Library identity intact."""
    return re.sub(
        r"\s*\(director['’]s cut\)\s*$", "", title, flags=re.IGNORECASE
    ).strip()[:200]


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
                    "available": self.enabled(provider),
                    "missing_data": provider not in target["cached_providers"]
                    and provider not in target["unavailable"],
                    "unavailable": provider in target["unavailable"],
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
            "title": target["title"],
            "search_title": search_title(target["comparison"]["title"]),
            "current": target["comparison"],
            "snapshot": target["snapshot"],
        }

    async def availability(self, actor, request, data):
        self.ready(actor)
        provider = data.get("provider") if isinstance(data, dict) else None
        if not isinstance(provider, str) or provider not in {"tmdb", "kaleidescape"}:
            raise invalid("Choose a supported scraper")
        if not self.parent.config.get(
            "metadata_tmdb_enabled" if provider == "tmdb" else "metadata_store_enabled"
        ):
            raise JournalError("metadata_disabled", "Enable this scraper first")
        result = await self.parent.repository.async_enrichment(
            "availability",
            self.parent.source,
            actor.id,
            request,
            data,
            lambda: self.ready(actor),
        )
        self.ready(actor)
        return result

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
        completed, failed = False, False
        try:
            async with asyncio.timeout(180), self.slots:
                self.ready(actor)
                child.session = child.create_session()
                with self.parent.repository.logger.context(
                    actor=(Resource.USER, actor.id),
                    resource=(Resource.MOVIE, title),
                    trigger=Trigger.USER_REQUEST,
                ):
                    yield child
                self.ready(actor)
                completed = True
        except ProviderError as error:
            failed = True
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
            failed = True
            raise JournalError(
                "metadata_unavailable",
                "Metadata retrieval failed; check the operation logs",
            ) from error
        finally:
            if child.session:
                child.session.detach()
                child.session = None
            self.jobs.pop(task, None)
            if completed or failed:
                await self.parent.record_activity(failed)

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

    def remember(self, actor, target, provider, **values):
        self.plans = {
            key: value
            for key, value in self.plans.items()
            if value["expires"] > time.monotonic()
        }
        if len(self.plans) >= 8:
            del self.plans[next(iter(self.plans))]
        token = str(uuid4())
        self.plans[token] = {
            "id": token,
            "actor": actor.id,
            "expires": time.monotonic() + REVIEW_SECONDS,
            "target": target,
            "provider": provider,
            **values,
        }
        return token

    async def search(self, actor, title, provider, query):
        from .review_matches import search

        return await search(self, actor, title, provider, query)

    async def preview(self, actor, title, provider, search_id="", choice=""):
        self.ready(actor)
        if not self.enabled(provider):
            raise JournalError(
                "metadata_disabled", "Enable and configure this provider first"
            )
        target = await self.parent.repository.async_enrichment(
            "review_target", self.parent.source, title
        )
        result = None
        reason = "provider_identity_mismatch"
        if search_id or choice:
            from .review_matches import selected

            staged, result = selected(self, actor, title, provider, search_id, choice)
            if target["snapshot"] != staged["snapshot"]:
                raise JournalError("refresh_required", "Movie changed; search again")
        async with self.worker(actor, title) as client:
            if result is None:
                try:
                    saved = target["matches"].get(provider)
                    result = (
                        await client.providers.resolve(provider, saved)
                        if saved
                        else await client.providers.metadata(
                            provider,
                            MovieQuery(
                                search_title(target["title"]),
                                target["year"],
                                target["href"] or "",
                            ),
                        )
                    )
                except ProviderError as error:
                    reason = str(error)
                    if reason not in REASONS:
                        raise
                    result = None
            if result is None:
                images = []
            else:
                images = (
                    await client.providers.images(provider, result)
                    if self.parent.config.get("library_sync_artwork")
                    else []
                )
        if result is None:
            await self.parent.mark_conflict(target, provider, reason)
            return await self.search(
                actor, title, provider, search_title(target["title"])
            )
        if len(json.dumps(result).encode()) > 128 * 1024:
            raise JournalError("metadata_limit", "Provider metadata is too large")
        choices = {
            f"{image['kind']}-{index}": image for index, image in enumerate(images)
        }
        token = self.remember(
            actor,
            target,
            provider,
            kind="review",
            metadata=result,
            images=choices,
            match=reference(result),
        )
        fields = {
            key: {"before": target["current"].get(key), "after": result[key]}
            for key in REVIEW_FIELDS
            if key in result and result[key] not in (None, "", [])
        }
        return {
            "plan_id": token,
            "has_backdrop": target["has_backdrop"],
            "title": target["title"],
            "matched": {"title": result["title"], "year": result["year"]},
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
            client.review_token = token
            body = await client.providers.image(plan["provider"], image, thumbnail=True)
        self.plan(actor, token)
        if image_type(body) is None:
            raise JournalError("library_artwork", "Image was rejected")
        return body

    async def cancel(self, actor, token):
        self.ready(actor)
        token = identifier(token)
        plan = self.plans.get(token)
        if plan is None:
            return {"cancelled": True}
        if plan["actor"] != actor.id:
            raise JournalError(
                "unauthorized", "Review belongs to another administrator"
            )
        self.plans.pop(token, None)
        for task, child in list(self.jobs.items()):
            if (
                getattr(child, "review_token", None) == token
                and child.actor.id == actor.id
            ):
                child.stopped = True
                task.cancel()
        self.parent.repository.logger.emit(
            Subsystem.METADATA,
            Operation.PAUSE,
            Outcome.SUCCEEDED,
            reason=Reason.METADATA_CANCELLED,
            resource=(Resource.MOVIE, plan["target"]["id"]),
        )
        return {"cancelled": True}

    async def apply(self, actor, request, data):
        self.ready(actor)
        data = selection(data)
        cached = await self.parent.repository.async_enrichment(
            "review_lookup", actor.id, request, data
        )
        if cached is not None:
            return cached
        plan = self.plan(actor, data["plan_id"])
        if plan.get("kind") != "review":
            raise invalid("Select a match and review its data first")
        logger = self.parent.repository.logger
        logger.emit(
            Subsystem.METADATA,
            Operation.UPDATE,
            Outcome.STARTED,
            reason=Reason.METADATA_APPLY,
            stage=Stage.PREFLIGHT,
            resource=(Resource.MOVIE, plan["target"]["id"]),
            count=len(data["images"]),
        )
        images = {}
        if data["images"]:
            if not self.parent.config.get("library_sync_artwork"):
                raise invalid("Enable artwork sync first")
            async with self.worker(actor, plan["target"]["id"]) as client:
                client.review_token = data["plan_id"]
                for kind, choice in data["images"].items():
                    image = plan["images"].get(choice)
                    if image is None or image["kind"] != kind:
                        raise invalid("Image is not part of this review")
                    logger.emit(
                        Subsystem.METADATA,
                        Operation.REQUEST,
                        Outcome.STARTED,
                        reason=Reason.METADATA_IMAGE,
                        stage=Stage.READ,
                        resource=(Resource.MOVIE, plan["target"]["id"]),
                        target=(Resource.EVENT, choice),
                    )
                    images[kind] = await client.providers.image(plan["provider"], image)
        self.plan(actor, data["plan_id"])
        logger.emit(
            Subsystem.METADATA,
            Operation.WRITE,
            Outcome.STARTED,
            reason=Reason.METADATA_COMMIT,
            stage=Stage.WRITE,
            resource=(Resource.MOVIE, plan["target"]["id"]),
        )
        result = await self.parent.repository.async_enrichment(
            "review_apply",
            self.parent.source,
            actor.id,
            request,
            data,
            plan,
            images,
            self.parent.config.get("library_artwork_cache_mb", 512) * 1024 * 1024,
        )

        logger.emit(
            Subsystem.METADATA,
            Operation.WRITE,
            Outcome.SUCCEEDED,
            reason=Reason.METADATA_SAVED,
            stage=Stage.RECEIPT,
            resource=(Resource.MOVIE, plan["target"]["id"]),
        )
        return result

    async def clear(self):
        self.plans.clear()
        tasks = list(self.jobs)
        for task in tasks:
            self.jobs[task].stopped = True
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

"""Actor-bound title searches, provider downloads, and artwork previews."""

import asyncio
import json
import re
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from aiohttp import ClientError

from ..core.models import JournalError, identifier, invalid
from ..core.security import is_active_admin
from ..library.store import image_type
from ..scrapers import MovieQuery, ProviderError, Providers
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
                    "supports_images": provider == "tmdb",
                    "missing_data": not target["provider_status"][provider]["has_data"]
                    and provider not in target["unavailable"],
                    "unavailable": provider in target["unavailable"],
                    **target["provider_status"][provider],
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
            "auto_save": bool(self.parent.config.get("metadata_auto_save")),
            "title": target["title"],
            "search_title": search_title(target["comparison"]["title"]),
            "current": target["comparison"],
            "artwork_unavailable": target["artwork_unavailable"],
            "artwork_present": target["artwork_present"],
            "snapshot": target["snapshot"],
            "field_mapping": target["field_mapping"],
            "history": target["history"],
        }

    async def action(self, actor, request, data):
        self.ready(actor)
        if not isinstance(data, dict) or data.get("action") not in {
            "mapping",
            "reset_cover",
            "reset_backdrop",
        }:
            raise invalid("Choose a supported metadata action")
        return await self._write_action(actor, request, data)

    async def _write_action(self, actor, request, data):
        self.ready(actor)
        kind = data.get("action") if isinstance(data, dict) else None
        if kind in {"checked", "download"} and not self.enabled(data.get("provider")):
            raise JournalError(
                "metadata_disabled", "Enable and configure this provider first"
            )
        result = await self.parent.repository.async_enrichment(
            "review_action",
            self.parent.source,
            actor.id,
            request,
            data,
            lambda: self.ready(actor),
        )
        self.ready(actor)
        return result

    async def refresh(
        self, actor, request, title, provider, query, year=None, stage=False
    ):
        """Always search; commit a unique match immediately or return candidates."""
        found = await self.search(actor, title, provider, query, year)
        if not found["candidates"]:
            target = self.plan(actor, found["search_id"])["target"]
            staged = await self.stage_result(actor, target, provider, None)
            return (
                staged
                if stage
                else await self.commit_refresh(actor, request, staged, target)
            )
        if len(found["candidates"]) == 1:
            return await self.refresh_choice(
                actor,
                request,
                title,
                provider,
                found["search_id"],
                found["candidates"][0]["id"],
                stage,
            )
        return {"outcome": "matches", **found}

    async def refresh_choice(
        self, actor, request, title, provider, search_id, choice, stage=False
    ):
        from .review_matches import selected

        staged, candidate = selected(self, actor, title, provider, search_id, choice)
        current = await self.parent.repository.async_enrichment(
            "review_target", self.parent.source, title
        )
        if current["snapshot"] != staged["snapshot"]:
            raise JournalError("refresh_required", "Movie changed; search again")
        async with self.worker(actor, title) as client:
            result = await client.providers.resolve(provider, reference(candidate))
        if len(json.dumps(result).encode()) > 128 * 1024:
            raise JournalError("metadata_limit", "Provider metadata is too large")
        prepared = await self.stage_result(actor, staged, provider, result)
        self.plans.pop(search_id, None)
        return (
            prepared
            if stage
            else await self.commit_refresh(actor, request, prepared, staged)
        )

    async def stage_result(self, actor, target, provider, metadata):
        images = []
        if (
            metadata
            and provider == "tmdb"
            and self.parent.config.get("library_sync_artwork")
        ):
            async with self.worker(actor, target["id"]) as client:
                images = await client.providers.images(provider, metadata)
        choices = {
            f"{image['kind']}-{index}": image for index, image in enumerate(images)
        }
        token = self.remember(
            actor,
            target,
            provider,
            kind="download",
            metadata=metadata,
            match=reference(metadata) if metadata else None,
            images=choices,
        )
        return {
            "outcome": "staged",
            "plan_id": token,
            "provider": provider,
            "has_data": bool(metadata),
            "matched": {"title": metadata["title"], "year": metadata["year"]}
            if metadata
            else None,
            "values": {key: metadata[key] for key in REVIEW_FIELDS if key in metadata}
            if metadata
            else {},
            "images": [
                {
                    "id": key,
                    **{
                        field: image.get(field) for field in ("kind", "width", "height")
                    },
                }
                for key, image in choices.items()
            ],
        }

    async def commit_refresh(self, actor, request, staged, target):
        await self.save_draft(
            actor,
            request,
            {
                "title_id": target["id"],
                "snapshot": target["snapshot"],
                "providers": {staged["provider"]: staged["plan_id"]},
                "sources": None,
                "expectations": None,
                "image_plan": "",
                "images": {},
                "resets": [],
            },
        )
        return {"outcome": "downloaded" if staged["has_data"] else "no_data"}

    async def save_draft(self, actor, request, data):
        from .draft import selection
        from .matching import same_provider_identity

        self.ready(actor)
        data = selection(data)
        cached = await self.parent.repository.async_enrichment(
            "draft_lookup", self.parent.source, actor.id, request, data
        )
        if cached is not None:
            return cached
        plans = {}
        for provider, token in data["providers"].items():
            plan = self.plan(actor, token)
            if plan.get("kind") != "download" or plan["provider"] != provider:
                raise invalid("Choose a staged scraper result")
            plans[provider] = plan
        image_plan = (
            self.plan(actor, data["image_plan"]) if data["image_plan"] else None
        )
        if image_plan and (
            image_plan.get("kind") not in {"review", "download"}
            or image_plan["provider"] != "tmdb"
            or not image_plan.get("metadata")
        ):
            raise invalid("Choose artwork from a TMDB movie")
        for plan in [*plans.values(), *([image_plan] if image_plan else [])]:
            if (
                plan["target"]["id"] != data["title_id"]
                or plan["target"]["source"] != self.parent.source
                or plan["target"]["snapshot"] != data["snapshot"]
            ):
                raise JournalError(
                    "refresh_required", "Movie changed; reopen metadata manager"
                )
        if (
            image_plan
            and plans.get("tmdb", {}).get("metadata")
            and not same_provider_identity(
                image_plan["metadata"], plans["tmdb"]["metadata"]
            )
        ):
            raise invalid("Choose artwork for the staged TMDB match")
        if data["expectations"]:
            for provider, enabled in data["expectations"]["providers"].items():
                key = (
                    "metadata_tmdb_enabled"
                    if provider == "tmdb"
                    else "metadata_store_enabled"
                )
                if enabled and not self.parent.config.get(key):
                    raise JournalError("metadata_disabled", "Enable this scraper first")
        choices = {}
        for kind, choice in data["images"].items():
            image = image_plan["images"].get(choice)
            if not image or image.get("kind") != kind:
                raise invalid("Image is not part of this review")
            choices[kind] = image
        tmdb = plans.get("tmdb")
        if (
            tmdb
            and tmdb.get("metadata")
            and "backdrop" not in choices
            and "backdrop" not in data["resets"]
        ):
            target = tmdb["target"]
            expected = (
                (data["expectations"] or {})
                .get("artwork", {})
                .get("backdrop", "backdrop" not in target["artwork_unavailable"])
            )
            if (
                expected
                and not target["artwork_present"]["backdrop"]
                and not target["backdrop_removed"]
                and self.parent.config.get("library_sync_artwork")
                and self.parent.config.get("metadata_source_backdrop") != "original"
            ):
                first = next(
                    (
                        image
                        for image in tmdb["images"].values()
                        if image.get("kind") == "backdrop"
                    ),
                    None,
                )
                if first:
                    choices["auto"] = first
        images = {}
        if choices:
            if not self.parent.config.get("library_sync_artwork"):
                raise invalid("Enable artwork sync first")
            async with self.worker(actor, data["title_id"]) as client:
                for kind, choice in choices.items():
                    images[kind] = await client.providers.image("tmdb", choice)
        for token in [
            *data["providers"].values(),
            *([data["image_plan"]] if data["image_plan"] else []),
        ]:
            self.plan(actor, token)
        result = await self.parent.repository.async_enrichment(
            "draft_apply",
            self.parent.source,
            actor.id,
            request,
            data,
            plans,
            image_plan,
            images,
            self.parent.config.get("library_artwork_cache_mb", 512) * 1024 * 1024,
            lambda: self.ready(actor),
        )
        return result

    async def availability(self, actor, request, data):
        self.ready(actor)
        if isinstance(data, dict) and "providers" in data:
            if not isinstance(data["providers"], dict):
                raise invalid("Choose supported scrapers")
            for provider in data["providers"]:
                if provider not in {
                    "tmdb",
                    "kaleidescape",
                } or not self.parent.config.get(
                    "metadata_tmdb_enabled"
                    if provider == "tmdb"
                    else "metadata_store_enabled"
                ):
                    raise JournalError("metadata_disabled", "Enable this scraper first")
            return await self.parent.repository.async_enrichment(
                "availability",
                self.parent.source,
                actor.id,
                request,
                data,
                lambda: self.ready(actor),
            )
        provider = data.get("provider") if isinstance(data, dict) else None
        kind = data.get("kind") if isinstance(data, dict) else None
        if provider is None and kind in {"poster", "backdrop"}:
            pass
        elif not isinstance(provider, str) or provider not in {"tmdb", "kaleidescape"}:
            raise invalid("Choose a supported scraper")
        if provider is not None and not self.parent.config.get(
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
                yield child
                self.ready(actor)
                completed = True
        except ProviderError as error:
            failed = True
            raise JournalError(
                str(error),
                "Provider data could not be retrieved; check the configured source",
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
                "Metadata retrieval failed; check the provider settings",
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

    async def search(self, actor, title, provider, query, year=None):
        from .review_matches import search

        return await search(self, actor, title, provider, query, year)

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
                    images[kind] = await client.providers.image(plan["provider"], image)
        self.plan(actor, data["plan_id"])
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
        return result

    async def clear(self):
        self.plans.clear()
        tasks = list(self.jobs)
        for task in tasks:
            self.jobs[task].stopped = True
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

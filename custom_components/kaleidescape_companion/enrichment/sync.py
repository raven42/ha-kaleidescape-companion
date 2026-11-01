"""Optional fixed-origin HTTPS enrichment; all storage is delegated to the worker."""

import asyncio
import ipaddress
import re
import socket
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from aiohttp import ClientError, ClientTimeout, DummyCookieJar
from homeassistant.helpers.aiohttp_client import (
    DATA_RESOLVER,
    async_create_clientsession,
)
from kaleidescape_api.logging import (
    Failure,
    Level,
    Operation,
    Outcome,
    Resource,
    Subsystem,
)
from yarl import URL

from .._vendor.kaleidescape_scrapers import MovieQuery, ProviderError, Providers
from .._vendor.kaleidescape_scrapers.providers.store import movie_path
from ..core.models import JournalError
from ..core.operations import traced
from ..core.security import is_active_admin
from ..library.config import origin
from ..library.store import image_type, source_id
from .config import DEFAULTS


class MetadataSync:
    """No construction/networking when providers or Library are disabled.

    Automatic passes follow successful catalog scans. Valid cache entries are
    reused for seven days. A manual pass refreshes them; it never changes a
    device or provider account. An HTTP failure stops the pass, including 429.
    """

    def __init__(self, hass, repository, entry):
        self.hass, self.repository, self.entry = hass, repository, entry
        self.config = {**DEFAULTS, **dict(entry.options or entry.data)}
        self.source = source_id(origin(self.config.get("library_host", "")))
        self.task = self.session = None
        self.paused = self.stopped = False
        self.processed = self.updated = self.skipped = self.total = 0
        self.error = None
        self.last_finished = None
        self.actor = None
        self.reviews = None
        self.review_network = False
        self.providers = Providers(
            self._get,
            requests_per_second=self.config["metadata_requests_per_second"],
            tmdb_credential=self.config["metadata_tmdb_credential"],
        )

    def create_session(self):
        return async_create_clientsession(
            self.hass,
            cookie_jar=DummyCookieJar(),
            trust_env=False,
            auto_decompress=False,
            auto_cleanup=False,
            headers={
                "User-Agent": "KaleidescapeCompanion/0.0.0",
                "Accept-Encoding": "identity",
            },
        )

    def title_reviews(self):
        from .review import TitleReviews

        if self.reviews is None:
            self.reviews = TitleReviews(self)
        return self.reviews

    def _ready(self):
        current = {**DEFAULTS, **dict(self.entry.options or self.entry.data)}
        if (
            self.stopped
            or self.paused
            or not current.get("library_enabled")
            or current != self.config
            or (self.actor is not None and not is_active_admin(self.actor))
        ):
            raise JournalError("not_ready", "Metadata settings or access changed")

    def request_sync(self, actor=None, *, force=False):
        self._ready()
        if self.task and not self.task.done():
            return
        self.actor = actor
        self.task = self.hass.async_create_background_task(
            self._run(force), "Companion metadata enrichment"
        )

    def status(self):
        return {
            "running": bool(self.task and not self.task.done()),
            "processed": self.processed,
            "updated": self.updated,
            "skipped": self.skipped,
            "total": self.total,
            "error": self.error,
            "last_finished": self.last_finished,
        }

    @traced(Subsystem.METADATA, Operation.REQUEST, debug=True)
    async def _get(self, url, headers):
        self._ready()
        parsed = urlsplit(url)
        # Providers construct paths; never accept a URL from the browser or a response.
        if (
            parsed.scheme != "https"
            or parsed.hostname
            not in {"www.kaleidescape.com", "api.themoviedb.org", "image.tmdb.org"}
            or parsed.port not in (None, 443)
            or parsed.username
            or parsed.password
            or parsed.fragment
        ):
            raise ProviderError("provider_destination")
        if parsed.hostname == "www.kaleidescape.com":
            if not self.config["metadata_store_enabled"]:
                raise ProviderError("provider_disabled")
            if (
                parsed.query
                or headers
                or (parsed.path != "/robots.txt" and not movie_path(parsed.path))
            ):
                raise ProviderError("provider_destination")
        elif parsed.hostname == "image.tmdb.org":
            if not (
                self.config["metadata_tmdb_enabled"]
                and self.config.get("library_sync_artwork")
            ):
                raise ProviderError("provider_disabled")
            if (
                parsed.query
                or headers
                or not re.fullmatch(
                    r"/t/p/(?:w300|w500|w780)/[A-Za-z0-9]{1,128}\.jpg", parsed.path
                )
                or (
                    not self.review_network and not parsed.path.startswith("/t/p/w780/")
                )
            ):
                raise ProviderError("provider_destination")
        else:
            if not self.config["metadata_tmdb_enabled"]:
                raise ProviderError("provider_disabled")
            if not re.fullmatch(
                r"/3/(?:search/movie|movie/[1-9][0-9]*(?:/images)?)", parsed.path
            ) or (
                parsed.path.endswith("/images")
                and not (
                    self.review_network and self.config.get("library_sync_artwork")
                )
            ):
                raise ProviderError("provider_destination")
        answers = await self.hass.data[DATA_RESOLVER].resolve(
            parsed.hostname, 443, family=socket.AF_UNSPEC
        )
        addresses = [row["host"] for row in answers]
        if not addresses or any(
            not ipaddress.ip_address(ip).is_global for ip in addresses
        ):
            raise ProviderError("provider_destination")
        self._ready()
        base = URL(url)
        address = min(addresses, key=lambda ip: ":" in ip)
        async with self.session.get(
            base.with_host(address),
            headers={
                **headers,
                "Host": base.authority,
                "User-Agent": "KaleidescapeCompanion/0.0.0",
            },
            server_hostname=base.host,
            allow_redirects=False,
            timeout=ClientTimeout(total=20, connect=5),
        ) as response:
            self.repository.logger.emit(
                Subsystem.METADATA,
                Operation.REQUEST,
                Outcome.SUCCEEDED if response.status == 200 else Outcome.REJECTED,
                level=Level.DEBUG if response.status == 200 else Level.WARNING,
                status=response.status,
                resource=(Resource.REQUEST, url),
                target=(Resource.PROVIDER, parsed.hostname),
            )
            if response.status == 429:
                raise ProviderError("provider_rate_limited")
            if response.status in (401, 403):
                raise ProviderError("provider_access_denied")
            if response.status != 200:
                raise ProviderError("provider_http_error")
            if (
                response.headers.get("Content-Encoding", "identity").lower()
                != "identity"
            ):
                raise ProviderError("provider_encoding")
            expected = (
                {"text/plain"}
                if parsed.path == "/robots.txt"
                else {"text/html", "application/xhtml+xml"}
                if parsed.hostname == "www.kaleidescape.com"
                else {"image/jpeg"}
                if parsed.hostname == "image.tmdb.org"
                else {"application/json"}
            )
            if response.content_type not in expected:
                raise ProviderError("provider_content_type")
            if response.content_length and response.content_length > 4 * 1024 * 1024:
                raise ProviderError("provider_response_too_large")
            body = bytearray()
            async for chunk in response.content.iter_chunked(65536):
                self._ready()
                body.extend(chunk)
                if len(body) > 4 * 1024 * 1024:
                    raise ProviderError("provider_response_too_large")
            if (
                parsed.hostname == "image.tmdb.org"
                and image_type(body) != response.content_type
            ):
                raise ProviderError("provider_content_type")
        self._ready()
        return bytes(body)

    async def _run(self, force):
        self.repository.logger.emit(
            Subsystem.METADATA, Operation.SCRAPE, Outcome.STARTED
        )
        self.error = None
        self.providers.robots = None
        self.processed = self.updated = self.skipped = 0
        failure, cancelled = None, False
        try:
            self.session = self.create_session()
            rows = await self.repository.async_enrichment("candidates", self.source)
            self.total = len(rows)
            async with asyncio.timeout(3600):
                for row in rows:
                    self._ready()
                    for provider, enabled in (
                        ("kaleidescape", self.config["metadata_store_enabled"]),
                        ("tmdb", self.config["metadata_tmdb_enabled"]),
                    ):
                        if not enabled:
                            continue
                        if type(row["year"]) is not int or not (
                            row["href"]
                            if provider == "kaleidescape"
                            else self.config["metadata_tmdb_credential"]
                        ):
                            self.skipped += 1
                            continue
                        previous = row["enrichment"].get(provider, {}).get("fetched_at")
                        if previous and not force:
                            try:
                                if datetime.fromisoformat(previous) > datetime.now(
                                    UTC
                                ) - timedelta(days=7):
                                    continue
                            except ValueError, TypeError:
                                pass
                        try:
                            result = await self.providers.metadata(
                                provider,
                                MovieQuery(
                                    row["title"], row["year"], row["href"] or ""
                                ),
                            )
                        except ProviderError as error:
                            if str(error) in {
                                "invalid_store_link",
                                "tmdb_not_found",
                                "tmdb_ambiguous",
                                "provider_identity_mismatch",
                            }:
                                self.skipped += 1
                                continue
                            raise
                        self._ready()
                        metadata = {
                            **result,
                            "matched_title": row["title"],
                            "matched_group": row["source_group"],
                        }
                        await self.repository.async_enrichment(
                            "save",
                            self.source,
                            row["id"],
                            provider,
                            metadata,
                        )
                        if provider == "tmdb" and self.config.get(
                            "library_sync_artwork"
                        ):
                            image = await self.providers.artwork(provider, result)
                            self._ready()
                            if image is not None:
                                await self.repository.async_enrichment(
                                    "artwork",
                                    self.source,
                                    row["id"],
                                    metadata,
                                    image,
                                    self.config.get("library_artwork_cache_mb", 512)
                                    * 1024
                                    * 1024,
                                )
                        self.updated += 1
                    self.processed += 1
        except asyncio.CancelledError:
            cancelled = True
            raise
        except ProviderError as error:
            failure = error
            self.error = str(error)
        except JournalError as error:
            failure = error
            self.error = error.code
        except (
            ClientError,
            OSError,
            TimeoutError,
            ValueError,
            TypeError,
            KeyError,
            RecursionError,
        ) as error:
            # Never retain provider responses/URLs, DNS answers or credential text.
            failure = error
            self.error = "metadata_unavailable"
        except Exception as error:
            failure = error
            self.error = "metadata_format"
        finally:
            if failure:
                self.repository.logger.emit_failure(
                    Subsystem.METADATA, Operation.SCRAPE, failure, count=self.processed
                )
            else:
                self.repository.logger.emit(
                    Subsystem.METADATA,
                    Operation.SCRAPE,
                    Outcome.SKIPPED if cancelled else Outcome.SUCCEEDED,
                    failure=Failure.CANCELLED if cancelled else None,
                    count=self.processed,
                )
            if self.session:
                self.session.detach()
                self.session = None
            self.last_finished = datetime.now(UTC).isoformat()
            self.actor = None

    async def async_pause(self):
        self.paused = True
        if self.reviews is not None:
            await self.reviews.clear()
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def async_resume(self):
        self.paused = False

    async def async_stop(self):
        self.stopped = True
        await self.async_pause()

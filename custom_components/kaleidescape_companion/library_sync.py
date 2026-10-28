"""Opt-in, sequential, bounded GET-only library synchronization owned by HA."""

import asyncio
import socket
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from aiohttp import ClientError, ClientTimeout, DummyCookieJar
from homeassistant.helpers.aiohttp_client import (
    DATA_RESOLVER,
    async_create_clientsession,
)
from yarl import URL

from .journal import JournalError
from .library_config import DEFAULTS, lan_address, origin
from .library_parser import artwork_path, catalog, details
from .library_store import MAX_ARTWORK_BYTES, image_type, source_id


class LibrarySync:
    """A disabled integration never constructs this connector or resolves a host."""

    def __init__(self, hass, repository, config):
        self.hass, self.repository = hass, repository
        self.config = {**DEFAULTS, **config}
        self.origin = origin(self.config["library_host"])
        self.source = source_id(self.origin)
        self.session = None
        self.task = None
        self.timer = None
        self.stopped = False
        self.paused = False
        self.error = None
        self.phase = "idle"
        self.processed = 0
        self.total = 0
        self.last_attempt = None
        self.address = None

    async def async_start(self):
        self.session = async_create_clientsession(
            self.hass,
            cookie_jar=DummyCookieJar(),
            trust_env=False,
            auto_decompress=False,
            headers={"Accept-Encoding": "identity"},
        )
        self.request_sync()

    def request_sync(self):
        """Coalesce manual requests; no overlapping scans or fire-and-forget writes."""
        if self.stopped or self.paused:
            raise JournalError("not_ready", "Library sync is paused")
        if self.task and not self.task.done():
            return
        if self.timer:
            self.timer.cancel()
            self.timer = None
        self.task = self.hass.async_create_background_task(
            self._run(), "Kaleidescape library sync"
        )

    async def _cancel(self):
        if self.timer:
            self.timer.cancel()
            self.timer = None
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        self.task = None
        self.phase = "idle"

    async def async_stop(self):
        self.stopped = True
        await self._cancel()

    async def async_pause(self):
        self.paused = True
        await self._cancel()

    async def async_resume(self):
        self.paused = False
        if not self.stopped:
            self.request_sync()

    def status(self):
        return {
            "phase": self.phase,
            "error": self.error,
            "processed": self.processed,
            "total": self.total,
            "last_attempt": self.last_attempt,
            "interval_hours": self.config["library_interval_hours"],
            "collections_enabled": self.config["library_sync_collections"],
            "details_enabled": self.config["library_sync_details"],
            "artwork_enabled": self.config["library_sync_artwork"],
            "artwork_limit_bytes": self.config["library_artwork_cache_mb"]
            * 1024
            * 1024,
        }

    async def _resolve(self):
        base = URL(self.origin)
        try:
            async with asyncio.timeout(5):
                resolver = getattr(self.hass, "data", {}).get(DATA_RESOLVER)
                if resolver is not None:
                    records = await resolver.resolve(
                        base.host, base.port, family=socket.AF_UNSPEC
                    )
                    ips = list(dict.fromkeys(record["host"] for record in records))
                else:
                    addresses = await asyncio.get_running_loop().getaddrinfo(
                        base.host, base.port, type=socket.SOCK_STREAM
                    )
                    ips = list(dict.fromkeys(item[4][0] for item in addresses))
        except (OSError, TimeoutError) as error:
            raise JournalError(
                "library_unreachable",
                "The configured library host could not be resolved",
            ) from error
        ips = [ip for ip in ips if lan_address(ip)]
        if not ips:
            raise JournalError(
                "library_destination",
                "The library must resolve to a private LAN address",
            )
        return min(ips, key=lambda ip: ":" in ip)

    async def _get(self, path: str, *, image=False):
        """Pin validated DNS results; refuse redirects, cookies, compressed bodies."""
        base = URL(self.origin)
        if not (
            path == "/movies"
            or path.startswith("/movies?collection=")
            or path.startswith("/details?id=")
            or (image and artwork_path(path))
        ):
            raise JournalError("library_destination", "Library route was rejected")
        ip = self.address or await self._resolve()
        url = URL(self.origin + path).with_host(ip)
        maximum = MAX_ARTWORK_BYTES if image else 8 * 1024 * 1024
        async with self.session.get(
            url,
            allow_redirects=False,
            timeout=ClientTimeout(total=15, connect=5),
            headers={"Host": base.authority},
            server_hostname=base.host if base.scheme == "https" else None,
        ) as response:
            if (
                response.status != 200
                or response.headers.get("Content-Encoding", "identity").lower()
                != "identity"
            ):
                raise JournalError(
                    "library_response", "The library returned an unsupported response"
                )
            if (
                response.content_length is not None
                and response.content_length > maximum
            ):
                raise JournalError(
                    "library_too_large", "Library response exceeded its size limit"
                )
            content_type = response.content_type
            if content_type not in (
                {"image/jpeg", "image/png", "image/webp"}
                if image
                else {"text/html", "application/xhtml+xml"}
            ):
                raise JournalError(
                    "library_response", "Library response type was rejected"
                )
            parts, length = [], 0
            async for part in response.content.iter_chunked(65536):
                length += len(part)
                if length > maximum:
                    raise JournalError(
                        "library_too_large", "Library response exceeded its size limit"
                    )
                parts.append(part)
            body = b"".join(parts)
            if image:
                if image_type(body) != content_type:
                    raise JournalError("library_artwork", "Cover image was rejected")
                return body, content_type
            charset = (response.charset or "iso-8859-1").lower()
            if charset not in {
                "utf-8",
                "utf8",
                "iso-8859-1",
                "latin-1",
                "windows-1252",
            }:
                raise JournalError(
                    "library_format", "Library character encoding was rejected"
                )
            return body.decode(charset)

    async def _listing(self, path):
        page = await self._get(path)
        return await self.hass.async_add_executor_job(catalog, page)

    async def _run(self):
        self.last_attempt = datetime.now(UTC).isoformat()
        self.error = None
        self.processed = self.total = 0
        try:
            async with asyncio.timeout(1800):
                await self._sync()
        except asyncio.CancelledError:
            raise
        except JournalError as error:
            self.error = error.code
        except ClientError, OSError, TimeoutError, UnicodeError:
            self.error = "library_unreachable"
        except Exception:
            # Keep firmware errors private and independent from recording.
            self.error = "library_format"
        finally:
            self.phase = "idle"
            if not self.stopped and not self.paused:
                delay = self.config["library_interval_hours"] * 3600
                if self.error in {"busy", "backup_in_progress"}:
                    delay = min(delay, 60)
                self.timer = asyncio.get_running_loop().call_later(
                    delay, self.request_sync
                )

    async def _sync(self):
        self.phase = "catalog"
        self.address = await self._resolve()
        rows, names = await self._listing("/movies")
        memberships = None
        if self.config["library_sync_collections"] and names is None:
            self.error = "library_format"
        elif self.config["library_sync_collections"]:
            self.phase = "collections"
            memberships = {}
            member_count = 0
            try:
                for name in names:
                    members, _ = await self._listing(
                        "/movies?" + urlencode({"collection": name, "sort": 2})
                    )
                    memberships[name] = [row["source_handle"] for row in members]
                    member_count += len(members)
                    if member_count > 100_000:
                        raise JournalError(
                            "library_too_large",
                            "Collection memberships exceeded the sync limit",
                        )
            except JournalError as error:
                # Preserve previous collections; refresh the valid catalog.
                memberships = None
                self.error = error.code
        await self.repository.async_library_catalog(self.origin, rows, memberships)
        budget = self.config["library_artwork_cache_mb"] * 1024 * 1024
        await self.repository.async_library_trim(budget)
        if not (
            self.config["library_sync_details"] or self.config["library_sync_artwork"]
        ):
            return
        candidates = await self.repository.async_library_candidates(self.source)
        self.total = len(candidates)
        stale = (datetime.now(UTC) - timedelta(days=7)).isoformat()
        self.phase = "details"
        for item in candidates:
            requested = False
            try:
                metadata_due = self.config["library_sync_details"] and (
                    not item["metadata_synced_at"] or item["metadata_synced_at"] < stale
                )
                cover_due = self.config["library_sync_artwork"] and (
                    not item["artwork_key"]
                    or not item["fetched_at"]
                    or item["fetched_at"] < stale
                )
                if metadata_due or cover_due or not item["fetched_at"]:
                    requested = True
                    page = await self._get(
                        "/details?"
                        + urlencode({"id": item["source_handle"], "callback": "true"})
                    )
                    detail = await self.hass.async_add_executor_job(details, page)
                    await self.repository.async_library_details(
                        self.source,
                        item["id"],
                        detail,
                        self.config["library_sync_details"],
                    )
                    path = detail["artwork_path"]
                    cover_due = cover_due or (
                        self.config["library_sync_artwork"]
                        and path != item["artwork_path"]
                    )
                else:
                    path = item["artwork_path"]
                if cover_due and path:
                    requested = True
                    body, content_type = await self._get(path, image=True)
                    await self.repository.async_library_artwork_save(
                        self.source, item["id"], body, content_type, budget
                    )
            except JournalError as error:
                if error.code in {"backup_in_progress", "busy", "not_ready"}:
                    raise
                self.error = error.code
            except ClientError, OSError, TimeoutError, UnicodeError:
                self.error = "library_unreachable"
            self.processed += 1
            await asyncio.sleep(0.05 if requested else 0)

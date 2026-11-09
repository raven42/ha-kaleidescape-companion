"""Opt-in bounded catalog reads and separately enabled collection changes."""

import asyncio
import logging
import re
import socket
from datetime import UTC, datetime, timedelta
from html import escape
from uuid import uuid4

from aiohttp import ClientError, ClientTimeout, DummyCookieJar, MultipartWriter
from homeassistant.components import persistent_notification
from homeassistant.helpers.aiohttp_client import (
    DATA_RESOLVER,
    async_create_clientsession,
)
from yarl import URL

from ..const import PANEL_PATH
from ..core.logging import safe_exception
from ..core.models import JournalError
from ..core.security import async_finish_cleanup
from ..core.tasks import async_wait
from ..vendor.kaleidescape.error import KaleidescapeError
from ..vendor.kaleidescape.library_parser import LibraryFormatError, artwork_path
from ..vendor.kaleidescape.local_browser import (
    BrowserOutcomeUnknownError,
    BrowserResponse,
    BrowserResponseError,
    LocalLibrary,
    _removal_path,
)
from .collection_queue import fingerprint as queue_fingerprint
from .collection_queue import normalized
from .collections import member_hash, parameters
from .config import DEFAULTS, lan_address, origin
from .store import MAX_ARTWORK_BYTES, image_type, source_id

_LOGGER = logging.getLogger(__name__)
COLLECTION_PAGE_TIMEOUT = 300
COLLECTION_OPERATION_TIMEOUT = 1800
LIBRARY_SYNC_TIMEOUT = 3600
MISSING_NOTICE_ID = "kaleidescape_companion_library_missing_data"
MISSING_LIBRARY_LINK = (
    f"/{PANEL_PATH}?companion_page=library&library_missing_metadata_artwork=1"
)


def _notification_title(value):
    """Treat catalog titles as text in Home Assistant's Markdown renderer."""
    text = escape(" ".join(value.split()), quote=False)
    return re.sub(r"([\\`*_{}\[\]()#+.!|~>\-])", r"\\\1", text)


class LibrarySync:
    """A disabled integration never constructs this connector or resolves a host."""

    def __init__(self, hass, repository, config):
        self.hass, self.repository = hass, repository
        self.config = {**DEFAULTS, **config}
        self.origin = origin(self.config["library_host"])
        self.source = source_id(self.origin)
        self.session = None
        self.task = None
        self.stopped = False
        self.paused = False
        self.error = None
        self.phase = "idle"
        self.processed = 0
        self.total = 0
        self.last_attempt = None
        self.address = None
        self.operation_lock = asyncio.Lock()
        self.collection_task = None
        self.collection_queue_task = None
        self.collection_queue = []
        self.collection_scheduled = set()
        self.collection_accepts = set()
        self.collection_queue_lock = asyncio.Lock()
        self.collection_stage = "idle"
        self.collection_failure = None
        self._reported_error = None
        self._manual_sync = False
        self.browser = LocalLibrary(self)

    async def async_start(self):
        self.session = async_create_clientsession(
            self.hass,
            cookie_jar=DummyCookieJar(),
            trust_env=False,
            auto_decompress=False,
            auto_cleanup=False,
            headers={"Accept-Encoding": "identity"},
        )
        await self.repository.async_collection_queue("recover", self.source)
        self.request_sync(manual=False)

    def request_sync(self, *, manual=True):
        """Coalesce manual requests; no overlapping scans or fire-and-forget writes."""
        if self.stopped or self.paused:
            raise JournalError("not_ready", "Library sync is paused")
        if self.task and not self.task.done():
            return
        self._manual_sync = manual
        self.task = self.hass.async_create_background_task(
            self._run(), "Kaleidescape library sync"
        )

    async def _cancel(self):
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
        await self._drain_collection()
        if self.session:
            self.session.detach()
            self.session = None

    async def async_pause(self):
        self.paused = True
        await self._cancel()
        await self._drain_collection()

    async def _drain_collection(self):
        async def wait_for(task):
            try:
                await async_wait(task, report_abandoned=False)
            except JournalError, KaleidescapeError, ClientError, OSError, TimeoutError:
                pass

        for task in tuple(self.collection_accepts):
            await async_finish_cleanup(wait_for(task))
        if self.collection_queue_task and not self.collection_queue_task.done():
            await async_finish_cleanup(wait_for(self.collection_queue_task))
        if self.collection_task and not self.collection_task.done():

            async def finish():
                try:
                    await self.collection_task
                except (
                    JournalError,
                    KaleidescapeError,
                    ClientError,
                    OSError,
                    TimeoutError,
                ):
                    pass

            await async_finish_cleanup(finish())

    def _collection_ready(self):
        if self.stopped or self.paused:
            raise JournalError("not_ready", "Library is paused")

    async def async_collection_operation(self, operation, authorize):
        self._collection_ready()
        if self.operation_lock.locked() or (
            self.collection_task and not self.collection_task.done()
        ):
            raise JournalError("busy", "Wait for the active Library operation")

        async def run():
            try:
                async with asyncio.timeout(COLLECTION_OPERATION_TIMEOUT):
                    if self.operation_lock.locked():
                        raise JournalError(
                            "busy", "Wait for the active Library operation"
                        )
                    async with self.operation_lock:
                        self._collection_ready()
                        authorize()
                        return await operation()
            except JournalError as error:
                return error
            except LibraryFormatError, BrowserResponseError:
                return JournalError(
                    "library_format", "The local library page was not recognized"
                )
            except TimeoutError as error:
                if not self.collection_failure or self.collection_failure.startswith(
                    "CancelledError"
                ):
                    self.collection_failure = safe_exception(error)
                return JournalError(
                    "library_timeout", "Collection operation exceeded its time limit"
                )
            except ClientError, KaleidescapeError, OSError, UnicodeError:
                return JournalError(
                    "library_unreachable", "Collection operation could not be confirmed"
                )

        self.collection_task = self.hass.async_create_background_task(
            run(), "Kaleidescape collection add"
        )
        result = await async_wait(self.collection_task)
        if isinstance(result, JournalError):
            raise result
        return result

    async def async_collection_targets(self, title, revision, excluded, authorize):
        if type(revision) is not int or revision < 0:
            raise JournalError("invalid_request", "Invalid source revision")

        async def targets():
            state = await self.repository.async_collection_snapshot(
                self.source, title, excluded
            )
            if revision != state["revision"]:
                raise JournalError(
                    "refresh_required", "Library changed; refresh title details"
                )
            self.address = await self._resolve()
            choices = await self.browser.add_targets(state["version"]["source_handle"])
            authorize()
            return {
                "collections": [
                    name for name in state["collections"] if name in choices
                ],
                "revision": state["revision"],
            }

        return await self.async_collection_operation(targets, authorize)

    async def async_refresh_title_collections(
        self, title, revision, excluded, authorize
    ):
        """Refresh only one version from its explicit device details field."""
        if type(revision) is not int or revision < 0:
            raise JournalError("invalid_request", "Invalid source revision")
        if self.collection_queue_task and not self.collection_queue_task.done():
            raise JournalError("busy", "Wait for collection changes to finish")
        if self.task and not self.task.done():
            raise JournalError("busy", "Wait for the Library scan to finish")

        async def refresh():
            state = await self.repository.async_collection_snapshot(
                self.source, title, excluded
            )
            if state["revision"] != revision:
                raise JournalError("refresh_required", "Library changed; reopen title")
            if state["pending"]:
                raise JournalError(
                    "collection_uncertain", "Resolve the unconfirmed change"
                )
            self.address = await self._resolve()
            found_title, memberships = await self.browser.version_collections(
                state["version"]["source_handle"]
            )
            if found_title != state["version"]["title"]:
                raise JournalError(
                    "library_changed", "The server title identity changed"
                )
            authorize()
            self._collection_ready()
            return await self.repository.async_collection_refresh_version(
                self.source, title, revision, memberships, excluded
            )

        return await self.async_collection_operation(refresh, authorize)

    async def _collection_members(self, collection):
        return await self.browser.collection(collection)

    async def _collection_step(self, stage, operation):
        """Record bounded, privacy-preserving timing and failure context."""
        self.collection_stage = stage
        self.collection_failure = None
        started = asyncio.get_running_loop().time()
        _LOGGER.debug("Collection change stage started: stage=%s", stage)
        try:
            return await operation
        except BaseException as error:
            self.collection_failure = safe_exception(error)
            raise
        finally:
            _LOGGER.debug(
                "Collection change stage finished: stage=%s elapsed_seconds=%.1f",
                stage,
                asyncio.get_running_loop().time() - started,
            )

    async def _collection_transport(self, kind, operation):
        """Log only fixed request categories, timings, sizes and status codes."""
        started = asyncio.get_running_loop().time()
        _LOGGER.debug("Collection server request started: kind=%s", kind)
        try:
            response = await operation
        except BaseException as error:
            _LOGGER.debug(
                "Collection server request failed: kind=%s "
                "elapsed_seconds=%.1f reason=%s",
                kind,
                asyncio.get_running_loop().time() - started,
                safe_exception(error),
            )
            raise
        _LOGGER.debug(
            "Collection server request finished: kind=%s status=%d bytes=%d "
            "elapsed_seconds=%.1f",
            kind,
            response.status,
            len(response.body),
            asyncio.get_running_loop().time() - started,
        )
        return response

    async def _post_collection_add(self, handle, collection, authorize):
        """Use pyk's add-only form with no automatic retry."""
        await self.browser.add_to_collection(handle, collection, pre_submit=authorize)

    async def async_enqueue_collection(
        self,
        request,
        title,
        collection,
        operation,
        revision,
        actor,
        excluded,
        authorize,
    ):
        """Accept up to ten actions without waiting for a slow server."""
        task = self.hass.async_create_background_task(
            self._accept_collection(
                request,
                title,
                collection,
                operation,
                revision,
                actor,
                excluded,
                authorize,
            ),
            "Kaleidescape collection request",
        )
        self.collection_accepts.add(task)
        task.add_done_callback(self.collection_accepts.discard)
        return await async_wait(task)

    async def _accept_collection(
        self,
        request,
        title,
        collection,
        operation,
        revision,
        actor,
        excluded,
        authorize,
    ):
        async with self.collection_queue_lock:
            self._collection_ready()
            authorize()
            result = await self.repository.async_collection_queue(
                "enqueue",
                self.source,
                request,
                title,
                collection,
                operation,
                revision,
                actor,
                excluded,
            )
            if result["status"] == "queued" and (self.paused or self.stopped):
                await self.repository.async_collection_queue(
                    "update", self.source, request, "interrupted", "not_sent"
                )
                return {"request_id": request, "status": "interrupted"}
            if (
                result["status"] == "queued"
                and request not in self.collection_scheduled
            ):
                self.collection_scheduled.add(request)
                self.collection_queue.append(
                    {
                        "request": request,
                        "title": title,
                        "collection": collection,
                        "operation": operation,
                        "revision": revision,
                        "actor": actor,
                        "excluded": excluded,
                        "authorize": authorize,
                    }
                )
                if not self.collection_queue_task or self.collection_queue_task.done():
                    self.collection_queue_task = self.hass.async_create_background_task(
                        self._run_collection_queue(), "Kaleidescape collection queue"
                    )
            return result

    async def _queued_collection_change(self, job):
        """Preflight exact identities and reserve a durable one-shot device write."""
        authorize = job["authorize"]
        state = await self.repository.async_collection_snapshot(
            self.source, job["title"], job["excluded"]
        )
        if state["pending"]:
            raise JournalError(
                "collection_uncertain",
                "Resolve the unconfirmed collection change first",
            )
        self.address = await self._collection_step("resolve", self._resolve())
        rows, _ = await self._collection_step("catalog", self.browser.movies())
        version = state["version"]
        if not any(
            all(
                row[key] == version[key]
                for key in ("source_handle", "source_group", "title")
            )
            for row in rows
        ):
            raise JournalError(
                "refresh_required", "Source identity changed; sync the Library"
            )
        handle = version["source_handle"]
        key = normalized(job["collection"])
        operation = job["operation"]
        collection = job["collection"]
        other = None
        if key in {"new", "played"}:
            destination = "New" if key == "new" else "Played"
            source = "Played" if key == "new" else "New"
            if operation == "remove":
                source, destination = destination, source
            collection, other, operation = source, destination, "remove"
        elif key == "watchsoon":
            collection = "WatchSoon"
        before_rows = await self._collection_step(
            "read_before", self._collection_members(collection)
        )
        before = {row["source_handle"] for row in before_rows}
        other_rows = (
            await self._collection_step(
                "read_other_before", self._collection_members(other)
            )
            if other
            else None
        )
        other_before = (
            {row["source_handle"] for row in other_rows}
            if other_rows is not None
            else None
        )
        if (
            other
            and job["operation"] == "add"
            and handle in before
            and handle in other_before
        ):
            raise JournalError(
                "invalid_request",
                "This title is both Watched and Unwatched; remove one status first",
            )
        if other and handle not in before and handle not in other_before:
            raise JournalError(
                "invalid_request",
                "The server can move this title only from its current "
                "Watched or Unwatched collection",
            )
        expected = before | {handle} if operation == "add" else before - {handle}
        expected_other = other_before | {handle} if other_before is not None else None
        if operation == "add" and handle not in before:
            targets = await self._collection_step(
                "add_targets", self.browser.add_targets(handle)
            )
            offered = "Watch Soon" if key == "watchsoon" else collection
            if offered not in targets:
                raise JournalError(
                    "collection_form", "Collection is not an available add target"
                )
        authorize()
        self._collection_ready()
        token = queue_fingerprint(
            self.source,
            job["request"],
            job["title"],
            job["collection"],
            job["operation"],
            job["revision"],
            job["actor"],
        )
        await self.repository.async_collection_begin_change(
            self.source,
            job["request"],
            token,
            job["title"],
            collection,
            state["revision"],
            member_hash(expected),
            job["actor"],
            operation,
            other,
            member_hash(expected_other) if expected_other is not None else None,
        )
        sent = False
        try:
            authorize()
            self._collection_ready()
            if (handle in before) != (operation == "add"):
                try:
                    if operation == "add":
                        await self._collection_step(
                            "submit",
                            self.browser.add_to_collection(
                                handle,
                                "Watch Soon" if key == "watchsoon" else collection,
                                pre_submit=authorize,
                            ),
                        )
                    else:
                        await self._collection_step(
                            "submit",
                            self.browser.remove_from_collection(
                                handle, collection, pre_submit=authorize
                            ),
                        )
                    sent = True
                except BrowserOutcomeUnknownError as error:
                    sent = True
                    if asyncio.current_task().cancelling():
                        raise asyncio.CancelledError from error
                    _LOGGER.warning(
                        "Collection submission response was unconfirmed; "
                        "checking membership: %s",
                        safe_exception(error),
                    )
                before_rows = await self._collection_step(
                    "read_after", self._collection_members(collection)
                )
                other_rows = (
                    await self._collection_step(
                        "read_other_after", self._collection_members(other)
                    )
                    if other
                    else None
                )
            result = await self._collection_step(
                "store_result",
                self.repository.async_collection_finish(
                    self.source, job["request"], before_rows, other_members=other_rows
                ),
            )
            if result["status"] == "uncertain":
                observed = {row["source_handle"] for row in before_rows}
                observed_other = (
                    {row["source_handle"] for row in other_rows}
                    if other_rows is not None
                    else None
                )
                _LOGGER.warning(
                    "Collection readback did not match: selected_matches=%s "
                    "primary_matches=%s other_matches=%s "
                    "expected_count=%d observed_count=%d",
                    (handle in observed) == (operation == "add"),
                    observed == expected,
                    observed_other == expected_other,
                    len(expected),
                    len(observed),
                )
            return result
        except BaseException:
            if not sent:
                await async_finish_cleanup(
                    self.repository.async_collection_finish(
                        self.source, job["request"], acknowledge=job["actor"]
                    )
                )
            raise

    async def _run_collection_queue(self):
        try:
            await self._process_collection_queue()
        except Exception as error:
            _LOGGER.error(
                "Collection queue stopped unexpectedly: %s", safe_exception(error)
            )
            try:
                jobs = await self.repository.async_collection_queue(
                    "status", self.source
                )
                for job in jobs:
                    if job["status"] not in {"queued", "working", "syncing"}:
                        continue
                    try:
                        intent = await self.repository.async_collection_intent(
                            self.source, job["request_id"]
                        )
                    except JournalError:
                        intent = None
                    uncertain = bool(intent and intent["status"] == "uncertain")
                    await self.repository.async_collection_queue(
                        "update",
                        self.source,
                        job["request_id"],
                        "uncertain" if uncertain else "interrupted",
                        "queue_stopped",
                    )
            finally:
                self.collection_queue.clear()
                self.collection_scheduled.clear()

    async def _process_collection_queue(self):
        waiting_scan = []
        blocked = False
        while self.collection_queue:
            job = self.collection_queue.pop(0)
            request = job["request"]
            self.collection_stage = "waiting_for_library"
            self.collection_failure = None
            started = asyncio.get_running_loop().time()
            _LOGGER.debug(
                "Collection change started: queued_remaining=%d",
                len(self.collection_queue),
            )
            if self.paused or self.stopped or blocked:
                await self.repository.async_collection_queue(
                    "update", self.source, request, "interrupted", "not_sent"
                )
                self.collection_scheduled.discard(request)
                continue
            try:
                if self.task and not self.task.done():
                    try:
                        await asyncio.shield(self.task)
                    except asyncio.CancelledError:
                        if not (self.paused or self.stopped):
                            raise
                self._collection_ready()
                while self.operation_lock.locked():
                    await asyncio.sleep(0.2)
                    self._collection_ready()
                await self.repository.async_collection_queue(
                    "update", self.source, request, "working"
                )
                result = await self.async_collection_operation(
                    lambda: self._queued_collection_change(job), job["authorize"]
                )
                if result["status"] == "confirmed":
                    await self.repository.async_collection_queue(
                        "update", self.source, request, "syncing"
                    )
                    waiting_scan.append(request)
                    _LOGGER.debug(
                        "Collection readback verified; waiting for Library scan"
                    )
                else:
                    blocked = True
                    await self.repository.async_collection_queue(
                        "update",
                        self.source,
                        request,
                        "uncertain",
                        "collection_uncertain",
                    )
            except Exception as error:
                try:
                    intent = await self.repository.async_collection_intent(
                        self.source, request
                    )
                except JournalError:
                    intent = None
                uncertain = bool(intent and intent["status"] == "uncertain")
                blocked = blocked or uncertain
                code = (
                    error.code
                    if isinstance(error, JournalError)
                    else "library_unreachable"
                )
                _LOGGER.warning(
                    "Collection change could not complete: stage=%s outcome=%s code=%s "
                    "elapsed_seconds=%.1f reason=%s",
                    self.collection_stage,
                    "unconfirmed"
                    if uncertain
                    else "device_verified"
                    if intent and intent["status"] == "confirmed"
                    else "not_sent",
                    code,
                    asyncio.get_running_loop().time() - started,
                    self.collection_failure or safe_exception(error),
                )
                await self.repository.async_collection_queue(
                    "update",
                    self.source,
                    request,
                    "uncertain"
                    if uncertain
                    else "interrupted"
                    if self.paused or self.stopped
                    else "failed",
                    code,
                )
            finally:
                self.collection_scheduled.discard(request)
        if waiting_scan:
            if not self.paused and not self.stopped:
                self.request_sync()
                try:
                    await asyncio.shield(self.task)
                except asyncio.CancelledError:
                    if not self.task.cancelled():
                        raise
            for request in waiting_scan:
                verified = (
                    not self.paused
                    and not self.stopped
                    and not self.error
                    and await self.repository.async_collection_queue(
                        "verified", self.source, request
                    )
                )
                await self.repository.async_collection_queue(
                    "update",
                    self.source,
                    request,
                    "confirmed" if verified else "interrupted",
                    None if verified else "scan_unconfirmed",
                )
                if verified:
                    _LOGGER.debug("Collection change verified by Library scan")
                else:
                    _LOGGER.warning(
                        "Collection change was read back but the Library scan did not "
                        "confirm it: scan_failed=%s scan_interrupted=%s",
                        bool(self.error),
                        self.paused or self.stopped,
                    )
        if self.collection_queue:
            self.collection_queue_task = self.hass.async_create_background_task(
                self._run_collection_queue(), "Kaleidescape collection queue"
            )

    async def post(self, path: str, fields: dict[str, str]) -> BrowserResponse:
        """Companion-owned, pinned multipart transport for pyk's local browser."""
        operation = self._post_response(path, fields)
        if asyncio.current_task() is self.collection_task:
            return await self._collection_transport("post", operation)
        return await operation

    async def _post_response(
        self, path: str, fields: dict[str, str]
    ) -> BrowserResponse:
        if path != "/movies" and not _removal_path(path):
            raise JournalError("library_destination", "Library route was rejected")
        form = MultipartWriter("form-data")
        for name, value in fields.items():
            part = form.append(value)
            del part.headers["Content-Type"]
            part.set_content_disposition("form-data", name=name)
        base = URL(self.origin)
        url = URL(self.origin + path).with_host(self.address)
        async with self.session.post(
            url,
            data=form,
            allow_redirects=False,
            timeout=ClientTimeout(total=COLLECTION_PAGE_TIMEOUT, connect=15),
            headers={"Host": base.authority},
            server_hostname=base.host if base.scheme == "https" else None,
        ) as response:
            parts, length = [], 0
            async for part in response.content.iter_chunked(65536):
                length += len(part)
                if length > 8 * 1024 * 1024:
                    raise JournalError(
                        "library_too_large", "Collection response exceeded its limit"
                    )
                parts.append(part)
            return BrowserResponse(
                response.status,
                response.content_type,
                b"".join(parts),
                response.charset,
                response.headers.get("Content-Encoding", "identity"),
                response.headers.get("Location"),
            )

    async def async_collection_add(
        self, request, title, collection, revision, actor, excluded, authorize
    ):
        request, fingerprint = parameters(
            request, self.source, title, collection, revision, actor
        )

        async def add():
            cached = await self.repository.async_collection_lookup(request, fingerprint)
            if cached is not None:
                return (
                    await self._check_collection(request)
                    if cached["status"] == "uncertain"
                    else cached
                )
            state = await self.repository.async_collection_snapshot(
                self.source, title, excluded
            )
            if state["revision"] != revision:
                raise JournalError(
                    "refresh_required", "Library changed; refresh title details"
                )
            if state["pending"]:
                raise JournalError(
                    "collection_uncertain", "Resolve the previous collection request"
                )
            if collection not in state["collections"]:
                raise JournalError("invalid_request", "Unknown or hidden collection")
            self.address = await self._resolve()
            rows, _ = await self.browser.movies()
            version = state["version"]
            if not any(
                all(
                    row[key] == version[key]
                    for key in ("source_handle", "source_group", "title")
                )
                for row in rows
            ):
                raise JournalError(
                    "refresh_required", "Source identity changed; sync the Library"
                )
            choices = await self.browser.add_targets(version["source_handle"])
            if collection not in choices:
                raise JournalError(
                    "collection_form", "Collection is not an available add target"
                )
            members = await self._collection_members(collection)
            before = {row["source_handle"] for row in members}
            expected = await self.hass.async_add_executor_job(
                member_hash, before | {version["source_handle"]}
            )
            authorize()
            self._collection_ready()
            await self.repository.async_collection_begin(
                self.source,
                request,
                fingerprint,
                title,
                collection,
                revision,
                expected,
                actor,
            )
            may_have_posted = False
            try:
                authorize()
                self._collection_ready()
                if version["source_handle"] not in before:
                    try:
                        await self._post_collection_add(
                            version["source_handle"], collection, authorize
                        )
                        may_have_posted = True
                    except BrowserOutcomeUnknownError as error:
                        may_have_posted = True
                        if asyncio.current_task().cancelling():
                            raise asyncio.CancelledError from error
                        # A response failure is not proof the POST failed.
                    members = await self._collection_members(collection)
                result = await self.repository.async_collection_finish(
                    self.source, request, members
                )
                if result["status"] == "confirmed":
                    _LOGGER.info("Collection addition was verified and recorded")
                elif result["status"] == "uncertain":
                    _LOGGER.error(
                        "Collection addition outcome is uncertain; review is required"
                    )
                return result
            except BaseException:
                if may_have_posted:
                    _LOGGER.error(
                        "Collection addition could not be verified; "
                        "the outcome may be uncertain"
                    )
                else:
                    await async_finish_cleanup(
                        self.repository.async_collection_finish(
                            self.source, request, acknowledge=actor
                        )
                    )
                raise

        return await self.async_collection_operation(add, authorize)

    async def _check_collection(self, request):
        row = await self.repository.async_collection_intent(self.source, request)
        if row["status"] != "uncertain":
            return {"status": row["status"], "request_id": request}
        self.address = await self._resolve()
        members = await self._collection_members(row["collection"])
        other = (
            await self._collection_members(row["other_collection"])
            if row["other_collection"]
            else None
        )
        return await self.repository.async_collection_finish(
            self.source, request, members, other_members=other
        )

    async def async_collection_check(self, request, authorize, acknowledge=None):
        async def check():
            if acknowledge is not None:
                return await self.repository.async_collection_finish(
                    self.source, request, acknowledge=acknowledge
                )
            return await self._check_collection(request)

        result = await self.async_collection_operation(check, authorize)
        jobs = await self.repository.async_collection_queue("status", self.source)
        if any(job["request_id"] == request for job in jobs):
            if result["status"] == "confirmed":
                await self.repository.async_collection_queue(
                    "update", self.source, request, "syncing"
                )
                task = self.hass.async_create_background_task(
                    self._rescan_checked_collection(request),
                    "Kaleidescape verified collection rescan",
                )
                self.collection_queue_task = task
            elif result["status"] == "abandoned":
                await self.repository.async_collection_queue(
                    "update", self.source, request, "interrupted", "acknowledged"
                )
        return result

    async def _rescan_checked_collection(self, request):
        verified = False
        try:
            self.request_sync()
            await asyncio.shield(self.task)
            verified = not self.error and await self.repository.async_collection_queue(
                "verified", self.source, request
            )
        finally:
            await self.repository.async_collection_queue(
                "update",
                self.source,
                request,
                "confirmed" if verified else "interrupted",
                None if verified else "scan_unconfirmed",
            )
            if self.collection_queue:
                self.collection_queue_task = self.hass.async_create_background_task(
                    self._run_collection_queue(), "Kaleidescape collection queue"
                )

    async def async_resume(self):
        self.paused = False
        if not self.stopped:
            self.request_sync(manual=False)

    def status(self):
        return {
            "phase": self.phase,
            "error": self.error,
            "processed": self.processed,
            "total": self.total,
            "last_attempt": self.last_attempt,
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

    async def get(self, path: str) -> BrowserResponse:
        """Pin validated DNS results and return bounded bytes to pyk."""
        operation = self._get_response(path)
        if asyncio.current_task() is self.collection_task:
            kind = (
                "catalog"
                if path == "/movies"
                else "details"
                if path.startswith("/details?")
                else "collection"
            )
            return await self._collection_transport(kind, operation)
        return await operation

    async def _get_response(self, path: str) -> BrowserResponse:
        base = URL(self.origin)
        if not (
            path == "/movies"
            or path.startswith("/movies?collection=")
            or path.startswith("/details?id=")
            or artwork_path(path)
        ):
            raise JournalError("library_destination", "Library route was rejected")
        ip = self.address or await self._resolve()
        url = URL(self.origin + path).with_host(ip)
        maximum = MAX_ARTWORK_BYTES if artwork_path(path) else 8 * 1024 * 1024
        async with self.session.get(
            url,
            allow_redirects=False,
            timeout=ClientTimeout(
                total=COLLECTION_PAGE_TIMEOUT
                if path.startswith("/movies")
                or asyncio.current_task() is self.collection_task
                else 15,
                connect=15
                if path.startswith("/movies")
                or asyncio.current_task() is self.collection_task
                else 5,
            ),
            headers={"Host": base.authority},
            server_hostname=base.host if base.scheme == "https" else None,
        ) as response:
            if (
                response.content_length is not None
                and response.content_length > maximum
            ):
                raise JournalError(
                    "library_too_large", "Library response exceeded its size limit"
                )
            parts, length = [], 0
            async for part in response.content.iter_chunked(65536):
                length += len(part)
                if length > maximum:
                    raise JournalError(
                        "library_too_large", "Library response exceeded its size limit"
                    )
                parts.append(part)
            return BrowserResponse(
                response.status,
                response.content_type,
                b"".join(parts),
                response.charset,
                response.headers.get("Content-Encoding", "identity"),
                response.headers.get("Location"),
            )

    async def _get(self, path: str, *, image=False):
        """Compatibility probe for transport tests; runtime parsing lives in pyk."""
        response = await self.get(path)
        if response.status != 200 or response.content_encoding.lower() != "identity":
            raise JournalError(
                "library_response", "The library returned an unsupported response"
            )
        if image:
            if (
                response.content_type not in {"image/jpeg", "image/png", "image/webp"}
                or image_type(response.body) != response.content_type
            ):
                raise JournalError("library_artwork", "Cover image was rejected")
            return response.body, response.content_type
        if response.content_type not in {"text/html", "application/xhtml+xml"}:
            raise JournalError("library_response", "Library response type was rejected")
        charset = (response.charset or "iso-8859-1").lower()
        if charset not in {"utf-8", "utf8", "iso-8859-1", "latin-1", "windows-1252"}:
            raise JournalError(
                "library_format", "Library character encoding was rejected"
            )
        return response.body.decode(charset)

    async def _listing(self, path):
        if path == "/movies":
            return await self.browser.movies()
        raise ValueError("Use the browser's collection method for named listings")

    async def _notify_missing(self):
        """Publish the current group-level completeness result after a scan."""
        try:
            missing = await self.repository.async_library_missing_for_notification(
                self.source
            )
            if missing is None or self.stopped or self.paused:
                return
            movies = missing["movies"]
            if not movies:
                if not self.error:
                    persistent_notification.async_dismiss(self.hass, MISSING_NOTICE_ID)
                return
            lines = []
            for movie in movies:
                categories = [
                    label
                    for key, label in (("metadata", "metadata"), ("artwork", "artwork"))
                    if movie[key]
                ]
                title = _notification_title(movie["title"])
                lines.append(f"- {title} ({' and '.join(categories)})")
            message = (
                f"{len(movies)} {'movie has' if len(movies) == 1 else 'movies have'} "
                "missing metadata or artwork. "
                f"Missing metadata: {missing['missing_metadata']}; "
                f"missing artwork: {missing['missing_artwork']}.\n\n" + "\n".join(lines)
            )
            if self.error:
                message += (
                    "\n\nThe sync was incomplete; this reflects the cached library."
                )
            message += "\n\n[View library with missing metadata filter]" + (
                f"({MISSING_LIBRARY_LINK})"
            )
            _LOGGER.info(
                "Library sync found %s movies missing metadata or artwork "
                "(metadata=%s, artwork=%s). "
                "View library with missing metadata filter: %s",
                len(movies),
                missing["missing_metadata"],
                missing["missing_artwork"],
                MISSING_LIBRARY_LINK,
            )
            persistent_notification.async_create(
                self.hass,
                message,
                "Kaleidescape Companion: missing metadata or artwork",
                MISSING_NOTICE_ID,
            )
        except Exception as error:
            _LOGGER.warning(
                "Could not update the Library missing-data notification: %s",
                safe_exception(error),
            )

    async def _run(self):
        operation_id = uuid4().hex[:16]
        _LOGGER.info("Library synchronization started (operation_id=%s)", operation_id)
        self.last_attempt = datetime.now(UTC).isoformat()
        self.error = None
        self.processed = self.total = 0
        failed = False
        try:
            async with asyncio.timeout(LIBRARY_SYNC_TIMEOUT):
                async with self.operation_lock:
                    await self._sync()
            await self._notify_missing()
        except asyncio.CancelledError:
            _LOGGER.debug(
                "Library synchronization cancelled (operation_id=%s)", operation_id
            )
            raise
        except JournalError as error:
            self.error = error.code
            failed = True
        except ClientError, OSError, TimeoutError, UnicodeError:
            self.error = "library_unreachable"
            failed = True
        except KaleidescapeError:
            self.error = "library_format"
            failed = True
        except Exception as error:
            # Keep firmware errors private and independent from recording.
            self.error = "library_format"
            failed = True
            _LOGGER.debug(
                "Library synchronization fault: %s (operation_id=%s)",
                safe_exception(error),
                operation_id,
            )
        finally:
            self.phase = "idle"
            if not asyncio.current_task().cancelling():
                if self.error:
                    if self.error in {"busy", "backup_in_progress"}:
                        _LOGGER.debug("Library synchronization deferred for storage")
                    elif (
                        self._manual_sync
                        or (self.error, failed) != self._reported_error
                    ):
                        if failed and self.error == "library_changed":
                            _LOGGER.error(
                                "Library sync conflict (library_changed): a collection "
                                "referenced a movie absent from the catalog snapshot; "
                                "catalog and collection updates were rolled back. "
                                "Retry the sync (operation_id=%s)",
                                operation_id,
                            )
                        elif failed:
                            _LOGGER.error(
                                "Library synchronization failed; processed %s of %s "
                                "detail candidates (operation_id=%s)",
                                self.processed,
                                self.total,
                                operation_id,
                            )
                        else:
                            _LOGGER.warning(
                                "Library sync incomplete; processed %s of %s detail "
                                "candidates (operation_id=%s)",
                                self.processed,
                                self.total,
                                operation_id,
                            )
                    else:
                        _LOGGER.debug(
                            "Library synchronization remains incomplete "
                            "(operation_id=%s)",
                            operation_id,
                        )
                    self._reported_error = (self.error, failed)
                else:
                    if self._reported_error == ("library_changed", True):
                        if self.config["library_sync_collections"]:
                            _LOGGER.warning(
                                "Library sync conflict (library_changed) resolved: "
                                "a later catalog and collection sync succeeded "
                                "(operation_id=%s)",
                                operation_id,
                            )
                        else:
                            _LOGGER.warning(
                                "Library sync resumed after conflict "
                                "(library_changed), but collection sync was disabled; "
                                "the conflict was not rechecked (operation_id=%s)",
                                operation_id,
                            )
                    elif self._reported_error is not None:
                        _LOGGER.info("Library synchronization recovered")
                    self._reported_error = None
                    _LOGGER.info(
                        "Library synchronization completed: %s detail candidates "
                        "processed (operation_id=%s)",
                        self.processed,
                        operation_id,
                    )

    async def _sync(self):
        self.phase = "catalog"
        self.address = await self._resolve()
        rows, names = await self.browser.movies()
        memberships = None
        if self.config["library_sync_collections"] and names is None:
            self.error = "library_format"
        elif self.config["library_sync_collections"]:
            self.phase = "collections"
            memberships = {}
            member_count = 0
            try:
                for name in names:
                    members = await self.browser.collection(name)
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
            except KaleidescapeError:
                memberships = None
                self.error = "library_format"
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
                    detail = await self.browser.version_details(item["source_handle"])
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
                    body, content_type = await self.browser.artwork(path)
                    await self.repository.async_library_artwork_save(
                        self.source, item["id"], body, content_type, budget
                    )
            except JournalError as error:
                if error.code in {"backup_in_progress", "busy", "not_ready"}:
                    raise
                self.error = error.code
            except KaleidescapeError:
                self.error = "library_format"
            except ClientError, OSError, TimeoutError, UnicodeError:
                self.error = "library_unreachable"
            self.processed += 1
            await asyncio.sleep(0.05 if requested else 0)

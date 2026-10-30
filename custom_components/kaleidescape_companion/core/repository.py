"""Durable journal storage owned by a single dedicated SQLite worker."""

import asyncio
import json
import sqlite3
import tempfile
import time
from collections.abc import AsyncIterator, Callable
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from functools import partial
from pathlib import Path
from typing import Any

from ..library import browse as library_browse
from ..library import collections as library_collections
from ..library import store as library_store
from ..library.importing import portable_titles
from ..library.summary import library_summary
from ..playback.history import history_summary
from ..playback.recording import save_session
from . import import_merge, journal_store, preferences
from .importing import MAX_IMPORT_BYTES
from .maintenance import inspect_database, purge_database
from .migrations import SCHEMA_VERSION, UnsupportedSchemaError, migrate
from .models import (
    JournalError,
    fields,
    identifier,
    invalid,
    status,
    text,
    timestamp,
    validate_times,
)
from .security import async_finish_cleanup, private_directory, private_file

MAX_PENDING = 128
MAX_DATABASE_BYTES = 256 * 1024 * 1024
MAX_LIBRARY_DATABASE_BYTES = 192 * 1024 * 1024
MAX_EXPORT_BYTES = 256 * 1024 * 1024
EXPORT_BUILD_SECONDS = 30


class JournalRepository:
    """Serialize IO off the event loop; never share the connection across threads."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._worker = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="kaleidescape"
        )
        self._connection: sqlite3.Connection | None = None
        self._closing = False
        self._paused = False
        self._pending = 0
        self._close_task: asyncio.Task | None = None
        self._export_active = False
        self._import_active = False
        self._import_task: asyncio.Task | None = None
        self._import_plan: dict | None = None
        self._export_directory = path.with_name(f".{path.name}.exports")
        self._artwork_directory = path.parent / "artwork"
        self._calendar: dict | None = None
        self._recording_library_source: str | None = None

    @property
    def pending(self) -> int:
        """Expose only a non-private queue health metric."""
        return self._pending

    async def _call[T](
        self, operation: Callable[..., T], *args: Any, control: bool = False
    ) -> T:
        if self._closing:
            raise JournalError("not_ready", "Journal is closed")
        if not control and self._pending >= MAX_PENDING:
            raise JournalError("busy", "Journal queue is full; retry later")
        self._pending += 1
        future = asyncio.get_running_loop().run_in_executor(
            self._worker, partial(self._execute, operation, *args)
        )
        future.add_done_callback(self._finished)
        # A disconnected caller must not cancel an already accepted database write.
        return await asyncio.shield(future)

    def _finished(self, future: asyncio.Future) -> None:
        self._pending -= 1
        # Retrieve failures even when the requesting coroutine was cancelled.
        if not future.cancelled():
            future.exception()

    @staticmethod
    def _execute[T](operation: Callable[..., T], *args: Any) -> T:
        try:
            return operation(*args)
        except (sqlite3.Error, OSError) as error:
            raise JournalError(
                "storage_error", "Journal storage operation failed"
            ) from error

    async def async_open(self) -> None:
        """Open and migrate on the connection's owning thread."""
        await self._call(self._open)

    def _open(self) -> None:
        private_directory(self.path.parent)
        private_file(self.path, create=True)
        for suffix in ("-journal", "-wal", "-shm"):
            private_file(self.path.with_name(self.path.name + suffix))
        for backup in self.path.parent.glob(f"{self.path.name}.v*.bak"):
            private_file(backup)
        private_directory(self._export_directory)
        # Only integration-owned snapshot names are eligible for crash cleanup.
        for pattern in ("kaleidescape-*.json", "kaleidescape-*.sqlite"):
            for leftover in self._export_directory.glob(pattern):
                private_file(leftover)
                leftover.unlink()
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.create_function(
            "companion_casefold",
            1,
            lambda value: str(value or "").casefold(),
            deterministic=True,
        )
        from .search import matches

        connection.create_function("companion_matches", 3, matches, deterministic=True)
        connection.create_function(
            "companion_shuffle", 2, library_browse.shuffle_key, deterministic=True
        )
        from ..library.formats import labels as format_labels

        connection.create_function(
            "companion_formats", 1, format_labels, deterministic=True
        )
        try:
            migrate(connection, self.path)
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA journal_mode = DELETE")
            connection.execute("PRAGMA synchronous = FULL")
            connection.execute("PRAGMA secure_delete = ON")
            connection.execute("PRAGMA busy_timeout = 5000")
            page_size = connection.execute("PRAGMA page_size").fetchone()[0]
            pages = connection.execute("PRAGMA page_count").fetchone()[0]
            # Existing oversized journals remain readable but cannot grow.
            page_limit = max(pages, MAX_DATABASE_BYTES // page_size)
            connection.execute(f"PRAGMA max_page_count = {page_limit}")
            # Detect invalid current-version databases during setup, not first write.
            metadata = connection.execute(
                "SELECT dataset_id, revision FROM schema_metadata"
            ).fetchone()
            if metadata is None:
                raise UnsupportedSchemaError("Journal metadata is missing")
        except BaseException:
            connection.close()
            raise
        self._connection = connection
        if self._artwork_directory.exists() or self._artwork_directory.is_symlink():
            library_store.cache_open(connection, self._artwork_directory)

    async def async_library_info(self, source: str, excluded: str = "") -> dict:
        return await self._call(
            library_browse.library_info, self._db(), source, excluded
        )

    async def async_purchase_totals(self, source):
        from ..library.purchases import totals

        return await self._call(self._search_read, totals, source)

    async def async_library_list(
        self, source: str, filters: dict, excluded: str = ""
    ) -> dict:
        return await self._call(
            self._search_read, library_browse.library_list, source, filters, excluded
        )

    async def async_library_versions(
        self,
        source: str,
        title: str,
        offset: int = 0,
        revision: int | None = None,
        excluded: str = "",
        *,
        admin: bool = False,
    ) -> dict:
        return await self._call(
            library_browse.library_versions,
            self._db(),
            source,
            title,
            offset,
            revision,
            excluded,
            admin,
        )

    async def async_library_candidates(self, source: str) -> list[dict]:
        return await self._call(library_store.detail_candidates, self._db(), source)

    async def async_collection_snapshot(self, source, title=None, excluded=""):
        return await self._call(
            library_collections.snapshot, self._db(), source, title, excluded
        )

    async def async_collection_lookup(self, request, fingerprint):
        return await self._call(
            library_collections.lookup, self._db(), request, fingerprint
        )

    async def async_collection_intent(self, source, request):
        return await self._call(library_collections.intent, self._db(), source, request)

    async def async_collection_begin(self, *args):
        return await self._call(self._library_write, library_collections.begin, *args)

    async def async_collection_finish(
        self, source, request, members=None, acknowledge=None
    ):
        return await self._call(
            self._library_write,
            library_collections.finish,
            source,
            request,
            members,
            acknowledge,
        )

    def _library_write(self, operation, *args):
        if self._paused:
            raise JournalError("backup_in_progress", "Library writes paused for backup")
        if self._import_active or self._export_active:
            raise JournalError("busy", "Wait for the active transfer before syncing")
        db = self._db()
        page_size = db.execute("PRAGMA page_size").fetchone()[0]
        pages = db.execute("PRAGMA page_count").fetchone()[0]
        if (
            pages * page_size >= MAX_LIBRARY_DATABASE_BYTES
            and operation != self._trim_library_artwork
        ):
            raise JournalError(
                "library_storage_limit",
                "Library writes reached their storage ceiling; "
                "journal growth remains available",
            )
        previous_limit = db.execute("PRAGMA max_page_count").fetchone()[0]
        limit = max(pages, min(previous_limit, MAX_LIBRARY_DATABASE_BYTES // page_size))
        db.execute(f"PRAGMA max_page_count={limit}")
        try:
            return operation(db, *args)
        finally:
            db.execute(f"PRAGMA max_page_count={previous_limit}")

    async def async_library_catalog(
        self, origin: str, rows: list, collections=None
    ) -> None:
        await self._call(
            self._library_write, library_store.save_catalog, origin, rows, collections
        )

    async def async_library_details(
        self, source, id, details, include_metadata=True
    ) -> None:
        await self._call(
            self._library_write,
            library_store.save_details,
            source,
            id,
            details,
            include_metadata,
        )

    async def async_library_artwork_save(
        self, source, id, data, content_type, budget
    ) -> None:
        await self._call(
            self._library_write,
            self._save_library_artwork,
            source,
            id,
            data,
            content_type,
            budget,
        )

    def _save_library_artwork(self, db, source, id, data, content_type, budget):
        private_directory(self._artwork_directory)
        library_store.save_artwork(
            db, self._artwork_directory, source, id, data, content_type, budget
        )

    async def async_library_artwork(self, source: str, key: str) -> tuple[bytes, str]:
        return await self._call(
            library_store.read_artwork, self._db(), self._artwork_directory, source, key
        )

    async def async_library_trim(self, budget: int) -> None:
        await self._call(self._library_write, self._trim_library_artwork, budget)

    def _trim_library_artwork(self, db, budget):
        if self._artwork_directory.exists():
            with db:
                evicted = library_store.cache_trim(db, self._artwork_directory, budget)
                if evicted:
                    db.execute("UPDATE library_sources SET revision=revision+1")
                    db.execute("UPDATE schema_metadata SET revision=revision+1")
            for path in evicted:
                path.unlink(missing_ok=True)

    def _db(self) -> sqlite3.Connection:
        if self._connection is None:
            raise JournalError("not_ready", "Journal is not open")
        return self._connection

    async def async_close(self) -> None:
        """Reject new work and drain accepted operations before closing."""
        if self._close_task is None:
            self._closing = True
            self._close_task = asyncio.create_task(self._drain_and_close())
        await asyncio.shield(self._close_task)

    async def _drain_and_close(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(self._worker, self._close)
        finally:
            await loop.run_in_executor(None, self._worker.shutdown, True)

    def _close(self) -> None:
        self._import_plan = None
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    async def async_pause(self) -> None:
        """Drain writes before an HA backup; subsequent writes receive a retry error."""
        await self._call(self._set_paused, True, control=True)

    async def async_resume(self) -> None:
        """Release the backup write barrier."""
        await self._call(self._set_paused, False, control=True)

    def _set_paused(self, paused: bool) -> None:
        self._db()
        self._paused = paused

    async def async_info(self) -> dict:
        """Return non-content metadata for health and dataset selection."""
        return await self._call(self._info)

    def _info(self) -> dict:
        db = self._db()
        metadata = dict(db.execute("SELECT * FROM schema_metadata").fetchone())
        return {
            "dataset_id": metadata["dataset_id"],
            "schema_version": SCHEMA_VERSION,
            "revision": metadata["revision"],
            "created_at": metadata["created_at"],
            "viewing_count": db.execute(
                "SELECT count(*) FROM viewings WHERE deleted_at IS NULL"
            ).fetchone()[0],
            "backup_in_progress": self._paused,
            "database_bytes": self.path.stat().st_size,
            "database_limit_bytes": MAX_DATABASE_BYTES,
        }

    async def async_history_summary(self, *, now: datetime | None = None) -> dict:
        """Return bounded title-only sensor data from a single worker snapshot."""
        current = now or datetime.now(UTC)
        upper = timestamp(current.isoformat())
        cutoffs = [
            timestamp((current - timedelta(days=days)).isoformat())
            for days in (7, 30, 365)
        ]
        return await self._call(self._history_summary, upper, cutoffs)

    def _history_summary(self, upper: str, cutoffs: list[str]) -> dict:
        return history_summary(self._db(), upper, cutoffs)

    async def async_seed_ui_preferences(self, legacy):
        await self._call(preferences.seed, self._db(), legacy)

    async def async_ui_preferences(self, actor, shared=False, area="library"):
        return await self._call(
            preferences.get, self._db(), self._actor(actor), shared, area
        )

    async def async_ui_preferences_update(
        self, actor, shared, request, revision, patch, area="library"
    ):
        return await self._call(
            self._ui_preferences_update,
            self._actor(actor),
            shared,
            identifier(request),
            revision,
            patch,
            area,
        )

    def _ui_preferences_update(self, actor, shared, request, revision, patch, area):
        if self._paused:
            raise JournalError(
                "backup_in_progress", "Settings writes paused for backup"
            )
        return preferences.update(
            self._db(), actor, shared, request, revision, patch, area
        )

    async def async_hidden_collections(self):
        return await self._call(preferences.excluded, self._db())

    async def async_library_suggest(self, source, field, query, fuzzy=False):
        from ..library.browse import suggestions

        return await self._call(
            self._search_read, suggestions, source, field, query, fuzzy
        )

    async def async_library_summary(self, source: str | None) -> dict:
        """Read a bounded sensor projection; never resolve a host or request a scan."""
        return await self._call(self._library_summary, source)

    def _library_summary(self, source):
        return {
            **library_summary(self._db(), source),
            "database_bytes": self.path.stat().st_size,
        }

    async def async_inspect(
        self,
        table: str,
        offset: int = 0,
        revision: int | None = None,
        *,
        limit: int = 25,
        query: str = "",
        sort: str | None = None,
        descending: bool = False,
    ) -> dict:
        """Read bounded raw pages through a fixed table allowlist."""
        return await self._call(
            self._inspect, table, offset, revision, limit, query, sort, descending
        )

    def _search_read(self, function, *args):
        db = self._db()
        deadline = time.monotonic() + 2
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        try:
            return function(db, *args)
        except sqlite3.OperationalError as error:
            if getattr(error, "sqlite_errorcode", None) == sqlite3.SQLITE_INTERRUPT:
                raise JournalError(
                    "query_limit",
                    "Refine the search; its two-second budget was exceeded",
                ) from error
            raise
        finally:
            db.set_progress_handler(None, 0)

    async def async_library_search(self, source, query, excluded, fuzzy=True):
        from ..library.search import search

        return await self._call(search, self._db(), source, query, excluded, fuzzy)

    def _inspect(self, table, offset, revision, limit, query, sort, descending) -> dict:
        db = self._db()
        deadline = time.monotonic() + 2
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        try:
            return inspect_database(
                db, table, offset, revision, limit, query, sort, descending
            )
        except sqlite3.OperationalError as error:
            if getattr(error, "sqlite_errorcode", None) == sqlite3.SQLITE_INTERRUPT:
                raise JournalError(
                    "query_limit", "Query exceeded its two-second execution budget"
                ) from error
            raise
        finally:
            db.set_progress_handler(None, 0)

    async def async_database_validate_query(self, table, query):
        return await self._call(self._database_validate_query, table, query)

    def _database_validate_query(self, table, query):
        from .database_query import compile_query
        from .database_schema import TABLE_KEYS, schema

        if not isinstance(table, str) or table not in TABLE_KEYS:
            raise invalid("Invalid table")
        compile_query(query, schema(self._db(), table)[1])
        return {"valid": True}

    async def async_database_mutate(self, request, data, actor_id):
        return await self._call(
            self._database_mutate, identifier(request), data, self._actor(actor_id)
        )

    def _database_mutate(self, request, data, actor):
        from .database_mutations import mutation, mutation_fingerprint, replay

        cached = replay(self._db(), request, mutation_fingerprint(actor, data))
        if cached is not None:
            return cached
        if self._paused:
            raise JournalError(
                "backup_in_progress", "Database writes paused for backup"
            )
        if self._export_active or self._import_active:
            raise JournalError("busy", "Wait for the active transfer")
        if (
            isinstance(data, dict)
            and isinstance(data.get("table"), str)
            and data["table"].startswith("library_")
            and data.get("operation") == "edit"
        ):
            return self._library_write(
                mutation, self._artwork_directory, request, actor, data
            )
        return mutation(
            self._db(), self._artwork_directory, request, actor, data, self._calendar
        )

    async def async_purge(
        self,
        request_id: str,
        expected_revision: int,
        viewing_ids: list[str],
        purge_all: bool,
        confirmation: str,
        *,
        actor_id: str | None = None,
    ) -> dict:
        """Permanently purge explicitly confirmed entries; caller disables tracking."""
        if (
            type(expected_revision) is not int
            or expected_revision < 0
            or type(purge_all) is not bool
        ):
            raise invalid("Invalid purge revision/scope")
        if not isinstance(viewing_ids, list) or len(viewing_ids) > 100:
            raise invalid("Select at most 100 entries")
        ids = [identifier(value) for value in viewing_ids]
        if (
            len(ids) != len(set(ids))
            or (purge_all and ids)
            or (not purge_all and not ids)
        ):
            raise invalid("Choose selected entries or all entries")
        if confirmation != ("PURGE ALL" if purge_all else "PURGE"):
            raise invalid("Purge confirmation does not match")
        return await self._call(
            self._purge,
            identifier(request_id),
            {
                "expected_revision": expected_revision,
                "viewing_ids": sorted(ids),
                "all": purge_all,
            },
            self._actor(actor_id),
        )

    def _purge(self, request_id: str, data: dict, actor_id: str | None) -> dict:
        if self._paused:
            raise JournalError("backup_in_progress", "Journal writes paused for backup")
        if self._export_active or self._import_active:
            raise JournalError("busy", "Wait for the active export before purging")
        return purge_database(self._db(), request_id, data, actor_id)

    @asynccontextmanager
    async def async_import_slot(self) -> AsyncIterator[None]:
        """Bound uploads/validation to one per runtime, excluding exports/purge."""
        if self._import_active or self._export_active:
            raise JournalError("busy", "Another transfer is in progress")
        self._import_active = True
        try:
            yield
        finally:
            try:
                if self._import_task:
                    task = self._import_task

                    async def finish_import():
                        await task

                    await async_finish_cleanup(finish_import())
            except JournalError:
                pass  # The operation's caller already receives its safe error.
            finally:
                self._import_task = None
                self._import_active = False

    async def async_import_preview(self, payload, import_format, *, actor_id=None):
        """Validate an upload without writes; retain one bounded review."""
        if not self._import_active or self._import_task:
            raise JournalError("busy", "Import slot is not available")
        if not isinstance(payload, bytes) or len(payload) > MAX_IMPORT_BYTES:
            raise invalid("Import exceeds 32 MiB")
        task = self._import_task = asyncio.create_task(
            self._call(
                self._preview_import, payload, import_format, self._actor(actor_id)
            )
        )
        return await asyncio.shield(task)

    def _preview_import(self, payload, import_format, actor):
        self._import_plan = import_merge.review(
            self._db(), payload, import_format, actor
        )
        return self._import_plan["public"]

    async def async_import_match_search(self, plan_id, revision, key, query, actor_id):
        return await self._call(
            self._import_review_action,
            import_merge.search_matches,
            identifier(plan_id),
            revision,
            key,
            query,
            self._actor(actor_id),
        )

    async def async_import_match(self, plan_id, revision, key, title_id, actor_id):
        return await self._call(
            self._import_review_action,
            import_merge.match_purchase,
            identifier(plan_id),
            revision,
            key,
            title_id,
            self._actor(actor_id),
        )

    def _import_review_action(self, operation, *args):
        return operation(self._db(), self._import_plan, *args)

    async def async_import_apply(
        self, request_id, plan_id, revision, selected, *, actor_id=None
    ):
        if type(revision) is not int or revision < 0:
            raise invalid("Invalid import revision")
        async with self.async_import_slot():
            task = self._import_task = asyncio.create_task(
                self._call(
                    self._apply_import,
                    identifier(request_id),
                    identifier(plan_id),
                    revision,
                    selected,
                    self._actor(actor_id),
                )
            )
            return await asyncio.shield(task)

    def _apply_import(self, request_id, plan_id, revision, selected, actor):
        if self._paused:
            raise JournalError("backup_in_progress", "Journal writes paused for backup")
        db = self._db()
        # Imports may add Library rows; preserve the journal's reserved capacity.
        pages = db.execute("PRAGMA page_count").fetchone()[0]
        size = db.execute("PRAGMA page_size").fetchone()[0]
        previous = db.execute("PRAGMA max_page_count").fetchone()[0]
        limit = max(pages, min(previous, MAX_LIBRARY_DATABASE_BYTES // size))
        db.execute(f"PRAGMA max_page_count={limit}")
        try:
            return import_merge.apply(
                db, self._import_plan, request_id, plan_id, revision, selected, actor
            )
        finally:
            db.execute(f"PRAGMA max_page_count={previous}")

    async def async_create(
        self, request_id: str, data: dict, *, actor_id: str | None = None
    ) -> dict:
        """Create an explicitly supplied viewing without guessing movie identity."""
        record = fields(data)
        validate_times(record)
        return await self._call(
            self._mutate,
            "create",
            identifier(request_id),
            record,
            self._actor(actor_id),
        )

    async def async_create_from_library(self, request_id, source, data, *, actor_id):
        """Only the scoped API uses this admission path; imports stay separate."""
        if not isinstance(data, dict):
            raise invalid("Select a Library title")
        return await self._call(
            self._create_library,
            identifier(request_id),
            source,
            data,
            self._actor(actor_id),
        )

    def _create_library(self, request, source, data, actor):
        from ..playback.manual import prepare

        db = self._db()
        # Resolve retries before checking a changed/deleted source version.
        receipt = {"library_source": source, "data": data}
        cached = db.execute(
            "SELECT 1 FROM requests WHERE request_id=?", (request,)
        ).fetchone()
        return journal_store.mutate(
            db,
            "create",
            request,
            {} if cached else prepare(db, source, data),
            actor,
            self._paused,
            self._calendar,
            receipt,
        )

    async def async_calendar_configure(self, config):
        await self._call(self._configure_calendar, config)

    def _configure_calendar(self, config):
        from ..calendar.store import configure

        configure(self._db(), config)
        self._calendar = config

    async def async_calendar_claim(self):
        return await self._call(self._claim_calendar)

    def _claim_calendar(self):
        from ..calendar.store import claim

        if (
            self._paused
            or self._export_active
            or self._import_active
            or not self._calendar
        ):
            return None
        return claim(self._db(), self._calendar)

    async def async_calendar_finish(self, viewing_id, state):
        from ..calendar.store import finish

        await self._call(finish, self._db(), viewing_id, state)

    async def async_calendar_sync(self, operation, *args):
        return await self._call(self._calendar_sync, operation, *args)

    def _calendar_sync(self, operation, *args):
        from ..calendar import sync_store

        if operation not in {"begin", "status", "claim", "ready", "finish", "cancel"}:
            raise invalid("Invalid calendar operation")
        if operation in {"begin", "claim", "ready"} and (
            self._paused or self._export_active or self._import_active
        ):
            raise JournalError("busy", "Wait for the active backup/transfer")
        if operation in {"begin", "claim"}:
            if not self._calendar:
                raise JournalError("not_ready", "Calendar publishing is disabled")
            args = (*args, self._calendar)
        if operation == "begin":
            args = (identifier(args[0]), text(args[1], 128), args[2])
        return getattr(sync_store, operation)(self._db(), *args)

    async def async_update(
        self,
        request_id: str,
        viewing_id: str,
        expected_revision: int,
        patch: dict,
        *,
        actor_id: str | None = None,
        include_deleted: bool = False,
    ) -> dict:
        """Apply a correction once, with optimistic concurrency."""
        self._validate_revision(expected_revision)
        return await self._call(
            self._mutate,
            "update",
            identifier(request_id),
            {
                "viewing_id": identifier(viewing_id),
                "expected_revision": expected_revision,
                "patch": fields(patch, partial=True),
                **({"include_deleted": True} if include_deleted else {}),
            },
            self._actor(actor_id),
        )

    async def async_correct_viewing(
        self, request_id, viewing_id, expected_revision, patch, *, actor_id, source=None
    ):
        """Normal Journal edits accept a Library ID instead of a free-text title."""
        if not isinstance(patch, dict) or "title" in patch:
            raise invalid("Select a Library movie from the suggestions")
        if "library_title_id" not in patch:
            return await self.async_update(
                request_id, viewing_id, expected_revision, patch, actor_id=actor_id
            )
        if not source:
            raise JournalError("library_disabled", "Enable Library to change the movie")
        self._validate_revision(expected_revision)
        return await self._call(
            self._correct_library,
            identifier(request_id),
            identifier(viewing_id),
            expected_revision,
            source,
            patch,
            self._actor(actor_id),
        )

    def _correct_library(self, request, viewing_id, revision, source, patch, actor):
        from ..playback.manual import correction

        db = self._db()
        receipt = {
            "library_source": source,
            "viewing_id": viewing_id,
            "expected_revision": revision,
            "patch": patch,
        }
        cached = db.execute(
            "SELECT 1 FROM requests WHERE request_id=?", (request,)
        ).fetchone()
        data = (
            {}
            if cached
            else {
                "viewing_id": viewing_id,
                "expected_revision": revision,
                "patch": correction(db, source, patch),
            }
        )
        return journal_store.mutate(
            db, "update", request, data, actor, self._paused, self._calendar, receipt
        )

    async def async_delete(
        self,
        request_id: str,
        viewing_id: str,
        expected_revision: int,
        *,
        actor_id: str | None = None,
    ) -> dict:
        """Tombstone a record without losing retry/deletion history."""
        self._validate_revision(expected_revision)
        return await self._call(
            self._mutate,
            "delete",
            identifier(request_id),
            {
                "viewing_id": identifier(viewing_id),
                "expected_revision": expected_revision,
            },
            self._actor(actor_id),
        )

    @staticmethod
    def _validate_revision(revision: int) -> None:
        if type(revision) is not int or revision < 1:
            raise invalid("expected_revision must be a positive integer")

    @staticmethod
    def _actor(actor_id: str | None) -> str | None:
        # None is reserved for trusted internal callers, never browser input.
        return None if actor_id is None else text(actor_id, 128)

    def _mutate(self, operation, request_id, data, actor_id) -> dict:
        return journal_store.mutate(
            self._db(),
            operation,
            request_id,
            data,
            actor_id,
            self._paused,
            self._calendar,
        )

    async def async_get(self, viewing_id: str) -> dict:
        """Retrieve one visible viewing."""
        return await self._call(self._get, identifier(viewing_id))

    def _get(self, viewing_id: str, include_deleted: bool = False) -> dict:
        return journal_store.get_viewing(self._db(), viewing_id, include_deleted)

    async def async_save_session(
        self, snapshot: dict, minimum_seconds: float, resume_hours: float
    ) -> str:
        """Persist a detached tracker checkpoint on the SQLite worker."""
        return await self._call(
            self._save_session, snapshot, minimum_seconds, resume_hours
        )

    async def async_recording_library(self, source: str | None) -> None:
        """Select the native configured Library independently of calendar opt-in."""
        await self._call(self._set_recording_library, source)

    def _set_recording_library(self, source):
        self._recording_library_source = source

    async def async_metadata_preview(self, source):
        from ..playback.repair import preview

        return await self._call(preview, self._db(), source)

    async def async_metadata_repair(self, source, request, actor, token):
        return await self._call(
            self._metadata_repair,
            source,
            identifier(request),
            self._actor(actor),
            token,
        )

    def _metadata_repair(self, source, request, actor, token):
        from ..playback.repair import apply

        return apply(
            self._db(),
            source,
            request,
            actor,
            token,
            paused=self._paused,
            busy=self._export_active or self._import_active,
        )

    def _save_session(
        self, snapshot: dict, minimum_seconds: float, resume_hours: float
    ) -> str:
        if self._paused:
            raise JournalError("backup_in_progress", "Journal writes paused for backup")
        return save_session(
            self._db(),
            snapshot,
            minimum_seconds,
            resume_hours,
            self._calendar,
            self._recording_library_source,
        )

    async def async_open_session(self, player_id: str) -> dict | None:
        """Recover an existing session, including one whose viewing was tombstoned."""
        return await self._call(self._open_session, player_id)

    def _open_session(self, player_id: str) -> dict | None:
        row = (
            self._db()
            .execute(
                "SELECT * FROM sessions WHERE player_id = ? AND closed_at IS NULL",
                (player_id,),
            )
            .fetchone()
        )
        return dict(row) if row else None

    async def async_sessions(self, viewing_id: str) -> dict:
        """Return bounded timing/evidence details without changing the get contract."""
        return await self._call(self._sessions, identifier(viewing_id))

    def _sessions(self, viewing_id: str) -> dict:
        self._get(viewing_id)
        rows = (
            self._db()
            .execute(
                "SELECT * FROM sessions WHERE viewing_id = ? "
                "ORDER BY started_at DESC, id DESC LIMIT 101",
                (viewing_id,),
            )
            .fetchall()
        )
        return {"items": [dict(row) for row in rows[:100]], "has_more": len(rows) > 100}

    async def async_viewing_library(self, source, viewing_id):
        return await self._call(
            journal_store.viewing_library, self._db(), source, identifier(viewing_id)
        )

    async def async_calendar_month(
        self,
        start,
        end,
        query="",
        viewing_status=None,
        fuzzy=False,
        source=None,
        title_id=None,
    ):
        from .journal_calendar import month

        return await self._call(
            self._search_read,
            month,
            start,
            end,
            query,
            viewing_status,
            fuzzy,
            source,
            title_id,
        )

    async def async_calendar_details(self, viewing_id, source=None):
        from .journal_calendar import details

        return await self._call(self._search_read, details, viewing_id, source)

    async def async_list(
        self,
        *,
        query: str = "",
        viewing_status: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
        sort: str = "completed_at",
        descending: bool = True,
        fuzzy: bool = False,
        library_scope: tuple[str, str] | None = None,
    ) -> dict:
        """Return a bounded page bound to dataset revision and filters."""
        text(query, 500, empty=True)
        if viewing_status is not None:
            status(viewing_status)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise invalid("limit must be between 1 and 100")
        if cursor is not None:
            text(cursor, 4096)
        if (
            sort not in {"completed_at", "title"}
            or type(descending) is not bool
            or type(fuzzy) is not bool
        ):
            raise invalid("Invalid journal sort")
        return await self._call(
            self._list,
            query.casefold(),
            viewing_status,
            limit,
            cursor,
            sort,
            descending,
            fuzzy,
            library_scope,
        )

    def _list(
        self,
        query,
        viewing_status,
        limit,
        cursor,
        sort="completed_at",
        descending=True,
        fuzzy=False,
        library_scope=None,
    ) -> dict:
        return self._search_read(
            journal_store.list_viewings,
            query,
            viewing_status,
            limit,
            cursor,
            sort,
            descending,
            fuzzy,
            library_scope,
        )

    async def async_export(self, export_format: str) -> Path:
        """Create a snapshot; API callers must use async_export_snapshot instead."""
        if export_format not in ("json", "sqlite"):
            raise invalid("format must be json or sqlite")
        return await self._call(self._export, export_format)

    @asynccontextmanager
    async def async_export_snapshot(self, export_format: str) -> AsyncIterator[Path]:
        """Reserve one export through creation, streaming, and private cleanup."""
        if self._export_active or self._import_active:
            raise JournalError("busy", "Another journal export is in progress")
        self._export_active = True
        task = asyncio.create_task(self.async_export(export_format))
        try:
            yield await asyncio.shield(task)
        finally:
            try:
                await async_finish_cleanup(self._cleanup_export(task))
            finally:
                self._export_active = False

    @staticmethod
    async def _cleanup_export(task: asyncio.Task[Path]) -> None:
        try:
            path = await task
        except Exception, asyncio.CancelledError:
            # _export cleans up creation failures itself.
            return
        await asyncio.to_thread(path.unlink, missing_ok=True)

    def _export(self, export_format: str) -> Path:
        db = self._db()
        started = time.monotonic()
        with tempfile.NamedTemporaryFile(
            prefix="kaleidescape-",
            suffix=f".{export_format}",
            dir=self._export_directory,
            delete=False,
        ) as file:
            path = Path(file.name)
        try:
            if export_format == "sqlite":
                page_size = db.execute("PRAGMA page_size").fetchone()[0]

                def progress(_status: int, _remaining: int, total: int) -> None:
                    self._check_export(started, total * page_size)

                destination = sqlite3.connect(path)
                try:
                    db.backup(destination, pages=256, progress=progress)
                finally:
                    destination.close()
            else:
                metadata = {"format_version": 5, **self._info()}
                with path.open("w", encoding="utf-8") as output:
                    output.write(
                        '{"metadata": ' + json.dumps(metadata) + ', "viewings": ['
                    )
                    first = True
                    for row in db.execute(
                        "SELECT * FROM viewings ORDER BY started_at, id"
                    ):
                        if not first:
                            output.write(",")
                        json.dump(
                            {
                                **journal_store.record(row),
                                "manual_fields": json.loads(row["manual_fields"]),
                            },
                            output,
                            allow_nan=False,
                        )
                        first = False
                        self._check_export(started, output.tell())
                    output.write('], "sessions": [')
                    first = True
                    for row in db.execute(
                        "SELECT * FROM sessions ORDER BY started_at, id"
                    ):
                        if not first:
                            output.write(",")
                        json.dump(dict(row), output, allow_nan=False)
                        first = False
                        self._check_export(started, output.tell())
                    output.write('], "library": [')
                    first = True
                    for row in portable_titles(db):
                        if not first:
                            output.write(",")
                        json.dump(row, output, allow_nan=False)
                        first = False
                        self._check_export(started, output.tell())
                    output.write("]}")
            self._check_export(started, path.stat().st_size)
            return path
        except BaseException:
            path.unlink(missing_ok=True)
            raise

    @staticmethod
    def _check_export(started: float, size: int) -> None:
        if size > MAX_EXPORT_BYTES:
            raise JournalError("export_too_large", "Journal export exceeds size limit")
        if time.monotonic() - started > EXPORT_BUILD_SECONDS:
            raise JournalError("export_timeout", "Journal export exceeded time limit")

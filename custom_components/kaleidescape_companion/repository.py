"""Durable journal storage owned by a single dedicated SQLite worker."""

import asyncio
import base64
import hashlib
import json
import sqlite3
import tempfile
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any
from uuid import uuid4

from .journal import (
    JournalError,
    fields,
    identifier,
    invalid,
    status,
    text,
    validate_times,
)
from .migrations import SCHEMA_VERSION, UnsupportedSchemaError, migrate
from .recording import save_session

MAX_PENDING = 128


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
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            migrate(connection, self.path)
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA journal_mode = DELETE")
            connection.execute("PRAGMA synchronous = FULL")
            connection.execute("PRAGMA busy_timeout = 5000")
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
        }

    async def async_create(self, request_id: str, data: dict) -> dict:
        """Create an explicitly supplied viewing without guessing movie identity."""
        record = fields(data)
        validate_times(record)
        return await self._call(self._mutate, "create", identifier(request_id), record)

    async def async_update(
        self, request_id: str, viewing_id: str, expected_revision: int, patch: dict
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
            },
        )

    async def async_delete(
        self, request_id: str, viewing_id: str, expected_revision: int
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
        )

    @staticmethod
    def _validate_revision(revision: int) -> None:
        if type(revision) is not int or revision < 1:
            raise invalid("expected_revision must be a positive integer")

    def _mutate(self, operation: str, request_id: str, data: dict) -> dict:
        db = self._db()
        fingerprint = hashlib.sha256(
            json.dumps([operation, data], sort_keys=True, allow_nan=False).encode()
        ).hexdigest()
        if cached := db.execute(
            "SELECT fingerprint, response FROM requests WHERE request_id = ?",
            (request_id,),
        ).fetchone():
            if cached["fingerprint"] != fingerprint:
                raise JournalError(
                    "conflict", "Request UUID was used for different data"
                )
            return json.loads(cached["response"])
        if self._paused:
            raise JournalError("backup_in_progress", "Journal writes paused for backup")
        now = datetime.now(UTC).isoformat(timespec="microseconds")
        with db:
            if operation == "create":
                record = {
                    "id": str(uuid4()),
                    **data,
                    "origin": "manual",
                    "created_at": now,
                    "updated_at": now,
                    "revision": 1,
                    "deleted_at": None,
                    "completed_at": (data["ended_at"] or now)
                    if data["status"] == "completed"
                    else None,
                    "completion_reason": "manual"
                    if data["status"] == "completed"
                    else None,
                    "rule_version": None,
                }
                stored = {**record, "title_search": record["title"].casefold()}
                columns = ", ".join(stored)
                placeholders = ", ".join("?" for _ in stored)
                db.execute(
                    f"INSERT INTO viewings ({columns}) VALUES ({placeholders})",
                    tuple(stored.values()),
                )
            else:
                record = self._get(data["viewing_id"])
                if record["revision"] != data["expected_revision"]:
                    raise JournalError(
                        "conflict", "Viewing was changed; reload it first"
                    )
                patch = data.get("patch", {})
                record.update(patch)
                if "status" in patch:
                    record["completion_reason"] = (
                        "manual" if patch["status"] == "completed" else None
                    )
                    record["completed_at"] = (
                        (record["ended_at"] or now)
                        if patch["status"] == "completed"
                        else None
                    )
                validate_times(record)
                record["revision"] += 1
                record["updated_at"] = now
                if operation == "delete":
                    record["deleted_at"] = now
                stored = {**record, "title_search": record["title"].casefold()}
                corrections = json.loads(
                    db.execute(
                        "SELECT manual_fields FROM viewings WHERE id = ?",
                        (record["id"],),
                    ).fetchone()[0]
                )
                stored["manual_fields"] = json.dumps(
                    sorted(set(corrections) | patch.keys())
                )
                updates = ", ".join(f"{key} = ?" for key in stored if key != "id")
                db.execute(
                    f"UPDATE viewings SET {updates} WHERE id = ?",
                    (
                        *[value for key, value in stored.items() if key != "id"],
                        record["id"],
                    ),
                )
            db.execute("UPDATE schema_metadata SET revision = revision + 1")
            result = {
                "viewing": record,
                "revision": db.execute(
                    "SELECT revision FROM schema_metadata"
                ).fetchone()[0],
            }
            db.execute(
                "INSERT INTO requests VALUES (?, ?, ?)",
                (request_id, fingerprint, json.dumps(result, allow_nan=False)),
            )
        return result

    async def async_get(self, viewing_id: str) -> dict:
        """Retrieve one visible viewing."""
        return await self._call(self._get, identifier(viewing_id))

    def _get(self, viewing_id: str) -> dict:
        row = (
            self._db()
            .execute(
                "SELECT * FROM viewings WHERE id = ? AND deleted_at IS NULL",
                (viewing_id,),
            )
            .fetchone()
        )
        if row is None:
            raise JournalError("not_found", "Viewing does not exist")
        return self._record(row)

    @staticmethod
    def _record(row: sqlite3.Row) -> dict:
        result = dict(row)
        result.pop("title_search")
        result.pop("manual_fields", None)
        return result

    async def async_save_session(
        self, snapshot: dict, minimum_seconds: float, resume_hours: float
    ) -> str:
        """Persist a detached tracker checkpoint on the SQLite worker."""
        return await self._call(
            self._save_session, snapshot, minimum_seconds, resume_hours
        )

    def _save_session(
        self, snapshot: dict, minimum_seconds: float, resume_hours: float
    ) -> str:
        if self._paused:
            raise JournalError("backup_in_progress", "Journal writes paused for backup")
        return save_session(self._db(), snapshot, minimum_seconds, resume_hours)

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

    async def async_list(
        self,
        *,
        query: str = "",
        viewing_status: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> dict:
        """Return a bounded page bound to dataset revision and filters."""
        text(query, 500, empty=True)
        if viewing_status is not None:
            status(viewing_status)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise invalid("limit must be between 1 and 100")
        if cursor is not None:
            text(cursor, 4096)
        return await self._call(
            self._list, query.casefold(), viewing_status, limit, cursor
        )

    def _list(
        self, query: str, viewing_status: str | None, limit: int, cursor: str | None
    ) -> dict:
        db = self._db()
        meta = self._info()
        binding = [meta["dataset_id"], meta["revision"], query, viewing_status]
        predicates = ["deleted_at IS NULL", "instr(title_search, ?) > 0"]
        values: list[Any] = [query]
        if viewing_status:
            predicates.append("status = ?")
            values.append(viewing_status)
        if cursor:
            try:
                decoded = json.loads(
                    base64.b64decode(cursor, altchars=b"-_", validate=True)
                )
                if not isinstance(decoded, dict) or set(decoded) != {
                    "binding",
                    "after",
                }:
                    raise ValueError
                after = decoded["after"]
                if not isinstance(after, list) or len(after) != 2:
                    raise ValueError
                # Validate before passing values to SQLite, including nested values.
                timestamp_key = text(after[0], 64)
                record_key = identifier(after[1])
                if decoded["binding"] != binding:
                    raise JournalError(
                        "refresh_required", "Journal changed; restart pagination"
                    )
            except (ValueError, TypeError, KeyError, UnicodeError) as error:
                raise invalid("Invalid pagination cursor") from error
            predicates.append("(started_at, id) < (?, ?)")
            values.extend((timestamp_key, record_key))
        rows = db.execute(
            f"SELECT * FROM viewings WHERE {' AND '.join(predicates)} "
            "ORDER BY started_at DESC, id DESC LIMIT ?",
            (*values, limit + 1),
        ).fetchall()
        next_cursor = None
        if len(rows) > limit:
            last = rows[limit - 1]
            next_cursor = base64.urlsafe_b64encode(
                json.dumps(
                    {
                        "binding": binding,
                        "after": [last["started_at"], last["id"]],
                    }
                ).encode()
            ).decode()
        return {
            "dataset_id": meta["dataset_id"],
            "revision": meta["revision"],
            "items": [self._record(row) for row in rows[:limit]],
            "next_cursor": next_cursor,
        }

    async def async_export(self, export_format: str) -> Path:
        """Create a consistent temporary snapshot, streamed by the HTTP layer."""
        if export_format not in ("json", "sqlite"):
            raise invalid("format must be json or sqlite")
        return await self._call(self._export, export_format)

    def _export(self, export_format: str) -> Path:
        db = self._db()
        with tempfile.NamedTemporaryFile(
            prefix="kaleidescape-", suffix=f".{export_format}", delete=False
        ) as file:
            path = Path(file.name)
        try:
            if export_format == "sqlite":
                destination = sqlite3.connect(path)
                try:
                    db.backup(destination)
                finally:
                    destination.close()
            else:
                metadata = {"format_version": 2, **self._info()}
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
                                **self._record(row),
                                "manual_fields": json.loads(row["manual_fields"]),
                            },
                            output,
                            allow_nan=False,
                        )
                        first = False
                    output.write('], "sessions": [')
                    first = True
                    for row in db.execute(
                        "SELECT * FROM sessions ORDER BY started_at, id"
                    ):
                        if not first:
                            output.write(",")
                        json.dump(dict(row), output, allow_nan=False)
                        first = False
                    output.write("]}")
            return path
        except BaseException:
            path.unlink(missing_ok=True)
            raise

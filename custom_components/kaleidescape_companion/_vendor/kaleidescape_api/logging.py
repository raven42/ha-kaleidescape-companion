"""Content-free structured diagnostics. No wire, free-form messages or exceptions.

Sinks receive only immutable, validated events. Resource aliases use a private
HMAC key; neither original identifiers nor the key are included in events.
"""

import hashlib
import hmac
import inspect
import json
import secrets
import threading
from collections import deque
from collections.abc import Callable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from enum import StrEnum

from .log_messages import (
    MODULE,
    Reason,
    Stage,
    Trigger,
    classify,
    describe,
    source_location,
)


class Level(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Subsystem(StrEnum):
    TRANSPORT = "api.transport"
    PROTOCOL = "api.protocol"
    DATABASE = "database"
    CALENDAR = "calendar"
    LIBRARY = "library"
    ARTWORK = "artwork"
    METADATA = "metadata"
    PLAYBACK = "playback"
    OBSERVER = "observer"
    SETTINGS = "settings"
    IMPORT = "import"
    EXPORT = "export"
    BACKUP = "backup"
    APPLICATION = "application"


class Operation(StrEnum):
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    REQUEST = "request"
    READ = "read"
    WRITE = "write"
    SYNC = "sync"
    SCAN = "scan"
    SCRAPE = "scrape"
    DISCOVER = "discover"
    CONTROL = "control"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"
    EXPORT = "export"
    CONFIGURE = "configure"
    ACKNOWLEDGE = "acknowledge"
    VERIFY = "verify"
    RECORD = "record"
    CLEAR = "clear"
    PAUSE = "pause"
    RESUME = "resume"


class Outcome(StrEnum):
    STARTED = "started"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    UNCERTAIN = "uncertain"
    REJECTED = "rejected"
    RETRY = "retry"
    SKIPPED = "skipped"
    CHANGED = "changed"
    UNAVAILABLE = "unavailable"
    OVERFLOW = "overflow"
    MISMATCH = "mismatch"
    ACCEPTED = "accepted"


class Check(StrEnum):
    IDENTITY = "identity"
    INTERVAL = "interval"
    CONTENT = "content"
    BOUNDS = "bounds"
    CAPABILITY = "capability"
    CONFIGURATION = "configuration"
    REVISION = "revision"


class Failure(StrEnum):
    TIMEOUT = "timeout"
    CONNECTION = "connection"
    REJECTED = "rejected"
    VALIDATION = "validation"
    CANCELLED = "cancelled"
    PROVIDER = "provider"
    UNKNOWN = "unknown"
    UNSUPPORTED = "unsupported"
    MISSING_FIELD = "missing_field"
    INVALID_TYPE = "invalid_type"
    MISSING_ATTRIBUTE = "missing_attribute"
    AUTHORIZATION = "authorization"
    RATE_LIMIT = "rate_limit"
    STORAGE = "storage"
    CONFLICT = "conflict"


class Resource(StrEnum):
    USER = "user"
    DEVICE = "device"
    MOVIE = "movie"
    VIEWING = "viewing"
    SESSION = "session"
    REQUEST = "request"
    CALENDAR = "calendar"
    EVENT = "event"
    COLLECTION = "collection"
    PROVIDER = "provider"
    TABLE = "table"
    SETTINGS = "settings"


@dataclass(frozen=True)
class LogEvent:
    timestamp: str
    level: str
    logger: str
    operation: str
    outcome: str
    message: str
    file: str
    line: int
    reason: str | None = None
    stage: str | None = None
    actor: str | None = None
    related: str | None = None
    trace: str | None = None
    trigger: str | None = None
    revision: int | None = None
    resource: str | None = None
    target: str | None = None
    command: str | None = None
    failure: str | None = None
    check: str | None = None
    count: int | None = None
    status: int | None = None
    attempt: int | None = None
    elapsed_ms: int | None = None
    # Comparisons expose no underlying content.
    title_match: bool | None = None
    interval_match: bool | None = None
    description_match: bool | None = None

    def as_dict(self) -> dict:
        return {key: value for key, value in asdict(self).items() if value is not None}


Sink = Callable[[LogEvent], None]


class SafeLogger:
    """Bounded in-memory diagnostics with optional sanitized-event sinks.

    register returns an unregister callback. Sinks must be fast/nonblocking;
    exceptions are counted and isolated, never formatted or re-logged. Level
    changes apply immediately to this logger and every client sharing it.
    """

    def __init__(
        self,
        *,
        level: Level = Level.INFO,
        capacity: int = 256,
        key: bytes | None = None,
        source_packages: tuple[str, ...] = ("kaleidescape_api",),
    ) -> None:
        if type(capacity) is not int or not 1 <= capacity <= 4096:
            raise ValueError("Invalid log capacity")
        if key is not None and (type(key) is not bytes or len(key) != 32):
            raise ValueError("Log key must contain 32 private bytes")
        if (
            not isinstance(source_packages, tuple)
            or not 1 <= len(source_packages) <= 16
            or any(
                type(p) is not str or len(p) > 200 or not MODULE.fullmatch(p)
                for p in source_packages
            )
        ):
            raise ValueError("Invalid diagnostic source packages")
        self._source_packages = source_packages
        # Contexts contain sanitized aliases/codes only, never original identities.
        self._context: ContextVar[dict | None] = ContextVar(
            "diagnostic_context", default=None
        )
        self._key = key or secrets.token_bytes(32)
        self._lock = threading.RLock()
        self._dispatch = threading.local()
        self._level = Level(level)
        self._events: deque[LogEvent] = deque(maxlen=capacity)
        self._sinks: list[Sink] = []
        self.sink_failures = 0

    @property
    def level(self) -> Level:
        return self._level

    def set_level(self, level: Level) -> None:
        self._level = Level(level)

    def alias(self, kind: Resource, value: str) -> str:
        if not isinstance(kind, Resource) or not isinstance(value, str):
            raise ValueError("Resource requires a typed kind and string identity")
        code = hmac.new(
            self._key,
            (kind.value + "\0" + value).encode("utf-8", "surrogatepass"),
            hashlib.sha256,
        ).hexdigest()[:24]
        return kind.value + "-" + code

    def _links(
        self,
        *,
        actor=None,
        resource=None,
        related=None,
        target=None,
        trace=None,
        trigger=None,
        revision=None,
    ):
        result = {}
        for key, value in (
            ("actor", actor),
            ("resource", resource),
            ("related", related),
            ("target", target),
            ("trace", trace),
        ):
            if value is not None:
                result[key] = self.alias(*value)
        if trigger is not None:
            if not isinstance(trigger, Trigger):
                raise ValueError("Diagnostic trigger must be a catalog enum")
            result["trigger"] = trigger.value
        if revision is not None:
            if type(revision) is not int or not 0 <= revision <= 10**12:
                raise ValueError("Invalid diagnostic revision")
            result["revision"] = revision
        return result

    @contextmanager
    def context(
        self,
        *,
        actor: tuple[Resource, str] | None = None,
        resource: tuple[Resource, str] | None = None,
        related: tuple[Resource, str] | None = None,
        target: tuple[Resource, str] | None = None,
        trace: tuple[Resource, str] | None = None,
        trigger: Trigger | None = None,
        revision: int | None = None,
        inherit: bool = True,
    ):
        """Bind safe relationships to nested emissions; restore on every exit.

        Async tasks inherit their creation context. Thread executors require the
        caller to propagate contextvars.copy_context(). Use inherit=False for a
        fresh background job so an old request is not attributed to new work.
        """
        fields = {
            **((self._context.get() or {}) if inherit else {}),
            **self._links(
                actor=actor,
                resource=resource,
                related=related,
                target=target,
                trace=trace,
                trigger=trigger,
                revision=revision,
            ),
        }
        token = self._context.set(fields)
        try:
            yield
        finally:
            self._context.reset(token)

    def register(self, sink: Sink) -> Callable[[], None]:
        if (
            not callable(sink)
            or inspect.iscoroutinefunction(sink)
            or inspect.iscoroutinefunction(type(sink).__call__)
        ):
            raise TypeError("Log sink must be callable")
        with self._lock:
            if len(self._sinks) >= 32:
                raise ValueError("Log sink limit reached")
            self._sinks.append(sink)

        def unregister() -> None:
            with self._lock:
                if sink in self._sinks:
                    self._sinks.remove(sink)

        return unregister

    def snapshot(self) -> tuple[LogEvent, ...]:
        with self._lock:
            return tuple(self._events)

    def emit(
        self,
        subsystem: Subsystem,
        operation: Operation,
        outcome: Outcome,
        *,
        level: Level = Level.INFO,
        resource: tuple[Resource, str] | None = None,
        target: tuple[Resource, str] | None = None,
        actor: tuple[Resource, str] | None = None,
        related: tuple[Resource, str] | None = None,
        trace: tuple[Resource, str] | None = None,
        trigger: Trigger | None = None,
        revision: int | None = None,
        command: str | None = None,
        failure: Failure | None = None,
        check: Check | None = None,
        reason: Reason | None = None,
        stage: Stage | None = None,
        stacklevel: int = 1,
        count: int | None = None,
        status: int | None = None,
        attempt: int | None = None,
        elapsed_ms: int | None = None,
        title_match: bool | None = None,
        interval_match: bool | None = None,
        description_match: bool | None = None,
    ) -> None:
        if not (
            isinstance(subsystem, Subsystem)
            and isinstance(operation, Operation)
            and isinstance(outcome, Outcome)
            and isinstance(level, Level)
        ):
            raise ValueError("Log labels must be catalog enums")
        if list(Level).index(level) < list(Level).index(self._level):
            return
        from .commands import COMMANDS

        if command is not None and (
            type(command) is not str or command not in {*COMMANDS, "PLAY_MOVIE"}
        ):
            raise ValueError("Diagnostic command must belong to the command catalog")
        if failure is not None and not isinstance(failure, Failure):
            raise ValueError("Diagnostic failure must be a catalog enum")
        if check is not None and not isinstance(check, Check):
            raise ValueError("Diagnostic check must be a catalog enum")
        if reason is not None and not isinstance(reason, Reason):
            raise ValueError("Diagnostic reason must be a catalog enum")
        if stage is not None and not isinstance(stage, Stage):
            raise ValueError("Diagnostic stage must be a catalog enum")
        if type(stacklevel) is not int or not 1 <= stacklevel <= 8:
            raise ValueError("Invalid diagnostic stack level")
        numbers = (count, status, attempt, elapsed_ms)
        if any(
            n is not None and (type(n) is not int or not 0 <= n <= 10**12)
            for n in numbers
        ):
            raise ValueError("Invalid diagnostic measurement")
        if any(
            n is not None and type(n) is not bool
            for n in (title_match, interval_match, description_match)
        ):
            raise ValueError("Invalid comparison result")
        file, line = source_location(self._source_packages, stacklevel)
        links = {
            **(self._context.get() or {}),
            **self._links(
                actor=actor,
                resource=resource,
                related=related,
                target=target,
                trace=trace,
                trigger=trigger,
                revision=revision,
            ),
        }
        event = LogEvent(
            timestamp=datetime.now(UTC).isoformat(),
            level=level.value,
            logger=subsystem.value,
            operation=operation.value,
            outcome=outcome.value,
            message=describe(
                {
                    "logger": subsystem.value,
                    "operation": operation.value,
                    "outcome": outcome.value,
                    "failure": failure.value if failure else None,
                    "check": check.value if check else None,
                    "reason": reason.value if reason else None,
                    "stage": stage.value if stage else None,
                    "status": status,
                    "count": count,
                    "attempt": attempt,
                    "elapsed_ms": elapsed_ms,
                    "title_match": title_match,
                    "interval_match": interval_match,
                    "description_match": description_match,
                    **links,
                }
            ),
            file=file,
            line=line,
            reason=reason.value if reason else None,
            stage=stage.value if stage else None,
            **links,
            command=command,
            failure=failure.value if failure else None,
            check=check.value if check else None,
            count=count,
            status=status,
            attempt=attempt,
            elapsed_ms=elapsed_ms,
            title_match=title_match,
            interval_match=interval_match,
            description_match=description_match,
        )
        with self._lock:
            self._events.append(event)
            sinks = tuple(self._sinks)
        if getattr(self._dispatch, "active", False):
            with self._lock:
                self.sink_failures += 1
            return
        self._dispatch.active = True
        try:
            for sink in sinks:
                try:
                    sink(event)
                except Exception:
                    with self._lock:
                        self.sink_failures += 1
        finally:
            self._dispatch.active = False

    def emit_failure(
        self,
        subsystem: Subsystem,
        operation: Operation,
        error: BaseException,
        *,
        level: Level = Level.ERROR,
        resource: tuple[Resource, str] | None = None,
        target: tuple[Resource, str] | None = None,
        check: Check | None = None,
        reason: Reason | None = None,
        stage: Stage | None = None,
        count: int | None = None,
    ) -> None:
        """Emit a classified cause without exception text, arguments or traceback."""
        failure, status = classify(error)
        self.emit(
            subsystem,
            operation,
            Outcome.FAILED,
            level=level,
            resource=resource,
            target=target,
            check=check,
            reason=reason,
            stage=stage,
            failure=Failure(failure),
            status=status,
            count=count,
            stacklevel=2,
        )


def python_logging_sink(logger) -> Sink:
    """Adapt to logging.Logger; never forwards raw protocol LogRecords/exceptions."""

    def sink(event: LogEvent) -> None:
        logger.log(
            {
                Level.DEBUG: 10,
                Level.INFO: 20,
                Level.WARNING: 30,
                Level.ERROR: 40,
                Level.CRITICAL: 50,
            }[Level(event.level)],
            "%s",
            json.dumps(event.as_dict(), sort_keys=True),
        )

    return sink

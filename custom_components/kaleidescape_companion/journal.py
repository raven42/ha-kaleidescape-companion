"""Validation for explicit journal records, independent of HA and SQLite."""

import math
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

VIEWING_FIELDS = frozenset(
    {
        "title",
        "started_at",
        "ended_at",
        "duration_seconds",
        "watched_seconds",
        "status",
        "source_id",
        "player_id",
        "raw_content_id",
        "notes",
    }
)


class JournalError(Exception):
    """A safe, public API error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def invalid(message: str) -> JournalError:
    """Build a validation error without including private input data."""
    return JournalError("invalid_request", message)


def identifier(value: Any) -> str:
    """Canonicalize a request or record UUID."""
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError) as error:
        raise invalid("Expected a UUID") from error


def text(value: Any, maximum: int, *, empty: bool = False) -> str:
    """Require bounded text, allowing empty notes but no empty identities."""
    if not isinstance(value, str) or len(value) > maximum:
        raise invalid(f"Expected text of at most {maximum} characters")
    if not empty and not value.strip():
        raise invalid("Text must not be blank")
    try:
        value.encode("utf-8")
    except UnicodeError as error:
        raise invalid("Text must contain valid Unicode") from error
    return value


def seconds(value: Any) -> float:
    """Reject booleans, negative values, and non-finite numeric inputs."""
    if (
        type(value) not in (int, float)
        or not 0 <= value <= 1_000_000_000
        or not math.isfinite(value)
    ):
        raise invalid("Seconds must be a finite number between 0 and 1000000000")
    return float(value)


def timestamp(value: Any) -> str:
    """Require an explicit timezone and store a canonical UTC timestamp."""
    try:
        parsed = datetime.fromisoformat(text(value, 64))
        if parsed.utcoffset() is None:
            raise ValueError
        return parsed.astimezone(UTC).isoformat(timespec="microseconds")
    except (ValueError, OverflowError) as error:
        raise invalid("Expected an ISO timestamp with timezone") from error


def fields(data: Any, *, partial: bool = False) -> dict[str, Any]:
    """Validate create data or a correction patch; reject unknown fields."""
    validators = {
        "title": lambda value: text(value, 500),
        "started_at": timestamp,
        "ended_at": lambda value: None if value is None else timestamp(value),
        "duration_seconds": lambda value: None if value is None else seconds(value),
        "watched_seconds": seconds,
        "status": status,
        "source_id": lambda value: None if value is None else text(value, 255),
        "player_id": lambda value: None if value is None else text(value, 255),
        "raw_content_id": lambda value: None if value is None else text(value, 255),
        "notes": lambda value: text(value, 10000, empty=True),
    }
    if not isinstance(data, dict) or not data or data.keys() - validators.keys():
        raise invalid("Expected journal fields with no unknown properties")
    if not partial and not {"title", "started_at"} <= data.keys():
        raise invalid("title and started_at are required")
    result = {key: validators[key](value) for key, value in data.items()}
    if not partial:
        result = {
            "ended_at": None,
            "duration_seconds": None,
            "watched_seconds": 0.0,
            "status": "partial",
            "source_id": None,
            "player_id": None,
            "raw_content_id": None,
            "notes": "",
            **result,
        }
    return result


def status(value: Any) -> str:
    """Validate explicit manual completion status."""
    if value not in ("partial", "completed"):
        raise invalid("Status must be partial or completed")
    return value


def validate_times(record: dict[str, Any]) -> None:
    """Validate cross-field invariants after applying a correction."""
    if record["ended_at"] and record["ended_at"] < record["started_at"]:
        raise invalid("ended_at must not be earlier than started_at")

"""Ordered, transactional journal schema migrations."""

import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

SCHEMA_VERSION = 2

MIGRATIONS = {
    1: (
        """CREATE TABLE schema_metadata (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            dataset_id TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
        )""",
        """CREATE TABLE viewings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            title_search TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds REAL CHECK (duration_seconds >= 0),
            watched_seconds REAL NOT NULL CHECK (watched_seconds >= 0),
            status TEXT NOT NULL CHECK (status IN ('partial', 'completed')),
            source_id TEXT,
            player_id TEXT,
            raw_content_id TEXT,
            notes TEXT NOT NULL,
            origin TEXT NOT NULL CHECK (origin = 'manual'),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            deleted_at TEXT
        )""",
        """CREATE INDEX viewings_recent ON viewings
            (started_at DESC, id DESC) WHERE deleted_at IS NULL""",
        """CREATE INDEX viewings_status ON viewings
            (status, started_at DESC, id DESC) WHERE deleted_at IS NULL""",
        """CREATE TABLE requests (
            request_id TEXT PRIMARY KEY,
            fingerprint TEXT NOT NULL,
            response TEXT NOT NULL
        )""",
    ),
}

# Rebuild the original table to broaden its origin CHECK without losing v1 data.
MIGRATIONS[2] = (
    MIGRATIONS[1][1]
    .replace("CREATE TABLE viewings", "CREATE TABLE viewings_v2")
    .replace("origin = 'manual'", "origin IN ('manual', 'observed')"),
    "INSERT INTO viewings_v2 SELECT * FROM viewings",
    "DROP TABLE viewings",
    "ALTER TABLE viewings_v2 RENAME TO viewings",
    MIGRATIONS[1][2],
    MIGRATIONS[1][3],
    "ALTER TABLE viewings ADD COLUMN manual_fields TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE viewings ADD COLUMN completed_at TEXT",
    "ALTER TABLE viewings ADD COLUMN completion_reason TEXT",
    "ALTER TABLE viewings ADD COLUMN rule_version INTEGER",
    """UPDATE viewings SET completed_at = coalesce(ended_at, updated_at),
        completion_reason = 'manual' WHERE status = 'completed'""",
    """CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        viewing_id TEXT NOT NULL REFERENCES viewings(id),
        player_id TEXT NOT NULL,
        raw_content_id TEXT NOT NULL,
        title TEXT NOT NULL,
        duration_seconds REAL,
        started_at TEXT NOT NULL,
        last_observed_at TEXT NOT NULL,
        boot_id TEXT NOT NULL,
        watched_seconds REAL NOT NULL CHECK (watched_seconds >= 0),
        credits_seen INTEGER NOT NULL,
        credits_confirmed INTEGER NOT NULL,
        credits_at TEXT,
        credits_watched_seconds REAL NOT NULL,
        closed_at TEXT,
        end_reason TEXT,
        revision INTEGER NOT NULL CHECK (revision > 0),
        gap_count INTEGER NOT NULL CHECK (gap_count >= 0)
    )""",
    "CREATE INDEX sessions_viewing ON sessions(viewing_id)",
    "CREATE INDEX sessions_identity ON sessions"
    "(player_id, raw_content_id, last_observed_at)",
    "CREATE UNIQUE INDEX sessions_open ON sessions(player_id) WHERE closed_at IS NULL",
)


class UnsupportedSchemaError(Exception):
    """The database cannot safely be opened by this release."""


def migrate(connection: sqlite3.Connection, path: Path) -> None:
    """Upgrade atomically; retain a consistent copy before existing DB upgrades."""
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version > SCHEMA_VERSION:
        raise UnsupportedSchemaError("Journal schema is newer than this integration")
    if version == SCHEMA_VERSION:
        return
    tables = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
    if version == 0 and tables:
        raise UnsupportedSchemaError("Unrecognized journal database; left unchanged")
    if version:
        backup = path.with_name(f"{path.name}.v{version}.{uuid4().hex}.bak")
        with closing(sqlite3.connect(backup)) as destination:
            connection.backup(destination)
    connection.execute("BEGIN IMMEDIATE")
    try:
        for target in range(version + 1, SCHEMA_VERSION + 1):
            for statement in MIGRATIONS[target]:
                connection.execute(statement)
            if target == 1:
                connection.execute(
                    "INSERT INTO schema_metadata VALUES (1, ?, ?, 0)",
                    (str(uuid4()), datetime.now(UTC).isoformat()),
                )
            connection.execute(f"PRAGMA user_version = {target}")
        connection.commit()
    except BaseException:
        connection.rollback()
        raise

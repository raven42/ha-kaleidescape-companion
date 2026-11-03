"""Ordered, transactional journal schema migrations."""

import logging
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from ..security import private_file

SCHEMA_VERSION = 23
_LOGGER = logging.getLogger(__name__)

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

# Historical request actors are unknown; do not fabricate attribution.
MIGRATIONS[3] = (
    """CREATE TABLE manual_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        viewing_id TEXT NOT NULL REFERENCES viewings(id),
        viewing_revision INTEGER NOT NULL CHECK (viewing_revision > 0),
        dataset_revision INTEGER NOT NULL CHECK (dataset_revision > 0),
        occurred_at TEXT NOT NULL
    )""",
)

# Permanent purge receipts deliberately contain no viewing identities/content.
MIGRATIONS[4] = (
    """CREATE TABLE maintenance_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT,
        operation TEXT NOT NULL CHECK (operation = 'purge'),
        purged_count INTEGER NOT NULL CHECK (purged_count >= 0),
        dataset_revision INTEGER NOT NULL CHECK (dataset_revision > 0),
        occurred_at TEXT NOT NULL
    )""",
)


class UnsupportedSchemaError(Exception):
    """The database cannot safely be opened by this release."""


MIGRATIONS[5] = (
    """CREATE TABLE import_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT,
        imported_count INTEGER NOT NULL CHECK (imported_count >= 0),
        skipped_count INTEGER NOT NULL CHECK (skipped_count >= 0),
        dataset_revision INTEGER NOT NULL CHECK (dataset_revision > 0),
        occurred_at TEXT NOT NULL
    )""",
)


MIGRATIONS[6] = (
    """CREATE TABLE library_sources (
        id TEXT PRIMARY KEY, origin TEXT NOT NULL, first_seen TEXT NOT NULL,
        last_synced_at TEXT, collections_synced_at TEXT,
        revision INTEGER NOT NULL DEFAULT 0
    )""",
    """CREATE TABLE library_titles (
        id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES library_sources(id),
        source_handle TEXT NOT NULL, source_group TEXT NOT NULL,
        title TEXT NOT NULL, title_search TEXT NOT NULL, base_hash TEXT NOT NULL,
        data TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
        available INTEGER NOT NULL DEFAULT 1, fetched_at TEXT, metadata_synced_at TEXT,
        artwork_path TEXT, artwork_key TEXT,
        UNIQUE(source_id, source_handle)
    )""",
    """CREATE INDEX library_title_names ON library_titles(source_id, available,
        title_search, id)""",
    """CREATE TABLE library_collections (
        source_id TEXT NOT NULL REFERENCES library_sources(id), name TEXT NOT NULL,
        first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
        available INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY(source_id, name)
    )""",
    """CREATE TABLE library_memberships (
        source_id TEXT NOT NULL, title_id TEXT NOT NULL REFERENCES library_titles(id),
        collection TEXT NOT NULL,
        PRIMARY KEY(title_id, collection),
        FOREIGN KEY(source_id, collection)
            REFERENCES library_collections(source_id, name)
    )""",
    """CREATE TABLE library_artwork (
        cache_key TEXT PRIMARY KEY, content_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL, stored_at TEXT NOT NULL
    )""",
)


MIGRATIONS[7] = (
    """CREATE TABLE library_purchase_dates (
        title_id TEXT PRIMARY KEY REFERENCES library_titles(id),
        purchased_on TEXT NOT NULL, imported_at TEXT NOT NULL
    )""",
    """CREATE TABLE library_purchase_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT, updated_count INTEGER NOT NULL,
        source_revision INTEGER NOT NULL, occurred_at TEXT NOT NULL
    )""",
)


MIGRATIONS[8] = (
    """CREATE TABLE library_collection_intents (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        source_id TEXT NOT NULL REFERENCES library_sources(id),
        title_id TEXT REFERENCES library_titles(id), collection TEXT,
        expected_members_hash TEXT, status TEXT NOT NULL
            CHECK(status IN ('uncertain','confirmed','abandoned')),
        actor_id TEXT NOT NULL, acknowledged_by TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )""",
    """CREATE UNIQUE INDEX library_collection_pending
        ON library_collection_intents(source_id) WHERE status='uncertain'""",
)


# A purchase date belongs to a title version. Preserve historical import actors
# and their original source revisions while consolidating the one-off audit.
MIGRATIONS[9] = (
    "ALTER TABLE library_titles ADD COLUMN purchased_on TEXT",
    "ALTER TABLE library_titles ADD COLUMN purchase_imported_at TEXT",
    """UPDATE library_titles SET
        purchased_on=(SELECT purchased_on FROM library_purchase_dates
            WHERE title_id=id),
        purchase_imported_at=(SELECT imported_at FROM library_purchase_dates
            WHERE title_id=id)
        WHERE id IN (SELECT title_id FROM library_purchase_dates)""",
    "DROP TABLE library_purchase_dates",
    "ALTER TABLE import_audit RENAME TO import_audit_old",
    """CREATE TABLE import_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id), actor_id TEXT,
        imported_count INTEGER NOT NULL CHECK(imported_count>=0),
        skipped_count INTEGER NOT NULL CHECK(skipped_count>=0),
        dataset_revision INTEGER, occurred_at TEXT NOT NULL,
        updated_count INTEGER NOT NULL DEFAULT 0 CHECK(updated_count>=0),
        kind TEXT NOT NULL DEFAULT 'merge', source_revision INTEGER
    )""",
    """INSERT INTO import_audit
        SELECT *,0,'viewings',NULL FROM import_audit_old""",
    """INSERT INTO import_audit
        SELECT request_id,actor_id,0,0,NULL,occurred_at,updated_count,
        'purchase_dates',source_revision FROM library_purchase_audit""",
    "DROP TABLE import_audit_old",
    "DROP TABLE library_purchase_audit",
)


# A bounded last-addition batch is source sync state, not another title table.
MIGRATIONS[10] = (
    """ALTER TABLE library_sources ADD COLUMN recently_added_count INTEGER
        NOT NULL DEFAULT 0 CHECK(recently_added_count>=0)""",
    """ALTER TABLE library_sources ADD COLUMN recently_added_movies TEXT
        NOT NULL DEFAULT '[]'""",
    "ALTER TABLE library_sources ADD COLUMN recently_added_at TEXT",
)


MIGRATIONS[11] = (
    """CREATE TABLE settings (
        owner TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision>0),updated_at TEXT NOT NULL,
        PRIMARY KEY(owner,key))""",
    "ALTER TABLE library_sources ADD COLUMN recently_added_batch TEXT",
    "ALTER TABLE library_titles ADD COLUMN addition_batch TEXT",
    "CREATE INDEX library_title_groups ON library_titles(source_id,source_group)",
)


MIGRATIONS[12] = (
    "ALTER TABLE schema_metadata ADD COLUMN settings_revision "
    "INTEGER NOT NULL DEFAULT 0",
    "UPDATE schema_metadata SET settings_revision="
    "(SELECT coalesce(sum(revision),0) FROM settings)",
    """CREATE TABLE database_audit (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id), actor_id TEXT,
        operation TEXT NOT NULL, table_name TEXT NOT NULL,
        affected_count INTEGER NOT NULL,
        field_names TEXT NOT NULL, dataset_revision INTEGER NOT NULL,
        occurred_at TEXT NOT NULL)""",
)


MIGRATIONS[13] = (
    "ALTER TABLE viewings ADD COLUMN library_title_id TEXT",
    "ALTER TABLE viewings ADD COLUMN library_metadata TEXT NOT NULL DEFAULT '{}'",
    """CREATE TABLE calendar_publications (
        viewing_id TEXT PRIMARY KEY, target TEXT NOT NULL,
        config_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN
            ('queued','sending','sent','uncertain','cancelled')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""",
    "CREATE INDEX calendar_queue ON calendar_publications(state,created_at)",
    """CREATE INDEX viewings_completed ON viewings
        (status,coalesce(ended_at,completed_at,started_at),id)
        WHERE deleted_at IS NULL""",
)


MIGRATIONS[14] = (
    """CREATE TABLE calendar_sync_jobs (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT NOT NULL,
        target TEXT NOT NULL,config_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,finished_at TEXT)""",
    """CREATE TABLE calendar_sync_items (
        request_id TEXT NOT NULL REFERENCES calendar_sync_jobs(request_id),
        viewing_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN
        ('queued','checking','sending','created','matched','failed','uncertain','cancelled','skipped')),
        updated_at TEXT NOT NULL,PRIMARY KEY(request_id,viewing_id))""",
    "CREATE INDEX calendar_sync_pending ON calendar_sync_items(request_id,state)",
)


MIGRATIONS[15] = (
    """CREATE TABLE library_purchases (
        id TEXT PRIMARY KEY,title TEXT NOT NULL,title_search TEXT NOT NULL,
        purchased_on TEXT NOT NULL,purchase_price TEXT,retail_price TEXT,
        order_id TEXT,href TEXT,source_id TEXT REFERENCES library_sources(id),
        source_group TEXT,imported_at TEXT NOT NULL,
        CHECK((source_id IS NULL) = (source_group IS NULL)))""",
    "CREATE INDEX library_purchase_groups ON library_purchases"
    "(source_id,source_group,purchased_on)",
    "CREATE INDEX library_purchase_names ON library_purchases"
    "(title_search,purchased_on,id)",
    "CREATE INDEX library_purchase_matches ON library_titles"
    "(title_search,available,source_id,source_group)",
)


MIGRATIONS[16] = (
    "ALTER TABLE library_titles RENAME TO library",
    "ALTER TABLE library ADD COLUMN purchase_history TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE library ADD COLUMN purchase_price TEXT",
    "ALTER TABLE library ADD COLUMN retail_price TEXT",
    "ALTER TABLE library ADD COLUMN order_id TEXT",
    "ALTER TABLE library ADD COLUMN href TEXT",
    "ALTER TABLE library ADD COLUMN purchase_match_pending INTEGER NOT NULL "
    "DEFAULT 0 CHECK(purchase_match_pending IN (0,1))",
)


MIGRATIONS[17] = (
    "CREATE INDEX viewings_library_title ON viewings(library_title_id) "
    "WHERE deleted_at IS NULL",
)


MIGRATIONS[18] = (
    """CREATE TABLE playback_controls (
        request_id TEXT PRIMARY KEY REFERENCES requests(request_id),
        actor_id TEXT NOT NULL,player_serial TEXT NOT NULL,operation TEXT NOT NULL,
        status TEXT NOT NULL CHECK(
            status IN ('sending','finished','uncertain','reviewed')),
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,reviewed_by TEXT
    )""",
    """CREATE UNIQUE INDEX playback_controls_pending ON playback_controls(player_serial)
        WHERE status IN ('sending','uncertain')""",
)


MIGRATIONS[19] = (
    "ALTER TABLE library ADD COLUMN enrichment TEXT NOT NULL DEFAULT '{}'",
)


MIGRATIONS[20] = (
    """CREATE TABLE calendar_managed_events (
        scope TEXT NOT NULL,viewing_id TEXT NOT NULL,uid TEXT NOT NULL,
        PRIMARY KEY(scope,viewing_id),UNIQUE(scope,uid))""",
    """CREATE TABLE calendar_reconcile_candidates (
        scope TEXT NOT NULL,uid TEXT NOT NULL,digest TEXT NOT NULL,
        signature TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,
        observations INTEGER NOT NULL,PRIMARY KEY(scope,uid))""",
    """CREATE TABLE calendar_reconcile_intents (
        request_id TEXT PRIMARY KEY,scope TEXT NOT NULL,operation TEXT NOT NULL,
        viewing_id TEXT,uid TEXT,digest TEXT NOT NULL,state TEXT NOT NULL,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,reviewed_by TEXT)""",
    "CREATE INDEX calendar_reconcile_pending "
    "ON calendar_reconcile_intents(scope,state)",
)


# Keep the migration slot so schema upgrades remain ordered.
MIGRATIONS[21] = ()


MIGRATIONS[22] = ("ALTER TABLE library ADD COLUMN sort_title TEXT",)

# Remove tables created by older schema 21 releases.
MIGRATIONS[23] = (
    "DROP TABLE IF EXISTS operation_logs",
    "DROP TABLE IF EXISTS log_state",
)


def migrate(connection: sqlite3.Connection, path: Path) -> None:
    """Upgrade atomically; retain a consistent copy before existing DB upgrades."""
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version > SCHEMA_VERSION:
        raise UnsupportedSchemaError("Journal schema is newer than this integration")
    if version == SCHEMA_VERSION:
        return
    _LOGGER.info(
        "Journal schema migration started: version %s to %s", version, SCHEMA_VERSION
    )
    tables = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
    if version == 0 and tables:
        raise UnsupportedSchemaError("Unrecognized journal database; left unchanged")
    if version:
        backup = path.with_name(f"{path.name}.v{version}.{uuid4().hex}.bak")
        private_file(backup, create=True)
        with closing(sqlite3.connect(backup)) as destination:
            connection.backup(destination)
    connection.execute("BEGIN IMMEDIATE")
    try:
        for target in range(version + 1, SCHEMA_VERSION + 1):
            for statement in MIGRATIONS[target]:
                connection.execute(statement)
            if target == 16:
                from .library import consolidate

                consolidate(connection)
            if target == 17:
                from .journal import link_viewings

                link_viewings(connection)
            if target == 1:
                connection.execute(
                    "INSERT INTO schema_metadata VALUES (1, ?, ?, 0)",
                    (str(uuid4()), datetime.now(UTC).isoformat()),
                )
            connection.execute(f"PRAGMA user_version = {target}")
        connection.commit()
        _LOGGER.info("Journal schema migration committed: version %s", SCHEMA_VERSION)
    except BaseException:
        connection.rollback()
        _LOGGER.debug("Journal schema migration rolled back")
        raise

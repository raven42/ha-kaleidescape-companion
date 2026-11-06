# Journal storage and playback recording

Status: implemented. API version is `1`; SQLite schema is `27` and JSON export
format is `5`. This document owns persistent journal behavior and observation.
[Data management](design-data-management.md) owns administrative
editing/imports; [calendar](design-calendar.md) owns event delivery;
[controls](design-playback-controls.md) owns commands. Recording is independent
of those optional network features.

## Setup and storage

One household config entry owns
`<HA config>/kaleidescape_companion/journal.sqlite3`. The development launcher
uses `.ha-dev/kaleidescape_companion/journal.sqlite3`. Unload, restart and entry
removal retain data; adding the integration again reattaches the dataset.

All SQLite work runs on a dedicated worker outside HA's event loop, using
rollback-journal mode and full synchronization. At most 128 operations can wait;
overload reports `busy`. Accepted writes drain even after the requesting client
disconnects. Shutdown closes the connection on its owning worker.

Content changes commit rows, dataset revision and retry result together.
Actor/request/payload-bound UUID retries return the original result without
reapplying a mutation. Expected revisions reject stale edits. UI settings have
separate revisions and do not invalidate journal/catalog pages. Protected audit
records contain operation/actor/revision metadata rather than duplicate movie
content. Raw source identities are retained exactly; titles do not establish
identity.

Private storage uses `0700` directories and `0600` files with owned-path checks.
Schema migration creates a private pre-migration backup and applies supported
upgrades transactionally. A newer unsupported schema fails setup instead of
being overwritten. SQLite page growth is capped at 256 MiB, with Library writes
limited at 192 MiB to preserve journal headroom. An already larger database can
remain readable but cannot grow. Backups/snapshots/artwork are outside that cap;
there is no automatic history purge or filesystem-wide quota.

## Data responsibilities

| Tables                                                                                   | Responsibility                                                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `viewings`, `sessions`                                                                   | Household viewing snapshots and separate playback evidence; rewatches/resumptions remain distinct from catalog versions |
| `schema_metadata`, `requests`                                                            | Dataset identity, revisions and durable mutation deduplication                                                          |
| `manual_audit`, `maintenance_audit`, `import_audit`, `database_audit`                    | Attribution and operation/count/field metadata with distinct retention rules                                            |
| `library`, `library_sources`                                                             | Source/version metadata, catalog generation and freshness                                                               |
| `purchase_records`                                                                       | Separate purchase history, including unmatched receipts and validated Library links                                     |
| `library_collections`, `library_memberships`, `library_artwork`                          | Membership relations and file-cache index; image bytes are outside SQLite                                               |
| `settings`                                                                               | Personal/display-profile preferences and shared UI defaults                                                             |
| `library_collection_intents`, `playback_controls`                                        | Durable external command outcomes and uncertainty barriers                                                              |
| `calendar_publications`                                                                  | One-attempt completion publishing state                                                                                 |
| `calendar_sync_jobs`, `calendar_sync_items`                                              | Explicit historical export progress and receipts                                                                        |
| `calendar_managed_events`, `calendar_reconcile_candidates`, `calendar_reconcile_intents` | Dedicated-calendar links, delayed cleanup and Full Sync intents                                                         |

A version's descriptive metadata remains bounded JSON on that row; purchases,
memberships, sessions and recovery records are separate relationships. Purchase
history is projected from `purchase_records`, not embedded in Library JSON. Do
not flatten them into repeated movie rows or import operational receipts as
movie metadata. Schema history lives in the migration code; this design
describes the current model rather than a chronological list of every schema
change.

## Automatic tracking

Tracking defaults off. Select one existing Kaleidescape media player, its exact
play-status sensor and its media-location sensor in the native Configure flow or
Companion Settings. They must be different entities of the correct domains.
Registered source identities survive entity renames; replacing the player gives
it a new internal identity. Registered sources may be offline during setup.
Unregistered selections fall back to their entity IDs.

Observation subscribes to HA states and sends no device commands or extra TCP
queries. Disabling tracking/replacing the player closes its active source
session; ordinary reload/restart retains a checkpoint for recovery. A controls
player choice does not change the recording source. Multiple-player recording is
future work.

Minimum runtime defaults to 10 minutes, configurable 0–1440 minutes; 0 disables
the filter. At a positive cutoff, missing/invalid runtime waits for usable
metadata and a settling interval, without backfilling the wait. Known shorter
content ends a previously qualified session and is ignored. The threshold uses
total runtime, not elapsed watched time. It does not delete old viewings or
limit manual entries.

After 0.5 seconds of stable eligible playback with a usable raw content
identity, recording begins. Count only exact playing state; pause, scans and
intermission do not accrue watched time. Credits must belong to the same
identity/title. A credits indication while paused remains evidence until playing
confirms it. Completion requires the configured minimum main-content time
(default 300 seconds, range 1–3600) at the credits edge; playback position alone
does not prove completion.

A stop has a two-second grace period. An incomplete viewing can resume for the
same exact player/content identity within the configured window (default 24
hours, range 0–168 hours). A completed viewing followed by another session is a
rewatch. Titles do not merge unrelated works. Runtime/metadata changes cannot
silently reassign identities.

Checkpoints occur every 30 seconds. Restart recovery retains evidence without
counting unobserved downtime. The observation buffer holds 256 events; overflow
marks a gap. Storage trouble preserves recoverable checkpoint state instead of
inventing watched time. Backup pauses writes with bounded buffering and resumes
through the same gap/recovery rules.

## Manual viewings and corrections

Manual creation selects an exact version in an enabled scanned Library with a
known positive runtime. Completed is the default; the worker derives title,
identity/runtime snapshot and end time. Partial entries require positive watched
time within runtime. Start time is timezone-aware; the UI presents local time
and the backend retains UTC.

Journal correction validates only supported fields and protects manual choices
from later recorder updates. Title is not a free-form update field; selecting an
exact Library version is a separate validated operation. Notes, times and
completion corrections follow the edit schema. Session evidence remains distinct
from the editable viewing summary. Delete hides a viewing with a tombstone; it
does not erase evidence, receipts, exports or backups. Permanent administration
has its own [data-management contract](design-data-management.md).

Worker-owned Library snapshots preserve display facts for historical viewings
without relying on the current catalog. Explicit
[metadata repair](design-calendar.md#repair-existing-journal-metadata) fills
missing fields from exact cached identities and skips active/deleted rows. It
does not itself publish or rewrite calendar events; a later Full Sync can
refresh managed events from the repaired metadata.

## Reading and API access

All operations use HA authentication and scoped entry/dataset identifiers.
Household views contain safe viewing summaries and totals; notes, raw
identities, sessions, audits and exports require administrator access. Now
Playing reads permitted HA entities; recorder internals are administrator-only.

Lists are paginated with bounded results and revision/filter/sort-bound cursors.
Search supports case-folded literal matching and the saved fuzzy option. Sorts
include completion date (partials first) and title. A stale content revision
requires refresh; personal preference writes do not change that revision. An
active search temporarily displays the list without changing the saved Journal
view. Clear the search in the desktop input or with the mobile search chip to
return to the selected view; other filters remain active. Calendar's Today
button returns to the current local month. User-facing error codes distinguish
stale, busy, storage and permission failures. The command schemas in
[ui/websocket.py](../../custom_components/kaleidescape_companion/ui/websocket.py)
are the exact request reference. Continuous journal push subscriptions remain
future work; do not promise real-time updates on every mounted screen.

## Exports, backups and restore

Administrator JSON exports contain portable journal/session snapshots and
Library records, including private purchase history. SQLite exports contain the
full private database structure and retained operational data as prepared by the
exporter. Download preparation/streaming is bounded (256 MiB, 30-second
preparation and 60-second streaming budgets); temporary snapshots are cleaned
up. Neither export is a public household projection. See
[data management](design-data-management.md) for reviewed merge behavior.

HA backup hooks pause new external intents, drain accepted work and coordinate
storage, then resume when backup completes or fails. A SQLite export alone does
not contain artwork bytes or HA configuration. Full restoration is an offline
operation: stop HA, preserve the current database/configuration, restore a
compatible backup and restart. Do not replace the live SQLite file or downgrade
code across an incompatible schema. Receipts and uncertainty barriers are part
of recovery, not disposable cache data.

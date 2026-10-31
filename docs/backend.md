# Journal backend

The backend records manual journal entries and observed playback from one
selected HA player. API version is `1`; SQLite schema is `20` and JSON export
format is `5`. The household reader and administrator [management panel](ui.md)
use this API. Live subscriptions remain planned; administrator discovery and
[household device controls](playback-controls.md) are implemented;
[optional library sync](library.md) is implemented. A compact read-only Now
Playing card uses the existing snapshot API and HA artwork. The
[security policy](security.md) governs access, privacy, and resource limits.

## Setup and storage

Start the development HA instance and add **Kaleidescape Companion** under
**Settings → Devices & services → Add integration**. Existing framework entries
open the database after an HA restart or integration reload; no reinstallation
is needed.

The backend creates `<HA config>/kaleidescape_companion/journal.sqlite3`. In the
development launcher this is `.ha-dev/kaleidescape_companion/journal.sqlite3`.
One household entry owns the dataset. Unloading, restarting, or removing the
entry retains its data. Adding the integration again reattaches that dataset.

SQLite operations run on one dedicated worker, outside HA's event loop. Content
mutations commit the record, dataset revision, and retry result together. UI
settings use independent row revisions and do not change content revisions.
Rollback-journal mode and full synchronization are used. A queue of at most 128
operations bounds pending work; overload returns `busy` for retry. Accepted
writes finish even if a client disconnects. Shutdown drains accepted work and
closes the connection on its owning worker.

The schema contains dataset metadata, viewing snapshots, durable playback
sessions, field-correction markers, request deduplication, and manual audit
metadata. Raw source IDs are preserved exactly. No title matching, content-ID
normalization, or catalog identity merging is performed. Schema 1 databases
migrate automatically, keeping manual records and retry responses and creating a
pre-migration SQLite backup.

The dedicated storage directory is private (`0700`), with database, migration
backups, and snapshots restricted to the HA user (`0600`). Permissions are
tightened when opening existing storage; unsafe linked paths fail setup. SQLite
page growth is capped at 256 MiB. Larger existing databases remain readable but
cannot grow further. Storage-full writes fail atomically with `storage_error`;
diagnostics expose database size and the nominal limit. This cap does not
include backups or temporary snapshots. There is no automatic history purge.

Schema 3 adds a transactionally committed `manual_audit` record for each new
manual mutation: authenticated HA user ID, operation, request/viewing IDs,
viewing/dataset revisions, and timestamp. It adds no duplicate journal content.
Retries are bound to the original actor and create no extra audit event. Legacy
requests without audit attribution retain their retry behavior; no actor is
invented during migration. Trusted internal repository calls may have a null
actor. Browser clients cannot supply an actor ID. Audit metadata is included in
SQLite snapshots and remains outside ordinary journal responses and diagnostics.

Schema 4 adds `maintenance_audit`: actor, purge operation/request UUID, count,
dataset revision, and time, without viewing identities or content. Upgrading an
existing schema retains the usual private migration backup; purging never
removes that separate copy. JSON format 5 carries viewing/session snapshots,
portable Library entries with private embedded purchase history, excluding the
audit tables. SQLite exports include all tables. Schema 5 adds a minimal
`import_audit` record with authenticated actor, request UUID, imported/skipped
counts, dataset revision, and time, without imported content or file names.

Schema 6 adds source-scoped library titles, collections/memberships, and artwork
indexes. Image bytes use a private bounded file cache outside SQLite. Library
writes reserve journal headroom at a 192 MiB write ceiling; total SQLite growth
remains capped at 256 MiB. See the
[library storage and recovery contract](library.md#storage-artwork-and-recovery).

Schema 9 moves the former schema-7 purchase date and import timestamp onto each
`library_titles` version (renamed `library` in schema 16), folds purchase audit
history into `import_audit`, and removes both purchase-only tables. Schema 8
collection-add intents remain separate because they enforce a durable
external-write recovery barrier. See [purchase dates](purchase-dates.md) and
[reviewed imports](imports.md). `info` exposes only the validated native
landing-page default to active users.

Schema 16 renames `library_titles` to `library` (shown as **Library**) and
consolidates schema-15 invoice records into each entry's `purchase_history`
JSON. Flat `purchase_price`, `retail_price`, `order_id` and `href` columns
summarize the earliest invoice; all repeat orders remain in the history. Only
one representative version owns a movie-group purchase, so formats do not
duplicate charges. No separate purchase table remains. Prices, order IDs, links
and history are administrator-only; the date remains shared. Reviewed imports
require an existing scanned entry or a manual match before applying a purchase.
The upgrade preserves previously unlinked history as unavailable pending Library
entries, which can be matched through a reviewed JSON reimport. See
[purchase imports](imports.md#import-purchase-history-json).

Schema 10 adds the bounded last-addition title snapshot/count/time to
`library_sources`, committed with the catalog. Existing catalogs establish the
baseline; it adds no tables and no imported operational state. Seven additional
[Library/storage sensors](sensors.md#library-and-storage) read local summaries,
including grouped counts and cached size diagnostics.

Schema 11 adds actor-scoped and shared UI rows in `settings`, plus internal
source/version batch markers for exact-group recent badges. It seeds former HA
Library defaults once, then removes those options from HA. The
[UI preference contract](ui-preferences.md) defines live field patches, bounds,
private exports, access and migration behavior. UI rows never become movie data.

Schema 12 adds a content-free `database_audit` trail for the confirmed
administrator [database tools](database.md) and a monotonic `settings_revision`
on dataset metadata. UI row deletion no longer makes raw settings-page revisions
ambiguous; ordinary preference edits still leave content revisions unchanged.
Database writes validate supported fields, row tokens and the inspected content
revision, and preserve protected identities/receipts.

Schema 13 adds protected manual-viewing Library references/display snapshots and
the completion-calendar outbox. [Calendar publishing](calendar.md) is a
separate, off-by-default HA setting using only the selected calendar's create
action. Completion and queue insertion are transactional; sending/uncertain
receipts prevent blind retries. No automatic historical/import backfill occurs.
Schema 14 adds confirmed, bounded Journal export and protected per-item job
receipts; see the calendar guide.

Observed and manual viewings now share worker-only Library snapshots and exact
version resolution. Observed snapshots are saved before completion enqueue,
without depending on calendar opt-in. Administrator commands
`journal/metadata/preview` (scoped read) and `journal/metadata/repair` (request
UUID, review `token`, and `confirmation: "REPAIR METADATA"`) repair missing
fields from the configured Library cache. Recomputed review tokens reject stale
candidates; active sessions/tombstones are skipped, existing values stay intact,
and writes are atomic, bounded, audited and actor-idempotent. No schema
migration or calendar write is required. See
[repair procedures and limits](calendar.md#repair-existing-journal-metadata).

### Table responsibilities

A title version is stored once. Separate tables represent
one-to-many/many-to-many relationships or transactional recovery, not separate
copies of the same movie.

| Tables                                                                                   | Purpose                                                                                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `settings`                                                                               | Personal browsing values, shared hidden names and one-time inherited UI defaults; independently revisioned        |
| `database_audit`                                                                         | Administrator database edit/delete attribution and affected field names/counts, without row content               |
| `calendar_sync_jobs`, `calendar_sync_items`                                              | Explicit historical export attribution/progress and replay barriers, without copied event content                 |
| `calendar_managed_events`, `calendar_reconcile_candidates`, `calendar_reconcile_intents` | Dedicated-calendar UID links, delayed cleanup and durable Full Sync intents; no copied event content              |
| `calendar_publications`                                                                  | Durable one-attempt completion publishing state, target and configuration fingerprint; no copied event content    |
| `library`                                                                                | One row per source/version; descriptive metadata JSON, detection/freshness, artwork reference and purchase date   |
| `library_sources`                                                                        | Source namespace, catalog/collection freshness and revision                                                       |
| `library_collections`, `library_memberships`                                             | Collections, including empty collections, and many-to-many title membership                                       |
| `library_artwork`                                                                        | Deduplicated bounded file-cache index; image bytes live outside SQLite                                            |
| `viewings`, `sessions`                                                                   | Household viewing summaries and separate playback sessions/evidence; rewatches and resumptions are not title rows |
| `schema_metadata`, `requests`                                                            | Dataset identity/revision and durable mutation deduplication                                                      |
| `manual_audit`, `maintenance_audit`, `import_audit`                                      | Distinct mutation attribution/retention rules; import counts cover both title and viewing merges                  |
| `library_collection_intents`                                                             | Durable recovery for an external collection write with an uncertain result                                        |

Flattening memberships or sessions into title rows would duplicate titles or
require rewriting shared arrays; combining receipts/cache state with movie
metadata would couple unrelated retention and recovery. Common metadata remains
bounded JSON on the version instead of adding an actor/director table for every
field. New scalar title properties should normally extend that row, as purchase
dates now do. Indexed identities and memberships support joins/filters without
creating a second title record.

## Automatic tracking

For an existing entry, open **Settings → Devices & services → Kaleidescape
Companion → Configure**, enable automatic tracking, and select:

- The existing Kaleidescape media player.
- Its exact play-status sensor.
- Its media-location sensor.

All three must be different entities of the appropriate domains. Registered
sources may be offline during setup. Registry identities follow renames and
removals; an unregistered source falls back to its entity ID. Replacing a player
creates a new internal player identity. One player is configurable in this
slice; storage keeps independent player identities for later expansion.

Tracking is optional and defaults off. Existing entries retain the manual API.
Options reload automatically. Disabling tracking or replacing the player closes
its active source session; ordinary reload/restart retains a recovery
checkpoint. No extra device connection is opened and no playback action is sent.

**Minimum runtime to record** defaults to **10 minutes** and is configurable in
setup or **Configure** from 0 to 1,440 minutes; **0 disables this filter**.
Automatic recording admits only a reported total runtime at or above the cutoff
(exactly 10 minutes qualifies at the default). Short playback, including
trailers, creates no viewing/session. This uses total runtime, not elapsed
watched time: watching one minute of a qualifying movie can still create a
partial viewing.

With the filter enabled, missing/invalid runtime waits for usable metadata and
then the usual settling interval; waiting time is not backfilled. Missing
runtime during an established session suspends timing and marks a gap until
eligibility is re-established. A known short runtime ends the prior qualified
session with `below_minimum_runtime` and ignores the short playback, including
when the source reuses the same content ID. Recovery follows the configured
cutoff. The default also applies to older entries that have no saved runtime
option.

The filter applies going forward: it does not delete old viewings, suppress
history queries/sensors, or restrict explicit manual entries/corrections.
Raising the cutoff preserves an already recorded viewing while closing an
ineligible open source session. It is a source-runtime heuristic, not trailer
identification; a source reporting a feature's runtime for a trailer cannot be
distinguished by this rule alone. Now Playing still shows live playback with an
ignored/waiting message. No database migration or library lookup is needed.

The tracker counts elapsed monotonic time only during exact `playing` plus
`content` for a known raw ID. A new/resumed identity must remain usable for at
least 0.5 seconds; timing starts after that settling interval. Pauses, scans,
intermission, menus, missing identity, and unavailable sources do not count.
Movie content marked `stream` is supported. Position and progress are not
inferred from accumulated viewing time. Titles/durations are source snapshots;
journal corrections remain available when metadata is incomplete or stale.

A credits transition must belong to an established identity with the same title
snapshot. Ambiguous title/ID rollover cannot complete another movie. Paused
credits are retained as evidence; normal playback in credits confirms them.
Completion requires confirmed credits and at least **300 seconds** of
main-content playback by default, configurable from 1 to 3,600 seconds. This
completion threshold is separate from minimum total runtime for admitting a
journal entry. It is evaluated at the credits edge; later playback alone cannot
turn earlier short credits into completion. Repeated credits and post-credit
content remain the same viewing.

A known stop/`none` freezes timing immediately and closes the session after a
two-second grace period. Brief stop transitions can resume the same session.
Later sessions attach to a single unambiguous incomplete viewing with the exact
player/content identity within **24 hours** by default (configurable 0–168
hours; 0 disables merging). Completed viewings followed by a new session create
a rewatch. Different players or content IDs never merge by title.

Semantic edges and 30-second checkpoints persist absolute totals. Recovery
reuses an open session with a new boot ID and a gap marker, never adding
unobserved downtime. A crash can lose time since the last durable checkpoint.
Playback during a recording outage or while HA is stopped cannot be
reconstructed.

Up to 256 source observations are buffered during backups or storage delays.
Edges are processed in receipt order. Overflow discards the uncertain interval
and records a timing gap rather than inventing watched seconds. Storage errors
retain the pending checkpoint for retry; Now Playing and diagnostics show the
recording error. Shutdown unsubscribes first and drains/checkpoints accepted
work. If storage remains unavailable, shutdown logs the failure and recovery
retains only durable facts. If HA shuts down during a backup, writes remain
paused and buffered events may be lost; the next recovery records a gap.

From the authenticated browser console (using `hass` and `scope` below):

```js
await hass.callWS({ type: "kaleidescape_companion/now_playing", ...scope });
await hass.callWS({
  type: "kaleidescape_companion/journal/sessions",
  ...scope,
  viewing_id: "VIEWING_UUID",
});
```

Now Playing returns source title, raw content ID, duration, exact
status/location, availability, recording error, and buffer health. It also
returns the player `name`, snapshot `observed_at`, optional `artwork_key`,
`recording_paused`, `minimum_runtime_minutes`, and `recording_exclusion`
(`null`, `runtime_unknown`, or `below_minimum_runtime`).
`session: {watched_seconds, credits_confirmed, gap_count}` is present or `null`;
it must match the current raw content ID and runtime rule. Session time is
counted in memory and may include time not yet checkpointed; it is not the whole
resumed viewing's total, movie position, or a promise of durable completion. The
snapshot timestamp records HA observation, not independently verified device
freshness.

The endpoint is read-only and available to active users with HA `POLICY_READ`
for all resolved configured sources. Household responses omit raw IDs, session
and recording internals. An optional opaque `player_id` maps a known control
target to its native HA media-player registry entry; without tracking, the
configured control default can provide the display. Missing mappings return an
empty player list. Both roles mount the [Now Playing card](ui.md#now-playing),
which uses HA's authenticated image route without returning URLs/tokens.

## Authenticated API

Use HA's existing authenticated WebSocket connection. Active users may call
`info`, `journal/list`, `journal/get`, `journal/calendar` and
`journal/calendar/get` to browse the shared household journal. Personal UI
preferences and enabled cached Library reads also permit active users as
documented below. Management commands and all exports require an active
administrator. No token or unauthenticated data endpoint is added by this
integration. Authorization is repeated before returning private results after
awaited work; accepted writes remain committed if access changes during
processing. These endpoint checks do not sandbox the integration from the rest
of HA.

`info` includes `permissions: {read, edit, export}`. For regular users it
returns only scope, API version, revision, visible viewing count, and these
permissions; administrator responses retain schema/storage/tracking health.
Regular-user viewing responses allow only `id`, `title`, `started_at`,
`ended_at`, `duration_seconds`, `watched_seconds`, `status`, and `origin`.
Notes, source/player/content IDs, session evidence, mutation history, and
deletion tombstones remain outside this surface. Any change in active/admin
status during an awaited operation withholds its result. Accounts share the same
household history; there is no per-user dataset.

The [history sensors](sensors.md) derive completed and unfinished-partial
summaries from this database without adding a schema migration. Seven
Library/storage sensors separately derive source-group counts and health
metadata; schema 10 retains the latest non-empty discovery batch. All sensor
states follow HA entity visibility and may be retained by Recorder and
automations.

Every command type starts with `kaleidescape_companion/`. Use `info` to discover
the loaded entry and dataset. All journal commands require both `entry_id` and
`dataset_id`; a stale dataset reference is rejected. If the entry is unloaded,
`info` returns an empty list and scoped commands return `not_ready`.

| Command suffix     | Additional inputs                                                               | Result                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `info`             | None                                                                            | `entries` with scope, API/schema versions, counts, revision, and feature flags                                             |
| `journal/create`   | `request_id`, `data`                                                            | Committed `viewing` and dataset `revision`                                                                                 |
| `journal/get`      | `viewing_id`                                                                    | One visible viewing                                                                                                        |
| `journal/sessions` | `viewing_id`                                                                    | Latest 100 sessions and `has_more`                                                                                         |
| `now_playing`      | None beyond scope                                                               | Read-only `players` snapshot and recording health                                                                          |
| `journal/list`     | Optional `query`, `status`, `limit`, `cursor`, `sort`, `descending`, `fuzzy`    | `items`, `next_cursor`, dataset ID and revision                                                                            |
| `journal/update`   | `request_id`, `viewing_id`, `expected_revision`, `patch`                        | Committed `viewing` and dataset `revision`                                                                                 |
| `journal/delete`   | `request_id`, `viewing_id`, `expected_revision`                                 | Tombstoned `viewing` and dataset `revision`                                                                                |
| `settings/start`   | None beyond scope                                                               | Native HA options form: `flow_id`, `fields`, `errors`                                                                      |
| `settings/submit`  | `flow_id`, `data`                                                               | Updated form/errors or `type: create_entry` after native persistence/reload scheduling                                     |
| `settings/cancel`  | `flow_id`                                                                       | Abort this user's Companion options flow without saving                                                                    |
| `database/inspect` | `table`; optional `offset`, `revision`, `limit`, `query`, `sort`, `descending`  | Table counts, bounded raw `items`, matching `total`, `columns`, applied query/sort/limit, `offset`, `revision`, `has_more` |
| `database/purge`   | `request_id`, dataset `expected_revision`, `viewing_ids`, `all`, `confirmation` | Content-free `purged_count` and dataset `revision`                                                                         |
| `database/update`  | `request_id`, `viewing_id`, viewing `expected_revision`, `patch`                | Existing validated viewing corrections, including tombstones; no immutable/internal field edits                            |

Mutation request IDs and viewing IDs are UUIDs. Reuse the **same request UUID
and payload** when retrying an uncertain response; the original committed result
is returned without another write, including after restart. Reusing that UUID
for different data returns `conflict`. An old retry returns its original result,
even if later edits or deletion have occurred; fetch again for the current
state. After permanent purge, affected old mutation retries return `not_found`
instead of cached content, and cannot recreate a viewing. There is no automatic
expiry of request deduplication in this initial schema.

`expected_revision` is the viewing's revision, initially `1`, and increases with
each update or deletion. The separate dataset revision increases on every new
mutation. Stale corrections return `conflict`. A delete hides the record from
get/list; it retains a tombstone, original content, and retry history in storage
and exports. It is not a permanent privacy purge.

Lists default to `sort: completed_at`, `descending: true`, using end/completion
time with start time as fallback and UUID as a deterministic tie-breaker.
Partial entries always precede completed entries for this sort, in either
direction. `sort: title` uses the stored Unicode case-folded title, in either
direction, without the partial-first grouping. Search is a literal, Unicode
case-folded title substring unless `fuzzy=true` enables bounded word/typo
matching; `status` is `partial` or `completed`. The default page size is 50 and
the maximum is 100. Cursors bind to the dataset, revision, filters and sort. Any
intervening mutation or filter/sort change returns `refresh_required`; restart
from the first page. Do not parse or alter cursors.

### Record fields

`journal/update` accepts ordinary changed timing/status/note fields, and an
optional `patch.library_title_id` to explicitly select a different available,
scanned version in the enabled current Library. A free-text `title` patch is
rejected. The worker derives title/link/metadata from that exact ID and commits
them with the correction, revision and audit/UUID receipt. It preserves recorded
source/player/content identifiers and runtime/times/watched values unless
separately corrected; a selection patch cannot also override raw identifiers. It
may select a version with missing runtime because no timing is inferred. No
caller-supplied metadata snapshot is accepted. Actor/source/payload-bound
retries resolve before rereading a changed/unavailable version. Other historical
corrections work without Library enabled. Database corrections/imports retain
their separate administrator validation paths.

`journal/create` now requires enabled cached Library access. Its `data` accepts
only `library_title_id` (an exact available version in the configured source),
`started_at`, optional `status` (default `completed`), `notes`, and
`watched_seconds` for `partial` only. A positive known version runtime is
required. The worker supplies title/runtime/source identity, records a protected
display snapshot, sets completed watched time to runtime, and infers end time
from start plus watched time. Partial time must be positive and no greater than
runtime. Free-text creates or caller-supplied title/runtime/end/metadata are
rejected. Existing correction and reviewed import paths retain their own
validation.

| Field                                      | Rules/default                                                  |
| ------------------------------------------ | -------------------------------------------------------------- |
| `title`                                    | Required, nonblank text, at most 500 characters                |
| `started_at`                               | Required ISO timestamp with timezone; stored as UTC            |
| `ended_at`                                 | Optional timestamp with timezone; cannot precede start         |
| `duration_seconds`                         | Optional nonnegative number, otherwise `null`                  |
| `watched_seconds`                          | Nonnegative number, default `0`; independent of seek position  |
| `status`                                   | `partial` or `completed`; Library creates default to completed |
| `source_id`, `player_id`, `raw_content_id` | Optional opaque nonblank strings, at most 255 characters       |
| `notes`                                    | Text, at most 10,000 characters, default empty                 |

The table describes stored/correctable fields and lower-level import defaults;
new Library-based additions derive the fields described above.

Seconds must be finite and at most 1,000,000,000. Booleans are not numbers.
Unknown fields and empty patches are rejected. All fields above can be corrected
with `journal/update`. The backend also returns immutable IDs, `origin: manual`,
creation/update times, viewing revision, `deleted_at`, `completed_at`,
`completion_reason`, and `rule_version`. Observed records use
`origin: observed`. Corrections to observed fields remain authoritative: later
checkpoints update session evidence but preserve the fields you edited. Deleting
an active viewing keeps that session attached to its tombstone, so updates
cannot resurrect it.

### Database maintenance

The [Database guide](database.md) defines raw-first inspection, personal view
options, condition search/completion, supported per-table fields, confirmations,
references and concurrency behavior. Inspection accepts only eighteen trusted
tables, 10/25/100/500-row pages, validated sort columns, a bounded
2000-character predicate/literal search, revision-bound pagination and an 8 MiB
result budget. The predicate parser binds values and resolves field/JSON aliases
from trusted schema; it never executes caller SQL. Inspection has a two-second
SQL budget.

`database/inspect` now also returns `dataset_revision`, row snapshot tokens,
field descriptions/edit permissions, query field/operator names, approved
related-row key mappings, main-table names and deletion policy.
`database/validate_query` compiles a condition for position-based validation
without running it. `database/mutate` accepts a cryptographic `request_id` plus
`data` containing `table`, `operation` (edit or delete), 1–100 selected `rows`
with `key`/`token`, an edit `patch` (one row), `expected_revision` and
confirmation SAVE/DELETE. Active administrator and entry/dataset/readiness
checks run before/after awaited work. The worker commits changes, content
revision, receipt and database audit atomically; retries bind actor/payload.
Open playback rows, system identities, paths, audit and device write barriers
stay protected. Library cache mutations never edit a device.

Recording and sync may remain enabled for these targeted operations. A changed
dataset/row returns conflict; no unreviewed partial changes are applied. Active
transfers/backups block new writes; exact committed retries remain readable.
Source-owned metadata can be restored by the next sync. Deleting an artwork
index clears all references before private managed-file cleanup.

For compatibility, `database/update` retains the earlier viewing correction
contract and `database/purge` retains its explicitly confirmed selected/all
viewing purge contract, requiring recording disabled. The new UI uses confirmed
Database Delete for physical deletion and keeps Journal Delete as a tombstone.
Imports keep their separate review/disabled-recording contract. These legacy
APIs are not an unrestricted system-table editor.

### Try a round trip

In the browser developer console of a logged-in HA administrator, run:

```js
const hass = document.querySelector("home-assistant").hass;
const { entries } = await hass.callWS({ type: "kaleidescape_companion/info" });
const scope = {
  entry_id: entries[0].entry_id,
  dataset_id: entries[0].dataset_id,
};
const requestId = crypto.randomUUID();
// Requires a fictional cached Library with runtime metadata on an isolated HA.
const library = await hass.callWS({
  type: "kaleidescape_companion/library/list",
  ...scope,
  filters: { query: "Development example", limit: 10, grouped: false },
});
const movie = library.items.find((item) => item.duration_seconds > 0);
if (!movie)
  throw new Error("Sync a fictional Library title with known runtime first");
const created = await hass.callWS({
  type: "kaleidescape_companion/journal/create",
  ...scope,
  request_id: requestId,
  data: {
    library_title_id: movie.id,
    started_at: new Date().toISOString(),
    notes: "Manual backend test",
  },
});
await hass.callWS({ type: "kaleidescape_companion/journal/list", ...scope });
await hass.callWS({
  type: "kaleidescape_companion/journal/get",
  ...scope,
  viewing_id: created.viewing.id,
});
const updated = await hass.callWS({
  type: "kaleidescape_companion/journal/update",
  ...scope,
  request_id: crypto.randomUUID(),
  viewing_id: created.viewing.id,
  expected_revision: created.viewing.revision,
  patch: { notes: "A corrected development note" },
});
await hass.callWS({
  type: "kaleidescape_companion/journal/delete",
  ...scope,
  request_id: crypto.randomUUID(),
  viewing_id: created.viewing.id,
  expected_revision: updated.viewing.revision,
});
```

These calls write one explicit development entry and then tombstone it. They do
not contact a player or send controls. Keep calendar publishing disabled during
this round trip; a completed create otherwise queues its selected calendar
action. Use an isolated development instance and fictional cached data for
examples.

Public error codes include `invalid_request`, `unauthorized`, `not_found`,
`not_ready`, `conflict`, `refresh_required`, `backup_in_progress`, `busy`,
`export_too_large`, `export_timeout`, and `storage_error`. Malformed WebSocket
envelopes are rejected by HA's schema validation before the handler. A failed
storage operation is not reported as a successful write.

## Export, backup, and restore

### Reviewed merge imports

[Database merge imports](imports.md) accept compatible JSON/SQLite snapshots for
viewings and exact Library versions. Upload first creates a read-only,
actor/revision-bound review; explicit selected-row approval adds new IDs and
fills missing fields in one transaction. Populated values, manual corrections
and tombstones are preserved. Legacy schema-7/8 purchase dates are recognized.
The guide defines routes, formats, limits, exclusions and uncertain retry
handling. The former direct import and purchase-specific endpoints are removed.

### Downloads and offline restore

The authenticated admin-only route is:

```text
GET /api/kaleidescape_companion/{entry_id}/{dataset_id}/export?format=json
GET /api/kaleidescape_companion/{entry_id}/{dataset_id}/export?format=sqlite
```

Use `hass.fetchWithAuth(url)` from the panel/browser console or a bearer token
through an API client. An ordinary unauthenticated link will not download it.
Exports are streamed from consistent worker-created snapshots in a private
directory under storage. One HTTP export per loaded repository may be prepared
or streamed at a time; concurrent requests return `busy` (HTTP 503 with
`Retry-After`). Each snapshot is limited to 256 MiB and 30 seconds of
preparation; the full download has a 60-second time budget. Cleanup waits for
accepted file work to finish, so a stalled filesystem can delay cancellation
beyond that budget. Oversized exports return `export_too_large` (413);
preparation timeouts return `export_timeout` (503). A timed-out or
access-revoked stream is disconnected once headers have been sent. Downloads
send `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

Temporary files are deleted after transfer, including cancellation and
disconnect/error paths. Owned snapshots left by a crash are removed on the next
storage open. JSON contains format metadata, viewing records and
field-correction markers, and sessions, including tombstones. SQLite includes
the full database, including request deduplication and manual audit metadata.
JSON format 5 additionally contains portable Library title metadata, purchase
dates and private invoice history, without device origins, fetch paths or cache
keys. It does not include audit tables. Reviewed viewing/Library merge imports
are supported through Database; full SQLite restore remains an offline
operation. All exports and migration backups are private, including retained
tombstones; visible deletion does not erase data. See the
[retention procedures](security.md#backup-restore-retention-and-capacity).

HA's backup hooks drain accepted writes and pause new writes while its backup
runs. Clients receive `backup_in_progress` and can retry with the same request
ID afterward. Reads and exports remain available. The post-backup hook resumes
writes after success or failure. Observation is buffered during backups; see
[automatic tracking](#automatic-tracking) for its bounded-gap policy. End-to-end
HA OS/Supervisor backup behavior still needs release validation; local tests
verify the hooks and restored copies.

To restore a SQLite export, stop the target HA instance, retain a copy of its
existing journal, and replace only `kaleidescape_companion/journal.sqlite3`
under its config directory with the export. Start HA again. The dataset UUID and
records are retained; the config entry ID belongs to that HA installation. Never
replace a live database or open one journal with two HA instances.

Migrations run in order inside a transaction. Before upgrading an existing
schema, a SQLite backup is kept beside it with a versioned `.bak` name. Failed
migrations roll back, and newer or unrecognized schemas are rejected without
deleting data. Diagnostics expose versions, counts, revision, backup state, and
queue depth, without journal content or filesystem paths.

Search APIs accept a boolean `fuzzy` flag. Journal `list` and Library
`list`/people `suggest` default to literal matching when omitted, preserving API
compatibility; Library title `search` retains its previous fuzzy default.
Journal cursors bind the search mode as well as query/status/sort/revision.
Browser options explicitly send the user's mode. Literal mode matches
continuous, case-insensitive text, including punctuation and SQL wildcard
characters as ordinary text. Literal mode preserves punctuation and word order.
Fuzzy mode also supports normalized words, diacritics and small word
edits/swaps; approximate matching is limited to twelve query words and
100-character words. Longer general searches retain literal matching. A manual
title-completion request still has its 100-character/twelve-word fuzzy bound and
ten-result limit. Empty literal title completion offers no movie until text is
entered.

Journal/Library list and people suggestion reads have a two-second SQLite
budget; an exceeded budget returns `query_limit` rather than partial results.
Title completion retains its one-second scoring/10,000-name bound and reports
truncation. No arbitrary regex, wildcard execution, SQL or new remote access is
added.

## Journal and Library display links

### Month calendar reads

`journal/calendar` accepts timezone-aware ISO `start` and `end` bounds, plus
optional `query`, `status`, boolean `fuzzy` and linked Library `title_id`. The
browser sends local midnight at the start of the month and next month as UTC
instants. The worker normalizes them to UTC, accepts a positive span of at most
32 days (including DST changes), and reads nondeleted viewings in the half-open
`started_at` range. The existing date index supports this query. Results contain
the eight safe viewing fields plus nullable exact `library_title_id` and
`artwork_key`, ordered by start and ID, and the current content revision. The
hard limit is 1000 viewings; excess returns `calendar_limit` instead of a
partial month. SQLite work has a two-second budget.

`journal/calendar/get` accepts a viewing UUID and returns `viewing` with those
same eight safe fields and nullable `movie` metadata: title, artwork key,
rating, actors, directors, genres, runtime seconds, year, edition and formats.
Both roles receive the same positive projections, without notes, raw source data
or purchase/detection fields. The movie uses the exact saved Library link and
current configured source; disabled Library access or an unavailable version
returns no linked metadata/artwork while retaining the viewing. Both routes
recheck role, entry readiness and any Library source across awaits. No provider
or device action, new table, or schema migration is added.

### Exact display links

A viewing's existing `library_title_id` identifies the exact scanned version.
Schema 17 indexes that reference on non-deleted viewings; no duplicate reverse
reference array or additional table is needed. A source/group lookup resolves
all versions of the movie and uses the viewing index for paginated history.
Same-name remakes and movies on different sources remain separate.

Active authenticated users may call the source-scoped Library read commands:

- `library/viewing` takes `viewing_id` and returns `library: null` or a positive
  display projection containing `title_id`, `title` and `artwork_key`.
- `library/viewings` takes `title_id` and the Journal list's search, status,
  sort, order, limit and cursor fields. It returns the normal Journal page,
  restricted to that source/group. Household users receive only public viewing
  fields. Cursors bind the exact Library filter as well as content revision.

Both require enabled Library access and recheck authorization after awaiting
storage. The artwork bytes use the existing authenticated, current-source cache
route, not a stored external URL or a metadata snapshot.

The schema upgrade keeps a private pre-upgrade backup and backfills missing
references only for exact device handles, including the recognized playback /
browser spelling bridge. Legacy `home_assistant` rows require a single cached
source; other rows require their stored source. Existing links, active sessions,
deleted viewings, ambiguous matches and unmatched names remain unchanged. The
upgrade increments changed viewing revisions and the content revision, without
altering viewing facts or publishing calendar events. The reviewed metadata
repair remains available for entries that could not be linked automatically.

## Administrator Library purchase summary

`library/purchases/summary` is a scoped, administrator-only read. It returns the
source revision, deduplicated purchase-record count, unique known-order count,
missing-price/order counts, unpaired-price and duplicate counts, and currency
buckets with formatted `library_cost`, `retail_price` and `savings` strings.
Missing totals stay null; no currency is invented for an empty history. Values
are decimal strings to preserve integer-cent precision in browsers.

The worker streams embedded purchase histories for the configured source,
excluding pending unmatched history, and counts stable invoice IDs once. It
includes unavailable owners and repeat invoices, but not the redundant flat
summary columns. Distinct known order IDs determine the transaction count;
missing IDs do not create synthetic transactions. Savings require both prices in
one currency. Reads have a two-second SQL/Python budget and a 100,000-record
ceiling; exceeding either returns an error without partial totals. No schema,
networking or device-write change is involved.

## Device control API

[Controls](playback-controls.md) use authenticated WebSocket entry/dataset
scope. All active users may use `control/info`, `control/status`,
`control/prepare` and `control/execute` when opted in. Discovery/configuration
and uncertain-command acknowledgement remain administrator-only. There is no raw
protocol/HA-action endpoint or new HA control service.

`control/info` is passive and opens no socket. It returns enablement, launch
opt-in, `default_player` (opaque ID), friendly `players`, `blocked_players`,
`can_manage` and the caller's own `pending` receipts. Administrators receive all
pending receipts and an additional `devices` inventory. Ordinary users receive
no addresses/serials, actors or another user's receipt UUID. Discovery restores
choices from a private, seed-bound HA Store; only an administrator's explicit
`control/discover` refreshes that cache from the configured system.

`control/status` and `control/prepare` optionally accept `player_id`, restricted
to a known movie-capable target or configured default. Omission uses the
default. Unknown IDs, raw serials and destinations are rejected. Status returns
a safe live movie state. Prepare accepts a fixed `operation` and, for `launch`
only, opaque `title_id`; it returns an actor-bound 60-second `token`, live
context and `player_id`. The UI automatically preflights and sends on one
command click. There is no human confirmation field or ordinary command
confirmation dialog.

`control/execute` takes `request_id` and `token`, rechecks
identity/state/config, reserves a schema 18 receipt and sends once. Results
distinguish `state_observed`, `acknowledged`, `rejected`, `not_sent` and
`unconfirmed`; edition confirmation is always false. Retry the same
actor/UUID/token to retrieve an accepted result without replay. Pending
uncertainty blocks that serial across all users.

After physical inspection, administrator `control/acknowledge` takes a receipt
`request_id` and `confirmation: "REVIEWED"`, records the reviewer and returns
`pending_count`. It never resends/removes the original result or clears an
actively sending receipt. Startup converts interrupted reservations to
uncertain. System records are outside editing/portable imports; SQLite backups
retain them.

## External metadata

Schema 19 adds protected provider-cache JSON to Library. Scoped administrator
`metadata/status` and `metadata/sync` operate only enabled providers. Cache
credits augment Library detail/search projections without replacing source
identities or raw metadata. See [enrichment](enrichment.md) and its security
boundary for matching, request budgets, credential storage and opt-out behavior.

Schema 20 adds opt-in
[Full Sync](calendar.md#full-sync-for-a-dedicated-calendar). Administrator
`calendar/status` includes maintenance state; `calendar/maintain` accepts
`action: run|acknowledge`, saved `fingerprint`, and for acknowledgement
`confirmation: ACKNOWLEDGE` plus `review_token` from status. Entity CRUD stays
on the selected dedicated calendar, with age bounds, quarantine, stale-data
checks, read-back and durable uncertainty barriers.

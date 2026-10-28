# Journal backend

The backend records manual journal entries and observed playback from one selected
HA player. API version is `1`; SQLite schema is `5` and JSON export format is
`2`. The household reader and administrator [management panel](ui.md) use this API. Live
subscriptions, library, and controls remain planned; a compact read-only Now Playing
card uses the existing snapshot API and HA artwork.
The [security policy](security.md) governs access, privacy, and resource limits.

## Setup and storage

Start the development HA instance and add **Kaleidescape Companion** under **Settings →
Devices & services → Add integration**. Existing framework entries open the
database after an HA restart or integration reload; no reinstallation is needed.

The backend creates `<HA config>/kaleidescape_companion/journal.sqlite3`.
In the development launcher this is `.ha-dev/kaleidescape_companion/journal.sqlite3`.
One household entry owns the dataset. Unloading, restarting, or removing the
entry retains its data. Adding the integration again reattaches that dataset.

SQLite operations run on one dedicated worker, outside HA's event loop. Each
mutation commits the record, dataset revision, and retry result together.
Rollback-journal mode and full synchronization are used. A queue of at most 128
operations bounds pending work; overload returns `busy` for retry. Accepted
writes finish even if a client disconnects. Shutdown drains accepted work and
closes the connection on its owning worker.

The schema contains dataset metadata, viewing snapshots, durable playback
sessions, field-correction markers, request deduplication, and manual audit metadata. Raw source IDs
are preserved exactly. No title matching, content-ID normalization, or catalog
identity merging is performed. Schema 1 databases migrate automatically, keeping
manual records and retry responses and creating a pre-migration SQLite backup.

The dedicated storage directory is private (`0700`), with database, migration
backups, and snapshots restricted to the HA user (`0600`). Permissions are
tightened when opening existing storage; unsafe linked paths fail setup. SQLite
page growth is capped at 256 MiB. Larger existing databases remain readable but
cannot grow further. Storage-full writes fail atomically with `storage_error`;
diagnostics expose database size and the nominal limit. This cap does not include
backups or temporary snapshots. There is no automatic history purge.

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
existing schema retains the usual private migration backup; purging never removes
that separate copy. JSON format 2 remains a viewing/session export, excluding
the audit tables. SQLite exports include all tables. Schema 5 adds a minimal
`import_audit` record with authenticated actor, request UUID, imported/skipped
counts, dataset revision, and time, without imported content or file names.

## Automatic tracking

For an existing entry, open **Settings → Devices & services → Kaleidescape Companion →
Configure**, enable automatic tracking, and select:

- The existing Kaleidescape media player.
- Its exact play-status sensor.
- Its media-location sensor.

All three must be different entities of the appropriate domains. Registered
sources may be offline during setup. Registry identities follow renames and
removals; an unregistered source falls back to its entity ID. Replacing a player
creates a new internal player identity. One player is configurable in this slice;
storage keeps independent player identities for later expansion.

Tracking is optional and defaults off. Existing entries retain the manual API.
Options reload automatically. Disabling tracking or replacing the player closes
its active source session; ordinary reload/restart retains a recovery checkpoint.
No extra device connection is opened and no playback action is sent.

**Minimum runtime to record** defaults to **10 minutes** and is configurable
in setup or **Configure** from 0 to 1,440 minutes; **0 disables this filter**.
Automatic recording admits only a reported total runtime at or above the cutoff
(exactly 10 minutes qualifies at the default). Short playback, including trailers,
creates no viewing/session. This uses total runtime, not elapsed watched time:
watching one minute of a qualifying movie can still create a partial viewing.

With the filter enabled, missing/invalid runtime waits for usable metadata and
then the usual settling interval; waiting time is not backfilled. Missing runtime
during an established session suspends timing and marks a gap until eligibility
is re-established. A known short runtime ends the prior qualified session with
`below_minimum_runtime` and ignores the short playback, including when the source
reuses the same content ID. Recovery follows the configured cutoff. The default
also applies to older entries that have no saved runtime option.

The filter applies going forward: it does not delete old viewings, suppress
history queries/sensors, or restrict explicit manual entries/corrections. Raising
the cutoff preserves an already recorded viewing while closing an ineligible open
source session. It is a source-runtime heuristic, not trailer identification;
a source reporting a feature's runtime for a trailer cannot be distinguished by
this rule alone. Now Playing still shows live playback with an ignored/waiting
message. No database migration or library lookup is needed.

The tracker counts elapsed monotonic time only during exact `playing` plus
`content` for a known raw ID. A new/resumed identity must remain usable for at
least 0.5 seconds; timing starts after that settling interval. Pauses, scans,
intermission, menus, missing identity, and unavailable sources do not count.
Movie content marked `stream` is supported. Position and progress are not inferred
from accumulated viewing time. Titles/durations are source snapshots; journal
corrections remain available when metadata is incomplete or stale.

A credits transition must belong to an established identity with the same title
snapshot. Ambiguous title/ID rollover cannot complete another movie. Paused
credits are retained as evidence; normal playback in credits confirms them.
Completion requires confirmed credits and at least **300 seconds** of main-content
playback by default, configurable from 1 to 3,600 seconds. This completion threshold
is separate from minimum total runtime for admitting a journal entry. It is evaluated
at the credits edge; later playback alone cannot turn earlier short credits into
completion. Repeated credits and post-credit content remain the same viewing.

A known stop/`none` freezes timing immediately and closes the session after a
two-second grace period. Brief stop transitions can resume the same session.
Later sessions attach to a single unambiguous incomplete viewing with the exact
player/content identity within **24 hours** by default (configurable 0–168 hours;
0 disables merging). Completed viewings followed by a new session create a
rewatch. Different players or content IDs never merge by title.

Semantic edges and 30-second checkpoints persist absolute totals. Recovery reuses
an open session with a new boot ID and a gap marker, never adding unobserved
downtime. A crash can lose time since the last durable checkpoint. Playback during
a recording outage or while HA is stopped cannot be reconstructed.

Up to 256 source observations are buffered during backups or storage delays.
Edges are processed in receipt order. Overflow discards the uncertain interval
and records a timing gap rather than inventing watched seconds. Storage errors
retain the pending checkpoint for retry; Now Playing and diagnostics show the
recording error. Shutdown unsubscribes first and drains/checkpoints accepted work.
If storage remains unavailable, shutdown logs the failure and recovery retains
only durable facts. If HA shuts down during a backup, writes remain paused and
buffered events may be lost; the next recovery records a gap.

From the authenticated browser console (using `hass` and `scope` below):

```js
await hass.callWS({ type: "kaleidescape_companion/now_playing", ...scope });
await hass.callWS({
  type: "kaleidescape_companion/journal/sessions", ...scope,
  viewing_id: "VIEWING_UUID"
});
```

Now Playing returns source title, raw content ID, duration, exact status/location,
availability, recording error, and buffer health. It also returns the player
`name`, snapshot `observed_at`, optional `artwork_key`, `recording_paused`,
`minimum_runtime_minutes`, and `recording_exclusion` (`null`, `runtime_unknown`, or
`below_minimum_runtime`). `session: {watched_seconds, credits_confirmed, gap_count}`
is present or `null`; it must match the current raw content ID and runtime rule. Session time is counted in memory and may
include time not yet checkpointed; it is not the whole resumed viewing's total,
movie position, or a promise of durable completion. The snapshot timestamp records
HA observation, not independently verified device freshness.

The endpoint remains read-only/admin-only and checks HA `POLICY_READ` for every
resolved configured source entity. Missing mappings/offline sources remain
unavailable. With tracking disabled, `players` is empty. The compact administrator
[Now Playing card](ui.md#now-playing) refreshes this snapshot while visible.
It uses HA's existing authenticated media-player image route for current cover
art; the API exposes no image URL, access token, or arbitrary fetch destination.
No database schema/export version changes are needed. Progress and controls remain
planned; the card never calls HA actions or opens device connections.

## Authenticated API

Use HA's existing authenticated WebSocket connection. Active users may call `info`,
`journal/list`, and `journal/get` to browse the shared household journal. Other
commands and all exports require an active administrator. No token or
unauthenticated data endpoint is added by this integration.
Authorization is repeated before returning private results after awaited work;
accepted writes remain committed if access changes during processing. These
endpoint checks do not sandbox the integration from the rest of HA.

`info` includes `permissions: {read, edit, export}`. For regular users it returns
only scope, API version, revision, visible viewing count, and these permissions;
administrator responses retain schema/storage/tracking health. Regular-user viewing
responses allow only `id`, `title`, `started_at`, `ended_at`, `duration_seconds`,
`watched_seconds`, `status`, and `origin`. Notes, source/player/content IDs, session
evidence, mutation history, and deletion tombstones remain outside this surface.
Any change in active/admin status during an awaited operation withholds its result.
Accounts share the same household history; there is no per-user dataset.

The [history sensors](sensors.md) derive completed and unfinished-partial summaries
from this database without adding a schema migration. Their title/count states
follow HA entity visibility and may be retained by Recorder and automations.

Every command type starts with `kaleidescape_companion/`. Use `info` to discover
the loaded entry and dataset. All journal commands require both `entry_id` and
`dataset_id`; a stale dataset reference is rejected. If the entry is unloaded,
`info` returns an empty list and scoped commands return `not_ready`.

| Command suffix | Additional inputs | Result |
| --- | --- | --- |
| `info` | None | `entries` with scope, API/schema versions, counts, revision, and feature flags |
| `journal/create` | `request_id`, `data` | Committed `viewing` and dataset `revision` |
| `journal/get` | `viewing_id` | One visible viewing |
| `journal/sessions` | `viewing_id` | Latest 100 sessions and `has_more` |
| `now_playing` | None beyond scope | Read-only `players` snapshot and recording health |
| `journal/list` | Optional `query`, `status`, `limit`, `cursor` | `items`, `next_cursor`, dataset ID and revision |
| `journal/update` | `request_id`, `viewing_id`, `expected_revision`, `patch` | Committed `viewing` and dataset `revision` |
| `journal/delete` | `request_id`, `viewing_id`, `expected_revision` | Tombstoned `viewing` and dataset `revision` |
| `settings/start` | None beyond scope | Native HA options form: `flow_id`, `fields`, `errors` |
| `settings/submit` | `flow_id`, `data` | Updated form/errors or `type: create_entry` after native persistence/reload scheduling |
| `settings/cancel` | `flow_id` | Abort this user's Companion options flow without saving |
| `database/inspect` | `table`; optional `offset`, `revision` | Fixed table counts, up to 25 raw `items`, `offset`, `revision`, `has_more` |
| `database/purge` | `request_id`, dataset `expected_revision`, `viewing_ids`, `all`, `confirmation` | Content-free `purged_count` and dataset `revision` |
| `database/update` | `request_id`, `viewing_id`, viewing `expected_revision`, `patch` | Existing validated viewing corrections, including tombstones; no immutable/internal field edits |

Mutation request IDs and viewing IDs are UUIDs. Reuse the **same request UUID
and payload** when retrying an uncertain response; the original committed result
is returned without another write, including after restart. Reusing that UUID
for different data returns `conflict`. An old retry returns its original result,
even if later edits or deletion have occurred; fetch again for the current state.
After permanent purge, affected old mutation retries return `not_found` instead
of cached content, and cannot recreate a viewing.
There is no automatic expiry of request deduplication in this initial schema.

`expected_revision` is the viewing's revision, initially `1`, and increases with
each update or deletion. The separate dataset revision increases on every new
mutation. Stale corrections return `conflict`. A delete hides the record from
get/list; it retains a tombstone, original content, and retry history in storage
and exports. It is not a permanent privacy purge.

Lists sort by `started_at` descending, then viewing UUID descending. Search is a
literal, Unicode case-folded title substring; `status` is `partial` or `completed`.
The default page size is 50 and the maximum is 100. Cursors bind to the dataset,
revision, and filters. Any intervening mutation or filter change returns
`refresh_required`; restart from the first page. Do not parse or alter cursors.

### Record fields

| Field | Rules/default |
| --- | --- |
| `title` | Required, nonblank text, at most 500 characters |
| `started_at` | Required ISO timestamp with timezone; stored as UTC |
| `ended_at` | Optional timestamp with timezone; cannot precede start |
| `duration_seconds` | Optional nonnegative number, otherwise `null` |
| `watched_seconds` | Nonnegative number, default `0`; independent of seek position |
| `status` | `partial` (default) or explicitly `completed` |
| `source_id`, `player_id`, `raw_content_id` | Optional opaque nonblank strings, at most 255 characters |
| `notes` | Text, at most 10,000 characters, default empty |

Seconds must be finite and at most 1,000,000,000. Booleans are not numbers.
Unknown fields and empty patches are rejected. All fields above can be corrected
with `journal/update`. The backend also returns immutable IDs, `origin: manual`,
creation/update times, viewing revision, `deleted_at`, `completed_at`,
`completion_reason`, and `rule_version`. Observed records use `origin: observed`.
Corrections to observed fields remain authoritative: later checkpoints update
session evidence but preserve the fields you edited. Deleting an active viewing
keeps that session attached to its tombstone, so updates cannot resurrect it.

### Database maintenance

Settings and maintenance commands require an active administrator before access
and after awaited work. They retain entry/dataset scoping. Settings are an adapter
to HA's own options manager, not another configuration store: flows are bound to
the initiating actor and this entry, unknown fields/foreign flows are rejected,
and a changed configuration fingerprint rejects stale submission. Starting a new
Companion Settings form replaces that user's prior options flow. Saving uses the existing
`OptionsFlowWithReload`; it does not set arbitrary HA options or call actions.

Inspection accepts only `viewings`, `sessions`, `requests`, `manual_audit`,
`maintenance_audit`, `import_audit`, and `schema_metadata`. Rows sort by their internal primary
key with fixed 25-row pages, counts, and `has_more`. `offset` is a nonnegative
integer at most 10,000,000; provide the first page's dataset `revision` on later
pages. Intervening writes return `refresh_required`. Raw values include private
notes, actor IDs, source identifiers, tombstones, and cached response JSON; this
surface is never projected to regular users. SQL, paths, or other table names
are not accepted.

Purge requires recording disabled in the saved configuration and no live
observer, and rejects backup or active export overlap. It uses the **dataset**
revision (including 0), not a single viewing revision. Pass 1–100 unique viewing
UUIDs with `all: false` and `confirmation: "PURGE"`; or an empty ID list with
`all: true` and `confirmation: "PURGE ALL"`. Selected entries may be visible or
tombstoned. Scope/revision/confirmation failures make no changes.

One worker transaction removes the chosen viewings, associated sessions and
manual audit rows, and content from all matching cached mutation responses,
including legacy requests without audit attribution. Request UUIDs/fingerprints
remain as content-free `purged` barriers: replay returns `not_found`. A separate
minimal purge receipt plus `maintenance_audit` records the actor, time, count,
and new revision, without purged identities/content. Purge retries return the
same count/revision after restart and are bound to the original actor/payload.
This prevents accidental repeated purges and old create retries resurrecting data.
Accepted writes finish even if their caller disconnects or is cancelled.

SQLite `secure_delete=ON` overwrites freed content in the live database, but file
size may stay constant while pages become reusable; no automatic VACUUM or dataset
reset runs. This is not a physical secure-erasure guarantee. Other browser data,
HA Recorder, downloaded exports, HA/host backups, and pre-migration snapshots
remain separate copies. No automatic retention is added. Resume
recording explicitly after maintenance; sensors update on their normal interval.

### Try a round trip

In the browser developer console of a logged-in HA administrator, run:

```js
const hass = document.querySelector("home-assistant").hass;
const { entries } = await hass.callWS({ type: "kaleidescape_companion/info" });
const scope = { entry_id: entries[0].entry_id, dataset_id: entries[0].dataset_id };
const requestId = crypto.randomUUID();
const created = await hass.callWS({
  type: "kaleidescape_companion/journal/create",
  ...scope,
  request_id: requestId,
  data: {
    title: "Development example",
    started_at: new Date().toISOString(),
    watched_seconds: 120,
    notes: "Manual backend test"
  }
});
await hass.callWS({ type: "kaleidescape_companion/journal/list", ...scope });
await hass.callWS({
  type: "kaleidescape_companion/journal/get", ...scope,
  viewing_id: created.viewing.id
});
const updated = await hass.callWS({
  type: "kaleidescape_companion/journal/update", ...scope,
  request_id: crypto.randomUUID(), viewing_id: created.viewing.id,
  expected_revision: created.viewing.revision,
  patch: { status: "completed", watched_seconds: 600 }
});
await hass.callWS({
  type: "kaleidescape_companion/journal/delete", ...scope,
  request_id: crypto.randomUUID(), viewing_id: created.viewing.id,
  expected_revision: updated.viewing.revision
});
```

These calls write one explicit development entry and then tombstone it. They do
not contact a player or send controls. Use a development instance for examples.

Public error codes include `invalid_request`, `unauthorized`, `not_found`,
`not_ready`, `conflict`, `refresh_required`, `backup_in_progress`, `busy`,
`export_too_large`, `export_timeout`, and `storage_error`.
Malformed WebSocket envelopes are rejected by HA's schema
validation before the handler. A failed storage operation is not reported as a
successful write.

## Export, backup, and restore

### Merge compatible viewing imports

Database uses an active-administrator-only upload:

```text
POST /api/kaleidescape_companion/{entry_id}/{dataset_id}/import?format=json&request_id={uuid}&revision={dataset_revision}
```

Use `format=sqlite` for SQLite files. The raw body is the file, not a path or SQL
script. Upload/processing has a 30-second request budget; accepted worker writes
finish even on timeout/disconnect. One import slot covers upload, validation,
transaction, and cancellation cleanup. It excludes export/purge overlap and checks
the backup write barrier. Recording must be disabled with no observer; admin,
scope, and readiness are checked before and after awaited work. Responses are
noncacheable. Browser transfers have a 65-second abort budget.

Limits are 32 MiB and 10,000 rows. JSON may be a viewing array or an object with
`viewings`; duplicate keys/IDs, non-finite values, invalid Unicode, and malformed
known values fail the whole import. `id`, `title`, and timezone-bearing `started_at`
are required; optional journal fields get normal defaults. Known metadata includes
origin, dates, revision, deletion status, correction fields, and completion data.
Unknown keys/extra export sections are ignored. Compatibility depends on the
recognized keys, including older JSON/SQLite exports, rather than replacing the
live database or trusting the uploaded schema version.

SQLite is deserialized into a separate in-memory, defensive, query-only connection
with trusted schema disabled, native size/column/SQL limits, a progress deadline,
and an authorizer allowing only SELECT/READ of the regular `viewings` table.
Views, virtual tables, functions, attachments, extension operations, and caller SQL
are not accepted. Uploaded database code/migrations/triggers are never installed
into the live DB. There are no upload files or caller-selected paths.

All records are validated before one live transaction merges new IDs. Existing
IDs, including tombstones, stay unchanged. Snapshot values retain precision;
sessions, source audit/receipts, configuration, and source dataset identity are
not imported. New entries receive no fabricated session evidence. The transaction
records a minimal `import_audit` and durable actor/payload/revision-bound request
receipt, returning `imported_count`, `skipped_count`, and `revision`. Exact retries
return the original result, including after a later purge; they cannot restore
content. A new explicit import from a retained backup can restore purged records.

Import errors include `invalid_request`, `conflict`, `tracking_enabled`,
`import_too_large`, `import_timeout`, `busy`, `backup_in_progress`, and storage/access
errors. A timeout or interrupted response is unconfirmed: retry the exact file,
request UUID, and original revision. Use offline restore below when the complete
trusted database, including evidence and retry/audit state, must be recovered.

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
`Retry-After`). Each snapshot is limited to 256 MiB and 30 seconds of preparation;
the full download has a 60-second time budget. Cleanup waits for accepted file
work to finish, so a stalled filesystem can delay cancellation beyond that budget.
Oversized exports return `export_too_large` (413); preparation timeouts return
`export_timeout` (503). A timed-out or access-revoked stream is disconnected once
headers have been sent. Downloads send `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`.

Temporary files are deleted after transfer, including cancellation and
disconnect/error paths. Owned snapshots left by a crash are removed on the next
storage open. JSON contains
format metadata, viewing records and field-correction markers, and sessions,
including tombstones. SQLite includes
the full database, including request deduplication and manual audit metadata.
JSON format 2 does not include audit tables. Compatible viewing-only imports
are supported through Database; full SQLite restore remains an offline operation.
All exports and migration backups are private, including retained tombstones;
visible deletion does not erase data. See the
[retention procedures](security.md#backup-restore-retention-and-capacity).

HA's backup hooks drain accepted writes and pause new writes while its backup
runs. Clients receive `backup_in_progress` and can retry with the same request ID
afterward. Reads and exports remain available. The post-backup hook resumes
writes after success or failure. Observation is buffered during backups;
see [automatic tracking](#automatic-tracking) for its bounded-gap policy. End-to-end HA OS/Supervisor backup behavior
still needs release validation; local tests verify the hooks and restored copies.

To restore a SQLite export, stop the target HA instance, retain a copy of its
existing journal, and replace only `kaleidescape_companion/journal.sqlite3` under
its config directory with the export. Start HA again. The dataset UUID and
records are retained; the config entry ID belongs to that HA installation.
Never replace a live database or open one journal with two HA instances.

Migrations run in order inside a transaction. Before upgrading an existing
schema, a SQLite backup is kept beside it with a versioned `.bak` name. Failed
migrations roll back, and newer or unrecognized schemas are rejected without
deleting data. Diagnostics expose versions, counts, revision, backup state, and
queue depth, without journal content or filesystem paths.

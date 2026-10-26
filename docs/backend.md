# Journal backend

The backend records manual journal entries and observed playback from one selected
HA player. API version is `1`; SQLite schema is `3` and JSON export format is
`2`. The household reader and administrator [management panel](ui.md) use this API. Live
subscriptions, library, and controls remain planned.
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
playback by default, configurable from 1 to 3,600 seconds. The threshold is evaluated
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
availability, recording error, and buffer health. The endpoint is read-only and
admin-only. The management panel displays journal/session details; a dedicated
Now Playing UI, artwork/progress, and transport controls remain planned.

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

Mutation request IDs and viewing IDs are UUIDs. Reuse the **same request UUID
and payload** when retrying an uncertain response; the original committed result
is returned without another write, including after restart. Reusing that UUID
for different data returns `conflict`. An old retry returns its original result,
even if later edits or deletion have occurred; fetch again for the current state.
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
JSON format 2 does not include the audit table. JSON import is not implemented.
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

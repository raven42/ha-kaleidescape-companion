# Journal backend

This first backend slice supports explicit manual journal records. Automatic
entity observation, playback timing, session merging, and the journal panel
are the next development steps. API version and SQLite schema version are both
`1`; integration release metadata remains `0.0.0` during development.

## Setup and storage

Start the development HA instance and add **Kaleidescape** under **Settings →
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

The initial schema contains dataset metadata, manual viewing snapshots, and
request deduplication. Player/source/content identifiers are optional opaque
values. No title matching, content-ID normalization, catalog identity merge,
or invented playback session is performed. Later phases will add session,
observation, and catalog tables through ordered migrations.

## Authenticated API

Use HA's existing authenticated WebSocket connection. All commands and exports
currently require an active administrator. Household sharing is not implemented
yet. No token or unauthenticated data endpoint is added by this integration.

Every command type starts with `kaleidescape_companion/`. Use `info` to discover
the loaded entry and dataset. All journal commands require both `entry_id` and
`dataset_id`; a stale dataset reference is rejected. If the entry is unloaded,
`info` returns an empty list and scoped commands return `not_ready`.

| Command suffix | Additional inputs | Result |
| --- | --- | --- |
| `info` | None | `entries` with scope, API/schema versions, counts, revision, and feature flags |
| `journal/create` | `request_id`, `data` | Committed `viewing` and dataset `revision` |
| `journal/get` | `viewing_id` | One visible viewing |
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
creation/update times, viewing revision, and `deleted_at`.

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
`not_ready`, `conflict`, `refresh_required`, `backup_in_progress`, `busy`, and
`storage_error`. Malformed WebSocket envelopes are rejected by HA's schema
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
Exports are streamed from consistent worker-created snapshots; temporary files
are deleted after transfer, including disconnect/error paths. JSON contains
format metadata and all viewing records, including tombstones. SQLite includes
the full database, including request deduplication. JSON import is not implemented.

HA's backup hooks drain accepted writes and pause new writes while its backup
runs. Clients receive `backup_in_progress` and can retry with the same request ID
afterward. Reads and exports remain available. The post-backup hook resumes
writes after success or failure. Automatic observation buffering is not needed
until observation is implemented. End-to-end HA OS/Supervisor backup behavior
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

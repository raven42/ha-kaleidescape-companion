# Security policy and hardening

This policy governs current and future development. Changes to access, storage,
networking, imports, exports, or frontend rendering must preserve these rules
and include tests for the affected boundary. This is a maintained security
baseline, not a claim of independent security certification.

Frontend tests retain Lit lifecycle diagnostics and fail on unexpected console
warnings/errors; only the test build's expected development-mode banner is
suppressed. Cover configuration changes clear stale image state before
rendering, while preserving authenticated, visibility-triggered fetching and
bounded cache retention. These logging controls do not suppress production
diagnostics.

## Trust boundaries

| Boundary                                 | Policy and limitation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser → integration API                | Active authenticated HA users may read the shared household viewing summary and enabled cached Library metadata/artwork. Journal/catalog mutations, notes/source/session details, Now Playing, exports and shared UI preferences require an active administrator. Active users may read/write only their own browsing preferences. Now Playing also checks read permission on the configured source entities. Dataset IDs select data; they are not credentials.                                       |
| Integration → HA                         | Custom integrations execute in Core's process with Core's filesystem, entity, credential, and network access. Entity selection is application behavior, not a sandbox. Other code running as HA can read this database.                                                                                                                                                                                                                                                                                |
| HA users → one another                   | All active users share one household journal; there is no personal watch history or per-user journal ownership. Personal browsing preferences are scoped to authenticated HA user IDs, with shared hidden collection names managed by administrators. A positive field allowlist limits regular-user API responses. HA roles are not strong isolation between hostile authenticated users.                                                                                                             |
| Journal/Library → HA entity states       | History/Library sensor states and attributes deliberately expose movie titles, times, counts and storage sizes through HA entity access. Recorder, dashboards, automations, and backups can retain these values outside the private database. Notes, source identities, sessions, and audit actors must never enter sensors.                                                                                                                                                                           |
| HA → devices and services                | Observation reads selected HA states. Optional library sync makes bounded GET-only requests to the configured private LAN browser origin, using validated/pinned DNS results. Sync is disabled by default. A separate off-by-default administrator action can add one selected version to an existing verified collection. Now Playing artwork uses HA's existing image proxy. A separate calendar opt-in permits fixed create/lookup actions on one selected HA calendar; its provider may be remote. |
| Device/imported data → storage and UI    | Treat metadata, notes, HTML, image references, and imported files as untrusted, including data from local devices. Validate before storing or using it, and render text without executing markup.                                                                                                                                                                                                                                                                                                      |
| Storage → filesystem and exports         | Journal contents, source identifiers, audit actors, UI searches/preferences/user IDs, backups, and retry responses are private household data. Keep them outside static web roots and access them through the authenticated API.                                                                                                                                                                                                                                                                       |
| Development machine → test HA deployment | Deployment is an explicit privileged SSH operation. Verify the host key and target, send only the runtime package, and configure restart through fixed HA OS/Container commands. Normal checks must never connect to or modify the target.                                                                                                                                                                                                                                                             |

The integration does not add its own web server, database listener, identity
system, or general-purpose HA action/SQL/file proxy. Compiled panel assets may
be public; they must contain no credentials or household records.

If containment from compromised integration code becomes a requirement, use a
separate unprivileged process/container with its own storage, restricted network
access, and a narrow message interface. A full HA administrator token or an HA
configuration-directory mount would undermine that separation. Selecting a web
framework alone does not establish isolation.

## Implemented backend protections

- WebSocket reads and cached Library artwork require an active authenticated
  user; personal UI field patches additionally require that same authenticated
  actor, derived on the server. Management operations, shared preferences,
  manual sync, imports, and journal downloads require an active administrator.
  Check before storage access and after awaited work. A change in active/admin
  status during a request withholds its result, including an administrator
  response after a downgrade.
- Entry/dataset scoping is validated on every request. Schemas reject unexpected
  fields, and record validation bounds lengths, numbers, dates, and result
  pages.
- SQLite values use parameters. Database paths and SQL identifiers are internal;
  callers cannot supply arbitrary paths, SQL, or HA actions.
- The dedicated storage directory uses owner-only access (`0700`) and managed
  files use `0600`. Existing files are tightened when storage opens, including
  migration backups and SQLite sidecars. Managed symlinks and hard-linked files
  are rejected. These protections require filesystem permission support; they do
  not isolate code running as the same operating-system user.
- Export snapshots live in a private directory under journal storage. Only one
  HTTP export per loaded repository may be prepared or streamed at a time.
  Snapshots are size bounded, downloads have a time budget, and temporary files
  are removed on completion, failure, disconnect, and cancellation. Leftovers
  from a crashed process are removed on the next open. Preparation has a
  30-second budget and a download has a 60-second budget; cleanup must wait for
  accepted filesystem work and can outlast cancellation.
- Database growth is capped at 256 MiB of SQLite pages. Existing larger files
  remain readable without permitting further page growth. Export snapshots are
  capped at 256 MiB. The write queue remains bounded at 128 operations and
  source observations at 256. These are resource limits, not a complete
  denial-of-service defense against an administrator or compromised HA process.
- Schema 3 records manual mutation audit metadata transactionally: authenticated
  HA user ID, operation, request/viewing IDs, revisions, and time. It stores no
  additional title, note, credential, or before/after content. Retries do not
  create duplicate audit events. Historical actors cannot be reconstructed.
- API storage errors contain safe messages. Diagnostics contain health metadata,
  not journal content, actor IDs, source addresses, credentials, or file paths.

File protection errors fail storage setup rather than silently accepting a
publicly accessible journal. Permissions are applied only to integration-owned
storage, not the entire HA configuration tree. The HA configuration directory
and its ancestors must themselves be controlled by the HA operator. Run only one
HA process against a journal directory.

## Development and frontend hardening

1. Use an isolated HA instance, development accounts, and fictional data. The
   supplied launcher and Vite configuration bind to loopback. Keep discovery and
   household credentials out of the development instance. Existing local YAML is
   retained: verify its bind address when reusing an older configuration.
2. Keep `.ha-dev/`, `.env*`, databases, exports, tokens, device snapshots, and
   private logs out of Git. Ignoring a file does not protect it on disk. The HA
   launcher uses restrictive creation permissions and a private `.ha-dev/`.
3. The HA management panel uses HA's signed-in connection. The Vite adapter
   authenticates explicitly to the fixed local HA instance with a development
   token, held only in memory. Disconnect, page exit, or connection loss closes
   the socket and drops credentials; it does not revoke the token in HA. The
   adapter's entry point is excluded from the packaged HA module. A proxy is
   routing, not authentication. Never inject a privileged bearer token into
   arbitrary proxied requests or embed it in source, URLs, bundles, or browser
   environment variables. HA user tokens are not journal-scoped credentials.
4. Vite custom environment-variable exposure is disabled. Keep explicit host
   restrictions, CORS disabled for the standalone shell, strict filesystem
   serving, and fixed ports. The development HTTP proxy accepts only GETs to the
   explicit journal export route and query-free
   `/api/media_player_proxy/media_player.<object_id>` artwork route, plus POST
   to the scoped `import/preview` route with only a fixed format query field,
   and query-free scoped `library/artwork/<opaque key>` GETs, at a fixed
   `127.0.0.1:8123` target. It rejects image query tokens, browse-media
   subpaths, and arbitrary paths/URLs. It checks the origin or same-origin Fetch
   Metadata, passes the browser's bearer header, and injects no credentials.
   WebSockets go directly to local HA; there is no WebSocket proxy or origin
   rewriting. Any extension requires a boundary review.
5. Render imported strings through Lit text bindings. Avoid `unsafeHTML`, script
   URLs, remote executable assets, and broad HTML sanitization exceptions.
   Current cover images use only the fixed HA image route and bounded raster
   image blobs, never metadata-supplied URLs. Validate any future image/link
   protocols and destinations before extending that allowlist. Serve the
   compiled bundle through HA in production; Vite is a development tool.

The management UI renders metadata through text bindings, sends only changed
fields for corrections, and keeps expected revisions and request UUIDs on
writes. Request UUIDs use native `crypto.randomUUID` or cryptographic
`getRandomValues` with UUID v4 formatting; never substitute timestamps or
`Math.random`. If secure randomness is unavailable, preparation fails visibly
before any write is sent. An unconfirmed content write locks its exact payload
for explicit retry, including an unload/error after a possible commit.
Explicitly discarding that retry, navigation, or reload can lose it, so inspect
history before recreating an entry. Connection/user changes clear private
forms/lists, invalidate outstanding responses, and abort exports. Downloads have
a browser byte limit and temporary object URLs are revoked; already downloaded
files remain the operator's responsibility. The [UI guide](ui.md) documents
behavior and test limitations. The explicit layout review fixture uses fictional
data and is excluded from the packaged panel.

## Household read access and sensors

| Capability                                                                          | Active regular/read-only HA user     | Active administrator                 |
| ----------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Shared sidebar journal, search/filter/pagination                                    | Allowed                              | Allowed                              |
| Viewing title, start/end times, runtime, watched time, status, origin               | Allowed                              | Allowed                              |
| Notes, raw source/player/content identifiers, session evidence, storage health      | Denied by the integration API        | Allowed                              |
| Create/correct/delete, Now Playing, JSON/SQLite export                              | Denied                               | Allowed                              |
| Integration settings, raw-table inspection, confirmed Database edit/delete          | Denied                               | Allowed                              |
| Reviewed viewing/Library JSON/SQLite merge imports and Database viewing corrections | Denied                               | Allowed                              |
| Cached Library metadata/artwork and counts/revision/sync timestamps                 | Allowed when library sync is enabled | Allowed when library sync is enabled |
| Library sync progress/configuration/storage/error details and manual sync           | Denied                               | Allowed when library sync is enabled |
| Personal Library view/count/search/filter/sort/sizing preferences                   | Own values only                      | Own values only                      |
| Shared hidden collection names                                                      | Denied                               | Allowed                              |

Anonymous and inactive users are denied all journal and UI preference
operations. Regular-user `info` returns only API version, scope, revision,
visible-record count, Library enablement, and permissions. Regular-user
`library/info` uses a separate positive allowlist of
version/group/name/collection counts, source revision, an opaque
collection-preference key, and catalog/collection timestamps. `library/list`
uses the same explicit cached-title projection for both roles: known display
metadata including rating badges, opaque title/artwork keys, memberships/status,
group favorite/recent booleans, and detection/freshness times. It excludes
origin, raw source handles/groups, file paths, and private journal/session/audit
fields. Administrator-only version details additionally include private invoice
history. `journal/list` and `journal/get` use a positive record-field allowlist;
adding a database column must not implicitly expose it. Deletion tombstones are
excluded from these reads. Mutation authorization is enforced on the server;
hiding editor/export controls is not authorization. Known user/connection/role
changes clear the browser's old data and ignore late responses. Browser
downloads and data already observed cannot be recalled when access changes.

The household [sensors](sensors.md) publish completed/partial viewing history,
source-scoped Library counts, last catalog time, storage sizes and a bounded
recent-addition title batch. These are normal HA entity states, not
administrator-only API responses or per-user lists. HA entity permissions,
Recorder, automations and backups can retain them. They contain no notes, audit
actors, raw source handles/groups, origin, cache keys or private paths.

History and Library/storage each use a local-worker coordinator every 30 seconds
while their enabled entities have listeners. Entity getters read memory. No
sensor starts a sync, resolves DNS or contacts a device. Failed reads mark that
coordinator's entities unavailable, preserving independence from the other.
Library states use the currently configured source, reject late results after a
source change, and become unavailable immediately on opt-out; aggregate storage
sizes remain readable because disabled caches still occupy space. Missing
catalog/status context keeps watched/unwatched counts unknown rather than
publishing fabricated zeros or incomplete totals.

Title arrays contain at most 50 strings and 8 KiB UTF-8 JSON with an explicit
truncation flag; integer counts remain exact. The last-title state respects HA's
255-character limit. Schema 10 persists a bounded recent-batch snapshot, exact
count and timestamp on the source row inside the catalog transaction. Initial
sync is a baseline. Only newly discovered source groups replace the batch;
metadata/purchase imports, formats and unchanged scans do not. A retained batch
can describe titles no longer available. Imports cannot supply/restore these
operational fields; source tables remain outside portable import projections.
Schema 11 adds source/version batch markers for exact-group UI badges, with no
raw marker exposed in the public projection. No remote operation or full-catalog
entity attribute is added by the sensors. Use the existing
active-user/enabled-Library paginated API for complete lists.

## Now Playing and current artwork

The compact Now Playing card preserves administrator-only snapshot access and
checks HA entity `POLICY_READ` for all resolved configured source entities
before reading their live state. No journal ownership/sharing capability
changes. Responses include session timing/credits/gaps and health, not image
URLs or proxy tokens. The artwork change key is an opaque hash of the HA-local
picture reference, kept in memory only. External, malformed, and unrelated
picture references do not enable the cover request. Current-session context must
match the source content ID.

The browser builds an exact, query-free HA media-player proxy path from a
validated entity ID and fetches it using HA authentication, with redirects
refused. Only JPEG/PNG/WebP are accepted. Accumulation is capped at 5 MiB and
image requests have a five-second browser budget. This is a browser limit; HA
owns upstream fetching and caching. No new arbitrary-fetch endpoint, persistent
image store, Python image decoder, or device connection is introduced by
Companion. Missing or failed artwork has a placeholder. Raw picture URLs,
tokens, and image bytes never enter the journal, exports, diagnostics, or logs.

HA's existing media-player image route has its own authentication/token
behavior; it is not a Companion administrator-only endpoint. Other HA users may
already access images according to HA's wider trust model. The card never copies
signed image URLs or adds query tokens, and Vite passes only the browser's
bearer header on the allowlisted export/artwork GET and scoped import POST
routes; it never injects credentials of its own.

The snapshot refreshes about every five seconds while the card/page is visible;
requests do not overlap. Hiding/unmounting or account/connection changes clear
data, abort image work, revoke object URLs, and invalidate late results. Denied
access clears the card and stops automatic retries until explicit refresh, page
return, or rebind. There are no controls or HA action calls. Source metadata is
text, never executable markup. Future user sharing, subscriptions, controls,
remote URLs, or historical artwork require another boundary review and
regression tests.

The automatic runtime-admission rule validates its numeric configuration and
normalized source duration; it adds no fetches or control operations. It
preserves existing records, manual corrections, tombstones, audit, and retry
semantics. Unknown runtime waits when the rule is enabled. Now Playing's
cutoff/exclusion fields stay on the existing administrator/source-permission
surface, outside regular-user journal projections and history sensors. This is a
recording heuristic, not a security boundary or a reliable source content
classification.

## Settings and permanent maintenance

Administrator tabs mount only their selected view. Switching pages stops Now
Playing polling and cancels an abandoned settings flow. Drafts require discard
confirmation, and pending mutations retain their exact retry state until
resolved or explicitly discarded. Regular users keep the read-only journal
without these controls; their Library/Journal tabs share permitted cached reads
and actor-scoped personal browsing preference writes. Database New Entry uses
the existing administrator journal/create API, with no create/edit capability
for internal evidence, audit, retry, or metadata tables. Moving controls into
tabs does not grant API access or expand data projections. Journal Delete uses
the tombstone API; Database Delete permanently removes supported selected rows
through the confirmed mutation contract below. Audit, retry, dataset metadata
and device-write receipt tables disable mutation controls. Native
transfer/edit/delete dialogs block dismissal during accepted work or an
uncertain result; explicit retry discard remains available. Cancelled file
selection clears its private File and native input.

The sidebar settings adapter operates only this Companion entry's native HA
options flow. Start/submit/cancel require an active administrator; flows bind to
the authenticated actor and entry and reject configuration changes since
opening. Unknown setting fields and another user's or integration's flows are
rejected. Validation, storage, and reload stay in the existing HA options flow.
This adds no general options/action proxy or Vite HTTP route. A lost save
response requires reopening and inspecting the persisted values rather than
blindly replaying it.

Database inspection and the new query/administration commands require an active
administrator, before storage work and again after awaited results. The
[Database contract](database.md) allows eighteen fixed tables, known column/JSON
aliases, 10/25/100/500-row pages and 8 MiB result pages. Column identifiers come
only from the local migrated schema; values use parameters. The condition parser
supports comparisons, NULL tests, literal CONTAINS, LIKE and boolean grouping.
It accepts at most 2000 characters, 128 tokens and eight levels; inspection SQL
has a two-second progress deadline removed in finally. It cannot execute
arbitrary SQL/DDL/functions/subqueries, install schemas, or accept paths. Query
validation returns owned, position-based guidance without echoing entered
values. Autocomplete uses schema names/operators and text bindings. All columns,
even protected keys, can be queried without becoming writable.

`database/mutate` is a narrow edit/delete API over supported fields. It requires
entry/dataset scope, actor-bound cryptographic UUID, inspected content revision,
row keys and snapshot tokens, and explicit SAVE/DELETE confirmation. The worker
validates all selections before applying one transaction. Stale snapshots or
intervening content changes fail without partial changes. IDs, relationship
keys, managed paths, audit/receipt records and dataset identities/counters
remain protected; native source configuration still uses its existing options
flow. Open playback sessions/their viewings reject writes. Pending device
additions protect their source, and retained receipts protect source/version
foreign keys. Library edits preserve journal headroom. JSON metadata/preferences
use known field validators, never imported SQL or arbitrary file/network
references.

Recording and sync need not be disabled for these targeted edits/deletions:
revision conflicts protect accepted snapshots, while later authoritative source
sync can recreate/overwrite cached data. Bulk imports and the compatibility
purge API retain their disabled-recording rule. Backup and transfer barriers
apply to new operations; exact committed retries return the stored result,
including during backup. Accepted work can commit after disconnect or access
loss, but a changed role/activity/readiness withholds the private result.

Schema 12 records `database_audit`: actor, request UUID, operation/table,
affected field names/count, content revision and time, without copied row
IDs/content. Database Delete is permanent and handles local references
transactionally. Viewing deletion removes session/manual-audit links and redacts
cached viewing responses while retaining replay barriers and the new operation
audit. Library collection/source/version deletion clears local memberships in
dependency order; receipt references block deletion rather than weakening
external-write recovery. Artwork deletion clears indexed references before
unlinking only its validated, private content-hash file; a failed unlink leaves
an unserved orphan for normal cache reconciliation. No device write or arbitrary
filesystem operation is added. Backups/downloads/Recorder copies and physical
secure erasure stay outside this operation. A crash after commit but before file
cleanup can leave a private orphan.

Raw-first details and explicit edit/delete dialogs use safe text bindings. Dirty
edits require explicit discard; pending/unconfirmed mutations block implicit
dismissal/navigation and preserve their exact retry payload. Account/connection
changes clear drafts, raw rows and outstanding responses. UI-only Database
preferences have their own actor-scoped settings row and never grant access to
raw data. Shared hidden names remain administrator-managed. A monotonic settings
counter protects raw settings pagination after row deletion; journal/catalog and
reviewed-import revisions remain independent of ordinary preference saves.

## Reviewed viewing and Library imports

The [merge import contract](imports.md) is active-admin-only and scoped to the
current entry/dataset. Upload is a raw POST to
`import/preview?format=json|sqlite`; apply is a fixed `database/import`
WebSocket command. Check identity, active/admin status, readiness and disabled
recording before accepting work and after awaits. No caller-selected path, SQL
statement, source origin or device operation is accepted. Vite permits only that
exact preview route at fixed local HA.

Bound uploads to 32 MiB, combined viewing/title/purchase rows to 10,000, review
responses to 8 MiB, and upload/validation/review to 30 seconds. One transfer
slot excludes exports/purge and sync writes; cancellation drains accepted worker
work before releasing it. One bounded in-memory review per repository replaces
its predecessor, is actor-bound and expires for apply after ten minutes. Unload
clears it; expiry is checked on use, not a promise of immediate memory erasure.
Revision checks invalidate reviews after any database change. Selected keys must
be distinct, eligible rows in that exact server-owned review, at most 10,000;
clients cannot supply a field patch or substitute an import payload at apply
time.

Strict JSON rejects duplicate keys, non-finite values and malformed recognized
fields. SQLite is deserialized in memory, with defensive/query-only operation,
trusted schema disabled, limits and progress deadline. Inspect only regular
allowlisted `viewings`, `library` and legacy `library_titles`,
`library_purchases` and `library_purchase_dates` tables, then allow SELECT/READ
only; views, virtual tables, functions, attachments and extensions are denied.
Source schemas/triggers are never installed. Validate the entire file before
review or writes. Import no session, audit, receipt, configuration, network
origin, fetch/artwork path/key, collection membership or live recorder state.

Match viewing UUIDs and validated source-scoped version IDs, never title text.
Skip unknown Library sources and existing tombstones. Fill only missing allowed
fields; preserve populated values, zero, manual correction markers and existing
source grouping/detection/availability. New Library versions remain inactive
until source sync verifies them. Dates must be calendar days from 1990 through
the current UTC day. All selected writes, source/dataset revisions, minimal
content-free audit counts and actor/selection-bound UUID receipts commit in one
transaction. Imported writes respect the backup barrier and 192 MiB Library
ceiling, preserving journal headroom. Audit includes no source file name or
record content; historical purchase audit consolidation preserves original
source revision with a null dataset revision rather than inventing one.

An accepted apply can finish after disconnect/revocation; withhold its result
when access changes. Exact retries check durable receipts before the ephemeral
review and remain confirmable after restart/expiry/purge, without replaying a
committed write. A new explicit import may intentionally restore purged IDs.
Account/connection changes clear files/reviews/selection and ignore late
replies. Browser reload loses its pending retry; inspect before recreating it.
Native SQLite/Core remain upstream parser dependencies, not a process sandbox. A
full trusted restore remains offline.

Schema 16 stores invoices directly in `library` (renamed from `library_titles`)
and removes the separate schema-15 purchase table. `purchase_history` retains
repeat orders; flat private columns summarize the earliest invoice. Purchase
identities hash title/date/order/link on the worker; provided IDs must match and
duplicate identities are rejected. Prices are bounded nonnegative currency text
including zero, order IDs to 256 characters, passive HTTP(S)/store-relative
links to 2048 without credentials/control characters, and each history to 1000
records / 2 MiB. Links are never fetched or used as origins.

The reusable `library/title_matching.py` engine accepts a validated `TitleQuery`
with title, optional alternate title/year and paired source/group scope. It does
not read invoice fields or choose import writes. Adapters validate their format
and supply evidence; `library/purchases.py` extracts passive movie-store hints
and preserves purchase identity. Optional preferred entry IDs are
caller-controlled internal context, not a browser parameter. All matches target
scanned Library entries and remain suggestions. Purchase imports require
explicit selection.

A per-review worker index compares normalized display/search titles and supplied
title/year hints. Fixed text transformations handle punctuation/accents,
articles, edition suffixes, numeric spellings and bounded franchise ordinals; no
user regex, SQL expression, network fetch or executable parser is introduced.
Catalog loading is capped at 20,000 available versions and uses the review
deadline. Conflicting title/sequel evidence, nonmatching/unknown release years
and multiple source groups remain unresolved. Supplied years must appear in the
group's cached metadata.

Suggestions still require explicit administrator selection/approval. Exact entry
IDs and stored associations retain their integrity rules; a matching statistic
is proposal coverage, not proof of identity. Manual review can select an exact
entry for an alias. Stored associations cannot move through reimport. Invoice
merges fill missing values only, preserve conflicts and commit atomically with
revisions/audit/receipts; sync leaves history untouched. Upgrade only: old
unmatched invoices become unavailable pending Library rows, excluded from
browse/sensor projections, until reviewed matching moves their history and
removes the emptied pending row. Migration retains a private backup.

Purchase prices/order IDs/links/history are omitted by positive public
projections, not merely hidden in the UI. Only administrator `library/versions`
responses add stored history, with role/activity checks before and after awaited
work. Household lists/search, sensors, viewing snapshots and calendar fields
never receive it. Public purchase dates remain shared. Raw Library inspection
and exports require administrator access. Confirmed Database price edits update
both the flat summary and earliest invoice; identity/link/raw history are
protected. Deleting a Library entry/source deletes its owned purchases,
preserving the invariant that no persisted invoice can be orphaned. Backups and
exports retain their own copies. No device/provider operation or HTML parser is
added.

Unresolved purchase rows are prioritized in review. Administrator-only scoped
`database/import/search` and `/match` WebSocket commands validate the current
actor, review token, expiry, content revision and unresolved purchase key on the
worker. Recording must be disabled; role/activity/runtime scope is rechecked
after awaits. Search is literal partial-name matching, at most 100 characters,
20 grouped suggestions and a two-second SQLite budget. It supplies only bounded
cached title/year/director/version labels and exact IDs, with no device request.
An explicit choice resolves an available exact entry ID as the history owner. It
can associate an alias/remake deliberately without rewriting purchase identity
or playback/version identity. Already stored associations cannot be reassigned
through this interface.

Choices modify only the bounded in-memory review. Each choice rotates its token,
keeps the original expiry, and updates the displayed patch/counts. An old
approval token is rejected, including after a lost matching response; that case
requires fresh review. Final apply commits the chosen association with selected
records under the existing atomic audit/receipt contract. Scope changes,
disconnect and unmount clear pending completion text and ignore late responses.
No new origin, filesystem, SQL, device-write or regular-user capability is
added. Legacy supplied source/group links remain scoped to that cached group and
must satisfy the matching evidence; unknown exact IDs require manual matching.

## Future connectors, controls, and sharing

- Use HA's shared HTTP client, certificate verification, bounded timeouts,
  response sizes, concurrency, and retry backoff. Restrict destinations and
  redirects to the configured device. Local-device addresses are legitimate;
  arbitrary client-supplied fetch URLs are not.
- Keep library synchronization read-only. Playback requires an explicit user
  action, a configured player, a supported operation, and server-side permission
  checks. Do not expose raw protocol or general HA service forwarding.
- The
  [standalone playback harness](playback-controls.md#standalone-protocol-proof-of-concept)
  is an explicit operator tool, with no HA action/API registration or database
  writes. It uses literal private LAN IPs on port 10000 and verifies the
  directly connected serial/movie-zone capability before controls. It bounds
  frames to 4 KiB, each response to 128 KiB/256 messages, metadata to 128 rows,
  each connection/request to 5 seconds and observation to 10 seconds. It
  validates checksums, escaping, address/sequence correlation and returned
  metadata handles. Partial frames, wrong-device events and acknowledgements
  alone cannot confirm title playback. Possible sends are never automatically
  replayed; cancellation closes the socket. No discovery, wake or prefix
  fallback runs implicitly. Reports go to the operator's stdout without raw
  protocol logging. They contain private device/movie data and must not enter
  fixtures, Git or public logs. Operations serialize per client instance; the
  proof of concept has no cross-process lock or durable receipt. It is not a
  production HA control path.
- Future HA discovery/control opt-ins must be separate from Library sync. TCP
  connections require LAN validation, pinned destinations, verified serials and
  bounded framing/read budgets. Device replies and cached handles are untrusted;
  user-supplied commands/addresses are never a launch interface. Initial launch
  access remains administrator-only with HA entity control permission checks.
  Serialize per player, confirm interruption/wake intent and retain durable
  request outcomes; never replay uncertain sends. Discovery and catalog sync
  must not wake players or issue playback commands. The plain TCP interface must
  stay on the trusted LAN, without Internet exposure; HA authorization does not
  protect a device from another host with direct network access.
- Store necessary device credentials in HA config entries and redact them from
  errors, diagnostics, logs, and exports. Do not assume config-entry storage is
  encrypted or inaccessible to other HA code.
- Define household read/edit/export/control capabilities before adding sharing.
  Check relevant entity permissions as well as journal permissions.
  Subscriptions must stop releasing data when access is revoked or their entry
  unloads.
- Imports must validate size, schema, paths, identifiers, and content before
  applying transactional changes. Any extension to permanent purge must preserve
  coverage of sessions, retry responses, audit references, and retry barriers.

## Optional library network and cache boundary

Library sync is off by default. Only explicit enablement constructs its
connector, creates a managed HA HTTP session, resolves the default
`my-kaleidescape.local` name or configured host, and schedules GETs. Browsing
uses SQLite, not device requests. All active HA users may read enabled cached
metadata and artwork; settings and manual sync require an active administrator.
Scope/readiness/role checks apply before storage and after awaits, including
role changes on a read. Regular users retain their positive journal projection
and receive only the Library display fields and public freshness/count metadata
described above. `library/versions` uses the same active-user/source/readiness
checks and positive metadata projection, with opaque current-version keys,
50-row pages, bounded offsets, and source-revision checks. An opaque preference
hash invalidates stale list pagination and refreshes cached labels after
settings changes. Source-scoped `source_group` grouping is performed before
pagination; name text cannot combine remakes. Missing descriptive metadata may
inherit only from available versions in that exact source group at read time.
Populated fields and version-specific runtime/formats/artwork/dates/memberships
remain independent. Raw source metadata, stored identities, viewing facts, and
source memberships are never rewritten. Group format/year summaries are bounded
to 100 values. Individual metadata is loaded in 50-version pages; only the
selected version mounts a popup cover. Grid resize observers and debounced page
work stop on disconnect/access changes; stale layout replies are ignored and
page-size changes do not bypass normal scope/role checks.

Hidden collection names are a validated, administrator-managed display
preference (up to 200 names, 256 characters each). Shared Library projections,
facets, counts, and sort values omit them. Their movies stay visible, and cached
memberships still determine Played/Paused status. Hidden labels are not an
access-control boundary: administrators can still inspect raw tables/exports. No
new network operation or write capability is introduced by hiding names. The
separately opted-in [Add to Collection action](library-collections.md) honors
these preferences and requires an explicit administrator submission. Source
reads never trigger it. Disabling sync denies Library API access but retains
private cached data. No cloud store, password login, arbitrary vendor editing
route, or playback operation is supported.

Configured origins allow HTTP(S) on standard ports, without credentials, path,
query, or fragment. Resolution uses HA's shared DNS/mDNS resolver when
available. Only RFC 1918 IPv4/ULA IPv6 results can be selected. Each scan pins a
validated IP while retaining the original Host/TLS hostname; changing DNS cannot
redirect the request to a different destination. Loopback, link-local/metadata,
public, multicast, and unspecified destinations are rejected. TLS verification
stays enabled, cookies are disabled, proxy environment settings are ignored, and
redirects/compressed bodies are refused. The default HTTP interface is plaintext
on the local network; this is not transport encryption or a sandbox from other
HA code.

Only `/movies`, its encoded collection query, `/details` with an encoded source
handle, and validated `/webcovers/` or `/webcoverslarge/` raster paths are
fetched. No browser-supplied URL/path/SQL or metadata-supplied external
destination is used. HTML parsing uses the native structural parser without
evaluating scripts. Cached search uses Unicode-folded title/actor/director
substrings, with an optional bounded native fuzzy matcher. `library/suggest`
exposes at most 20 cached actor/director names per bounded query, under the same
active-user/enabled-source scope and access checks. It adds no device request.
Complete group/count/identity checks protect catalog availability;
missing/unrecognized or partial collection navigation preserves old memberships
rather than inventing unwatched status. The built-in Scenes navigation is
excluded because it opens scene management, not a movie collection; arbitrary
malformed pages still fail. Details and collections retain freshness separately.
Source Played/Paused labels never create journal completion or dated viewing
history.

Requests are sequential, with 5-second DNS/connect, 15-second request, and
30-minute scan budgets. HTML responses are capped at 8 MiB, trees at 200,000
nodes/64 levels, catalogs at 10,000 handles, collections at 200 and combined
memberships at 100,000. Known strings/credit arrays are bounded; filters use
parameters and fixed sort expressions with default 50-row, maximum 1000-row list
pages and bounded suggestions. List payloads have an 8 MiB conservative JSON
byte budget; oversized requests fail without truncating records or changing
stored data. Group summaries omit full credits/synopses, and those remain on the
separate 50-version detail read. Batched internal lookups stay below 999 SQLite
parameters. The integer page limit rejects booleans, fractions, and out-of-range
values. Facet selections are bounded to 100 strings per category (500 characters
each); match-any within a category and match-all across categories use bound SQL
parameters. A single worker still owns SQLite. Library writes cannot grow the
database beyond 192 MiB, reserving 64 MiB of the 256 MiB ceiling for journal
growth. Existing databases at/above the library ceiling reject new library
writes. This does not remove the database's overall storage-full limit or
isolate library work from shared HA resources.

Artwork uses private `0700`/`0600` files outside SQLite and static web roots.
Both MIME and JPEG/PNG/WebP magic must match, with a 5 MiB image cap and no
Python image decoding. Opaque SHA-256 keys resolve only current-source indexed
files. Reads validate size/hash/type and recheck active-user access, unchanged
role, and scope/readiness before delivery, with `no-store`/`nosniff` headers.
The browser begins image requests only for visible covers, limits them to three
per mounted Library (including details), and caps each at 5 MiB/five seconds.
Completed covers are retained in a private session-only LRU of at most 1000
images and 128 MiB of compressed bytes. Keys include entry/dataset scope and
content-hash artwork IDs; tokens, raw URLs and bytes never enter UI settings,
cookies or persistent browser storage. Repeated scroll/page/view/popup visits
reuse accepted URLs. Eviction prefers offscreen covers, revokes URLs and
invalidates mounted references; visible entries can be evicted to enforce the
hard budget. Up to three in-flight downloads (5 MiB each), decode memory and DOM
memory are additional; decoded memory is not bounded by this byte cap. The
initial UI page target is 100; numeric choices are 25/100/1000. All aggregates
source/preference-revision-bound pages of up to 1000 groups, capped at 10,000
groups and 32 MiB aggregate metadata. It does not bypass per-response 8 MiB
limits or add an unbounded endpoint. All can increase DOM/image memory, while
unfinished offscreen/hidden-page image requests still cancel. Completed covers
survive scrolling, hiding the browser and popup closure in the same Library
session. Leaving Library, disconnect/account/role/scope changes, detected access
denial or opt-out dispose the cache and revoke all URLs. Disposed caches reject
late insertions and stale component responses remain invalidated. HTTP
authentication and no-store/nosniff policies are unchanged; manual memory
retention is not an extra network/data-access capability. Known access loss
clears data, but previously observed bytes cannot be recalled. Increasing the
target increases possible DOM/image memory and decoded images;
visibility-triggered fetching, bounded retention and revocation remain required.

The configurable cache budget is 32–4096 MiB (default 512), plus at most one 5
MiB incoming file during normal writes. Atomic file replacement, transaction
rollback, linked-file rejection, managed orphan cleanup, and missing-file
reconciliation protect cache consistency. Eviction affects covers and their
cache references, not identities or viewing facts. Host backups and separate
copies need additional space and retain their own data. Journal purge does not
purge the catalog cache. SQLite snapshots include library metadata/indexes but
not cover bytes; JSON viewing import/export does not become library restore.

Backup pauses/cancels sync and drains accepted collection operations and worker
writes before copying files; resume/reload schedules a fresh read-only scan.
Stop/unload cancels requests/timers before closing the repository. Failures
expose only safe codes, not addresses, source IDs, filenames, raw pages, or
artwork. Automated checks use fictional data and mocked networking.
[Library validation](library.md#validation-and-limits) distinguishes authorized
read-only source checks from full sync/browser review.

## Operator procedures

### Install and update

Use a maintained HA release, review custom integration sources and dependency
changes, and protect HA accounts with strong authentication. Use HA's supported
secure remote-access configuration when needed. Restrict host/network access to
the devices HA needs. Stronger component-specific egress restrictions require a
separate process. Review
[HA's deployment guidance](https://www.home-assistant.io/docs/configuration/securing/).
Apply security updates to the supported Python interpreter and its package
installer as well; updating this integration does not update either of them.

Install dependencies from `pyproject.toml` and `frontend/package-lock.json`. Run
`bash dev/dev.sh check` before merging. Review dependency update PRs and
upstream advisories; use `npm --prefix frontend audit` for frontend dependencies
and `pip-audit` for the resolved Python development environment. Install the
optional audit tool with `python -m pip install -e '.[dev,audit]'`, then run
`bash dev/dev.sh audit` or the VS Code **Audit dependencies (network)** task.
The command checks both ecosystems and exits nonzero if either scan fails.
Dependabot configuration requests weekly Python, npm, and CI-action updates when
enabled on the hosting repository. Audit results require assessment and fixes; a
successful build is not a vulnerability scan. Runtime HA dependencies remain
HA-managed; this integration currently declares no additional Python libraries.

### Test deployment

The [deployment tasks](deployment.md) run on the development machine. Only
explicit deployment/restart tasks may contact the configured SSH target. Build,
preview, and normal checks remain local; shell regression tests use temporary
fictional directories. Keep target settings in ignored `.vscode/ha-deploy.json`
and SSH authentication in the operator's SSH configuration. Require known host
keys, key/agent authentication, and disabled agent forwarding. HA receives no
GitHub credentials. The SSH account and any Docker/HA CLI permissions are
privileged; this deployment tool does not restrict an otherwise privileged SSH
account.

Validate the SSH alias, optional login username, absolute config path, and
restart settings before connecting. An explicit username is passed as a separate
SSH `-l` argument for deployment and restart; it cannot supply options or shell
commands. Omitting it or setting it to `null` retains SSH's configured/default
username. Use process argument arrays locally, quote remote positional paths,
and permit only fixed HA OS or named-container configuration-check/restart
commands. Never accept an arbitrary remote shell command from settings. Runtime
archives are constructed locally from approved Python/JSON/bundle files, capped
at 32 MiB of file contents, and reject linked sources. They contain no journal,
logs, environment files, or development credentials. Package hashes identify
bytes; they do not authenticate an untrusted build or establish target-version
compatibility.

Remote deployment resolves the operator-selected configuration path, including
symlinked aliases/ancestors, to an existing physical directory before deriving
managed paths. It rejects a resolved filesystem root or missing
`configuration.yaml` and prints the physical directory for operator review.
Symlinks at managed `custom_components`, deployment-storage, and companion
destinations remain rejected. It uses a per-config deployment lock, stages
outside static resources, retains old code in a private directory, and replaces
only the companion component. Keep the configuration directory and its ancestors
operator-controlled; these checks are not a sandbox against concurrent changes
by another privileged process. Deployment leaves HA running and restart is
explicit. Concurrent restarts/updates through other tools are unsupported.
Retained code copies are not database backups, interrupted replacement is not a
crash-safe transaction, and code rollback cannot reverse a schema migration.
Inspect interrupted operations and take compatible HA/data backups before
updates. Configuration checking and a successful restart command do not verify
that the integration loaded; the operator reviews startup and the browser
afterward.

### Known dependency findings (2026-10-25)

Rechecked with `bash dev/dev.sh audit` on 2026-10-25: npm reported zero
vulnerabilities; the resolved Python environment reported 37 advisories in
Pillow 12.3.0, all listing 13.0.0 as the fix. The audit command therefore exits
nonzero. Counts are a dated advisory snapshot, not a guarantee about future
scans.

The 2026-10-28 frontend cleanup audit reports zero npm vulnerabilities after
adding source/Markdown linters and compatible patched transitive overrides. This
does not supersede the Python findings below or establish future advisory
status. Development tools now live in root `dev/` and `frontend/dev/`; only
`ui/assets/panel.js` ships as browser code. The preview connection and proxy
share an exact-route allowlist, including authenticated Library artwork and
reviewed import-preview uploads. Their origin, destination, method, redirect and
in-memory credential restrictions remain.

The installed HA 2026.10.2 environment audit identified affected `uv` 0.12.23
and Pillow 12.3.0. The development baseline is updated to HA 2026.10.4, which
pins `uv` 0.13.5, covering the advisory's minimum fix of 0.13.4. This does not
update a separately installed HA instance or a Python interpreter's own CA
store. See the
[uv advisory](https://github.com/astral-sh/uv/security/advisories/GHSA-hq85-5cpj-mr62).

**Release blocker:** HA 2026.10.4 still pins Pillow 12.3.0. The audit reports
image-decoding vulnerabilities fixed in Pillow 13.0.0, including potential code
execution. This integration currently performs no image decoding, but that does
not establish that the wider HA process cannot reach the affected code. Keep
development isolated; do not declare the dependency audit clean or publish a
hardened release with this finding unresolved. Recheck a maintained HA release
that adopts the fixes, update the development baseline, and rerun audits and
compatibility checks. Do not force an incompatible Pillow version over HA's pins
or suppress the advisories to make an audit pass. See
[HA's dependency pins](https://raw.githubusercontent.com/home-assistant/core/2026.10.4/pyproject.toml),
[Pillow's security release](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html),
and the
[critical decoder advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6).

### Backup, restore, retention, and capacity

Use the
[documented backup/restore procedure](backend.md#export-backup-and-restore).
Treat JSON/SQLite downloads and migration backups as private, including exports
containing tombstones. SQLite exports also contain retry responses, audit
metadata, user IDs and private UI searches/preferences. JSON format 5 includes
portable Library title metadata/dates and private purchase history alongside
viewing/session snapshots and does not include the audit tables. Keep backups
encrypted where practical and restrict access to the backup destination;
downloaded files are outside this integration's permission and cleanup control.

The journal deliberately retains history. A visible delete is a tombstone, not
permanent erasure: content can remain in sessions, retry responses, SQLite
pages, exports, and backups. There is no automatic history, audit, or retry
purge. Administrators may permanently delete selected supported entries through
Database as described above. The compatibility bulk viewing-purge API remains
available with recording disabled. Live content and references are removed while
content-free retry barriers and operation audit remain. Separate copies require
separate retention. Monitor storage and retain only the migration backups and
downloaded copies you need. At the database cap, writes fail with
`storage_error`; reads remain usable. Before reaching capacity, archive a
protected snapshot and plan retention or a reviewed limit change. Purge makes
freed pages reusable but need not shrink the database file. Never edit or delete
live SQLite files to reclaim space. Host backups and migration copies also need
disk headroom beyond the page cap.

For complete dataset removal, stop HA, remove only the integration's dedicated
`kaleidescape_companion/` storage directory, and separately remove its backups
and downloads according to the host's storage policy. Restarting the integration
creates a new dataset. This is destructive and does not promise physical secure
erasure from SSDs, snapshots, or external backup systems.

### Suspected exposure or vulnerability

Restrict access to the affected instance, revoke exposed HA/device credentials,
and preserve a protected copy of relevant evidence. Review journal audit
metadata and HA access logs, update affected code, and restore only from trusted
backups. Do not post tokens, household records, full databases, or private
diagnostics in public issues. There is not yet a published private reporting
channel or supported release matrix; establish both before distribution. Use a
private maintainer channel agreed for this repository for reports during
development. HA Core vulnerabilities follow
[HA's reporting policy](https://www.home-assistant.io/security/).

## Required review for future changes

Every change that affects a boundary above must update this document when the
model changes, and include regression tests for relevant denial, malformed
input, cross-dataset access, injection, resource limits, redaction, and cleanup
behavior. Test cancellation and access changes across awaited work for private
responses. Use synthetic data and isolated services; never run household
playback or device-control tests implicitly. The normal test/build task runs the
security regressions. Contributor and agent instructions link to this policy.

## References

- [HA trust model](https://contributors.home-assistant.io/security/how-it-works/)
- [Secure HA integrations](https://contributors.home-assistant.io/security/guides/integrations/)
- [Vite server security settings](https://vite.dev/config/server-options)
- [Vite client environment exposure](https://vite.dev/guide/env-and-mode)

## Display preferences, navigation, and purchase dates

The default landing page remains an administrator-managed native HA option.
Schema 11 moves Library view/count, applied query/facets, sort, cover size and
column widths and title/format/library/rating badge toggles to private
per-HA-user SQLite `settings` rows. Toggle values must be actual booleans; old
rows inherit new presentation defaults on read without a content revision
change. Shared hidden collection names use a separate administrator-managed row;
known names come from cached metadata without device requests. Old HA defaults
seed initial values once and obsolete UI options are removed from HA entry
data/options.

`ui/preferences/get` and `/update` derive their owner from the active connection
user; schemas accept no owner/actor parameter. Scoped `ui/shared/get` and
`/update` require an active administrator. Before/after-await role, activity,
entry/dataset and readiness checks apply. Accepted writes can finish after
access loss, but results are withheld. These four WebSocket commands add no
HTTP/proxy path, arbitrary settings/configuration API or device operation.

The worker atomically patches allowlisted fields; the last accepted edit to a
field wins, preserving other fields. UUID retries bind actor, scope, revision
and exact payload. Row revisions are independent from content revisions.
Receipts contain only a fingerprint and resulting revision, not a duplicate
search/filter snapshot. Values are limited to 16 KiB, at most 100 selections per
facet, 500-character searches, offered page sizes and bounded sizing values.
Shared hidden names retain their existing 200-name/256-character limits. Failed
saves have an explicit retry; local choices do not imply persistence.
Connection/account changes clear values, failed fields and pending responses.
Database view/count/table/sort options use a separate personal `database` row.
Other open tabs reload values on remount; no live cross-tab channel is added.

SQLite exports/backups contain private UI preferences and user IDs. Portable
JSON/SQLite merge imports ignore these settings and operational batch markers.
Normal users cannot read another user's settings or shared hidden-name values;
raw table inspection and SQLite downloads remain administrator-only. Shared
hidden labels are presentation, not an access-control boundary: Played/Paused
still determine status and Favorites can still supply an independent favorite
badge. In progress/Watched suppress New without modifying sensor membership.
Cover format selection uses the highest positively known video format only.
Recent badges use exact source-group batch markers, never title matching; older
title-only snapshots wait for the next new-movie batch for badge identity.
Format chips use positive metadata and fixed text/CSS classes without fetching
logos or executing source strings. See [UI preferences](ui-preferences.md).

The URL retains only an allowlisted `companion_page` tab, preserving HA's other
URL parameters and history state. Role and Library enablement restrict
restoration; unsupported pages fall back to an allowed default or Journal. There
are no cookies, local storage records, credentials, search text, or title IDs in
navigation state. URL persistence is navigation, not authorization. Default
admin-only tabs fall back to Journal for regular users. Dialog backdrop
dismissal runs the same cancel guard as Escape: pending/unconfirmed mutations
cannot be dismissed implicitly.

Purchase-history preparation is an offline development helper only. There is no
purchase HTML upload, Library purchase button or purchase-specific apply API.
Its JSON mode extracts bounded rendered fields without executing scripts or
fetching links. Only HTTP(S) links without credentials and store-relative movie
links are copied; unsupported links become null. A separate release-year field
is parsed from recognized movie-store paths without fetching them; absent or
unrecognized years remain null. Bundle allocations use bounded captured charges
and explicit Included markers, with integer-cent arithmetic; multi-bundle
invoices share their combined total because the saved page exposes no membership
mapping. Missing/unsupported/mixed-currency charges are not guessed. Price
strings and order numbers remain private administrator data. JSON output is
created owner-only, refuses existing files/links, and leaves existing
parent-directory permissions alone. Root `purchases.json` is ignored by Git.
Keep saved HTML/JSON/reports/corrected copies private and excluded from
runtime/Git/static roots. Schema 9 stores purchase dates on title versions and
consolidates former purchase audit into general import audit, retaining original
provenance. The [purchase-date guide](purchase-dates.md) describes the retained
helper and reviewed exact-ID SQLite merge. Date display remains in the shared
positive Library projection; account/invoice content never enters that
projection.

Purchase import review labels distinguish invoice additions from existing
Library entries. Context labels preserve the original field keys and
before/after values, reviewed operation, target, selection and approval
requirements. Invoice titles and other imported values are rendered as text,
never markup.

## Explicit collection additions

The [Add to Collection contract](library-collections.md) narrowly extends the
network boundary with one fixed multipart POST. `library_allow_collection_add`
is false by default. Browsing and automatic sync remain read-only; only a
scoped, active administrator request with a cryptographic UUID may start an add.
Targets are existing cached, visible names intersected with fresh form choices;
protected system labels are rejected. One request selects one opaque version ID
and one collection. Raw handles, hidden dropdown values and routes are
backend-resolved. No removal, collection creation, general form/URL proxy or
playback operation is registered. The Vite proxy gains no device route; commands
use the existing HA WebSocket connection.

Authorization, native options fingerprint, source identity and readiness are
rechecked across preflight/persistence awaits and immediately before POST. A
configuration/access change stops unstarted work; an accepted write may commit
before permission loss or disconnect can be observed. All private responses
repeat role/scope checks. Checks and local acknowledgments require an active
administrator but do not require the add opt-in, allowing recovery after
disabling additions.

A dedicated source lock serializes scans and add/check work. Fresh form
validation, selected handle/group/title matching, source revisions, exact
multipart fields, pinned LAN origin/Host/TLS, no cookies/proxy credentials, no
redirect following, 8 MiB response caps and 90-second operation budgets bound
the operation. Hidden option values (up to 512 characters, no control
characters) are passed as encoded values only. Scripts are never evaluated.
Errors expose no source snippets, addresses, handles, collection labels or image
bytes.

A worker transaction records schema 8 intent and actor/source/payload-bound
receipt before POST. At most one uncertain request per source and 10000 retained
collection receipts are allowed; Library's 192 MiB write ceiling and
backup/transfer barriers also apply. Only a fresh full collection read matching
the expected membership hash and selected version can confirm success/update
cache. Wider vendor grouping or concurrent changes remain uncertain. Final
receipts clear temporary target data and retain audit attribution, timestamps
and retry barriers. Uncertain targets stay private for read-back reconciliation.
No journal facts or purchase dates change. Same-UUID retries and explicit checks
never repeat a POST, including after restart. An explicit acknowledged
uncertainty permits a new request without undoing or proving failure of the old
one. Its acknowledging actor is retained.

Browser cancellation does not cancel accepted device work. Backup/unload drains
it before repository suspension/closure; hard crashes leave a durable uncertain
receipt. UI account/scope changes clear forms and ignore late responses; pending
receipts survive and appear to administrators on reopening Library. Regular
users receive neither add controls nor intent/operation metadata. All four
commands are administrator-only. Backdrop/Escape and version switching cannot
discard an in-flight or unconfirmed browser request. See the operator guide for
the remaining real-device validation; no live POST was used to implement or test
this change.

## Exact Library admission and calendar publishing

The Companion sidebar's code-only panel is retained across a validated native
options reload so HA does not navigate away from Settings. Storage/runtime
readiness and authorization checks still reject reads while unloaded; retaining
the route does not retain access to the old repository. Ordinary unload/disable
and entry removal remove the owned panel. Registration/update/removal verify the
component name and fixed asset path before touching an existing route,
preserving foreign-panel collisions. Journal list/details share the existing
positive household projection; administrator edit dialogs retain revision,
confirmation, retry and unsaved-change protections.

Schema 13 changes administrator `journal/create` to require an exact available
version in the enabled configured Library. Only the version ID, start time,
optional status/notes and partial watched time are accepted. The worker derives
title/runtime/end/source data and a bounded display snapshot. Invented titles,
runtime overrides and caller-supplied metadata are rejected; existing imports
and corrections remain separately validated. Library readiness/opt-out and
user/entry/dataset checks apply before and after awaited work. Actor-bound exact
retries survive source metadata changes. Private viewing snapshots contain
positive public metadata, bounded text/lists, no device
origins/paths/credentials, and stay outside household journal projections and
portable imports/exports. Journal sort expressions are fixed and cursors bind
sort, filters and mode; callers supply no SQL.

Normal `journal/update` title changes likewise accept only a selected
`library_title_id`, never a free-text title or caller-supplied snapshot. The
worker validates the exact available scanned version in the enabled current
source (excluding purchase-match placeholders), derives title/link/metadata and
commits them atomically with the normal revision, audit and retry receipt.
Recorded timing/runtime/watched values and raw playback identifiers are
preserved; the latter cannot be overridden in a selection patch. Other field
corrections remain possible with Library disabled. Existing historical titles
are not guessed, migrated or required to match by name. Database/import
validation stays separate. No schema change is needed.

The Add and Edit dialogs share one bounded autocomplete with year/format
disambiguation and the global personal fuzzy mode. Typed text invalidates a
selection and cannot establish identity; clearing, scope/client changes and
unmount invalidate pending suggestions. Add requires positive cached runtime;
Edit can select missing-runtime versions while preserving recorded facts.
Selections require an explicit suggestion and Save action. Server checks apply
before storage and after awaits; retries bind the original selected source,
version, patch, actor and revision even after metadata changes. Tests cover
forgery, same-name/version selection, opt-out, stale rows, exact retries and
transaction rollback. These changes perform no device/calendar-provider writes
except the existing separately configured completion-publishing behavior.

Observed checkpoints now persist the same bounded snapshot before completion
enqueue, independently of calendar opt-in. Resolution is restricted to the
native configured Library source and exact stored version IDs/handles. Only the
locally verified `26-N.0-S_<eight hex digits>` → `N-S_<same digits>` spelling
bridge is accepted in addition to exact handles. Raw IDs are preserved, case is
not folded, unknown forms remain unmatched, and multiple matches are rejected.
Names/year are never identity fallbacks. Work-level descriptive fallback remains
restricted to an exact source group; version-specific runtime/format/artwork
stay separate.

Administrator-only `journal/metadata/preview` and `journal/metadata/repair`
provide local fill-only repair with active-user/admin/entry/dataset/Library
checks before and after awaited work. They add no network, SQL, file or HA
action proxy. Preview returns counts and a hash of current candidates;
confirmation recomputes it on the worker and rejects changed candidates. Open
sessions and tombstones are skipped. Repairs preserve nonempty snapshot values,
playback identity/timing/corrections and calendar receipts. Request UUIDs bind
source, review token and actor; content-free `database_audit` and request
receipts commit with the change. New writes respect backup/transfer barriers and
roll back on failure, including a 10,000-entry or ten-second between-row
execution limit. Existing actor-bound receipts can be retrieved while paused.
Repair does not enqueue publication, retry uncertain events, or edit remote
descriptions.

Calendar publishing is a separate native HA opt-in, false by default. It permits
one fixed `calendar.create_event` action on the selected writable calendar, not
an arbitrary service/entity proxy. Registered targets follow renames without
rebinding deleted identities. Opt-in/configuration, availability and capability
are rechecked immediately before calling HA. Configuration changes stop
unstarted calls; accepted calls can finish. HA owns provider credentials and
networking; Companion adds no direct provider connection, arbitrary destination,
token or Vite route. Providers and readers sharing the calendar can see titles,
bounded human-readable details and times from the chosen templates. Settings and
the export confirmation disclose this sharing.

Flat title/description brace substitution accepts only listed fields, never
attribute/index access, format specifiers, conversions or executable/Jinja
templates. Title templates are capped at 500 characters, description templates
at 5000, rendered titles at 1024 and complete descriptions at 32 KiB. List/text
substitutions are bounded. Only the rendered title/description and interval
enter provider events: no appended JSON, dataset/viewing/version IDs or
artwork-cache references. Legacy `{artwork}` placeholders render blank. Notes,
raw handles, origins, paths and credentials never enter events. Existing
provider descriptions are not rewritten. The local Journal calendar and future
dashboard card read the authenticated Journal/Library database instead of
provider metadata. No external image fetch/decoder is added.

Completion and a content-free `calendar_publications` receipt commit atomically.
One queued viewing per ten-second tick is claimed as sending before the external
action. A timeout, provider failure or crash recovery becomes uncertain, without
automatic retry. A failed final receipt write can leave sending; the attempt
barrier remains. Protected receipts retain viewing IDs, selected entities,
fingerprints and times without copied event content or a viewing foreign key, so
purging a viewing cannot silently permit another attempt. Imports and existing
history are not automatically backfilled. Backup/unload drains accepted work
before storage suspension/close. Provider exceptions are logged without private
response text. Normal checks use simulated providers only.

## Confirmed historical Journal export

Schema 14 adds protected `calendar_sync_jobs` and `calendar_sync_items`
progress/attribution receipts. `calendar/status`, `calendar/sync` and
`calendar/cancel` require active administrator, current entry/dataset and
readiness checks. Start uses a cryptographic UUID bound to the actor and saved
configuration fingerprint plus explicit confirmation. It selects at most 10,000
completed nondeleted Journal viewings. Library collection membership is not a
dated viewing history. No regular-user capability, HTTP route or Vite proxy
route is added.

Only the configured calendar's fixed `get_events` and `create_event` actions are
used. Remote reads cover one UTC month plus seven days, at most 10,000 events /
8 MiB per response, retaining one window in memory. Viewing spans over seven
days are rejected; calls time out after 30 seconds. Failed/malformed lookup
stops unstarted work and cannot cause blind creates. Matching uses the rendered
title and UTC start/end instants to whole seconds. Existing event descriptions
are not rewritten. Title-format changes can produce duplicates; confirmation
discloses that risk.

The worker persists per-item intent before writes and compares the current
viewing revision before creating an event. Originating-user
activity/administrator authority, selected configuration and availability are
checked across waits. Automatic publishing and explicit export share a lock.
Uncertain prior attempts with unchanged configuration may be resolved by a
remote match, but absence of a match never authorizes a blind retry.
Created/matched items suppress pending automatic publication for that
configuration. Content-free jobs/receipts retain actor, target/fingerprint,
viewing IDs, times and states; no event titles or provider responses are copied.
They are not automatically purged and count toward storage capacity.

Cancel stops unstarted work and drains accepted calls. Navigation/disconnect
does not cancel an accepted job while its originating user remains authorized.
Backup pauses between items, drains accepted calls and resumes afterward.
Restart/reload cancels pending/checking items and preserves sending as
uncertain, without automatically resuming historical jobs. A failed final
receipt can leave sending and block another export; inspect the calendar and
reload to recover it as uncertain. Concurrent external writers, changed
configuration and stale restored databases can still produce duplicates. Local
deletion/correction/opt-out cannot recall external copies. This is not
cross-provider exactly-once delivery. See [calendar procedures](calendar.md).

## Detail navigation and private artwork previews

Detail clicks use the existing active-user/enabled-Library read boundary. They
replace personal search/facet values without device mutation, service call, path
or HTTP route. Untrusted metadata remains Lit text with fixed callback keys,
never markup/executable navigation. Pending collection operations disable detail
navigation. Single-version details use a labelled region without a dangling tab
reference.

Library filtering/preferences include genre, year and format selections with the
existing 100-value/500-character bounds. Years accept one to four ASCII digits.
Each category binds one JSON array, staying below 999 SQLite variables even with
200 hidden collection names. The fixed native format classifier returns positive
badge categories and known source labels using constant patterns; it evaluates
no user expressions. Facets are capped at 500 suggestions and responses retain
the 8 MiB limit. Scope/activity/source/opt-out checks across awaits and portable
export projections remain unchanged.

Database related-row links derive from approved local relationships, including
composite keys. They use the existing validated, parameter-bound predicate
grammar, never arbitrary SQL. Missing targets are reported, not recreated; IDs
and relationship fields remain protected. Artwork previews reuse
enabled/current-source Library authorization, private object-URL retention and
response limits; unavailable/evicted/unreferenced artwork shows a placeholder.
NULL input and dialog layout changes add no write capability. Main tables are
viewings, sessions and Library; sources, collections and artwork require the
system-table toggle without changing their field/edit/delete policy.

## Search preferences and bounded fuzzy reads

### Journal month view

`journal/calendar` and `journal/calendar/get` allow active authenticated users
with the existing dataset/readiness checks and post-await role/source checks.
Both roles receive the same positive projections: the eight safe viewing fields,
opaque current-source Library/artwork links on month rows, and a compact movie
projection on detail reads. Notes, raw source IDs, private invoice fields,
purchase/detection dates and full metadata snapshots are excluded. Library
opt-out or an unavailable/noncurrent version withholds linked metadata/artwork;
the Journal itself remains readable. No provider/device call or new HTTP/proxy
route is introduced.

Month reads validate timezone-aware bounds and a positive span of at most 32
days, limit to 1000 nondeleted viewings, bind all search values, and run on the
single worker with the two-second SQLite budget. An exceeded row/time limit
returns an error rather than a misleading partial month. Exact version links
reuse existing indexes. The browser uses local start dates, text bindings and
the existing visibility-loaded, bounded authenticated artwork cache. Account,
scope and Library-enablement changes clear state/cache and invalidate pending
month/detail replies. Dialog dismissal also invalidates pending details.

Calendar details expose an Edit viewing action only in the administrator host
with edit permission. It passes only the viewing UUID to the shared Journal
editor, which refetches the full administrator record/revision through the
existing authenticated `journal/get` path. Scope/connection changes invalidate
late reads. The compact month/detail projections remain unchanged and contain no
extra private fields or edit revisions. Household readers bind no editor.

Both Journal layouts share changed-field updates, optimistic revisions,
actor-scoped request UUIDs and guarded uncertain-write retries. The editor's
Delete entry action uses the existing confirmed `journal/delete` tombstone,
retaining the row/session history and excluding it from visible reads. It adds
no physical-delete/restore API and makes no Database purge call. Successful
mutations refresh the current month without resetting navigation. Regression
tests cover role separation, stale reads/conflicts, changed-field patches,
cancelled deletion, exact retry and retained tombstones; browser dialog geometry
remains an operator check.

The personal Journal `view` preference accepts only `list` or `calendar`;
`calendar_size` accepts integer heights of 60–320 pixels and `calendar_fit`
accepts only booleans. They use the existing actor-owned preference API and
validated Database settings editor. Fit uses local viewport geometry and cleans
up observers/listeners on unmount. Resizing changes no content or API access.
Compact detail links use Lit text-bound buttons and pass only a typed search or
single-facet criterion to Library, which replaces and saves personal criteria
through its existing validation path. Both roles keep their existing enabled
Library boundary; no metadata URLs, remote fetches or SQL expressions are used.
Account/scope changes clear pending navigation state, and late preference reads
cannot overwrite the selected criterion. Searches/filters stay out of URLs.
Search migration removes only obsolete fuzzy-search keys, preserving Journal
layout. No schema change or broader write permission is introduced. Regression
tests use fictional temporary storage and component DOMs; real-browser geometry
remains an operator check.

### Global fuzzy search

Personal search preferences use `area=search` and one strictly boolean
`fuzzy_search` field, enabled by default. Journal and Library controls read and
write this same actor-owned row. Manual title pickers, including Database's,
restore the same choice. Database query syntax and exact filters are unaffected.
Active-user ownership, dataset/readiness checks, actor/area-bound UUID receipts
and post-await revocation checks apply. Shared preferences remain Library-only.
The protected Database settings editor validates the known search preference
row.

Startup consolidates legacy Journal/Library values using the most recently saved
row, removes obsolete per-view keys and preserves other preferences. A saved
search row takes precedence on repeated startup. Consolidation runs atomically
on the repository worker and advances the settings revision; it neither imports
settings nor changes household access or journal/catalog content revisions. No
schema change is required.

Read-only `journal/list`, `library/list`, `library/search` and `library/suggest`
accept a validated boolean fuzzy flag. Journal cursors bind it to prevent
mixed-mode pagination. Literal mode uses case-insensitive continuous strings
without SQL/regex/wildcard interpretation. Approximate matching uses fixed
normalization and a narrow edit-distance band, at most twelve query words and
100 characters per approximate word; longer general searches retain literal
matches. Lists/people completion use a two-second SQLite progress budget,
removed after success/failure. Manual title completion retains its
ten-result/10,000-name/one-second bounds. Exact facet selection, Database
predicates and exact Library-version admission are unchanged.

Browser scope/client changes and unmount clear settings/suggestions and ignore
late results; mode changes invalidate pending completions. Ordinary Journal
revision refreshes preserve the manual picker query. Personal booleans inherit
defaults without rewriting existing rows. No device networking, arbitrary
expression or direct provider access is added by search. SQL and filesystem
access remain on the established worker and managed paths.

## Offline title comparison tools

`dev/benchmark_title_matching.py` is excluded from runtime packages and accepts
bounded Companion JSON/SQLite exports or an explicit title-only JSON manifest.
Manifests use the same validated title evidence, reject unknown fields and
retain the 32 MiB/10,000-row limits. SQLite inputs retain defensive, query-only
regular table validation; the reference export is also opened read-only with
schema/time checks. Reports omit notes, prices, order IDs and raw URLs. Optional
reports are new `0600` files and refuse existing paths/links. Input hashes
detect changed files. The tool adds no HA endpoint or live name-based import
permission.

## Journal and Library reference reads

`library/viewing` and `library/viewings` are active-user Library reads gated by
the enabled current Library source, dataset and post-await access checks. The
forward link exposes only `title_id`, display title and an opaque cached artwork
key. Reverse lookups use the existing exact version reference, bounded
source/group SQL and revision/filter-bound Journal pagination. Household rows
use the existing positive Journal field allowlist; notes, invoice fields,
playback handles and metadata snapshots remain administrator/private storage
fields. Queries do not mutate records or follow stored URLs.

Schema 17 adds a partial viewing-reference index and transactionally backfills
only missing exact links, with a private pre-upgrade backup. It neither guesses
by title/year nor moves existing references. Legacy observed rows without a
browser-source identity require exactly one cached source. Open sessions and
deleted rows are left alone. No calendar events or device writes occur. Library
removal does not delete viewing history; absent targets yield no navigable link.
Browser linkage state and cached image URLs are cleared on scope/account changes
and unmount; stale responses cannot restore old content. No record identities or
filters are added to URLs or persistent browser storage.

## Library random sorting

Shuffle seeds use the same cryptographic ID generator as mutation requests,
including its `getRandomValues` fallback on HTTP LAN origins. Missing random
generation reports a visible error rather than silently abandoning a sort.

Random sorting uses a bounded personal `random_seed` (empty or 32 lowercase
hexadecimal characters), validated in both settings patches and list filters. A
deterministic worker-only SHA-256 function ranks source groups or exact version
IDs; seeds are SQL parameters, never SQL expressions. Pagination and All reuse
the same seed and normal content/source/preference revision checks. Sorting
changes no content, access permissions, device state or journal links. The seed
is stored with personal Library preferences, not in URLs or browser storage;
existing ownership and retry protections apply. No schema change or additional
package is required.

## Administrator purchase aggregates

`library/purchases/summary` is excluded from active-user read operations:
inactive or non-administrator users are rejected before storage access. It uses
the current enabled Library source, dataset scope and existing post-await
role/readiness/source checks. Financial aggregates are never attached to shared
Library info, Journal responses, sensors or artwork. Personal footer visibility
is not authorization. Role/scope changes and unmount clear cached totals and
ignore late responses; the controls are hidden from household readers.

The worker streams at most 100,000 invoice records within two-second SQL/Python
budgets and returns no partial result on exhaustion. Stable invoice identities
are counted once; currency prefixes remain separate and arithmetic uses integer
cents, serialized as formatted strings. Only aggregate counts and totals are
returned, not invoice/order identifiers or raw history. The personal toggle
`show_library_cost` is a strictly validated boolean, default false, using
existing ownership/retry protections. No schema migration, provider request,
device access or financial inference is added.

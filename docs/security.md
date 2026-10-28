# Security policy and hardening

This policy governs current and future development. Changes to access, storage,
networking, imports, exports, or frontend rendering must preserve these rules and
include tests for the affected boundary. This is a maintained security baseline,
not a claim of independent security certification.

## Trust boundaries

| Boundary | Policy and limitation |
| --- | --- |
| Browser → integration API | Active authenticated HA users may read the shared household viewing summary. Mutations, notes/source/session details, Now Playing, and exports require an active administrator. Now Playing also checks read permission on the configured source entities. Dataset IDs select data; they are not credentials. |
| Integration → HA | Custom integrations execute in Core's process with Core's filesystem, entity, credential, and network access. Entity selection is application behavior, not a sandbox. Other code running as HA can read this database. |
| HA users → one another | All active users share one household journal; there is no personal watch history or per-user journal ownership. A positive field allowlist limits regular-user API responses. HA roles are not strong isolation between hostile authenticated users. |
| Journal → HA entity states | Watch-history sensor states/attributes deliberately expose movie titles, times, and counts through HA entity access. Recorder, dashboards, automations, and backups can retain these values outside the private database. Notes, source identities, sessions, and audit actors must never enter sensors. |
| HA → devices and services | Observation reads selected HA states. Optional library sync makes bounded GET-only requests to the configured private LAN browser origin, using validated/pinned DNS results. It is disabled by default and sends no controls or edits. Now Playing artwork uses HA's existing image proxy. |
| Device/imported data → storage and UI | Treat metadata, notes, HTML, image references, and imported files as untrusted, including data from local devices. Validate before storing or using it, and render text without executing markup. |
| Storage → filesystem and exports | Journal contents, source identifiers, audit actors, backups, and retry responses are private household data. Keep them outside static web roots and access them through the authenticated API. |
| Development machine → test HA deployment | Deployment is an explicit privileged SSH operation. Verify the host key and target, send only the runtime package, and configure restart through fixed HA OS/Container commands. Normal checks must never connect to or modify the target. |

The integration does not add its own web server, database listener, identity
system, or general-purpose HA action/SQL/file proxy. Compiled panel assets may be
public; they must contain no credentials or household records.

If containment from compromised integration code becomes a requirement, use a
separate unprivileged process/container with its own storage, restricted network
access, and a narrow message interface. A full HA administrator token or an HA
configuration-directory mount would undermine that separation. Selecting a web
framework alone does not establish isolation.

## Implemented backend protections

- WebSocket reads require an active authenticated user; management operations
  and HTTP downloads require an active administrator. Check before storage access
  and after awaited work. A change in active/admin status during a request withholds
  its result, including an administrator response after a downgrade.
- Entry/dataset scoping is validated on every request. Schemas reject unexpected
  fields, and record validation bounds lengths, numbers, dates, and result pages.
- SQLite values use parameters. Database paths and SQL identifiers are internal;
  callers cannot supply arbitrary paths, SQL, or HA actions.
- The dedicated storage directory uses owner-only access (`0700`) and managed
  files use `0600`. Existing files are tightened when storage opens, including
  migration backups and SQLite sidecars. Managed symlinks and hard-linked files
  are rejected. These protections require filesystem permission support; they
  do not isolate code running as the same operating-system user.
- Export snapshots live in a private directory under journal storage. Only one
  HTTP export per loaded repository may be prepared or streamed at a time.
  Snapshots are size bounded, downloads have a time budget, and temporary files
  are removed on completion, failure, disconnect, and cancellation. Leftovers
  from a crashed process are removed on the next open.
  Preparation has a 30-second budget and a download has a 60-second budget;
  cleanup must wait for accepted filesystem work and can outlast cancellation.
- Database growth is capped at 256 MiB of SQLite pages. Existing larger files
  remain readable without permitting further page growth. Export snapshots are
  capped at 256 MiB. The write queue remains bounded at 128 operations and source
  observations at 256. These are resource limits, not a complete denial-of-service
  defense against an administrator or compromised HA process.
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
   household credentials out of the development instance. Existing local YAML
   is retained: verify its bind address when reusing an older configuration.
2. Keep `.ha-dev/`, `.env*`, databases, exports, tokens, device snapshots, and
   private logs out of Git. Ignoring a file does not protect it on disk. The HA
   launcher uses restrictive creation permissions and a private `.ha-dev/`.
3. The HA management panel uses HA's signed-in connection. The Vite adapter
   authenticates explicitly to the fixed local HA instance with a development
   token, held only in memory. Disconnect, page exit, or connection loss closes
   the socket and drops credentials; it does not revoke the token in HA. The
   adapter's entry point is excluded from the packaged HA module. A proxy is routing,
   not authentication. Never inject a privileged bearer token into arbitrary
   proxied requests or embed it in source, URLs, bundles, or browser environment
   variables. HA user tokens are not journal-scoped credentials.
4. Vite custom environment-variable exposure is disabled. Keep explicit host
   restrictions, CORS disabled for the standalone shell, strict filesystem
   serving, and fixed ports. The development HTTP proxy accepts only GETs to the
   explicit journal export route and query-free `/api/media_player_proxy/media_player.<object_id>`
   artwork route, plus POST to the scoped import route with fixed format/request/revision
   query fields, and query-free scoped `library/artwork/<opaque key>` GETs,
   at a fixed `127.0.0.1:8123` target. It rejects image query tokens,
   browse-media subpaths, and arbitrary paths/URLs. It checks
   the origin or same-origin Fetch Metadata, passes the browser's bearer header,
   and injects no credentials. WebSockets go directly to local HA; there is no
   WebSocket proxy or origin rewriting. Any extension requires a boundary review.
5. Render imported strings through Lit text bindings. Avoid `unsafeHTML`, script
   URLs, remote executable assets, and broad HTML sanitization exceptions.
   Current cover images use only the fixed HA image route and bounded raster
   image blobs, never metadata-supplied URLs. Validate any future image/link
   protocols and destinations before extending that allowlist.
   Serve the compiled bundle through HA in production; Vite is a development tool.

The management UI renders metadata through text bindings, sends only changed
fields for corrections, and keeps expected revisions and request UUIDs on writes.
Request UUIDs use native `crypto.randomUUID` or cryptographic `getRandomValues`
with UUID v4 formatting; never substitute timestamps or `Math.random`. If secure
randomness is unavailable, preparation fails visibly before any write is sent.
An unconfirmed write locks its exact payload for explicit retry, including an
unload/error after a possible commit. Explicitly discarding that retry, navigation,
or reload can lose it, so inspect history before recreating an entry.
Connection/user changes clear private forms/lists, invalidate outstanding
responses, and abort exports. Downloads have a browser byte limit and temporary
object URLs are revoked; already downloaded files remain the operator's responsibility.
The [UI guide](ui.md) documents behavior and test limitations. The explicit layout
review fixture uses fictional data and is excluded from the packaged panel.

## Household read access and sensors

| Capability | Active regular/read-only HA user | Active administrator |
| --- | --- | --- |
| Shared sidebar journal, search/filter/pagination | Allowed | Allowed |
| Viewing title, start/end times, runtime, watched time, status, origin | Allowed | Allowed |
| Notes, raw source/player/content identifiers, session evidence, storage health | Denied by the integration API | Allowed |
| Create/correct/delete, Now Playing, JSON/SQLite export | Denied | Allowed |
| Integration settings, fixed raw-table inspection, selected/all permanent purge | Denied | Allowed |
| Viewing-only JSON/SQLite merge imports and Database viewing corrections | Denied | Allowed |
| Cached Library metadata/artwork, sync status, and manual sync | Denied | Allowed when library sync is enabled |

Anonymous and inactive users are denied all journal operations. Regular-user
`info` returns only API version, scope, revision, visible-record count, and
permissions. `journal/list` and `journal/get` use a positive record-field allowlist;
adding a database column must not implicitly expose it. Deletion tombstones are
excluded from these reads. Mutation authorization is enforced on the server;
hiding editor/export controls is not authorization. Known user/connection/role
changes clear the browser's old data and ignore late responses. Browser downloads
and data already observed cannot be recalled when access changes.

The household [history sensors](sensors.md) publish completed-viewing history and
unfinished partial titles as explicitly requested. Lists are bounded to the newest
50 titles and 8 KiB of UTF-8 JSON, with a truncation flag; counts stay exact. The
full last title is an attribute, while its state respects HA's 255-character limit.
They contain no notes, audit metadata, raw identifiers, or private filesystem paths.
Their visibility follows HA's entity permissions and wider trust model; they are
not protected by the journal API's administrator checks. Account for Recorder and
external automations when deciding history retention and who can access HA.
These summaries refresh from one local worker query every 30 seconds while entities
are enabled, with no device/network polling. Failed refreshes mark sensors unavailable.

## Now Playing and current artwork

The compact Now Playing card preserves administrator-only snapshot access and
checks HA entity `POLICY_READ` for all resolved configured source entities before
reading their live state. No journal ownership/sharing capability changes.
Responses include session timing/credits/gaps and health, not image URLs or proxy
tokens. The artwork change key is an opaque hash of the HA-local picture reference,
kept in memory only. External, malformed, and unrelated picture references do not
enable the cover request. Current-session context must match the source content ID.

The browser builds an exact, query-free HA media-player proxy path from a validated
entity ID and fetches it using HA authentication, with redirects refused. Only
JPEG/PNG/WebP are accepted. Accumulation is capped at 5 MiB and image requests have
a five-second browser budget. This is a browser limit; HA owns upstream fetching
and caching. No new arbitrary-fetch endpoint, persistent image store, Python image
decoder, or device connection is introduced by Companion. Missing or failed artwork
has a placeholder. Raw picture URLs, tokens, and image bytes never enter the journal,
exports, diagnostics, or logs.

HA's existing media-player image route has its own authentication/token behavior;
it is not a Companion administrator-only endpoint. Other HA users may already
access images according to HA's wider trust model. The card never copies signed
image URLs or adds query tokens, and Vite passes only the browser's bearer header
on the allowlisted export/artwork GET and scoped import POST routes; it never
injects credentials of its own.

The snapshot refreshes about every five seconds while the card/page is visible;
requests do not overlap. Hiding/unmounting or account/connection changes clear data,
abort image work, revoke object URLs, and invalidate late results. Denied access
clears the card and stops automatic retries until explicit refresh, page return, or rebind.
There are no controls or HA action calls. Source metadata is text, never executable
markup. Future user sharing, subscriptions, controls, remote URLs, or historical
artwork require another boundary review and regression tests.

The automatic runtime-admission rule validates its numeric configuration and
normalized source duration; it adds no fetches or control operations. It preserves
existing records, manual corrections, tombstones, audit, and retry semantics.
Unknown runtime waits when the rule is enabled. Now Playing's cutoff/exclusion
fields stay on the existing administrator/source-permission surface, outside
regular-user journal projections and history sensors. This is a recording heuristic,
not a security boundary or a reliable source content classification.

## Settings and permanent maintenance

Administrator tabs mount only their selected view. Switching pages stops Now
Playing polling and cancels an abandoned settings flow. Drafts require discard
confirmation, and pending mutations retain their exact retry state until resolved
or explicitly discarded. Regular users keep the read-only journal without these
controls. Database New Entry uses the existing administrator journal/create API,
with no create/edit capability for internal evidence, audit, retry, or metadata
tables. Moving controls into tabs changes no API authorization or data projection.
The shared Database toolbar reuses these same endpoints: single-entry deletion
uses the journal tombstone API and remains distinct from permanent purge. Internal
tables disable mutation controls. Native transfer/purge dialogs block dismissal
during accepted work or an uncertain result; explicit retry discard remains
available. Cancelled file selection clears its private File and native input.

The sidebar settings adapter operates only this Companion entry's native HA
options flow. Start/submit/cancel require an active administrator; flows bind to
the authenticated actor and entry and reject configuration changes since opening.
Unknown setting fields and another user's or integration's flows are rejected.
Validation, storage, and reload stay in the existing HA options flow. This adds
no general options/action proxy or Vite HTTP route. A lost save response requires
reopening and inspecting the persisted values rather than blindly replaying it.

Database inspection is administrator-only, includes private data, and accepts
only twelve internal table names with 25-row pages and revision-bound pagination,
including five read-only library tables.
Database corrections reuse validated viewing fields, optimistic revisions, manual
audit, and exact retry semantics, including for tombstones; they preserve deletion
status and session evidence. Internal tables/immutable fields are read-only.
There is no arbitrary SQL or filesystem path API. Render raw values
as text; account/connection changes clear details and invalidate late responses.

Permanent selected/all purge requires recording disabled and no active observer,
explicit server-validated confirmation, dataset revision, and a request UUID.
Backup/export activity blocks purging. One transaction removes viewing/session
content, related manual audit rows, and cached response content, including legacy
responses without an audit row. Minimal UUID/fingerprint retry barriers remain
so old create/update requests cannot resurrect or return purged data. A schema 4
maintenance audit/receipt retains only actor, operation/request UUID, time, count,
and revision. It contains no purged viewing identities, titles, notes, or source
IDs; request fingerprints are hashes, not stored payloads. Exact purge retries
are bound to actor/payload and remain safe after a lost response or restart.

SQLite secure deletion is enabled for the live database; this does not promise
physical erasure from storage, rollback remnants, host snapshots, or external
copies. Purge does not remove exports, migration/HA backups, already viewed browser
data, or HA Recorder/automation history. It leaves the dataset identity and
minimal maintenance/retry metadata intact. No automatic retention policy is added.

## Compatible viewing imports

Imports are explicitly initiated, active-admin-only raw POST uploads scoped to
the current entry/dataset. Check access and readiness before upload, before
accepting worker work, and before returning results. Require recording disabled
and no observer. Bound uploads to 32 MiB and one import per runtime, with 10,000
viewings and a 30-second request/validation budget. Keep the slot until accepted
work finishes after cancellation; exports/purge cannot overlap. The normal backup
barrier and database growth limit still apply. No uploaded paths are accepted.

Parse JSON strictly and validate all recognized values/IDs/timestamps before a
single transaction. SQLite uploads are deserialized in memory with defensive and
query-only operation, trusted schema disabled, native limits and a progress
deadline. Select only known columns from the regular viewings table; the authorizer
denies functions, attachments, and other operations. Reject views/virtual tables,
incompatible structures, oversized rows, malformed files, duplicate keys/IDs, and
non-finite numeric fields. No source schema, trigger, SQL script, extension, session,
audit, receipt, configuration, or live recorder state is installed.

Merge only new IDs and retain existing entries/tombstones unchanged. Preserve
validated viewing snapshots and precision without fabricating historical actors
or timing evidence. Schema 5 records only the importing actor, request UUID,
imported/skipped counts, dataset revision, and time; filenames and contents are
not retained in audit/logs. Actor/payload-bound receipts make exact retries safe,
including after a subsequent purge. A separate explicit import from an older
backup can intentionally restore purged content. Unknown source keys are ignored;
recognized values are never trusted based solely on an export/schema version.

Uploads stay in memory; account/connection changes abort browser work, clear file
selection, and ignore late results. An accepted transaction can still finish; an
uncertain result retains the original immutable File/request for explicit retry.
Private files and bytes already observed cannot be recalled. Native SQLite and
Core dependencies still need upstream maintenance; this is not a sandbox against
a compromised HA process or a guarantee against every parser vulnerability.

## Future connectors, controls, and sharing

- Use HA's shared HTTP client, certificate verification, bounded timeouts,
  response sizes, concurrency, and retry backoff. Restrict destinations and
  redirects to the configured device. Local-device addresses are legitimate;
  arbitrary client-supplied fetch URLs are not.
- Keep library synchronization read-only. Playback requires an explicit user
  action, a configured player, a supported operation, and server-side permission
  checks. Do not expose raw protocol or general HA service forwarding.
- Store necessary device credentials in HA config entries and redact them from
  errors, diagnostics, logs, and exports. Do not assume config-entry storage is
  encrypted or inaccessible to other HA code.
- Define household read/edit/export/control capabilities before adding sharing.
  Check relevant entity permissions as well as journal permissions. Subscriptions
  must stop releasing data when access is revoked or their entry unloads.
- Imports must validate size, schema, paths, identifiers, and content before
  applying transactional changes. Any extension to permanent purge must preserve
  coverage of sessions, retry responses, audit references, and retry barriers.

## Optional library network and cache boundary

Library sync is off by default. Only explicit enablement constructs its connector,
creates a managed HA HTTP session, resolves the default `my-kaleidescape.local`
name or configured host, and schedules GETs. Browsing uses SQLite, not device
requests. Settings and sync/read/artwork APIs require an active administrator;
scope/readiness/role checks apply before storage and after awaits. Regular users
retain their existing positive journal projection. Disabling sync denies Library
API access but retains private cached data. No cloud store, password login, vendor
editing route, or playback operation is supported.

Configured origins allow HTTP(S) on standard ports, without credentials, path,
query, or fragment. Resolution uses HA's shared DNS/mDNS resolver when available.
Only RFC 1918 IPv4/ULA IPv6 results can be selected. Each scan pins a validated IP
while retaining the original Host/TLS hostname; changing DNS cannot redirect the
request to a different destination. Loopback, link-local/metadata, public, multicast,
and unspecified destinations are rejected. TLS verification stays enabled, cookies
are disabled, proxy environment settings are ignored, and redirects/compressed
bodies are refused. The default HTTP interface is plaintext on the local network;
this is not transport encryption or a sandbox from other HA code.

Only `/movies`, its encoded collection query, `/details` with an encoded source
handle, and validated `/webcovers/` or `/webcoverslarge/` raster paths are fetched.
No browser-supplied URL/path/SQL or metadata-supplied external destination is used.
HTML parsing uses the native structural parser without evaluating scripts. Complete
group/count/identity checks protect catalog availability; missing/unrecognized or
partial collection navigation preserves old memberships rather than inventing
unwatched status. Details and collections retain freshness separately. Source
Played/Paused labels never create journal completion or dated viewing history.

Requests are sequential, with 5-second DNS/connect, 15-second request, and 30-minute
scan budgets. HTML responses are capped at 8 MiB, trees at 200,000 nodes/64 levels,
catalogs at 10,000 handles, collections at 200 and combined memberships at 100,000.
Known strings/credit arrays are bounded; filters use parameters and fixed sort
expressions with 50-row pages and bounded suggestions. A single worker still owns
SQLite. Library writes cannot grow the database beyond 192 MiB, reserving 64 MiB
of the 256 MiB ceiling for journal growth. Existing databases at/above the library
ceiling reject new library writes. This does not remove the database's overall
storage-full limit or isolate library work from shared HA resources.

Artwork uses private `0700`/`0600` files outside SQLite and static web roots. Both
MIME and JPEG/PNG/WebP magic must match, with a 5 MiB image cap and no Python image
decoding. Opaque SHA-256 keys resolve only current-source indexed files. Reads
validate size/hash/type and recheck active-admin access before delivery, with
`no-store`/`nosniff` headers. The browser displays one bounded cover blob at a time,
aborts stale requests, and revokes URLs on selection/account/navigation changes.

The configurable cache budget is 32–4096 MiB (default 512), plus at most one 5 MiB
incoming file during normal writes. Atomic file replacement, transaction rollback,
linked-file rejection, managed orphan cleanup, and missing-file reconciliation
protect cache consistency. Eviction affects covers and their cache references,
not identities or viewing facts. Host backups and separate copies need additional
space and retain their own data. Journal purge does not purge the catalog cache.
SQLite snapshots include library metadata/indexes but not cover bytes; JSON
viewing import/export does not become library restore.

Backup pauses/cancels sync and drains accepted worker writes before copying files;
resume/reload schedules a fresh read-only scan. Stop/unload cancels requests/timers
before closing the repository. Failures expose only safe codes, not addresses,
source IDs, filenames, raw pages, or artwork. Automated checks use fictional data
and mocked networking. [Library validation](library.md#validation-and-limits)
distinguishes authorized read-only source checks from full sync/browser review.

## Operator procedures

### Install and update

Use a maintained HA release, review custom integration sources and dependency
changes, and protect HA accounts with strong authentication. Use HA's supported
secure remote-access configuration when needed. Restrict host/network access to
the devices HA needs. Stronger component-specific egress restrictions require a
separate process. Review [HA's deployment guidance](https://www.home-assistant.io/docs/configuration/securing/).
Apply security updates to the supported Python interpreter and its package
installer as well; updating this integration does not update either of them.

Install dependencies from `pyproject.toml` and `frontend/package-lock.json`.
Run `bash scripts/dev.sh check` before merging. Review dependency update PRs and
upstream advisories; use `npm --prefix frontend audit` for frontend dependencies
and `pip-audit` for the resolved Python development environment. Install the
optional audit tool with `python -m pip install -e '.[dev,audit]'`, then run
`bash scripts/dev.sh audit` or the VS Code **Audit dependencies (network)** task.
The command checks both ecosystems and exits nonzero if either scan fails.
Dependabot configuration requests weekly Python, npm, and CI-action updates when
enabled on the hosting repository. Audit results require assessment and fixes;
a successful build is not a vulnerability scan. Runtime HA dependencies remain
HA-managed; this integration currently declares no additional Python libraries.

### Test deployment

The [deployment tasks](deployment.md) run on the development machine. Only explicit
deployment/restart tasks may contact the configured SSH target. Build, preview,
and normal checks remain local; shell regression tests use temporary fictional
directories. Keep target settings in ignored `.vscode/ha-deploy.json` and SSH
authentication in the operator's SSH configuration. Require known host keys,
key/agent authentication, and disabled agent forwarding. HA receives no GitHub
credentials. The SSH account and any Docker/HA CLI permissions are privileged;
this deployment tool does not restrict an otherwise privileged SSH account.

Validate the SSH alias, optional login username, absolute config path, and restart
settings before connecting. An explicit username is passed as a separate SSH `-l`
argument for deployment and restart; it cannot supply options or shell commands.
Omitting it or setting it to `null` retains SSH's configured/default username.
Use process argument arrays locally, quote remote positional paths, and permit only
fixed HA OS or named-container configuration-check/restart commands. Never accept
an arbitrary remote shell command from settings. Runtime archives are constructed
locally from approved Python/JSON/bundle files, capped at 32 MiB of file contents,
and reject linked sources. They contain no journal, logs, environment files, or
development credentials. Package hashes identify bytes; they do not authenticate
an untrusted build or establish target-version compatibility.

Remote deployment resolves the operator-selected configuration path, including
symlinked aliases/ancestors, to an existing physical directory before deriving
managed paths. It rejects a resolved filesystem root or missing `configuration.yaml`
and prints the physical directory for operator review. Symlinks at managed
`custom_components`, deployment-storage, and companion destinations remain rejected.
It uses a per-config deployment lock, stages outside static resources, retains old
code in a private directory, and replaces only the companion component. Keep the
configuration directory and its ancestors operator-controlled; these checks are
not a sandbox against concurrent changes by another privileged process.
Deployment leaves HA running and
restart is explicit. Concurrent restarts/updates through other tools are unsupported.
Retained code copies are not database backups, interrupted replacement is not a
crash-safe transaction, and code rollback cannot reverse a schema migration.
Inspect interrupted operations and take compatible HA/data backups before updates.
Configuration checking and a successful restart command do not verify that the
integration loaded; the operator reviews startup and the browser afterward.

### Known dependency findings (2026-10-25)

Rechecked with `bash scripts/dev.sh audit` on 2026-10-25: npm reported zero
vulnerabilities; the resolved Python environment reported 37 advisories in
Pillow 12.3.0, all listing 13.0.0 as the fix. The audit command therefore exits
nonzero. Counts are a dated advisory snapshot, not a guarantee about future scans.

The installed HA 2026.10.2 environment audit identified affected `uv` 0.12.23
and Pillow 12.3.0. The development baseline is updated to HA 2026.10.4, which
pins `uv` 0.13.5, covering the advisory's minimum fix of 0.13.4. This does not
update a separately installed HA instance or a Python interpreter's own CA store.
See the [uv advisory](https://github.com/astral-sh/uv/security/advisories/GHSA-hq85-5cpj-mr62).

**Release blocker:** HA 2026.10.4 still pins Pillow 12.3.0. The audit reports
image-decoding vulnerabilities fixed in Pillow 13.0.0, including potential code
execution. This integration currently performs no image decoding, but that does
not establish that the wider HA process cannot reach the affected code. Keep
development isolated; do not declare the dependency audit clean or publish a
hardened release with this finding unresolved. Recheck a maintained HA release
that adopts the fixes, update the development baseline, and rerun audits and
compatibility checks. Do not force an incompatible Pillow version over HA's pins
or suppress the advisories to make an audit pass.
See [HA's dependency pins](https://raw.githubusercontent.com/home-assistant/core/2026.10.4/pyproject.toml),
[Pillow's security release](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html),
and the [critical decoder advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6).

### Backup, restore, retention, and capacity

Use the [documented backup/restore procedure](backend.md#export-backup-and-restore).
Treat JSON/SQLite downloads and migration backups as private, including exports
containing tombstones. SQLite exports also contain retry responses and audit
metadata. JSON format 2 is a viewing/session export and does not include the
audit tables. Keep backups encrypted where practical and restrict access
to the backup destination; downloaded files are outside this integration's
permission and cleanup control.

The journal deliberately retains history. A visible delete is a tombstone,
not permanent erasure: content can remain in sessions, retry responses, SQLite
pages, exports, and backups. There is no automatic history, audit, or retry purge.
Administrators may explicitly purge selected/all entries through Database as
described above. Live content and references are removed while content-free retry
barriers and maintenance audit remain. Separate copies require separate retention.
Monitor storage and retain only the migration backups and downloaded copies you
need. At the database cap, writes fail with `storage_error`; reads remain usable.
Before reaching capacity, archive a protected snapshot and plan retention or a
reviewed limit change. Purge makes freed pages reusable but need not shrink the
database file. Never edit or delete live SQLite files to reclaim space.
Host backups and migration copies also need disk headroom beyond the page cap.

For complete dataset removal, stop HA, remove only the integration's dedicated
`kaleidescape_companion/` storage directory, and separately remove its backups
and downloads according to the host's storage policy. Restarting the integration
creates a new dataset. This is destructive and does not promise physical secure
erasure from SSDs, snapshots, or external backup systems.

### Suspected exposure or vulnerability

Restrict access to the affected instance, revoke exposed HA/device credentials,
and preserve a protected copy of relevant evidence. Review journal audit metadata
and HA access logs, update affected code, and restore only from trusted backups.
Do not post tokens, household records, full databases, or private diagnostics in
public issues. There is not yet a published private reporting channel or supported
release matrix; establish both before distribution. Use a private maintainer
channel agreed for this repository for reports during development. HA Core
vulnerabilities follow [HA's reporting policy](https://www.home-assistant.io/security/).

## Required review for future changes

Every change that affects a boundary above must update this document when the
model changes, and include regression tests for relevant denial, malformed input,
cross-dataset access, injection, resource limits, redaction, and cleanup behavior.
Test cancellation and access changes across awaited work for private responses.
Use synthetic data and isolated services; never run household playback or
device-control tests implicitly. The normal test/build task runs the security
regressions. Contributor and agent instructions link to this policy.

## References

- [HA trust model](https://contributors.home-assistant.io/security/how-it-works/)
- [Secure HA integrations](https://contributors.home-assistant.io/security/guides/integrations/)
- [Vite server security settings](https://vite.dev/config/server-options)
- [Vite client environment exposure](https://vite.dev/guide/env-and-mode)

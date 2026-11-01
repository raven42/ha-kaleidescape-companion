# Kaleidescape Companion framework status

The product name is **Kaleidescape Companion**. The HA domain
`kaleidescape_companion` coexists with the built-in **Kaleidescape** integration
(`kaleidescape`).

## Present

- Feature-organized runtime packages (`core/`, `library/`, `playback/`, `ui/`,
  `enrichment/`), separate development tools, editor tasks, runtime-only
  packaging and version metadata.
- Config flow and runtime lifecycle for one household journal, retaining data on
  unload/removal.
- SQLite schema/migrations and a dedicated worker for transactional manual
  journal records.
- Active-user journal reads and administrator-only create/update/delete API,
  optimistic revisions, and durable request deduplication.
- Authenticated JSON/SQLite exports, HA backup write barriers, and content-free
  diagnostics.
- Private storage permissions, linked-path rejection, bounded exports/database
  growth, and transactional attribution of manual changes (schema 3), purges
  (schema 4), and merge imports (schema 5).
- Opt-in administrator [Library sync](library.md), disabled by default, with
  default-host discovery/override, interval and data/artwork options,
  source-scoped versions/collections, first-detection dates, shared read-only
  browsing, multi-select filters with a one-click clear action, sortable lists
  with stable/resizable columns, resizable covers with whole-row pagination,
  25/100/1000/All page sizes with bounded chunked responses, source-defined
  movie groups with missing-description fallback, bounded individual-version
  detail tabs, hidden collection names, expanded formats, and authenticated
  private covers with bounded session retention, an Options popup,
  highest-video-quality cover chips, mutually exclusive Watched/In progress/New
  indicators and independent Favorite bookmarks.
- [Protected Database administration](database.md) with raw-first details,
  confirmed edits/deletions, personal view options, schema-aware query
  completion and transactional stale-snapshot protection. Schema 12 adds
  operation audit and a monotonic settings counter.
- Library-based manual additions with exact version selection, text local time,
  inferred runtime/end and completion-date/title Journal sorting. Schema 13 adds
  protected manual display snapshots and opt-in
  [calendar publishing](calendar.md) with durable one-attempt receipts. Schema
  14 adds configurable descriptions and explicit, matched historical Journal
  export. Journal Options also provides a saved monthly calendar with
  overlapping cached covers and compact viewing/movie detail popups for both
  roles. A standalone HA dashboard card remains planned.
- Shared Library metadata snapshots for manual/observed viewings, persisted
  before observed completion enqueue. Settings provides a reviewed, fill-only
  repair for older Journal entries, preserving raw identities, existing values,
  active sessions and calendar receipts without device/provider writes.
- Schema 9 stores [purchase dates](purchase-dates.md) on title versions and
  consolidates import audit. [Reviewed merge imports](imports.md) add new
  records and fill missing viewing/Library metadata by exact ID, with selectable
  approval. Purchase-history HTML preparation remains an offline development
  helper.
- Schema 22 adds administrator sort titles, protected display corrections/source
  restoration, per-format preferences with a shared user shuffle, and scraper
  progress in the Library footer.
- Schema 17 indexes Journal/Library links and backfills exact legacy references.
- Schema 16 renames the scanned table to **Library** and embeds repeated
  purchase history on its owning entry, removing the separate purchase table.
  Purchase JSON reviews require matched scanned targets, with a known-title
  picker for ambiguity. A shared `TitleMatcher`/`TitleQuery` contract accepts
  title/year evidence from import adapters; the purchase adapter supplies
  passive store-link hints. Suggestions preserve remake/sequel/source
  boundaries. Administrator-only prices/orders stay outside household
  projections. JSON format 5 includes the embedded history and reads older
  exports.
- Native landing-page defaults and URL tab restoration; schema 11
  [database UI preferences](ui-preferences.md) save personal browsing choices
  and shared hidden collection names immediately. Status flags and explicit
  format chips appear in Library; dialogs retain guarded backdrop dismissal.
- Schema 6 library metadata and a bounded evictable artwork file cache,
  preserving viewing facts and journal write headroom, with backup/unload
  cancellation.
- A [security policy](security.md), security regression tests in the normal
  check tasks, and contributor/agent guidance for future changes.
- Tests for storage recovery, migration rollback, API validation/permissions,
  exports, backups, reload, and shutdown.
- Optional entity mapping and options flow for one player, preserving registered
  identities across renames.
- Administrator Settings tab using the same native HA options flow, with
  stale-configuration/actor scoping and automatic reload.
- Administrator Database shared toolbar/surface, underline table tabs, inline
  selection list, raw-first details and confirmed supported-field edit/delete
  dialogs. Personal Options save 10/25/100/500-row pages, sorting and
  system-table visibility. Schema-aware condition search and reviewed
  import/export retain access, revision, row-snapshot and retry protections.
  Database Delete removes supported live rows and dependent references
  permanently; Journal Delete remains a tombstone.
- Configurable total-runtime admission (10 minutes by default, 0 disables),
  excluding short playback from automatic entries and waiting for missing
  runtime.
- Ordered observation, monotonic session timing, checkpoint/restart recovery,
  credits completion, partial resumes, and rewatch separation.
- Field corrections/tombstones protected from automatic writes, bounded backup
  buffering with explicit gaps, and read-only Now Playing/session APIs.
- Household HA sidebar panel with administrator management and shared Vite UI
  for journal CRUD, filters, pagination, session evidence, database health, and
  JSON/SQLite downloads.
- Shared large Now Playing display with administrator recording context, HA
  cover artwork, exact playback/location, runtime, counted session time,
  credits/gaps, and recording health; visible-only refresh, source read checks,
  missing-art fallback, and connection cleanup.
- Memory-only development connection, restricted local export/artwork/import
  proxy, component and proxy security tests, TypeScript checks,
  ESLint/Markdownlint, source/docs formatting, and packaged ES module.
- A read-only household sidebar view for regular users, with server-side field
  allowlists and administrator-only notes, source/session details, and exports.
- Fourteen [HA sensors](sensors.md): seven history sensors for completed history
  and unfinished partial viewings, plus seven Library/storage sensors for unique
  movies, watched/unwatched counts, recent additions, last sync and storage
  sizes. Independent shared coordinators use local queries; lists stay bounded
  and counts exact. Schema 10 persists recent additions on the source row.
- Project validation script and continuous-integration workflow.
- Runtime-only archives and explicit VS Code SSH deployment tasks for HA
  OS/Container, with a local target preview, retained previous code, and
  separate check/restart.
- [Product plan](plan.md), [technical design](design.md), and
  [development guide](development.md).

## Device controls

The [Companion API adapter](playback-controls.md) adds separately opted-in,
administrator seed discovery, household player selection and fixed
transport/navigation/power commands and experimental exact-Library-version
launch. Schema 18 records durable actor-bound outcomes and blocks uncertain
writes pending physical review. HA installs the pinned API package; the
independent Python 3.11+ project, CLI and tests remain separate. Built-in HA
entities and recorder sources are preserved.

Fictional API/UI tests cover permission/identity/state checks and
retry/lifecycle boundaries. The operator's earlier CLI launch/STOP sequence
covers one player; the new HA interface and broader commands need operator
browser/device review. Exact-edition confirmation remains unverified.

## Deferred

Multi-player configuration, live subscriptions, validated position/progress,
canonical work/edition identities, broader journal identity inference and
historical artwork, per-user ownership/selective sharing, saved resume and
broader player compatibility remain deferred. The basic management panel is
registered in HA; broader product UI and real-browser
compatibility/accessibility checks remain. Administrator
[Add to Collection](library-collections.md) is implemented behind a separate
off-by-default option. Removal remains planned; automatic sync stays GET-only.
Reviewed viewing/Library JSON/SQLite merge imports are implemented; automatic
retention remains deferred. Full SQLite restore is documented as an offline
procedure.

See the [backend API](backend.md) for the implemented manual and observed
journal behavior. The [design](design.md) distinguishes current source
boundaries from future extensions. Phase 1 is not complete: broader HA
release/backup and real-browser validation still need work. Real-source
transitions and target deployment results require operator validation; local
checks make no device connection.

## Publication prerequisites

Set the real project documentation/repository URLs and codeowners, choose a
license, select and validate supported HA releases, run the real HA
lifecycle/config-flow tests, and review the intended release contents.
Preparatory HACS metadata is not a claim of catalog acceptance or a
production-ready release.

Resolve the
[known dependency release blocker](security.md#known-dependency-findings-2026-10-25)
and rerun dependency audits before publication.

Reusable import matching and its offline JSON/SQLite/title-manifest evaluator
are documented in [title matching](title-matching.md). Adding another import
adapter still requires validated identities, scoped authorization and reviewed
writes.

## Dedicated calendar maintenance

Optional Full Sync (schema 20) maintains a dedicated HA calendar, including
Journal corrections and delayed deletion of unmatched entries. It has a 1–12
month window, configurable daily time, UID links, read-back, two-pass cleanup
and durable uncertainty recovery. See [calendar procedures](calendar.md).
Automated entity tests pass; live provider/browser review remains pending.

## External metadata

Optional store/TMDB enrichment is implemented with independent reusable parsers,
fixed HTTPS destinations, source-labelled ratings, a write-only TMDB credential,
a shared request limiter and schema 19 Library cache. Both providers default
off. Live TMDB-key testing and operator UI review remain pending; see
[enrichment](enrichment.md).

Manual scraping supports explicit candidate search/selection with bounded
credits and optional thumbnail previews. Approved provider bindings and match
conflict codes live in protected Library enrichment JSON, with stale review and
in-flight write checks. Automatic refreshes reuse approved identities. Library
projects a conflict boolean and supports a persistent conflict filter; no new
table/schema migration is required. Shared whole-word quoted search applies
across Library/Journal, pickers, import review and plain Database searches.

Library queries evaluate distinct credits before fuzzy matching and reuse
bounded worker-only metadata/facet projections. Input/revision keys preserve
freshness and source-policy changes invalidate cached projections. Both roles
retain the same search budget and positive response fields; see
[search behavior](library.md#browsing) and the fictional enriched benchmark in
[development](development.md#library-performance).

## Operational diagnostics and transfer

Schema 21 adds a bounded, administrator-only [log book](logging.md), private
resource aliases, live levels shared with the independent protocol API, and
privacy-safe instrumentation for external operations and database mutations.
Calendar Full Sync retries verification reads without replaying writes and
reports comparison bits/stages for diagnosis. Administrator settings files use
selectable categories, credential exclusion and review before application.

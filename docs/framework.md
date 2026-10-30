# Kaleidescape Companion framework status

The product name is **Kaleidescape Companion**. The HA domain
`kaleidescape_companion` coexists with the built-in **Kaleidescape** integration
(`kaleidescape`).

## Present

- Feature-organized runtime packages (`core/`, `library/`, `playback/`, `ui/`),
  separate development tools, editor tasks, runtime-only packaging and version
  metadata.
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
  export. Monthly calendar views and an HA card remain planned.
- Shared Library metadata snapshots for manual/observed viewings, persisted
  before observed completion enqueue. Settings provides a reviewed, fill-only
  repair for older Journal entries, preserving raw identities, existing values,
  active sessions and calendar receipts without device/provider writes.
- Schema 9 stores [purchase dates](purchase-dates.md) on title versions and
  consolidates import audit. [Reviewed merge imports](imports.md) add new
  records and fill missing viewing/Library metadata by exact ID, with selectable
  approval. Purchase-history HTML preparation remains an offline development
  helper.
- Schema 15 preserves repeated purchase orders in private Library purchase
  history. Direct purchase JSON imports use selectable reviews, conservative
  movie-group suggestions and an explicit known-title picker for unresolved
  purchases; derived dates preserve explicit version dates. Administrator JSON
  format 4 exports include portable purchase records.
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
- Compact administrator Now Playing card with HA cover artwork, exact
  playback/location, runtime, counted session time, credits/gaps, and recording
  health; visible-only refresh, source read checks, missing-art fallback, and
  connection cleanup.
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

## Deferred

Multi-player configuration, live subscriptions, validated position/progress,
canonical work/edition identities, journal identity associations and historical
artwork, per-user ownership/selective sharing, and playback controls remain
deferred. The basic management panel is registered in HA; broader product UI and
real-browser compatibility/accessibility checks remain. Administrator
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

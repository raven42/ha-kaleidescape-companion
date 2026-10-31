# Changelog

## Unreleased — Modal consistency and provider API organization

- Add space below movie actions and align Play/Power On and Collection heights.
- Use a shared upper-right X across application dialogs and keep commit actions
  at the lower right. Remove Remote's duplicate heading and empty Done footer.
- Move providers into `lib/scrapers/`, with one typed metadata API, separate
  provider adapters and a shared throttled transport. Update vendoring,
  packaging, checks and documentation.
- Verify that the official TCP protocol has no movie collection membership
  add/remove command. Keep verified HTTP addition; removal awaits its contract.

## Unreleased — Shared Now Playing and optional metadata

- Share permission-checked Now Playing artwork/display context with household
  accounts; retain private recorder evidence for administrators.
- Add readiness-gated Power On/Play Movie, automatic playback navigation,
  single-player simplification and a portrait Remote popup. Move Library details
  below artwork and omit single-version count text.
- Add independent store/TMDB provider clients and parsers, disabled by default,
  guarded HTTPS, shared throttling, write-only credential settings, source
  credits and schema 19 provider caches on Library.
- Expand offline regression checks and replace the stale test changelog copy
  with a current suite guide. No deployment or live device testing performed.

## Unreleased — Household playback and combined movie details

- Share opted-in playback with all active HA users and send commands directly
  from their clicks, retaining automatic preflight and durable no-replay
  receipts. Keep discovery, settings, purchase details and uncertain-command
  recovery administrator-only; hide network inventory and other actors'
  receipts.
- Add a per-dialog/card player picker and private seed-bound discovery cache
  restored without connecting to devices. Preserve the shared default and
  Journal sources. Add Now Playing controls to the household reader.
- Combine Library title/badge/actions and poster/synopsis/linked-credit details
  in a responsive dialog, retaining version tabs and expandable record details.
  Put Play Movie, Choose Player and administrator Collection actions together.
- Add permission, privacy, target selection, cache and single-click regressions;
  update the security policy and operator/browser review instructions.

## Unreleased — Companion device discovery and controls

- Bundle a generated runtime-only copy of the independent API, with freshness
  checks and isolated deployment imports; keep its CLI and project independent.
- Add off-by-default administrator discovery, a serial-based default player,
  transport/navigation/power controls and separately enabled experimental
  Library-version playback. Preserve the built-in HA entities and recorder.
- Add live identity/content/state checks, explicit interruption review and
  schema 18 actor-bound command receipts. Uncertain sends block further writes
  until physical review; retries retrieve outcomes without replay.
- Cover authorization, opt-outs, stale state, uncertainty/restart, standby,
  backup and UI recovery with fictional peers. Real HA/browser/device review
  remains operator work; no deployment or device commands run during checks.

## Unreleased — Official protocol library and experimental extensions

- Audit the independent API's source/docs and add bugbear/async linting,
  Pyright, generated typed command members, malformed-input regressions and
  isolated source/wheel verification. Clarify the directory tree and include
  examples documentation in source distributions.

- Split TCP codecs, persistent sessions, documented commands and models into an
  independent `lib/kaleidescape-api/` Python 3.11+ project with 206 current Rev
  17 request definitions. Include its own packaging, docs, examples, CLI, source
  distribution, test framework and Python-version CI matrix; exclude it from
  integration deployment until an HA adapter is implemented.
- Add serial/zone routing, bounded event iterators, binary responses, multipart
  content/music browsing, discovery and structured status/error handling.
- Isolate undocumented movie launch and configurable profiles in a separate
  adapter; preserve operator preflight, dry runs and uncertain outcomes.
- Extend the CLI with offline catalog listing, documented commands, discovery
  and bounded events. Add codec/emulator/lifecycle regressions.

## Unreleased — Standalone playback protocol proof of concept

- Add a standard-library TCP client and operator CLI with IP/serial operands,
  read-only preflight, PLAY/STOP and experimental exact-handle PLAY_MOVIE.
- Validate framing, checksums, player identity and movie metadata; preserve
  uncertain outcomes without retries, wake commands or guessed namespaces.
- Add dry runs, structured results and fictional emulator regressions; leave
  native HA controls and discovery for subsequent work.
- Record operator-reported selected-title launch/stop success on one player;
  retain exact-edition, resume and broader compatibility validation gates.

## Unreleased — Build and test diagnostics

- Reset cover state before rendering and skip unchanged panel busy-state updates
  to avoid redundant Lit renders.
- Capture expected deployment-test prompts and suppress only Lit's test startup
  banner; fail component tests on unexpected console warnings/errors.
- Disable unrelated npm upgrade notices while retaining dependency lifecycle
  script restrictions.

## Unreleased — Library-selected Journal corrections

- Share Add viewing's Library autocomplete with list/calendar editors; require
  an exact suggestion when changing a movie, with year/format disambiguation.
- Atomically update the title, Library reference and metadata from that version;
  preserve recorded viewing facts and reject forged free-text title patches.
- Retain historical timing/note corrections when Library is disabled, and keep
  revision checks, actor-bound retries, audit and recoverable deletion.
- Add selection, authorization, linkage and rollback regressions.

## Unreleased — Calendar viewing editor

- Add administrator Edit viewing to calendar details, loading the current
  record/revision into the shared Journal editor.
- Add Delete entry inside the shared editor with the existing confirmation and
  recoverable deletion marker; retain row/session history and refresh the month.
- Preserve household read-only details, conflict/draft protections and exact
  uncertain-write retries; add component and lifecycle regressions.

## Unreleased — Calendar sizing and Library detail links

- Add saved Journal calendar size and Fit month to screen controls; resize
  covers without rereading month data.
- Make compact detail titles, people, genres, years, ratings and format badges
  open Library with fresh, saved search/filter criteria for either household
  role.
- Validate new personal preferences, guard unmounted views against reloads, and
  add sizing, navigation, persistence and lifecycle regressions.

## Unreleased — Journal month calendar

- Add a saved Calendar-view toggle under Journal Options for both household
  roles, with month navigation, overlapping artwork and hover/keyboard
  foregrounding.
- Open compact movie/viewing details from each cover; show local viewing dates,
  watched minutes and Library badges/metadata without purchase/detection fields.
- Add bounded, source-scoped month/detail reads, reuse exact Library links and
  authenticated image caching, and preserve Journal layout across startup search
  migration. External calendar publishing remains independent.
- Add storage, authorization, preference and component regressions; browser
  layout review remains an operator step.

## Unreleased — Random sorting over HTTP

- Reuse the API client's cryptographic UUID fallback for shuffle seeds when
  `crypto.randomUUID` is unavailable on HTTP connections. Preserve Randomize and
  the selected shuffle across paged and All results.

## Unreleased — Administrator Library purchase totals

- Add a sticky, off-by-default footer-cost toggle and expandable Purchase
  details for total paid cost, retail price, savings and unique transactions.
- Read source-scoped invoice history once per identity, keep currencies separate
  and expose missing-price/order coverage using exact cent arithmetic.
- Protect financial summaries with administrator checks before and after reads;
  keep household UI/API projections free of monetary data.

## Unreleased — Random Library sorting

- Add Random sorting in List and Cover views, with a Randomize button that
  starts a fresh shuffle from page one.
- Save the shuffle seed with personal preferences and keep the order stable
  across paging, filters, layouts and reloads; retain six spreadsheet columns.

## Unreleased — Linked Journal and Library details

- Show cached artwork and an exact Library detail link in Journal entries for
  administrators and household readers.
- Link Library movies to paginated viewing history across versions in the same
  source/group, with an explicit option to show all viewings again.
- Add schema 17's viewing-reference index and conservative exact-ID backfill;
  preserve ambiguous/unmatched history, active sessions and viewing facts.

## Unreleased — Global personal fuzzy search

- Use one per-user search preference across views, editable from both Journal
  and Library Options; include Database's manual-viewing title picker.
- Consolidate legacy choices from the most recently saved preference row,
  preserving other Library preferences and existing global choices.

## Unreleased — Clear purchase import review

- Distinguish purchase additions/updates from Library entries in import review
  while preserving the original field keys and before/after values.

## Unreleased — Purchase export release year

- Include a separate integer `year` in purchase JSON, inferred from the
  movie-store link using the shared title parser; use `null` when unknown.
- Preserve existing invoice fields, bundle allocations and import compatibility.

## Unreleased — Reusable title matching

- Rename the engine to `library/title_matching.py` with format-independent
  `TitleQuery`, `TitleMatcher` and `TitleMatch` interfaces. Keep invoice parsing
  and target ownership preferences in the purchase import adapter.
- Rename the evaluator to `dev/benchmark_title_matching.py`; accept Companion
  JSON/SQLite exports and bounded title-only JSON manifests through `--input`.
- Preserve reviewed purchase matching and existing exact-ID live import rules.

## Unreleased — Purchase title and release-year matching

- Suggest Library owners using cached search/display titles and movie-store slug
  titles/years, with fixed normalization for editions, punctuation, articles,
  written numbers and franchise subtitles.
- Keep conflicting years/titles/sequel numbers and ambiguous source groups in
  manual review; preserve stored invoice identity and existing Library links.
- Add a read-only development evaluator with aggregate coverage and optional
  private reports; production imports retain explicit selection and approval.

## Unreleased — Purchases owned by Library entries

- Rename the scanned database table to `library` and its Database tab to
  Library.
- Store repeat invoice history and earliest-invoice summary fields on the owning
  entry; remove the separate purchase table with a private backup and
  transactional migration, including previously unmatched history awaiting
  review.
- Require a scanned match before purchase import; retain compact manual matching
  for ambiguous names and support old JSON/SQLite exports and corrected dates.
- Keep prices, order IDs, links and invoice history administrator-only,
  including API responses; show history in administrator title details. Purchase
  dates remain shared. JSON format 5 exports the embedded history.

## Journal layout, Settings navigation and plain calendar events

- Export only configured calendar title/description templates and times. Remove
  appended Companion JSON/IDs/artwork references; legacy artwork placeholders
  render blank. Future calendar views/cards will read the local database.
- Preserve the Companion panel route across native options reloads and reopen
  the Settings form on the same tab after saving.
- Give administrator and household Journals a shared toolbar and split
  entry-list/details surface. Open administrator corrections/manual additions in
  guarded dialogs and consolidate health metrics into a status line.

## Observed viewing metadata and Journal repair

- Save bounded Library metadata and exact version links for observed viewings,
  independently of calendar publishing; recognize the observed playback/browser
  handle spelling difference without changing raw IDs or guessing by title.
- Add a reviewed Settings repair for missing Journal metadata, with fill-only
  updates, active-session protection, durable retries and content-free audit.
- Use the same matching and snapshot logic for manual viewings, recording and
  calendar rendering. Existing calendar events are not rewritten.

## Search options and spacing

- Add independent, sticky Journal and Library fuzzy-search options covering
  their searches and completion dialogs; preserve literal partial matching when
  disabled.
- Align Library filter headings and add space beneath sticky dialog actions.
- Move Library collections and artwork under Database system tables.

## Detail-driven Library browsing

- Make detail names and metadata apply fresh searches or exact filters, with
  sticky genre/year/format selections.
- Hide single-version tabs and use correct singular/plural count labels
  throughout the UI and development count messages.

## Calendar export and UI consistency

- Keep the calendar export confirmation compact and themed, with an unpainted
  action row instead of a separate footer block.
- Add an editable event description template and confirmed historical Journal
  export with remote matching, progress, cancellation and durable
  uncertain-write protection (schema 14).
- Fix manual-viewing title completion and add bounded fuzzy matching.
- Align search/sort controls, make Settings actions sticky, unify dialog
  actions, and allow typing into NULL database fields.
- Move Library sources under system tables, preview cached artwork and follow
  related rows; simplify Library version tabs.

## Unreleased — Library-based manual entries and calendar publishing

- Require an exact cached Library version for new manual viewings, populate
  runtime/source metadata, accept text local times, default to Completed and
  infer end time; show watched minutes only for Partial.
- Add completion-date/title Journal sorting in either direction, keeping
  partials first for date sorting and binding pagination to the sort.
- Move Library sort controls to the sticky toolbar and refresh/sync to compact
  footer controls; remove the redundant heading and view-type border.
- Add opt-in HA calendar publishing with a writable entity selector, flat
  configurable title fields, bounded artwork/viewing description references,
  durable one-attempt receipts, opt-out/reload/backup protection and no
  backfill.
- Schema 13 adds protected manual Library snapshots and calendar receipts;
  monthly calendar and HA card work remain planned.

## Unreleased — Library browsing and protected Database administration

- Add sticky Library search/status bars, debounced title/actor/director search,
  full-cache people suggestions, ordered compact filters and reusable rating/
  format badges. Display source Played as Watched; put detailed sync/version
  information in Options and make cover ratings optional.
- Add personal Database options, raw-first details, confirmed supported-field
  edits and permanent selected-row deletion. Keep IDs, links, paths, audit,
  receipts, operational state and active playback records protected; reject
  stale snapshots while recording/sync can remain enabled.
- Add schema-aware predicate completion/validation and bounded execution using
  bound parameters. Schema 12 adds database operation audit and a monotonic
  UI-settings revision to support safe preference-row deletion.

## Unreleased — Library layout options and retained covers

- Group live personal view/count/cover-size and overlay controls in an Options
  popup, retaining sort/order and whole-row numeric cover pagination. Existing
  database preference rows inherit enabled overlay defaults without a schema
  change.
- Show only the highest known SD/HD/4K/4K Cinematic format on covers. Use
  exclusive top-left Watched/In progress/New indicators and an independent
  top-right Favorite bookmark; progress/completion overrides New without
  changing the recent sensor batch. Lists retain detailed format chips.
- Retain downloaded covers across scrolling, pagination, view changes and
  details in a private 1000-image/128 MiB session LRU. Fetch only visible
  covers; keep request limits, eviction cleanup and account/access revocation
  barriers.

## Unreleased — Persistent Library presentation and badges

- Move Library UI choices to schema 11 database settings, scoped per HA user;
  save view, page size, applied search/filters, sort, cover size and column
  widths immediately. Shared hidden names remain administrator-managed. Migrate
  former HA UI options once; keep the default landing page native.
- Offer 25/100/1000/All page sizes, keeping whole-row cover pagination and
  loading All through bounded revision-checked chunks.
- Add overlapping watched/recent/favorite cover flags and list summary badges,
  plus explicit 4K/Cinematic, HD, SDR, HDR10, Dolby Vision and Atmos chips.
  Source-group batch markers distinguish new movies from formats and remakes.
- Keep UI row revisions independent of content imports/edits, with actor-bound
  validation, atomic field patches and private SQLite backup/export behavior.

## Unreleased — Library and storage sensors

- Add seven HA sensors: total movies unique by source group, watched/unwatched
  movies, recent additions, last catalog sync, database size and artwork cache
  size.
- Keep recent counts exact with a bounded title-list attribute. Schema 10 stores
  the latest non-empty discovery batch on the source row; initial sync is a
  baseline, and unchanged scans/additional formats retain the batch.
- Preserve history entity IDs and use separate local-query coordinators. Missing
  status stays unknown; disabled Library sensors become unavailable while size
  diagnostics continue to report retained storage. Full catalogs use pagination.

## Unreleased — Reviewed metadata merges

- Replace direct add-only imports with compact reviewed JSON/SQLite merges:
  selectable new records and missing-data fills, search/pages, preserved
  conflicts, exact-ID matching, stale-plan checks and durable selected-request
  retries.
- Accept legacy corrected SQLite purchase dates through Database → Merge Import.
  Preserve the source file and keep HTML processing only in the offline `dev/`
  helper; remove the purchase-specific runtime UI/API.
- Migrate to schema 9: put purchase dates on title versions and consolidate old
  purchase audit into import audit without losing original actor/source
  revisions. Retain separate relational collections, sessions, cache and
  recovery tables.
- Extend JSON format 3 with portable Library titles/dates; exclude source
  origins, artwork paths/keys and operational state from the portable title
  projection.

## Unreleased

- Organize runtime internals into core, library, playback and UI packages while
  retaining HA entry points, identities, wire routes and schema 8. Split worker
  journal SQL from repository lifecycle and move development tools out of
  runtime.
- Add Library Clear Filter; remove inherited page backgrounds from embedded
  controls.
- Share the development proxy/connection route contract and fix Library artwork
  and purchase previews in Vite. Add ESLint, Markdownlint and documentation
  formatting to local/CI/editor checks; refresh architecture and operator
  guides.

- Group Library editions by source-scoped `source_group`, keeping same-name
  remakes separate. Fill missing descriptions from sibling versions at read time
  while preserving raw metadata and version-specific facts.
- Restrict full-viewport sizing to the main panel, fixing Library and Add to
  Collection spacing. Order tabs Now Playing, Library, Journal, Database,
  Settings.
- Add Database page sizes of 10/25/100/500, literal search, column sorting, and
  bounded responses; retain administrator-only inspection and purge safeguards.
- Add rough development/runtime organization and calendar/Gmail integration
  investigations to the product plan.

- Add separately opted-in administrator Add to Collection for one version and
  existing target, with read-back verification, protected recovery UI, and
  schema 8 durable receipts that prevent automatic POST replay. Removal remains
  deferred.

- Add configurable landing/Library defaults, URL tab restoration, known/custom
  hidden-collection lists, and guarded dialog backdrop dismissal.
- Add private purchase-history preview and explicit date corrections (schema 7),
  plus an offline corrected-copy helper; preserve journal and first detection.

## Unreleased — Adaptive Library pagination

- Added entries-per-page targets from 1 to 1000, defaulting to 50.
- Fit cover pages to complete measured grid rows; debounce viewport/cover-size
  changes, preserve the current title range, and use the effective size for
  paging. The final catalog remainder stays visible without duplicated entries.
- Added compact group summaries, an 8 MiB list-response budget, batched lookups,
  resize/lifecycle/page-size regressions, and a fictional query benchmark.
- Avoided redundant empty-cover renders on large pages; artwork stays
  visible-only with three requests at once. No device operations or deployment.

## Unreleased — Grouped Library and stable tables

- Grouped identical case-folded names in list/cover views before pagination,
  preserving exact versions and exposing each version in the detail popup.
- Expanded summary `Multiple` formats from concrete source rows; retained
  individual format/year/runtime/status/collection metadata.
- Stabilized table widths across sorts, added accessible drag/keyboard column
  resizing, and truncated/wrapped long fields.
- Added validated hidden-collection preferences to native and sidebar Settings;
  preserved movies and Played/Paused status, with stale-preference refresh
  checks.
- Added the bounded authenticated version-read API and regression tests; split
  worker browse queries from catalog writes/cache files. No schema migration.
- Documented device collection write-back evidence and a separate validation
  plan; no vendor POST, write capability, or deployment is part of this change.

## Unreleased — Shared Library browsing

- Enabled read-only Library metadata/artwork access for active household users;
  retained administrator-only settings, manual sync, and detailed
  storage/status.
- Added resizable cover grids, sortable year/collection/list headings, and modal
  title details. Moved filters into multi-select checkbox dialogs and removed
  writer/studio filters.
- Excluded the vendor's built-in Scenes management page from collection
  discovery, fixing initial collection sync failing despite a valid title
  catalog.
- Bounded visible cover requests, cleared/revoked image blobs on navigation and
  account changes, and expanded role/filter/parser/UI regression coverage.

## Unreleased — Optional local library

- Added disabled-by-default Library sync with default-host discovery, hostname
  override, scheduling and collection/detail/artwork options through HA
  settings.
- Added source/version/collection metadata and first detection in schema 6, plus
  local search, metadata/status filters, sorting, and an opt-in Library tab.
- Preserved Played/Paused source semantics separately from journal completion.
- Added a private bounded raster cache outside SQLite, authenticated delivery,
  reserved journal growth, DNS pinning, read-only routes, and lifecycle/backup
  gates.
- Added fictional parser/storage/API/UI/security tests and operator
  documentation. Read-only source format checks succeeded; full sync/browser
  review remains.

## Unreleased — Unified Database management

- Combined Database into one surface with a shared entry/refresh/import/export
  toolbar, table tabs matching the main navigation, and padded list/detail
  columns.
- Added confirmed single-viewing tombstone deletion through the existing journal
  API, retaining optimistic revisions and exact uncertain-response retries.
- Moved import/export and selected/all permanent purge into native dialogs.
  Cancellation clears file selection; pending work/retries retain their
  safeguards.
- Updated documentation and component regressions. Browser layout/focus review
  remains operator work; no deployment or backend/schema changes.

## Unreleased — Page tabs and database entry controls

- Replaced the page toggle/settings dialog with Now Playing, Journal, Database,
  and Settings tabs, retaining Journal as the default and the native options
  flow.
- Limited Add viewing to Journal and added New Entry to Database's viewing list,
  using the shared form and existing validated, retry-safe create API.
- Padded the database entries pane and put the row count above compact,
  single-line First/Previous/Next buttons.
- Preserved unsaved-change prompts, pending-write locks, account cleanup, and
  selected-page-only Now Playing polling. Operator browser review remains
  pending.

## Unreleased — Advanced layout and compatible imports

- Moved Journal/Advanced to a header radio toggle beside Settings; database
  tables use keyboard-accessible tabs and inline checkbox/name lists with a
  right-hand detail editor. Internal records remain read-only; deleted viewing
  corrections preserve deletion status, session evidence, and existing
  audit/retry protections.
- Shared viewing fields between both editors and aligned numeric Settings
  inputs.
- Moved exports into Advanced and added bounded administrator JSON/SQLite
  imports from compatible prior exports, merging new IDs without changing
  existing entries.
- Added full-file validation, isolated in-memory SQLite reads, atomic imports,
  durable retries, transfer barriers, and minimal import attribution in
  schema 5.
- Updated security/compatibility documentation and regression coverage. No
  deployment.

## Unreleased — Display precision, settings, and database maintenance

- Display editor timestamps to whole seconds and minutes to two decimals while
  preserving full precision for unchanged stored fields and automatic recording.
- Added an administrator Settings dialog backed by the existing HA options flow,
  with actor/configuration scoping and native validation/reload.
- Added Advanced raw-table inspection and confirmed selected/all permanent
  purge, gated by disabled recording, revisions, and backup/export barriers.
- Purge removes associated sessions, audit references, and cached response
  content; minimal retry barriers prevent old requests recreating purged
  entries. Schema 4 adds content-free maintenance audit/receipts. Separate
  backups remain unchanged.
- Added storage/API/UI regressions; real-browser review remains operator work.

## Unreleased — Minimum movie runtime

- Added a configurable minimum total runtime for automatic entries, defaulting
  to 10 minutes (0 disables), separately from the watched-time completion
  threshold.
- Excluded shorter playback and waited for unknown/late runtime before
  recording; preserved existing/manual history and partial resume across ignored
  playback.
- Added Now Playing ignored/waiting messages, translated setup/options labels,
  and regression coverage for configuration, timing, recovery, and persistence.

## Unreleased — Viewing editor layout

- Prevented form controls and grid columns from expanding beyond the editor
  card.
- Stacked fields based on the editor pane's width, including side-by-side
  layouts.
- Added fractional-second timestamps to the fictional layout-review page and
  documented the operator checks for native date/time controls.

## Unreleased — Deletion confirmation fix

- Fixed mutation request-ID generation when a browser lacks `crypto.randomUUID`,
  using native cryptographic random bytes for UUID v4 IDs.
- Made deletion preparation failures visible and preserved the entry for retry;
  saving reports missing secure randomness without blaming form values.
- Added regressions for confirmation, duplicate clicks, unavailable randomness,
  and exact retries after an uncertain deletion; rebuilt the panel.

## Unreleased — Lean Now Playing

- Added a compact administrator card with HA cover artwork, exact
  playback/location status, runtime, counted session time, credits/gaps, and
  recording health.
- Reused the existing HA player and snapshot API; no library sync, controls,
  additional media-player entity, database migration, or artwork service.
- Added source-entity read checks, token-free artwork change keys, bounded image
  downloads, visible-only refresh, and cleanup across account/connection
  changes.
- Restricted the fixed local development proxy to explicit export/artwork GETs;
  updated security policy, roadmap, UI guidance, and regression tests.

## Unreleased — Architecture and documentation cleanup

- Reconciled current features, validation limits, and future phases across the
  docs; separated interface research from the current technical design and
  roadmap.
- Removed unused future-feature placeholder modules and the duplicate runtime
  map; API/backup resolution now uses typed HA config-entry resources.
- Separated worker-only history queries from repository lifecycle/CRUD, removed
  redundant pagination metadata work, and bounded title encoding without
  repeated copies.
- Fixed stop-grace state leaking between playback sessions and stale reader
  pagination after a failed refresh; added regression coverage.
- Unified VS Code and terminal checks and rechecked dependency advisories.

## Unreleased — Household readers and history sensors

- Added active-user household journal browsing with bounded read responses;
  notes, source/session details, mutations, and exports remain
  administrator-only.
- Added a dedicated read-only sidebar view, including search, status filters,
  pagination, and cache cleanup when connections/accounts change.
- Added completed-history title/list/count sensors and a separate unfinished
  partial-viewings sensor, refreshed together every 30 seconds.
- Documented shared-history visibility, Recorder implications, rolling windows,
  bounded lists, and operator browser review.

## Unreleased — Test deployment tasks

- Fixed deployment through linked configuration aliases such as `/config` by
  resolving the physical HA directory while retaining managed-path protections.
- Shortened SSH failure summaries to avoid dumping the embedded remote script.
- Added optional `ssh_user` settings for an explicit deployment/restart login
  username.
- Added a default integration-package build and configurable SSH deployment
  tasks for HA OS and Container, including offline target preview and separate
  check/restart.
- Limited packages to runtime files and preserved journal storage during staged
  deployment; retained previous component files for manual recovery.
- Added ignored local target settings, deployment/security guidance, and
  isolated packaging, path, command, locking, and failure-recovery tests.

## Unreleased — Integration display name

- Renamed the integration, setup flow, HA sidebar, HACS listing, and management
  UI to Kaleidescape Companion to distinguish them from HA's built-in
  Kaleidescape integration.
- Existing entries with the old default title update on startup or reload;
  custom entry titles and the `kaleidescape_companion` domain are preserved.

## Unreleased — Journal management UI

- Added an administrator HA sidebar panel and shared local Vite management UI.
- Added journal search/filter/pagination, manual entries, corrections, confirmed
  tombstone deletion, session details, database health, and private exports.
- Preserved untouched observed fields and added conflict recovery and explicit
  retries with the original request UUID and payload.
- Added memory-only development credentials and a fixed local export proxy.
- Added component, credential, proxy, and panel-lifecycle tests; updated
  security boundaries, editor tasks, and the UI/development guides.

## Unreleased — Security hardening

- Documented trust boundaries, hardening/retention procedures, and security
  review requirements.
- Restricted managed storage permissions and rejected unsafe linked paths.
- Bounded database growth and export preparation, size, concurrency, and
  transfer time.
- Added private snapshot cleanup across cancellation, failures, and crash
  recovery.
- Added transactional authenticated actor attribution for manual changes (schema
  3).
- Rechecked access before private responses and during exports; hardened Vite
  defaults.
- Added security regressions to CI/editor tasks, a review template, and
  dependency-update configuration.
- Updated the development HA baseline to 2026.10.4 for its patched uv
  dependency; documented the remaining upstream Pillow finding and added an
  optional audit task.

## Unreleased — Automatic playback journal

- Added optional player/status/location mapping and a reloadable options flow.
- Added monotonic timing, credits completion, partial resumes, rewatches, and
  recovery gaps.
- Migrated schema 1 to 2 with durable sessions and protected manual corrections.
- Added read-only Now Playing/session evidence APIs and bounded backup
  observation buffering.
- Added deterministic state-machine, migration, repository, and HA event-adapter
  tests.

## Unreleased — Journal backend

- Added durable SQLite manual journal records, ordered migrations, and
  worker-owned IO.
- Added administrator-only journal queries/mutations, revisions, and retry
  deduplication.
- Added JSON/SQLite exports, backup write barriers, retained-data lifecycle, and
  diagnostics.
- Added repository, migration, API, export, and lifecycle tests; automatic
  playback tracking remains next.

## 0.0.0 — Framework scaffold

- Named the project Kaleidescape and consolidated the plan and design under
  `docs/`.
- Created a minimal Home Assistant integration using the internal
  `kaleidescape_companion` domain.
- Added component placeholders, a bundled panel shell, development tooling, and
  CI.
- Left journal, library, APIs, persistence, and playback behavior unimplemented.

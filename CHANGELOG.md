# Changelog

## Unreleased

- Group Library editions by source-scoped `source_group`, keeping same-name
  remakes separate. Fill missing descriptions from sibling versions at read time
  while preserving raw metadata and version-specific facts.
- Restrict full-viewport sizing to the main panel, fixing Library and Add to
  Collection spacing. Order tabs Now Playing, Library, Journal, Database, Settings.
- Add Database page sizes of 10/25/100/500, literal search, column sorting, and
  bounded responses; retain administrator-only inspection and purge safeguards.
- Add rough development/runtime organization and calendar/Gmail integration
  investigations to the product plan.

- Add separately opted-in administrator Add to Collection for one version and
  existing target, with read-back verification, protected recovery UI, and schema 8
  durable receipts that prevent automatic POST replay. Removal remains deferred.


- Add configurable landing/Library defaults, URL tab restoration, known/custom
  hidden-collection lists, and guarded dialog backdrop dismissal.
- Add private purchase-history preview and explicit date corrections (schema 7),
  plus an offline corrected-copy helper; preserve journal and first detection.
## Unreleased — Adaptive Library pagination

- Added entries-per-page targets from 1 to 1000, defaulting to 50.
- Fit cover pages to complete measured grid rows; debounce viewport/cover-size
  changes, preserve the current title range, and use the effective size for paging.
  The final catalog remainder stays visible without duplicated entries.
- Added compact group summaries, an 8 MiB list-response budget, batched lookups,
  resize/lifecycle/page-size regressions, and a fictional query benchmark.
- Avoided redundant empty-cover renders on large pages; artwork stays visible-only
  with three requests at once. No device operations or deployment.

## Unreleased — Grouped Library and stable tables

- Grouped identical case-folded names in list/cover views before pagination,
  preserving exact versions and exposing each version in the detail popup.
- Expanded summary `Multiple` formats from concrete source rows; retained
  individual format/year/runtime/status/collection metadata.
- Stabilized table widths across sorts, added accessible drag/keyboard column
  resizing, and truncated/wrapped long fields.
- Added validated hidden-collection preferences to native and sidebar Settings;
  preserved movies and Played/Paused status, with stale-preference refresh checks.
- Added the bounded authenticated version-read API and regression tests; split
  worker browse queries from catalog writes/cache files. No schema migration.
- Documented device collection write-back evidence and a separate validation plan;
  no vendor POST, write capability, or deployment is part of this change.

## Unreleased — Shared Library browsing

- Enabled read-only Library metadata/artwork access for active household users;
  retained administrator-only settings, manual sync, and detailed storage/status.
- Added resizable cover grids, sortable year/collection/list headings, and modal
  title details. Moved filters into multi-select checkbox dialogs and removed
  writer/studio filters.
- Excluded the vendor's built-in Scenes management page from collection discovery,
  fixing initial collection sync failing despite a valid title catalog.
- Bounded visible cover requests, cleared/revoked image blobs on navigation and
  account changes, and expanded role/filter/parser/UI regression coverage.

## Unreleased — Optional local library

- Added disabled-by-default Library sync with default-host discovery, hostname
  override, scheduling and collection/detail/artwork options through HA settings.
- Added source/version/collection metadata and first detection in schema 6, plus
  local search, metadata/status filters, sorting, and an opt-in Library tab.
- Preserved Played/Paused source semantics separately from journal completion.
- Added a private bounded raster cache outside SQLite, authenticated delivery,
  reserved journal growth, DNS pinning, read-only routes, and lifecycle/backup gates.
- Added fictional parser/storage/API/UI/security tests and operator documentation.
  Read-only source format checks succeeded; full sync/browser review remains.

## Unreleased — Unified Database management

- Combined Database into one surface with a shared entry/refresh/import/export
  toolbar, table tabs matching the main navigation, and padded list/detail columns.
- Added confirmed single-viewing tombstone deletion through the existing journal
  API, retaining optimistic revisions and exact uncertain-response retries.
- Moved import/export and selected/all permanent purge into native dialogs.
  Cancellation clears file selection; pending work/retries retain their safeguards.
- Updated documentation and component regressions. Browser layout/focus review
  remains operator work; no deployment or backend/schema changes.

## Unreleased — Page tabs and database entry controls

- Replaced the page toggle/settings dialog with Now Playing, Journal, Database,
  and Settings tabs, retaining Journal as the default and the native options flow.
- Limited Add viewing to Journal and added New Entry to Database's viewing list,
  using the shared form and existing validated, retry-safe create API.
- Padded the database entries pane and put the row count above compact,
  single-line First/Previous/Next buttons.
- Preserved unsaved-change prompts, pending-write locks, account cleanup, and
  selected-page-only Now Playing polling. Operator browser review remains pending.

## Unreleased — Advanced layout and compatible imports

- Moved Journal/Advanced to a header radio toggle beside Settings; database tables
  use keyboard-accessible tabs and inline checkbox/name lists with a right-hand
  detail editor. Internal records remain read-only; deleted viewing corrections
  preserve deletion status, session evidence, and existing audit/retry protections.
- Shared viewing fields between both editors and aligned numeric Settings inputs.
- Moved exports into Advanced and added bounded administrator JSON/SQLite imports
  from compatible prior exports, merging new IDs without changing existing entries.
- Added full-file validation, isolated in-memory SQLite reads, atomic imports,
  durable retries, transfer barriers, and minimal import attribution in schema 5.
- Updated security/compatibility documentation and regression coverage. No deployment.

## Unreleased — Display precision, settings, and database maintenance

- Display editor timestamps to whole seconds and minutes to two decimals while
  preserving full precision for unchanged stored fields and automatic recording.
- Added an administrator Settings dialog backed by the existing HA options flow,
  with actor/configuration scoping and native validation/reload.
- Added Advanced raw-table inspection and confirmed selected/all permanent purge,
  gated by disabled recording, revisions, and backup/export barriers.
- Purge removes associated sessions, audit references, and cached response content;
  minimal retry barriers prevent old requests recreating purged entries. Schema 4
  adds content-free maintenance audit/receipts. Separate backups remain unchanged.
- Added storage/API/UI regressions; real-browser review remains operator work.

## Unreleased — Minimum movie runtime

- Added a configurable minimum total runtime for automatic entries, defaulting to
  10 minutes (0 disables), separately from the watched-time completion threshold.
- Excluded shorter playback and waited for unknown/late runtime before recording;
  preserved existing/manual history and partial resume across ignored playback.
- Added Now Playing ignored/waiting messages, translated setup/options labels,
  and regression coverage for configuration, timing, recovery, and persistence.

## Unreleased — Viewing editor layout

- Prevented form controls and grid columns from expanding beyond the editor card.
- Stacked fields based on the editor pane's width, including side-by-side layouts.
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

- Added a compact administrator card with HA cover artwork, exact playback/location
  status, runtime, counted session time, credits/gaps, and recording health.
- Reused the existing HA player and snapshot API; no library sync, controls,
  additional media-player entity, database migration, or artwork service.
- Added source-entity read checks, token-free artwork change keys, bounded image
  downloads, visible-only refresh, and cleanup across account/connection changes.
- Restricted the fixed local development proxy to explicit export/artwork GETs;
  updated security policy, roadmap, UI guidance, and regression tests.

## Unreleased — Architecture and documentation cleanup

- Reconciled current features, validation limits, and future phases across the docs;
  separated interface research from the current technical design and roadmap.
- Removed unused future-feature placeholder modules and the duplicate runtime map;
  API/backup resolution now uses typed HA config-entry resources.
- Separated worker-only history queries from repository lifecycle/CRUD, removed
  redundant pagination metadata work, and bounded title encoding without repeated copies.
- Fixed stop-grace state leaking between playback sessions and stale reader pagination
  after a failed refresh; added regression coverage.
- Unified VS Code and terminal checks and rechecked dependency advisories.

## Unreleased — Household readers and history sensors

- Added active-user household journal browsing with bounded read responses;
  notes, source/session details, mutations, and exports remain administrator-only.
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
- Added optional `ssh_user` settings for an explicit deployment/restart login username.
- Added a default integration-package build and configurable SSH deployment tasks
  for HA OS and Container, including offline target preview and separate check/restart.
- Limited packages to runtime files and preserved journal storage during staged
  deployment; retained previous component files for manual recovery.
- Added ignored local target settings, deployment/security guidance, and isolated
  packaging, path, command, locking, and failure-recovery tests.

## Unreleased — Integration display name

- Renamed the integration, setup flow, HA sidebar, HACS listing, and management UI
  to Kaleidescape Companion to distinguish them from HA's built-in Kaleidescape integration.
- Existing entries with the old default title update on startup or reload;
  custom entry titles and the `kaleidescape_companion` domain are preserved.

## Unreleased — Journal management UI

- Added an administrator HA sidebar panel and shared local Vite management UI.
- Added journal search/filter/pagination, manual entries, corrections, confirmed
  tombstone deletion, session details, database health, and private exports.
- Preserved untouched observed fields and added conflict recovery and explicit
  retries with the original request UUID and payload.
- Added memory-only development credentials and a fixed local export proxy.
- Added component, credential, proxy, and panel-lifecycle tests; updated security
  boundaries, editor tasks, and the UI/development guides.

## Unreleased — Security hardening

- Documented trust boundaries, hardening/retention procedures, and security review requirements.
- Restricted managed storage permissions and rejected unsafe linked paths.
- Bounded database growth and export preparation, size, concurrency, and transfer time.
- Added private snapshot cleanup across cancellation, failures, and crash recovery.
- Added transactional authenticated actor attribution for manual changes (schema 3).
- Rechecked access before private responses and during exports; hardened Vite defaults.
- Added security regressions to CI/editor tasks, a review template, and dependency-update configuration.
- Updated the development HA baseline to 2026.10.4 for its patched uv dependency;
  documented the remaining upstream Pillow finding and added an optional audit task.

## Unreleased — Automatic playback journal

- Added optional player/status/location mapping and a reloadable options flow.
- Added monotonic timing, credits completion, partial resumes, rewatches, and recovery gaps.
- Migrated schema 1 to 2 with durable sessions and protected manual corrections.
- Added read-only Now Playing/session evidence APIs and bounded backup observation buffering.
- Added deterministic state-machine, migration, repository, and HA event-adapter tests.

## Unreleased — Journal backend

- Added durable SQLite manual journal records, ordered migrations, and worker-owned IO.
- Added administrator-only journal queries/mutations, revisions, and retry deduplication.
- Added JSON/SQLite exports, backup write barriers, retained-data lifecycle, and diagnostics.
- Added repository, migration, API, export, and lifecycle tests; automatic playback tracking remains next.

## 0.0.0 — Framework scaffold

- Named the project Kaleidescape and consolidated the plan and design under `docs/`.
- Created a minimal Home Assistant integration using the internal `kaleidescape_companion` domain.
- Added component placeholders, a bundled panel shell, development tooling, and CI.
- Left journal, library, APIs, persistence, and playback behavior unimplemented.

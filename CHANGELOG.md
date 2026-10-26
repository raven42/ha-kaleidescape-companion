# Changelog

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

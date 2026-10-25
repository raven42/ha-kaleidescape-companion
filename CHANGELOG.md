# Changelog

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

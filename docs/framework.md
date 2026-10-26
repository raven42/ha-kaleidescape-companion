# Kaleidescape Companion framework status

The product name is **Kaleidescape Companion**. The HA domain `kaleidescape_companion` coexists with the built-in **Kaleidescape** integration (`kaleidescape`).

## Present

- Repository layout, editor settings, ignore rules, and version metadata.
- Config flow and runtime lifecycle for one household journal, retaining data on unload/removal.
- SQLite schema/migrations and a dedicated worker for transactional manual journal records.
- Active-user journal reads and administrator-only create/update/delete API,
  optimistic revisions, and durable request deduplication.
- Authenticated JSON/SQLite exports, HA backup write barriers, and content-free diagnostics.
- Private storage permissions, linked-path rejection, bounded exports/database growth,
  and transactional attribution of manual changes (schema 3).
- A [security policy](security.md), security regression tests in the normal check tasks,
  and contributor/agent guidance for future changes.
- Tests for storage recovery, migration rollback, API validation/permissions, exports, backups, reload, and shutdown.
- Optional entity mapping and options flow for one player, preserving registered identities across renames.
- Ordered observation, monotonic session timing, checkpoint/restart recovery, credits completion, partial resumes, and rewatch separation.
- Field corrections/tombstones protected from automatic writes, bounded backup buffering with explicit gaps, and read-only Now Playing/session APIs.
- Administrator HA sidebar panel and shared Vite UI for journal CRUD, filters,
  pagination, session evidence, database health, and JSON/SQLite downloads.
- Memory-only development connection, restricted local export proxy, component
  and proxy security tests, TypeScript checks, formatting, and packaged ES module.
- A read-only household sidebar view for regular users, with server-side field
  allowlists and administrator-only notes, source/session details, and exports.
- Seven [watch-history sensors](sensors.md) for completed history and unfinished
  partial viewings, with shared polling, bounded title lists, and exact counts.
- Remaining boundaries for library, artwork, live Now Playing UI, and controls.
- Scaffold validation script and continuous-integration workflow.
- Runtime-only archives and explicit VS Code SSH deployment tasks for HA OS/Container,
  with a local target preview, retained previous code, and separate check/restart.
- [Product plan](plan.md), [technical design](design.md), and [development guide](development.md).

## Deferred

Multi-player configuration, live subscriptions, catalog synchronization,
artwork, per-user ownership/selective sharing,
and playback controls remain deferred. The basic management panel is registered in HA;
broader product UI and real-browser compatibility/accessibility checks remain.
JSON import and permanent purge are also deferred; SQLite restore is documented.

See the [backend API](backend.md) for the implemented manual and observed journal behavior.
The rest of the design document remains a target specification. Phase 1 is not
complete: broader HA release/backup and real-browser validation
still need work. No household device or playback test has been performed.

## Publication prerequisites

Set the real project documentation/repository URLs and codeowners, choose a license, select and validate supported HA releases, run the real HA lifecycle/config-flow tests, and review the intended release contents. Preparatory HACS metadata is not a claim of catalog acceptance or a production-ready release.

Resolve the [known dependency release blocker](security.md#known-dependency-findings-2026-10-25)
and rerun dependency audits before publication.

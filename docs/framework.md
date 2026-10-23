# Kaleidescape framework status

The product name is **Kaleidescape**. `kaleidescape_companion` is an internal HA namespace needed to coexist with the built-in `kaleidescape` integration.

## Present

- Repository layout, editor settings, ignore rules, and version metadata.
- Config flow and runtime lifecycle for one household journal, retaining data on unload/removal.
- SQLite schema/migrations and a dedicated worker for transactional manual journal records.
- Administrator-only WebSocket create/get/list/update/delete API, optimistic revisions, and durable request deduplication.
- Authenticated JSON/SQLite exports, HA backup write barriers, and content-free diagnostics.
- Tests for storage recovery, migration rollback, API validation/permissions, exports, backups, reload, and shutdown.
- Remaining boundaries for observation, panel, sensors, library, artwork, and controls.
- TypeScript/Lit panel shell, local preview, TypeScript checks, reproducible dependency lockfile, and packaged ES module.
- Scaffold validation script and continuous-integration workflow.
- [Product plan](plan.md), [technical design](design.md), and [development guide](development.md).

## Deferred

Automatic entity mapping/observation, playback/session rules, journal UI, live
subscriptions, catalog synchronization, artwork, sensors, sharing permissions,
and playback controls remain deferred. The bundled panel is not registered in HA.
JSON import and permanent purge are also deferred; SQLite restore is documented.

See the [backend API](backend.md) for the implemented manual journal behavior.
The rest of the design document remains a target specification. Phase 1 is not
complete: player setup, panel access, and broader HA release/backup validation
still need work. No household device or playback test has been performed.

## Publication prerequisites

Set the real project documentation/repository URLs and codeowners, choose a license, select and validate supported HA releases, run the real HA lifecycle/config-flow tests, and review the intended release contents. Preparatory HACS metadata is not a claim of catalog acceptance or a production-ready release.

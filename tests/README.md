# Tests

`test_library.py` uses fictional HTML and mocked networking to check catalog
completeness/version groups, collection status precedence, filters/pagination,
first detection, schema 6 migration, reserved journal headroom, private artwork
limits/rollback, DNS pinning, native HA session/lifecycle, and access revocation.
`frontend/tests/library.test.ts` covers cached browsing, opt-in behavior, filters,
safe text, stale results, cover abort/revocation, and outage handling. The normal
proxy tests include the query-free authenticated library artwork route. Full
source sync, native browser layout, and other firmware require operator review.

Install `python -m pip install -e '.[dev]'`, then run:

```sh
python -m unittest discover -s tests -v
```

Tests cover editable namespace discovery, real temporary SQLite repositories,
migrations and rollback, persistence/retry behavior, revisions, pagination,
backup barriers, export/restore, HA runtime/API handlers, and automatic tracking.
Tracking tests cover pauses/scans, metadata/credits ordering, partial resumes,
rewatches, independent stop-grace windows, recovery gaps, protected corrections,
buffered edges, and overflow. HTTP streaming
responses are mocked. No household devices or running HA server are required.
These are not end-to-end HA OS/Supervisor backup tests.

Page-level tests cover the ordered administrator tabs and keyboard navigation,
inline settings save/cancel/reload, cancelled draft navigation, inactive Now Playing
polling cleanup, and Database toolbar creation/deletion with uncertain-response
exact retries. Single-surface/tab/pagination structure and import/export/purge
dialog state, cancellation, private-file cleanup, and retry locks are checked
in the simulated DOM; padding and
single-line button geometry still require operator browser review.

`test_importing.py` covers compatible JSON/SQLite exports and old-schema viewing
keys, immutable existing IDs, tombstones, precision, hostile/malformed input,
full validation/rollback, transfer/backup/revision barriers, cancellation cleanup,
and access revocation before/after commit. Registered API tests cover validated
Database corrections without restoring tombstones or editing internal fields.
Frontend tests cover table tabs, list/detail editing, exact edit/import retries,
transfer cleanup, file limits, and the narrow authenticated development import
POST route. Native widget layout/focus still requires operator browser review.

`test_maintenance.py` covers fixed-table bounded inspection, changed-page
revisions, selected/all purge of sessions/audit/legacy cached content, replay
barriers, durable receipts, rollback, backup/export conflicts, cancellation, and
denied/in-flight access changes. It exercises the real HA options manager and
integration options flow with loader/reload hooks mocked, checking validation,
actor/configuration binding, persistence, cancellation, and reload scheduling.
`frontend/tests/admin.test.ts` covers settings, raw text, confirmation gates,
lost-response exact purge retries, conflicts, and stale/denied details. Editor
tests verify rounded display without rewriting original source precision.
Native modal focus, layout, and input constraint validation remain operator QA;
the simulated DOM's fractional-step modulo is not browser-equivalent.

`test_runtime_filter.py` covers cutoff boundaries, unknown/late runtime, disabled
and custom cutoffs, gaps, same-ID trailer transitions, storage admission, reload,
partial resume, and retained manual/history records. HA option/observation tests
cover default/legacy configuration, validation, and live ignored/waiting reasons.

`test_now_playing.py` checks administrator/source permissions, disabled tracking,
and dataset scoping. Observation tests cover live session context, safe artwork
change keys, identity changes, and unavailable/invalid picture sources. Frontend
Now Playing tests cover visibility polling, no controls/progress, late snapshots,
image type/size/time limits, fallback, access loss, aborts, and object-URL cleanup.
Proxy tests reject image query tokens, arbitrary paths/targets, methods, and origins.

`test_panel.py` verifies household sidebar registration, static asset scope, reload,
foreign-panel collisions, and failed-setup cleanup. Vitest component tests under
`frontend/tests/` cover the shared management UI, field-preserving corrections,
conflicts, retry UUIDs, token cleanup, and stale private responses.
Component/API regressions also cover browsers without `randomUUID`, secure-random
failure messages, duplicate confirmation clicks, and exact deletion retries.
The optional `/tests/review.html` Vite page uses fictional in-memory data for layout review.
These tests use a simulated DOM; real-browser visual/accessibility testing and
release compatibility validation remain separate. See the [UI guide](../docs/ui.md).

`test_history.py` exercises regular-user field allowlists, denied management,
in-flight role changes, rolling UTC windows, rewatches, corrected dates, deleted
and future-dated records, bounded title lists (including exact UTF-8/JSON byte limits), and sensor
availability/lifecycle.
`frontend/tests/reader.test.ts` covers read-only rendering, filters, safe text,
account/connection cleanup, and late-response rejection using a simulated DOM.

`test_security.py` covers storage permissions and unsafe links, audit attribution
and rollback, bounded database growth/exports, access changes, and repeated
cancellation. `npm --prefix frontend test` tests Vite's host/CORS/file boundaries
with an ephemeral loopback listener and checks that custom environment values are
not exposed. Both suites are part of the default checks. Follow the
[security policy](../docs/security.md) when adding tests or changing boundaries.

`test_deploy.py` verifies runtime archive contents, linked-source rejection,
settings validation, SSH argument/host-key protections, offline previews, and task
dependency boundaries. It exercises staging, linked-path rejection, deployment
locking, and failure recovery through a local shell with fictional temporary
files. Tests cover linked configuration aliases resolving to physical HA storage,
continued rejection of linked managed destinations, and concise SSH errors.
It never opens an SSH connection or restarts HA/Docker. Real target access,
permissions, CLI availability, and startup remain operator validation tasks; see
the [deployment guide](../docs/deployment.md).

Run `python scripts/check_scaffold.py` for syntax, metadata, namespace,
translation, local Markdown-link, and bundle checks. The default VS Code
**Check all** task and `bash scripts/dev.sh check` run both suites plus Ruff
and the frontend build.

`fixtures/` remains reserved for minimized, sanitized protocol/library
examples. Never copy household exports or raw snapshots here. See the
[backend guide](../docs/backend.md) for manual testing with authenticated HA.

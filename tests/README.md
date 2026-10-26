# Tests

Install `python -m pip install -e '.[dev]'`, then run:

```sh
python -m unittest discover -s tests -v
```

Tests cover editable namespace discovery, real temporary SQLite repositories,
migrations and rollback, persistence/retry behavior, revisions, pagination,
backup barriers, export/restore, HA runtime/API handlers, and automatic tracking.
Tracking tests cover pauses/scans, metadata/credits ordering, partial resumes,
rewatches, recovery gaps, protected corrections, buffered edges, and overflow. HTTP streaming
responses are mocked. No household devices or running HA server are required.
These are not end-to-end HA OS/Supervisor backup tests.

`test_panel.py` verifies admin sidebar registration, static asset scope, reload,
foreign-panel collisions, and failed-setup cleanup. Vitest component tests under
`frontend/tests/` cover the shared management UI, field-preserving corrections,
conflicts, retry UUIDs, token cleanup, and stale private responses. The optional
`/tests/review.html` Vite page uses fictional in-memory data for layout review.
These tests use a simulated DOM; real-browser visual/accessibility testing and
release compatibility validation remain separate. See the [UI guide](../docs/ui.md).

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

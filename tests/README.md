# Tests

Install `python -m pip install -e '.[dev]'`, then run:

```sh
python -m unittest discover -s tests -v
```

Tests cover editable namespace discovery, real temporary SQLite repositories,
migrations and rollback, persistence/retry behavior, revisions, pagination,
backup barriers, export/restore, and HA runtime/API handlers. HTTP streaming
responses are mocked. No household devices or running HA server are required.
These are not end-to-end HA OS/Supervisor backup tests.

Run `python scripts/check_scaffold.py` for syntax, metadata, namespace,
translation, local Markdown-link, and bundle checks. The default VS Code
**Check all** task and `bash scripts/dev.sh check` run both suites plus Ruff
and the frontend build.

`fixtures/` remains reserved for minimized, sanitized protocol/library
examples. Never copy household exports or raw snapshots here. See the
[backend guide](../docs/backend.md) for manual testing with authenticated HA.

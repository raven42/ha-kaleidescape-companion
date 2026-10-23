# Tests

After `python -m pip install -e '.[dev]'`, run
`python -m unittest discover -s tests` to check that the installed namespace
can be scanned by Home Assistant. This guards against editable-install finder
paths being mistaken for component directories.

Behavior tests will be added with the relevant implementation phase. `fixtures/` is reserved for minimized, sanitized library/protocol examples. Do not copy household exports or raw server snapshots into this directory.

Run `python3 scripts/check_scaffold.py` for current syntax, metadata, namespace, translation, and local Markdown-link checks. Home Assistant runtime tests are intentionally deferred until the supported HA release and Phase 1 behavior are established.

# Testing and validation

Run `scripts/setup` first, then use `scripts/check` as the normal validation
gate. Shared definitions power terminal commands, VS Code tasks and CI. Normal
checks use fictional data and temporary storage; emulator/proxy tests bind
loopback sockets but do not contact household devices or live providers.

```sh
scripts/check
scripts/test --providers-only
scripts/test --python-only
scripts/test --frontend-only
scripts/format --check
scripts/check-pyk --reconstruct
```

The provider suite is independent of HA and runs on the CI Python matrix. The
integration suite uses standard unittest discovery. The wrappers set isolated
asyncio slow-callback diagnostics to 250 ms without disabling debug checks;
direct `python -m unittest` commands retain Python's default. Frontend tests
combine Node security/proxy checks with simulated-DOM components. The
[test suite map](../../tests/README.md) identifies feature coverage.

For focused work in the prepared environment:

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_repository.py'
PYTHONPATH=custom_components/kaleidescape_companion .venv/bin/python -m unittest discover -s tests/scrapers
npm --prefix frontend test
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
npm --prefix frontend run build:check
```

Check includes lint/format validation, all suites, TypeScript, project metadata
and links, shell syntax, bundled pyk hashes and offline reconstruction, and
generated-asset comparison. Build intentionally updates the packaged frontend;
Check instead builds into temporary output and fails if the accepted bundle
differs. Inspect changes after Build and rerun Check before packaging. Package
also verifies required generated assets; it does not substitute for all tests.

Network advisory scans are an explicit separate command:

```sh
scripts/dependency-audit
```

Both Python and npm scans run even if one fails. A vulnerability result or
advisory-service/network failure produces a failing exit. Record versions,
exposure and disposition; an old clean scan is not current release evidence.

Expected fault-injection warnings can appear in a passing suite. Inspect the
exit status and test summary, and investigate unexpected warnings, leaked
resources or skipped cases. If a sandbox blocks loopback sockets, record that
environment failure separately and use the execution tool's scoped permission
workflow for the rerun.

Offline tests do not qualify native HA lifecycle or backup hooks, actual browser
layouts, devices, providers, email transport or calendar writes. Ask the
operator to review a concrete UI with navigation and a short checklist; do not
automate a real browser. Device/provider/deployment qualification uses a
separately selected scope. The [roadmap](roadmap.md#external-qualification)
defines required acceptance; skipped cases remain open.

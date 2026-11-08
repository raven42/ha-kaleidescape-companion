# Test suites

Run the complete local check from the repository root:

```sh
bash dev/dev.sh check
```

It checks workspace/runtime consistency, independent metadata providers,
integration tests, project structure, Python lint/formatting, shell syntax,
Markdown lint/formatting, frontend lint/types, component/proxy tests and the
production bundle. Tests use fictional data and temporary storage. Loopback
emulator/proxy tests need local socket permission; normal checks contact no
household devices or external metadata providers.

## Focused checks

```sh
PYTHONPATH=custom_components/kaleidescape_companion .venv/bin/python -m unittest discover -s tests/scrapers
.venv/bin/python dev/run_python_tests.py
npm --prefix frontend test
npm --prefix frontend run build
```

- `test_repository`, `test_backend`, `test_security`, migration and import
  suites exercise worker-owned storage, HA lifecycle, bounded operations and
  roles.
- Library, purchases, matching and preferences suites cover exact identities,
  cache preservation, browsing, financial field privacy and sticky UI settings.
- Purchase tests cover schema-25 movement of embedded invoice history, nullable
  dates, schema-27 repair evidence, retained unmatched records, later
  correlation, replay/conflict handling and purchase-only reconciliation during
  recording. Receipt and blueprint tests exercise quoted forwards, original
  receipt dates, required HTML item extraction, cover/title duplicate links,
  version fingerprints and comment histories with fictional inputs.
- `test_read_cache` checks distinct-credit work, household/admin search parity,
  cache bounds/invalidation and cleanup after interrupted queries. The offline
  [enriched Library benchmark](../docs/guides/guide-development.md#library-performance)
  measures fictional paging and search separately from browser rendering.
- Observation, tracking, history, journal linkage and calendar suites cover
  timing, durable evidence, corrections and external-write receipts.
- `test_controls` uses fictional protocol peers; `test_now_playing` checks
  source permissions and household artwork projections.
- `test_enrichment` and `tests/scrapers` cover provider parsing, credentials,
  matching, throttling, networking policy, cancellation and storage boundaries.
- `frontend/tests` uses a simulated DOM and fictional API transport. Unexpected
  console warnings/errors fail tests. Tests never automate a real browser.
  Coverage includes purchase reconciliation/artwork, rating and format filters,
  calendar search/view restoration, Watch Soon badges and repeated
  custom-element module loading. Simulated layout assertions are not visual
  browser validation.

Keep credentials, household exports, saved store pages and player addresses out
of fixtures and tracked files. Add regression tests when changing a trust
boundary. Use existing shared fixtures instead of copying a real database.

For browser testing, ask the operator to review the concrete UI and provide
navigation steps. For live commands, choose a suitable player and playback
window explicitly; deployment and device tests are not part of the check task.
See the [development guide](../docs/guides/guide-development.md),
[security policy](../docs/policies/policy-security.md), and
[controls guide](../docs/design/design-playback-controls.md).

`test_calendar_maintenance` uses fictional HA calendar entities for Full Sync,
including UID-preserving edits, replacement before deletion, age/recurrence
bounds, failed/malformed reads, quarantine, stale data, restart uncertainty,
worker guards and administrator access. UI tests cover shared time shifting,
dedicated-calendar warnings, saved mode refresh and pending-set review tokens.
No provider calendars are read or changed by these checks.

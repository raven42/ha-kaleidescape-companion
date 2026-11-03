# Kaleidescape Companion development

## Scope

This repository contains the journal backend, automatic observation, shared
reader/administrator UI, history/Library sensors, and opt-in library sync. Keep
feature behavior aligned with the [plan](plan.md), [design](design.md), and
[framework status](framework.md). The implemented Library and controls extend
the journal without replacing HA's built-in playback entities.

## Tooling

### Development setup

Requires Python **3.14.2+**, SQLite **3.35+**, Node.js **22.13+ (22.x) or 24+**,
and npm. Python's minimum matches the Home Assistant **2026.10.4** development
dependency; it is not a declared minimum supported HA release. The isolated HA
runtime may also need FFmpeg and jpeg-turbo for its base media components; the
journal itself does not process media.

From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m pip install -e ../kaleidescape-api
npm --prefix frontend ci
bash dev/dev.sh check
```

The editable install reads the `dev` extra in `pyproject.toml`, which includes
Home Assistant and Ruff. The separate editable API install provides its CLI and
development tools and supplies the source used to refresh Companion's generated
vendor copy. Frontend dependencies use the npm lockfile. `frontend/.npmrc`
disables dependency lifecycle hooks; the SDK's development Husky hook is not
needed. The explicit build commands still run, and esbuild uses its platform
package. The optional `bash dev/dev.sh setup` performs the same installation
steps. An existing virtual environment is reused; deactivate and recreate it
when changing Python versions. HA installs additional integration requirements
on first start, which needs internet access.

Run these in separate terminals:

```sh
# Standalone frontend preview with hot reload
bash dev/dev.sh preview
# Separate Home Assistant development server
bash dev/dev.sh ha
```

Open <http://127.0.0.1:5173/> for the development connection screen or
<http://127.0.0.1:8123/> for HA. Complete HA onboarding with a local development
account, then choose **Settings → Devices & services → Add integration →
Kaleidescape Companion**. Open **Kaleidescape Companion** in HA's sidebar to
manage the journal using your signed-in administrator account. For Vite, use a
memory-only token from that local development account as described in the
[UI guide](ui.md). Existing entries can enable automatic tracking through
**Configure**. Select one player and its two sensors as described in the
[tracking guide](backend.md#automatic-tracking). Fourteen
[HA sensors](sensors.md) are created. Regular HA users see the read-only
household journal and the enabled cached Library. Keep analytics off if you do
not want development telemetry.

HA uses `.ha-dev/`, including credentials and storage. That directory, `.venv/`,
npm dependencies, and build intermediates are ignored by Git. The bundled
integration panel remains tracked as a release asset. The launcher symlinks only
`kaleidescape_companion` into the local HA config, so backend edits are
available after restarting HA. Rebuild frontend edits with
`bash dev/dev.sh check`; Vite preview updates automatically.

The initial HA YAML comes from `dev/ha-development.yaml` and is copied only when
`.ha-dev/configuration.yaml` is absent. Edit the local copy for experiments. It
binds to `127.0.0.1:8123` and excludes `default_config` and automatic discovery.
HA still loads its mandatory core/base integrations. No household devices or
existing HA configuration are configured by this setup. Stop either server with
**Ctrl+C**; restart HA after Python changes. If port 8123 is occupied, stop the
conflicting development process. The Vite adapter intentionally uses fixed
ports; changing the HA port requires a reviewed matching frontend/proxy
configuration change.

HA's upstream development container is another option:
[official environment guide](https://contributors.home-assistant.io/core/development/environment/).

### VS Code tasks

Open the repository folder in VS Code and use **Tasks: Run Task** from the
Command Palette. Run **Setup dependencies** for a new checkout. **Tasks: Run
Build Task** runs the checks/build and creates an integration archive; **Tasks:
Run Test Task** runs **Check all**, including the build, Python tests, project
validation, lint, and formatting checks. Each check is also available as an
individual task. Python tasks use `.venv` directly, so shell activation is
unnecessary.

**Build frontend** remains available for a quicker frontend-only build. For a
remote test instance, initialize the ignored deployment settings, review
**Preview test HA deployment**, then run **Deploy to test HA**. Restart is a
separate task, or use **Build, deploy and restart test HA** for the explicit
combined action. Both HA OS and Container targets are configurable; see the
[deployment guide](deployment.md).

**Run frontend preview** and **Run Home Assistant** each use a dedicated
terminal. Stop them with **Tasks: Terminate Task** or Ctrl+C. Servers are
started only when you explicitly run their tasks.

With the servers running, use **Open frontend webview**, **Open Home Assistant
webview**, or **Open server webviews** to open their URLs inside VS Code. These
use the built-in browser command and do not start servers. Current VS Code opens
each URL in an integrated browser tab; older versions may reuse the Simple
Browser view. The tasks use the default ports 5173 and 8123.

### Checks and packaging

With the virtual environment activated:

```sh
python dev/vendor_api.py --check
PYTHONPATH=custom_components/kaleidescape_companion python -m unittest discover -s tests/scrapers
python -m unittest discover -s tests -v
python dev/check_project.py
ruff check .
ruff format --check .
npm --prefix frontend run lint
npm --prefix frontend run lint:markdown
npm --prefix frontend run format:docs:check
npm --prefix frontend run format:check
npm --prefix frontend test
npm --prefix frontend run build
```

The setuptools backend explicitly includes the
`custom_components.kaleidescape_companion` namespace and its manifest, setup
strings, translations, and bundled panel. `pip install -e '.[dev]'` exposes
checkout changes without reinstalling Python source files. HA still loads the
integration through its configuration directory's `custom_components` path; the
local launcher creates that link for development. The protocol API is generated
into the integration's `_vendor/` directory; provider code lives in its
`scrapers/` directory. Both are included in its archive. Home Assistant itself
and development tools belong in the project's `dev` extra.

The Vite development server binds to loopback. Its development adapter connects
only to local HA and clears its token on disconnect; the adapter is excluded
from the production bundle. The explicit `/review.html` page uses fictional
in-memory records for layout review. The production build is a self-contained ES
module with no external runtime imports, packaged into the integration directory
and committed with source changes so a future HACS installation does not need
Node. Run `npm --prefix frontend run format:docs` to format all project
Markdown. The Markdown rules live in `.markdownlint-cli2.jsonc`; ESLint uses
`frontend/eslint.config.mjs`. The Markdown linter has compatible patched KaTeX
and RE2JS overrides in the npm lockfile; recheck/remove these when upstream
adopts the fixed versions. Run `npm --prefix frontend run format` to format
frontend source/tests and `npm --prefix frontend run format:check` to check
them. CI and `dev/dev.sh check` include Ruff, ESLint, Markdownlint,
source/documentation formatting, proxy security tests, component tests, and the
production build.

Component tests use Lit's development build with lifecycle diagnostics enabled.
Only its expected development-mode startup banner is suppressed in the test
setup. Unexpected console warnings/errors remain visible and fail tests, so
successful runs should not contain routine `stderr` sections. CLI tests capture
and verify expected prompts instead of printing temporary paths. Project npm
settings disable dependency lifecycle scripts and unrelated npm upgrade notices;
explicit dependency/security checks remain available.

`frontend/package-lock.json` fixes the frontend dependency resolution. Commit
lockfile updates with the corresponding source change. CI repeats the build and
checks the packaged module matches its source. Minimum supported HA and frontend
APIs remain a release validation task. The default VS Code **Check all** calls
the same `dev/dev.sh check` entry point as terminal development so the local
check sequence stays consistent.

The
[standalone playback protocol harness](playback-controls.md#standalone-protocol-proof-of-concept)
accepts explicit IP/serial and probe/PLAY/STOP operands without starting HA.
Handle launch is experimental. Normal checks use fictional loopback emulation;
real device tests are operator actions, separate from build/test tasks. The
[protocol library guide](protocol-library.md) explains the separate API project.
The API source is maintained and checked independently in the sibling
`../kaleidescape-api` checkout. Companion copies its importable runtime modules
into `_vendor/` before deployment; the standalone project retains its own CLI,
docs, tests, and distribution build.

## Integration framework

Integration release versions remain `0.0.0`; current API, database and JSON
export versions are listed in the [backend guide](backend.md). The
`kaleidescape_companion` domain coexists with HA's built-in `kaleidescape`
integration. Existing framework entries open the database on reload/restart
without a configuration migration.

The [technical design](design.md#source-boundaries) maps source files to their
responsibilities and documents future extension points. Runtime resources belong
to typed config entries; sensors use a shared HA update coordinator, and
database work stays on its dedicated worker.

Manual additions select cached Library versions with known runtime; the worker
derives identity/runtime/end. New entries default to completed; Partial asks for
watched minutes. Journal date/title sorts retain revision-bound paging. Opt-in
[calendar publishing](calendar.md) uses a fixed writable HA calendar and flat
title/description placeholders. Protected display snapshots and outbox receipts
support confirmed historical Journal export with bounded remote matching. No
automatic history/import backfill occurs. Automated tests use simulated calendar
actions; provider/browser review stays an operator step.

Journal's personal Calendar-view toggle uses bounded local-month reads and the
existing authenticated Library artwork cache, independently of external
publishing. It is available to both household roles, with compact positive
detail projections. Component tests cover navigation, poster stacks, popup
content and late-response cleanup; rendered browser review remains with the
operator. See the [month view guide](calendar.md#journal-month-view).

The [backend guide](backend.md) documents storage, role-scoped API access,
manual testing, backup/export, restore, and retention. Automatic observation,
session timing, entity setup, household reading, administrator
[management](ui.md), and [HA sensors](sensors.md) are implemented. The shared
Now Playing display reuses HA artwork and source states with visible-only
snapshot refresh. Administrator Settings reuses the native HA options flow.
Database uses a shared toolbar and table tabs for fixed-table inspection,
raw-first details, validated supported-field corrections, permanent
selected-entry deletion, and compatible JSON/SQLite merge imports. Personal
Options persist pagination, sort and system-table visibility. Schema 12 adds
content-free database-operation audit and monotonic settings revisions.
Transfers and edit/delete confirmations use native dialogs; pending work and
exact retries prevent accidental dismissal. Journal Delete remains a tombstone.
Optional [Library sync](library.md) adds schema 6 source/version/collection
metadata and a private bounded artwork cache, with default-host discovery and
manual override. Its Library tab stays disabled until opted in through Settings.
All active users can browse the enabled Library; settings and manual sync remain
administrator-only. Worker queries group source-scoped `source_group` values
before pagination while retaining exact versions; the popup loads at most 50
versions per page. Hidden collections are display-only and use known/custom
value lists. Schema 11 [UI preferences](ui-preferences.md) save view/count,
applied filters, search, sort and sizing per HA user; hidden names are shared
database settings. The landing default remains native, with URL main-tab
restoration. The [purchase-date helper](purchase-dates.md) stays offline;
corrected SQLite copies use the reviewed missing-data merge. Schema 16
consolidates invoice history onto the scanned `library` table. Purchase imports
require a matched entry; prices/orders/history stay administrator-only, while
dates remain shared. Fixed/resizable table widths and popup version navigation
need operator browser review. The page-size dropdown offers 25/100/1000/All;
Covers adapts numeric targets to whole rows and All aggregates bounded
revision-checked chunks. Status flags and explicit format chips use public
metadata, without guessing missing capabilities. Use
`.venv/bin/python dev/benchmark_library.py` to time a fictional
5000-name/10000-version cache without networking; this does not replace browser
or target-HA timing. [Add to Collection](library-collections.md) is separately
opt-in and administrator-only; removal remains deferred.
[Playback controls](playback-controls.md) now add separately opted-in discovery,
a default player and a guarded control interface. Progress, subscriptions, and
selective per-user sharing remain deferred.

Library search/status bars are sticky, search includes partial actors/directors,
and filters use bounded people suggestions. Database now has personal Options,
raw-first details and confirmed supported-field edits/deletions with
schema-aware condition completion; see the [Database guide](database.md). Normal
checks use only synthetic databases and mocked devices. Schema upgrades run
automatically with a private pre-migration backup; runtime code and frontend
must ship together.

## Validation

`python -m unittest discover -s tests -v` exercises real temporary SQLite
repositories and HA objects/registered command handlers. It covers persistence,
retry deduplication, optimistic edits, literal search/pagination, migration
rollback, backup barriers, exported-database restore, permissions, unload,
shutdown, HTTP export cleanup, automatic timing, partial resumes, credits
ordering, protected corrections, recovery, and observation overflow. HTTP
request/response objects are mocked. Maintenance tests cover purge references,
old replay barriers, atomic rollback, revision/confirmation conflicts, cancelled
writes, actor/role access, and native HA options validation/persistence/reload
scheduling. This is not a full HA OS/Supervisor end-to-end test. Temporary
fixtures contain only fictional records.

Security regressions cover private storage permissions, linked-path rejection,
audit attribution/rollback, database growth, export size/time/concurrency
limits, repeated cancellation, and access revocation.
`npm --prefix frontend test` uses an ephemeral loopback server to verify host,
CORS, environment, and file-serving boundaries; it closes the listener
afterward. These checks run in CI, the default VS Code **Check all** task, and
`dev/dev.sh check`. Network advisory scans are separate from these offline
checks; see the [security procedures](security.md).

Earlier isolated HA 2026.10.2 smoke runs verified the real config flow,
authenticated WebSocket create/retry/list, JSON/SQLite downloads, denial of
anonymous/non-admin requests, and data retention after integration reload. A
second isolated run verified options enabling/disabling, synthetic playback
recording and credits completion, authenticated Now Playing/session APIs, and
observer cleanup/recovery on reload. Temporary instances were stopped afterward.

Those smoke runs predate the shared reader and sensors; they do not validate
these features on the current 2026.10.4 baseline or establish a supported
matrix. Automated tests do not replace operator browser review. Native
number-step validation is also operator QA: the simulated DOM uses exact
floating-point remainder for fractional steps, so component tests stub form
validity and exercise actual backend validation independently.

Use an isolated development HA instance for manual UI/config-flow and API
checks. Do not overwrite the built-in integration. Configure only sources
intended for recording; tests use fictional states and send no controls. Project
validation and frontend checks remain part of the default VS Code **Check all**
task and CI.

Shared dialog and split-pane sizing lives in `frontend/src/ui/styles.ts`,
`entry-layout.styles.ts` and `viewport.ts`. The viewport controller measures
sticky controls and the visible viewport without persisting layout state or
requesting data. Simulated geometry and touch-selection regressions accompany
the existing paging/dialog tests. Follow the
[responsive review checklist](ui.md#responsive-layouts-and-review) for real
phone/tablet rendering; automated DOM tests do not replace that review.

## Library performance

Use the offline benchmark with fictional provider credits to exercise the
expanded catalog, paging and literal/fuzzy/quoted searches:

```sh
python dev/benchmark_library.py --titles 1000 --samples 5 --enriched
```

Omit `--enriched` for the source-only baseline, or use up to 5000 movie groups
(10,000 versions). Timings include repository dispatch, query/projection and
page-size validation; they exclude WebSocket transport, rendering and artwork.
Compare the same catalog, machine, page size and warm/cold state. Local results
do not guarantee target HA performance. The benchmark never reads household
files or makes network requests.

Library search materializes distinct names before matching, while private
worker-local memoization reuses effective metadata and revision-bound facets.
Cache state is bounded and discarded at close; imports, edits, source policies,
membership changes and availability keep the existing revision/input checks.
Current profiling does not justify duplicating credits into permanent tables or
introducing FTS/WAL. Keep the two-second query and response-byte limits when
extending this read path.

For an explicitly authorized household investigation, create an owner-only
temporary directory and use SQLite's backup API from a read-only source
connection. Open only that disposable copy through the repository. Never open
the source export through runtime setup, which may migrate it or tighten its
permissions. Keep records, user identities, queries and private files out of
benchmarks and fixtures; report only aggregate counts/timings. Remove the copy
afterward. A running scrape need not block read profiling, but take one
consistent snapshot for comparisons.

## Working practices

The [security policy](security.md) applies to every development phase. Review
its trust boundaries before API, storage, network, or UI changes, and add
regression tests for affected protections. `AGENTS.md` and the pull request
template carry the same requirement into future work. Development must use
fictional data and isolated services; a successful build is not a security
assessment.

- Preserve the existing Kaleidescape integration and theater automation.
- Keep local server credentials, movie-library snapshots, databases, and private
  diagnostics out of Git.
- Keep parser and review fixtures fictional or reduced/sanitized; never use
  household snapshots in normal checks.
- Do not build database schemas, state machines, API handlers, or device clients
  into placeholder modules ahead of their phase.
- Choose a real project URL, repository owner/codeowners, and license before
  publishing. No fabricated ownership or repository links are included.
- No deployment, SSH connection, or device-control test is part of normal
  verification.

Use the general [reviewed merge import](imports.md) to bring a corrected copy
into live storage. The HTML parser and corrected-copy helper stay under `dev/`;
the runtime accepts reviewed purchase JSON through the general Database import
flow, with explicit Library matching and administrator-only financial fields.

### Provider development

Provider code is under `custom_components/kaleidescape_companion/scrapers/`.
`Providers.metadata(provider, MovieQuery(...))` is the shared API; `providers/`
owns individual provider adapters/parsers, and `transport.py` owns the shared
limiter. HA opt-ins, network allowlists and storage stay in the integration's
`enrichment/` adapter. Full checks run its offline tests directly from the
integration source. The protocol API runtime is copied from the sibling project
and checked with `python dev/vendor_api.py --check`. Do not use a household
movie/page or real API credential as a fixture. Metadata setup and remaining
operator validation are documented in [enrichment](enrichment.md).

### Validate an exported database

Run `python dev/validate_database.py path/to/export.sqlite` to perform read-only
SQLite integrity and foreign-key checks plus validation of known Library/Journal
JSON columns. Output contains counts only; it does not expose record values or
repair the file. Exit codes are 0 for a passing file, 1 for detected violations,
and 2 when validation cannot finish. Prefer a downloaded SQLite export over a
running database. Structural validation does not test scraper providers or
semantic metadata correctness.

### Operational logging

Companion uses Home Assistant's Python logging configuration for integration
messages. To investigate, enable debug logging for the integration or configure
`custom_components.kaleidescape_companion` at `debug` in HA's Logger settings.
Disable debug logging after reproduction and review logs before sharing them.
Health diagnostics are a separate snapshot, not a log history. The bundled
protocol API retains its own existing logging implementation; its replacement is
a separate effort. Live HA debug-download behavior still requires operator
review.

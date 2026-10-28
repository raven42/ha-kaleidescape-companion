# Kaleidescape Companion development

## Scope

This repository contains the journal backend, automatic observation, shared reader/administrator UI, history sensors, and opt-in library sync. Keep feature behavior aligned with the [plan](plan.md), [design](design.md), and [framework status](framework.md). Journal implementation comes before the library browser and controls.

## Tooling

### Development setup

Requires Python **3.14.2+**, Node.js **22.12+**, and npm. Python's minimum
matches the Home Assistant **2026.10.4** development dependency; it is not
a declared minimum supported HA release. The isolated HA runtime may also need FFmpeg and jpeg-turbo for its base media
components; the journal itself does not process media.

From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
npm --prefix frontend ci
bash scripts/dev.sh check
```

The editable install reads the `dev` extra in `pyproject.toml`, which includes
Home Assistant and Ruff. Frontend dependencies use the npm lockfile.
The optional `bash scripts/dev.sh setup` performs the same installation steps.
An existing virtual environment is reused; deactivate and recreate it when
changing Python versions.
HA installs additional integration requirements on first start, which needs
internet access.

Run these in separate terminals:

```sh
# Standalone frontend preview with hot reload
bash scripts/dev.sh preview
# Separate Home Assistant development server
bash scripts/dev.sh ha
```

Open <http://127.0.0.1:5173/> for the development connection screen or
<http://127.0.0.1:8123/> for HA. Complete HA onboarding with a local development
account, then choose **Settings → Devices & services → Add integration →
Kaleidescape Companion**. Open **Kaleidescape Companion** in HA's sidebar to manage the journal using
your signed-in administrator account. For Vite, use a memory-only token from that
local development account as described in the [UI guide](ui.md). Existing entries
can enable automatic tracking through **Configure**. Select one player and its
two sensors as described in the [tracking guide](backend.md#automatic-tracking).
Seven [history sensors](sensors.md) are created. Regular HA users see the read-only
household journal. Keep analytics off if you do not want development telemetry.

HA uses `.ha-dev/`, including credentials, logs, and storage. That directory,
`.venv/`, npm dependencies, and build intermediates are ignored by Git. The
bundled integration panel remains tracked as a release asset. The launcher
symlinks only `kaleidescape_companion` into the local HA config, so backend
edits are available after restarting HA. Rebuild frontend edits with
`bash scripts/dev.sh check`; Vite preview updates automatically.

The initial HA YAML comes from `scripts/ha-development.yaml` and is copied
only when `.ha-dev/configuration.yaml` is absent. Edit the local copy for
experiments. It binds to `127.0.0.1:8123` and excludes `default_config` and
automatic discovery. HA still loads its mandatory core/base integrations.
No household devices or existing HA configuration are configured by this
setup. Stop either server with **Ctrl+C**; restart HA after Python changes.
If port 8123 is occupied, stop the conflicting development process. The Vite
adapter intentionally uses fixed ports; changing the HA port requires a reviewed
matching frontend/proxy configuration change.

HA's upstream development container is another option:
[official environment guide](https://contributors.home-assistant.io/core/development/environment/).

### VS Code tasks

Open the repository folder in VS Code and use **Tasks: Run Task** from the
Command Palette. Run **Setup dependencies** for a new checkout. **Tasks: Run
Build Task** runs the checks/build and creates an integration archive; **Tasks: Run Test Task** runs
**Check all**, including the build, Python tests, scaffold validation, lint,
and formatting checks. Each check is also available as an individual task.
Python tasks use `.venv` directly, so shell activation is unnecessary.

**Build frontend** remains available for a quicker frontend-only build.
For a remote test instance, initialize the ignored deployment settings, review
**Preview test HA deployment**, then run **Deploy to test HA**. Restart is a separate
task, or use **Build, deploy and restart test HA** for the explicit combined action.
Both HA OS and Container targets are configurable; see the [deployment guide](deployment.md).

**Run frontend preview** and **Run Home Assistant** each use a dedicated
terminal. Stop them with **Tasks: Terminate Task** or Ctrl+C. Servers are
started only when you explicitly run their tasks.

With the servers running, use **Open frontend webview**, **Open Home Assistant
webview**, or **Open server webviews** to open their URLs inside VS Code.
These use the built-in browser command and do not start servers. Current VS Code
opens each URL in an integrated browser tab; older versions may reuse the Simple
Browser view. The tasks use the default ports 5173 and 8123.

### Checks and packaging

With the virtual environment activated:

```sh
python -m unittest discover -s tests -v
python scripts/check_scaffold.py
ruff check .
ruff format --check .
npm --prefix frontend run format:check
npm --prefix frontend test
npm --prefix frontend run build
```

The setuptools backend explicitly includes the `custom_components.kaleidescape_companion`
namespace and its manifest, setup strings, translations, and bundled panel.
`pip install -e '.[dev]'` exposes checkout changes without reinstalling Python
source files. HA still loads the integration through its configuration directory's
`custom_components` path; the local launcher creates that link for development.
Runtime third-party requirements for the distributed integration belong in its
`manifest.json`; Home Assistant itself and development tools belong in the
project's `dev` extra. No additional runtime library is currently required.

The Vite development server binds to loopback. Its development adapter connects
only to local HA and clears its token on disconnect; the adapter is excluded from
the production bundle. The explicit `/tests/review.html` page uses fictional
in-memory records for layout review. The production build is a self-contained ES
module with no external runtime imports, packaged into the integration directory
and committed with source changes so a future HACS installation does not need Node.
Run `npm --prefix frontend run format` to format frontend source/tests and
`npm --prefix frontend run format:check` to check them. CI and `dev.sh check`
include formatting, proxy security tests, component tests, and the production build.

`frontend/package-lock.json` fixes the frontend dependency resolution. Commit lockfile updates with the corresponding source change. CI repeats the build and checks the packaged module matches its source. Minimum supported HA and frontend APIs remain a release validation task. The
default VS Code **Check all** calls the same `scripts/dev.sh check` entry point
as terminal development so the local check sequence stays consistent.

## Integration framework

Integration release versions remain `0.0.0`; API and database schema versions
are `1` and `6`, respectively; JSON export format remains `2`.
The `kaleidescape_companion` domain coexists with HA's built-in
`kaleidescape` integration. Existing framework entries open the database on
reload/restart without a configuration migration.

The [technical design](design.md#source-boundaries) maps source files to their
responsibilities and documents future extension points. Runtime resources belong
to typed config entries; sensors use a shared HA update coordinator, and database
work stays on its dedicated worker.

The [backend guide](backend.md) documents storage, role-scoped API access,
manual testing, backup/export, restore, and retention. Automatic observation,
session timing, entity setup, household reading, administrator [management](ui.md),
and [history sensors](sensors.md) are implemented. The administrator Now Playing
card reuses HA artwork and source states with visible-only snapshot refresh.
Administrator Settings reuses the native HA options flow. Database uses a shared
toolbar and table tabs for fixed-table inspection, validated viewing corrections,
tombstone deletion, explicit permanent purge, and compatible
JSON/SQLite viewing merge imports; schema 5 adds content-free import audit.
Transfers and purge use native dialogs; pending work and exact retries prevent
accidental dismissal. No additional API or schema change is needed for this layout.
Optional [Library sync](library.md) adds schema 6 source/version/collection
metadata and a private bounded artwork cache, with default-host discovery and
manual override. Its Library tab stays disabled until opted in through Settings.
Playback controls, progress, subscriptions, and broader Library sharing remain deferred.

## Validation

`python -m unittest discover -s tests -v` exercises real temporary SQLite
repositories and HA objects/registered command handlers. It covers persistence,
retry deduplication, optimistic edits, literal search/pagination, migration
rollback, backup barriers, exported-database restore, permissions, unload,
shutdown, HTTP export cleanup, automatic timing, partial resumes, credits
ordering, protected corrections, recovery, and observation overflow. HTTP request/response objects are mocked.
Maintenance tests cover purge references, old replay barriers, atomic rollback,
revision/confirmation conflicts, cancelled writes, actor/role access, and native
HA options validation/persistence/reload scheduling.
This is not a full HA OS/Supervisor end-to-end test. Temporary fixtures contain
only fictional records.

Security regressions cover private storage permissions, linked-path rejection,
audit attribution/rollback, database growth, export size/time/concurrency limits,
repeated cancellation, and access revocation. `npm --prefix frontend test` uses
an ephemeral loopback server to verify host, CORS, environment, and file-serving
boundaries; it closes the listener afterward. These checks run in CI, the default
VS Code **Check all** task, and `scripts/dev.sh check`. Network advisory scans
are separate from these offline checks; see the [security procedures](security.md).

Earlier isolated HA 2026.10.2 smoke runs verified the real config flow,
authenticated WebSocket create/retry/list, JSON/SQLite downloads, denial of
anonymous/non-admin requests, and data retention after integration reload.
A second isolated run verified options enabling/disabling, synthetic playback
recording and credits completion, authenticated Now Playing/session APIs, and
observer cleanup/recovery on reload. Temporary instances were stopped afterward.

Those smoke runs predate the shared reader and sensors; they do not validate
these features on the current 2026.10.4 baseline or establish a supported matrix.
Automated tests do not replace operator browser review.
Native number-step validation is also operator QA: the simulated DOM uses exact
floating-point remainder for fractional steps, so component tests stub form
validity and exercise actual backend validation independently.

Use an isolated development HA instance for manual UI/config-flow and API
checks. Do not overwrite the built-in integration. Configure only sources intended
for recording; tests use fictional states and send no controls. Scaffold validation
and frontend checks remain part of the default VS Code **Check all** task and CI.

## Working practices

The [security policy](security.md) applies to every development phase. Review its
trust boundaries before API, storage, network, or UI changes, and add regression
tests for affected protections. `AGENTS.md` and the pull request template carry
the same requirement into future work. Development must use fictional data and
isolated services; a successful build is not a security assessment.

- Preserve the existing Kaleidescape integration and theater automation.
- Keep local server credentials, movie-library snapshots, databases, and private diagnostics out of Git.
- Use reduced, sanitized parser fixtures only when parser implementation begins.
- Do not build database schemas, state machines, API handlers, or device clients into placeholder modules ahead of their phase.
- Choose a real project URL, repository owner/codeowners, and license before publishing. No fabricated ownership or repository links are included.
- No deployment, SSH connection, or device-control test is part of normal verification.

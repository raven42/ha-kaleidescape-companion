# Kaleidescape development

## Scope

This repository contains the initial manual journal backend and frontend scaffolding. Keep feature behavior aligned with the [plan](plan.md), [design](design.md), and [framework status](framework.md). Journal implementation comes before the library browser and controls.

## Tooling

### Development setup

Requires Python **3.14.2+**, Node.js **22.12+**, and npm. Python's minimum
matches the Home Assistant **2026.10.2** development dependency; it is not
a declared minimum supported HA release. HA's base media components also
use FFmpeg and jpeg-turbo.

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

Open <http://127.0.0.1:5173/> for the panel shell or
<http://127.0.0.1:8123/> for HA. Complete HA onboarding with a local development
account, then choose **Settings → Devices & services → Add integration →
Kaleidescape**. Confirm database setup, then use the
[backend API examples](backend.md#try-a-round-trip) to log and retrieve manual
records. No entities or sidebar panel are expected yet. Keep analytics off if you do not want development telemetry.

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
If port 8123 is occupied, change `server_port` in the local YAML.

HA's upstream development container is another option:
[official environment guide](https://contributors.home-assistant.io/core/development/environment/).

### VS Code tasks

Open the repository folder in VS Code and use **Tasks: Run Task** from the
Command Palette. Run **Setup dependencies** for a new checkout. **Tasks: Run
Build Task** builds and packages the frontend; **Tasks: Run Test Task** runs
**Check all**, including the build, Python tests, scaffold validation, lint,
and formatting checks. Each check is also available as an individual task.
Python tasks use `.venv` directly, so shell activation is unnecessary.

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

The Vite development server binds to loopback. The preview renders only the placeholder shell, without mock movie history or live connections. The production build is a self-contained ES module with no external runtime imports. It is packaged into the integration directory and is intended to be committed with source changes so a future HACS installation does not need Node.

`frontend/package-lock.json` fixes the frontend dependency resolution. Commit lockfile updates with the corresponding source change. CI repeats the build and checks the packaged module matches its source. Minimum supported HA and frontend APIs remain an implementation/release validation task.

## Integration framework

Integration release versions remain `0.0.0`; API and database schema versions
are `1`. The `kaleidescape_companion` domain coexists with HA's built-in
`kaleidescape` integration. Existing framework entries open the database on
reload/restart without a configuration migration.

The [backend guide](backend.md) documents storage, the administrator-only API,
manual testing, backup/export, restore, and retention. Automatic observation,
session timing, entity setup, and panel registration remain deferred.

## Validation

`python -m unittest discover -s tests -v` exercises real temporary SQLite
repositories and HA objects/registered command handlers. It covers persistence,
retry deduplication, optimistic edits, literal search/pagination, migration
rollback, backup barriers, exported-database restore, permissions, unload,
shutdown, and HTTP export cleanup. HTTP request/response objects are mocked;
this is not a full HA OS/Supervisor end-to-end test. Temporary fixtures contain
only fictional records.

An isolated HA 2026.10.2 smoke run also verified the real config flow,
authenticated WebSocket create/retry/list, JSON/SQLite downloads, denial of
anonymous/non-admin requests, and data retention after integration reload.
Its temporary instance was stopped after verification.

Use an isolated development HA instance for manual UI/config-flow and API
checks. Do not overwrite the built-in integration or configure household
players until the observation phase. Scaffold validation and frontend checks
remain part of the default VS Code **Check all** task and CI.

## Working practices

- Preserve the existing Kaleidescape integration and theater automation.
- Keep local server credentials, movie-library snapshots, databases, and private diagnostics out of Git.
- Use reduced, sanitized parser fixtures only when parser implementation begins.
- Do not build database schemas, state machines, API handlers, or device clients into placeholder modules ahead of their phase.
- Choose a real project URL, repository owner/codeowners, and license before publishing. No fabricated ownership or repository links are included.
- No deployment, network listener in HA, or device-control test is part of scaffold verification.

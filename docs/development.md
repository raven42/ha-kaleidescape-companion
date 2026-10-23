# Kaleidescape development

## Scope

This repository currently contains project scaffolding. Keep feature behavior aligned with the [plan](plan.md), [design](design.md), and [framework status](framework.md). Journal implementation comes before the library browser and controls.

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
Kaleidescape**. Confirm the framework setup form. No entities or sidebar panel
are expected yet. Keep analytics off if you do not want development telemetry.

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

### Checks and packaging

With the virtual environment activated:

```sh
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

`manifest.json`, `const.py`, and project versions use `0.0.0` for the initial scaffold. The `kaleidescape_companion` domain avoids shadowing HA's built-in `kaleidescape` integration. Its minimal config flow creates one inert entry; `runtime.py` is an empty resource container, and setup/unload do not subscribe to events or access disk/network resources.

The remaining Python files are documented placeholders. In particular, `backup.py` declares no hooks, `sensor.py` declares no platform, and `websocket.py`/`http.py` register no routes. A placeholder's existence does not mean its capability is implemented. The panel bundle is built but deliberately not registered in HA yet.

## Future HA validation

Use a separate development HA instance. Copy only `custom_components/kaleidescape_companion/` into that instance's `custom_components` directory, then restart and add the Kaleidescape framework entry. Do not overwrite `custom_components/kaleidescape` or modify the built-in integration. The framework adds no entities or functional screens yet.

Integration lifecycle/config-flow tests using HA's test harness belong in Phase 1 when the supported HA releases are selected. The local runtime baseline above enables manual validation now. The current automated checks validate syntax, metadata, identity, translations, documentation links, and packaged frontend consistency; they do not claim an end-to-end HA test.

## Working practices

- Preserve the existing Kaleidescape integration and theater automation.
- Keep local server credentials, movie-library snapshots, databases, and private diagnostics out of Git.
- Use reduced, sanitized parser fixtures only when parser implementation begins.
- Do not build database schemas, state machines, API handlers, or device clients into placeholder modules ahead of their phase.
- Choose a real project URL, repository owner/codeowners, and license before publishing. No fabricated ownership or repository links are included.
- No deployment, network listener in HA, or device-control test is part of scaffold verification.

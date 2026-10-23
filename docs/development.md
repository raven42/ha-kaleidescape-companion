# Kaleidescape development

## Scope

This repository currently contains project scaffolding. Keep feature behavior aligned with the [plan](plan.md), [design](design.md), and [framework status](framework.md). Journal implementation comes before the library browser and controls.

## Tooling

Use Python 3.13+ for syntax/metadata checks and Ruff, plus Node 22.12+ and npm for the frontend. No Home Assistant runtime is needed for these scaffold checks. Installing this directory as a Python package does not install a Home Assistant integration; HA loads the `custom_components` directory.

```sh
python3 scripts/check_scaffold.py
python3 -m pip install 'ruff>=0.14,<1'
ruff check .
ruff format --check .
cd frontend
npm ci
npm run build
npm run dev
```

The Vite development server binds to loopback. The preview renders only the placeholder shell, without mock movie history or live connections. The production build is a self-contained ES module with no external runtime imports. It is packaged into the integration directory and is intended to be committed with source changes so a future HACS installation does not need Node.

`frontend/package-lock.json` fixes the frontend dependency resolution. Commit lockfile updates with the corresponding source change. CI repeats the build and checks the packaged module matches its source. Minimum supported HA and frontend APIs remain an implementation/release validation task.

## Integration framework

`manifest.json`, `const.py`, and project versions use `0.0.0` for the initial scaffold. The `kaleidescape_companion` domain avoids shadowing HA's built-in `kaleidescape` integration. Its minimal config flow creates one inert entry; `runtime.py` is an empty resource container, and setup/unload do not subscribe to events or access disk/network resources.

The remaining Python files are documented placeholders. In particular, `backup.py` declares no hooks, `sensor.py` declares no platform, and `websocket.py`/`http.py` register no routes. A placeholder's existence does not mean its capability is implemented. The panel bundle is built but deliberately not registered in HA yet.

## Future HA validation

Use a separate development HA instance. Copy only `custom_components/kaleidescape_companion/` into that instance's `custom_components` directory, then restart and add the Kaleidescape framework entry. Do not overwrite `custom_components/kaleidescape` or modify the built-in integration. The framework adds no entities or functional screens yet.

Integration lifecycle/config-flow tests using HA's test harness belong in Phase 1 when the supported HA release is selected. The current checks validate syntax, metadata, identity, translations, documentation links, and packaged frontend consistency; they do not claim an end-to-end HA test.

## Working practices

- Preserve the existing Kaleidescape integration and theater automation.
- Keep local server credentials, movie-library snapshots, databases, and private diagnostics out of Git.
- Use reduced, sanitized parser fixtures only when parser implementation begins.
- Do not build database schemas, state machines, API handlers, or device clients into placeholder modules ahead of their phase.
- Choose a real project URL, repository owner/codeowners, and license before publishing. No fabricated ownership or repository links are included.
- No deployment, network listener in HA, or device-control test is part of scaffold verification.

## Validation environment used for scaffolding

This workspace originally had no Python or Node. Temporary runtimes were unpacked under `/tmp/kaleidescape-toolchain`, with launchers under `/tmp/kaleidescape-dev/bin`; no system packages or Home Assistant installation were changed. Those paths are workspace conveniences, not project dependencies. Use ordinary Python and Node installations for normal development.

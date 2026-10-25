# Kaleidescape Companion

A Home Assistant project for a household watch journal, Now Playing, a local movie library browser, and playback controls.

**Status:** journal backend with optional automatic playback tracking and an administrator management panel. Browse, add, correct, and delete viewings; inspect session evidence and export the journal. The same UI works in HA's sidebar and the isolated Vite development preview. Library browsing, live Now Playing UI, and playback controls remain planned.

## Documentation

- [Product plan](docs/plan.md)
- [Technical design and research](docs/design.md)
- [Development guide](docs/development.md)
- [Build and deploy to test HA](docs/deployment.md)
- [Security policy, trust boundaries, and hardening](docs/security.md)
- [Journal backend and API](docs/backend.md)
- [Journal management UI](docs/ui.md)
- [Framework status](docs/framework.md)
- [Changelog](CHANGELOG.md)

## Project identity

The project and display name are **Kaleidescape Companion**. The internal Home Assistant domain is `kaleidescape_companion`: the built-in **Kaleidescape** integration (`kaleidescape`) must remain available to supply player entities. Never install this project over the built-in integration. The Python client `pykaleidescape` is also an existing, separate project.

## Layout

```text
custom_components/kaleidescape_companion/  Integration framework and bundled panel
frontend/                                TypeScript/Lit panel source and preview
scripts/                                 Scaffold validation and asset packaging
tests/                                   Storage, API, lifecycle, and packaging tests
docs/                                   Plan, design, and framework documentation
.github/workflows/                       CI checks
```

## Development setup

Requires Python **3.14.2+**, Node.js **22.12+**, and npm. From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cd frontend
npm ci
npm run build
cd ..
```

`pyproject.toml` defines the editable Python package and its `dev` extra,
including Home Assistant **2026.10.4** and Ruff. This HA version is the local
development baseline, not a declared minimum supported HA release. Re-run
`python -m pip install -e '.[dev]'` after changing Python dependencies.
Frontend dependencies are installed separately from `frontend/package-lock.json`.

Read the [security policy](docs/security.md) before development or installation.
Custom integrations run with HA's privileges; this project does not sandbox
itself from HA. Use an isolated development instance and development credentials.

Run checks and build the bundled panel:

```sh
python -m unittest discover -s tests -v
python scripts/check_scaffold.py
ruff check .
ruff format --check .
npm --prefix frontend run format:check
npm --prefix frontend test
npm --prefix frontend run build
```

Run the servers in separate terminals from the repository root:

```sh
bash scripts/dev.sh preview  # http://127.0.0.1:5173
bash scripts/dev.sh ha       # http://127.0.0.1:8123
```

The HA launcher links this checkout's integration into `.ha-dev/custom_components/`
and keeps HA configuration, credentials, and storage in the ignored `.ha-dev/`
directory. Complete local HA onboarding, then add **Kaleidescape Companion** under
**Settings → Devices & services → Add integration**. Restart HA after backend
changes. Open **Kaleidescape Companion** in HA's sidebar as an administrator. The standalone
Vite preview uses a memory-only token from the local development instance; see
the [UI guide](docs/ui.md). No entities are created. Enable automatic tracking in the integration’s
**Configure** options; see the [tracking guide](docs/backend.md#automatic-tracking).

An editable pip install prepares Python imports and tools; HA discovers custom
integrations under its configuration directory's `custom_components/`. For
installation into another HA instance, copy
`custom_components/kaleidescape_companion/` into that instance's
`custom_components/` directory and restart HA. Node is only needed by developers:
`npm run build` packages the standalone module into the integration's
`frontend/panel.js`.

See the [development guide](docs/development.md#development-setup) for
configuration details. The optional `bash scripts/dev.sh setup` performs the
venv/editable-install/npm steps above; `bash scripts/dev.sh check` runs all checks
and the frontend build.

VS Code's default build task also creates `dist/kaleidescape-companion.tar.gz`.
Configurable SSH tasks deploy to a test HA OS or Container instance, with an
offline target preview and a separate configuration-check/restart task. See the
[deployment guide](docs/deployment.md); build and test tasks never deploy automatically.

## Delivery order

1. Foundations
2. Watch journal and read-only Now Playing
3. Library browser
4. Playback and controls
5. Polish

The initial database/API slice starts the foundations phase; the remaining phases are planned. Project documentation URLs, repository ownership, supported HA releases, and a distribution license must be settled before publication; HACS metadata is preparatory. This repository has not been installed into the household HA instance.

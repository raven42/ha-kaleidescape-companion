# Kaleidescape

A Home Assistant project for a household watch journal, Now Playing, a local movie library browser, and playback controls.

**Status:** framework scaffold only. The setup flow creates an inert development entry; it does not connect to devices, record playback, create a database, register a panel, or send commands. The bundled panel is a standalone placeholder ready for later registration.

## Documentation

- [Product plan](docs/plan.md)
- [Technical design and research](docs/design.md)
- [Development guide](docs/development.md)
- [Framework status](docs/framework.md)
- [Changelog](CHANGELOG.md)

## Project identity

The project and display name are **Kaleidescape**. The internal Home Assistant domain is `kaleidescape_companion`: the built-in `kaleidescape` domain must remain available to supply player entities. Never install this project over the built-in integration. The Python client `pykaleidescape` is also an existing, separate project.

## Layout

```text
custom_components/kaleidescape_companion/  Integration framework and bundled panel
frontend/                                TypeScript/Lit panel source and preview
scripts/                                 Scaffold validation and asset packaging
tests/                                  Future behavior tests and sanitized fixtures
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
including Home Assistant **2026.10.2** and Ruff. This HA version is the local
development baseline, not a declared minimum supported HA release. Re-run
`python -m pip install -e '.[dev]'` after changing Python dependencies.
Frontend dependencies are installed separately from `frontend/package-lock.json`.

Run checks and build the bundled panel:

```sh
python scripts/check_scaffold.py
ruff check .
ruff format --check .
npm --prefix frontend run build
```

Run the servers in separate terminals from the repository root:

```sh
bash scripts/dev.sh preview  # http://127.0.0.1:5173
bash scripts/dev.sh ha       # http://127.0.0.1:8123
```

The HA launcher links this checkout's integration into `.ha-dev/custom_components/`
and keeps HA configuration, credentials, and storage in the ignored `.ha-dev/`
directory. Complete local HA onboarding, then add **Kaleidescape** under
**Settings → Devices & services → Add integration**. Restart HA after backend
changes. The framework currently creates no entities or HA sidebar panel.

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

## Delivery order

1. Foundations
2. Watch journal and read-only Now Playing
3. Library browser
4. Playback and controls
5. Polish

The framework reserves module boundaries for these phases without implementing their behavior. Project documentation URLs, repository ownership, supported HA releases, and a distribution license must be settled before publication; HACS metadata is preparatory. This repository has not been installed into the household HA instance.

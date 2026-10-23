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

## Local checks

Use Python 3.13+ and Node 22.12+ (Node 24 is suitable). These are development-tool targets, not a declared minimum Home Assistant release.

```sh
python3 scripts/check_scaffold.py
python3 -m pip install 'ruff>=0.14,<1'
ruff check .
ruff format --check .
cd frontend
npm ci
npm run build
```

`npm run build` checks TypeScript and copies a standalone module to `custom_components/kaleidescape_companion/frontend/panel.js`. Preview locally with `npm run dev`; no Home Assistant account or server is needed. Follow the [development guide](docs/development.md) for isolated integration testing later.

## Delivery order

1. Foundations
2. Watch journal and read-only Now Playing
3. Library browser
4. Playback and controls
5. Polish

The framework reserves module boundaries for these phases without implementing their behavior. Project documentation URLs, repository ownership, supported HA releases, and a distribution license must be settled before publication; HACS metadata is preparatory. This repository has not been installed into the household HA instance.

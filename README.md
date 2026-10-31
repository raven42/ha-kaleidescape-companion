# Kaleidescape Companion

A Home Assistant integration for a shared household watch journal, Now Playing,
and an optional local movie library. It uses HA's built-in **Kaleidescape**
integration for playback observations. Optional player controls use the
standalone Kaleidescape API for all active HA users; administrators configure
and discover devices.

Active HA users can browse the journal and enabled Library. Administrators can
correct records, manage the database, configure tracking and sync, and
explicitly add a version to a device collection. Library sync and collection
additions, playback controls and experimental title launch are separate opt-in
features, all disabled by default. See the [framework status](docs/framework.md)
for delivered features and validation limits.

## Documentation

- [Development and checks](docs/development.md)
- [Build and deploy to test HA](docs/deployment.md)
- [Security policy and hardening](docs/security.md)
- [Product plan](docs/plan.md) and [technical design](docs/design.md)
- [Journal backend and API](docs/backend.md)
- [User interface](docs/ui.md) and [HA sensors](docs/sensors.md)
- [Library](docs/library.md),
  [collection additions](docs/library-collections.md), and
  [purchase dates](docs/purchase-dates.md) and
  [reviewed merge imports](docs/imports.md)
- [Independent Kaleidescape API library](https://pypi.org/project/kaleidescape-api/)
- [Player discovery and controls](docs/playback-controls.md#companion-setup-and-use)
- [Interface research](docs/research.md) and [changelog](CHANGELOG.md)

## Layout

```text
custom_components/kaleidescape_companion/
  core/       SQLite worker, migrations, journal operations, settings and security
  library/    Catalog sync, metadata, artwork, collections and title validation
  playback/   HA observation/recording, device discovery, controls and receipts
  _vendor/    Generated runtime subset of the independent protocol API
  ui/         Authenticated APIs, panel registration and compiled assets
  *.py        Required HA entry points and integration constants
frontend/
  src/        Typed UI source grouped into core, library, playback and ui
  dev/        Preview shell, guarded local proxy and fictional review page
  tests/      Component and proxy security tests
dev/         Development, validation, packaging and deployment tools
tests/       Python storage, API, lifecycle and deployment tests
docs/        Product, architecture, security and operator guides
```

The `dev/` tools, standalone API CLI/docs/tests and frontend development sources
are excluded from integration deployment. Only the integration directory,
including its generated API runtime, is installed into HA.

## Development setup

Requires Python **3.14.2+**, Node.js **22.13+ (22.x) or 24+**, and npm. From the
repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --find-links ../kaleidescape-api/dist -e '.[dev]'
npm --prefix frontend ci
bash dev/dev.sh check
```

Python dependencies and development tools come from `pyproject.toml`; Node tools
use `frontend/package-lock.json`. HA **2026.10.4** is the development baseline,
not a declared minimum supported HA release. An editable pip install prepares
imports and tools; HA discovers the integration through `custom_components/`.

Read the [security policy](docs/security.md). Use an isolated HA instance,
fictional records and development credentials. Custom integrations execute with
HA's privileges.

Start the servers in separate terminals:

```sh
bash dev/dev.sh preview  # http://127.0.0.1:5173
bash dev/dev.sh ha       # http://127.0.0.1:8123
```

The HA launcher keeps configuration and storage in ignored `.ha-dev/` and links
only this integration into its `custom_components/`. Complete HA onboarding, add
**Kaleidescape Companion** under **Settings → Devices & services**, and open its
sidebar page. In HA, the panel uses your signed-in session. The standalone Vite
preview uses a memory-only token from the isolated development instance.

The [development guide](docs/development.md) covers VS Code tasks, individual
checks and manual browser review. All checks and packaging remain local;
deployment and restart tasks are explicit.

## Installation and use

Copy `custom_components/kaleidescape_companion/` into the target HA
configuration's `custom_components/`, then restart HA and add **Kaleidescape
Companion**. Preserve the built-in `kaleidescape` integration. This project's
domain is `kaleidescape_companion`.

Production needs the compiled `ui/assets/panel.js`, which is included in the
runtime package. It needs neither Node nor Vite. The VS Code default build task
checks the project and creates `dist/kaleidescape-companion.tar.gz`;
configurable SSH tasks support HA OS and Container. See
[deployment](docs/deployment.md).

The page order is **Now Playing | Library | Journal | Database | Settings**.
Settings controls the default landing page; the selected tab is retained in the
URL. Personal [Library preferences](docs/ui-preferences.md) save immediately in
the database: view, count, filters, search, sort, cover size and column widths.
Configure one player's entities for automatic recording. Minimum runtime
defaults to 10 minutes; 0 disables the cutoff. Fourteen
[HA sensors](docs/sensors.md) expose viewing history, Library counts/recent
additions, last catalog sync and storage sizes. Full catalogs stay in the
paginated Library UI/API rather than sensor attributes.

Enable Library explicitly, leaving its host blank to try `my-kaleidescape.local`
or setting a local host. Choose sync interval, metadata and optional artwork.
Source groups distinguish remakes from editions; Library offers list/cover
views, search, checkbox filters, **Clear Filter**, status/format badges and
25/100/1000/All page sizes. [Database tools](docs/database.md) offer sticky
options, schema-aware condition search, protected confirmed edits/permanent
deletion, and import/export. Library adds sticky search/status bars, partial
title/people search, and reusable format/rating badges. Recording must still be
disabled before merge imports and legacy bulk purge operations.

Manual additions select an exact cached Library movie, default to Completed and
infer runtime/end time; Partial exposes watched minutes. Journal can sort by
completion date (partials first) or title in either direction. Optional
[Journal Calendar view](docs/calendar.md#journal-month-view) under Journal
Options shows monthly overlapping covers and compact viewing/movie details for
both household roles, independently of calendar publishing. Optional
[calendar publishing](docs/calendar.md), disabled by default, adds new
completions to one writable HA calendar with configurable title/description
templates and bounded metadata.

## Release status

This is a development integration. Operator browser, real-source, backup and HA
compatibility validation remain. Repository ownership/URLs, a license, supported
HA releases and the documented
[dependency release blocker](docs/security.md#known-dependency-findings-2026-10-25)
must be resolved before publication. HACS metadata is preparatory.

Historical completed Journal viewings can be explicitly exported from Settings
to the configured calendar, with matching/progress and a warning about
title-format duplicates. See [calendar procedures](docs/calendar.md).

# Companion architecture

Status: temporary patched-pyk proof of concept; documentation reviewed
2026-11-04. The [migration plan](../plans/plan-pykaliedescape-migration.md)
tracks upstream release and hardware qualification.

Companion is a single-entry Home Assistant service integration with domain
`kaleidescape_companion`. It adds a household journal, cached movie Library,
optional controls, metadata and calendar workflows. HA's built-in `kaleidescape`
integration continues to own its entities and supplies playback observations.
Companion does not replace it or access its private runtime objects.

## Runtime ownership

| Location                      | Responsibility                                                                                                | Detailed contract                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Integration root              | Config/options flows, setup/unload, backup hooks, diagnostics, HA entities/actions, translations and manifest | This document, [automations](design-automations.md)                                                      |
| `core/`                       | One SQLite worker, migrations, requests, settings, permissions and safe logging helpers                       | [Journal](design-journal.md), [data management](design-data-management.md), [logging](design-logging.md) |
| `playback/`                   | HA observation, recording, selected-player discovery/control and durable command outcomes                     | [Journal](design-journal.md#automatic-tracking), [controls](design-playback-controls.md)                 |
| `library/`                    | Local browser transport/sync, catalog identity, artwork, collection changes and matching                      | [Library](design-library.md), [matching](design-title-matching.md)                                       |
| `enrichment/` and `scrapers/` | HA task orchestration/authorization/storage and standalone metadata provider clients respectively             | [Metadata](design-metadata.md)                                                                           |
| `calendar/`                   | Publishing, reconciliation and dedicated-calendar Full Sync through HA                                        | [Calendar](design-calendar.md)                                                                           |
| `ui/` and `frontend/src/`     | Authenticated HTTP/WebSocket interfaces, panel/cards and typed frontend                                       | [UI](design-user-interface.md), [cards](design-dashboard-cards.md)                                       |

Feature state belongs to the typed config entry's `runtime_data`. A small
`hass.data` marker prevents duplicate HTTP registration. Data is stored under
HA's configuration directory, with a private SQLite journal and artwork cache;
HA storage owns the seed-bound discovery cache. The integration doesn't install
a second database service, web server or logging framework.

## Home Assistant controls

The Companion service device exposes **Library sync**, **Refresh metadata**, and
**Calendar full sync** buttons. They request the same background jobs as the
panel and are unavailable when the corresponding feature is disabled. The
configuration switches **Add watched movies to calendar**, **Automatically
record playback**, and **Enable library sync** change the corresponding
integration settings and reload the entry. Existing configuration validation
still applies: recording requires configured playback entities, and calendar
publishing requires a supported calendar. Changes preserve all other options.

Home Assistant entity permissions govern who can operate these controls,
including through automations. Calendar publishing can share movie details with
people who have access to the configured calendar.

## Setup, reload and unload

Setup opens the repository, validates/upgrades its schema, restores the control
cache without opening sockets, registers UI services and forwards the sensor,
button, and switch platforms. Enabled features start their owned tasks:
observation subscribes to HA states, Library starts its initial sync, and
calendars start their queues. Recurring Library, metadata and calendar Full Sync
schedules are optional HA automations, not integration timers. External
enrichment requires a separately enabled provider and Library. Disabled
connectors do not initiate their network work. Setup is therefore not
unconditionally network-free when optional work has already been enabled.

When HA's automation blueprint manager is available, setup installs missing
packaged blueprints. It preserves existing files and does not create or enable
automations. The [automation design](design-automations.md) owns version checks,
reviewed updates, schedules and purchase receipt ingestion.

Storage availability errors use `ConfigEntryNotReady`; an unsupported database
schema uses `ConfigEntryError` without disclosing private exception text.
Options changes reload the entry. Accepted work is drained, listeners/timers and
owned tasks are stopped, connections/sessions are closed and the repository is
closed last. Platform unload must succeed before releasing its runtime.
Unloading/removing the entry retains household data. Backup hooks coordinate
writers and resume after HA finishes or fails its backup.

The 2026-11-04 audit identified cleanup isolation and control-read races.
Cleanup now attempts each owner even when another fails, and owned control reads
are cancelled or drained before clients close. Offline fault tests cover these
boundaries; live HA and hardware lifecycle qualification remains outstanding.

This follows HA's
[config-entry lifecycle and runtime ownership guidance](https://contributors.home-assistant.io/core/integrations/config-entries/).
Use APIs supported by the actual target HA release when evolving cleanup.

## HA infrastructure and asynchronous work

HA owns authentication, users/roles, entity permissions, configuration, calendar
services, dashboards, dependency installation, logging and backup orchestration.
Companion owns application validation, projections, transactions and recovery.
The distinction matters: an authenticated user can still submit an invalid
version ID, stale edit or unsafe destination. See the
[security policy](../policies/policy-security.md).

SQLite and filesystem work run off the event loop on the repository worker or an
executor. Sensor getters read coordinator caches; they perform no I/O. Two
30-second coordinators refresh local summaries for the
[17 sensors](design-sensors.md). Library and provider networking is
asynchronous. Pyk's current local-browser HTML parsing runs synchronously in its
async methods; quantify event-loop impact on large libraries before release.
Preserve HA responsiveness when adding features, consistent with HA's
[blocking-operation guidance](https://contributors.home-assistant.io/core/internals/blocking-operations/).

Use HA HTTP session/connector helpers. The existing network adapters create
purpose-specific sessions where cookie, proxy, compression or DNS rules need to
differ; they retain HA connector/TLS support and close the sessions they own. Do
not blindly substitute a shared cookie-bearing session or change a shared
connector to enforce one feature's policy. Optional metadata clients keep their
fetch interface independent of HA.

## Dependency and release contract

The current manifest pins `pykaleidescape==1.2.0`, matching development HA
2026.11.0. Required HA dependencies are `frontend`, `http`, and `websocket_api`;
`kaleidescape`, `calendar`, and `automation` are optional ordering dependencies
via `after_dependencies`. A manual journal does not require a configured player
or calendar. Automatic recording needs selected existing HA entities.

The PoC owns lazy, persistent pyk `Device` objects and uses public methods and
requests while preserving application preflight and durable outcomes. Pyk's
`LocalLibrary` parses local browser pages through Companion's HA HTTP transport.
Public Store scraping belongs entirely to Companion. The installed 1.2.0 package
lacks these new interfaces, so this PoC bundles the reviewed patched source in
Companion's private namespace as described in the
[deployment guide](../guides/guide-deployment.md). The
[migration plan](../plans/plan-pykaliedescape-migration.md) owns release gates.

Before release, establish supported HA versions, upstream pyk compatibility, the
project license and installation validation, and verify final release metadata.
Match dependency pins and metadata to HA's
[manifest contract](https://contributors.home-assistant.io/core/integrations/manifest/).
The current custom integration has not claimed HA core quality-scale
certification.

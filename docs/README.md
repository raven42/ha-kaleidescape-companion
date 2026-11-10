# Companion documentation

Start with [installation and first use](getting-started.md), then enable only
the features you need. Companion is preparing for alpha; implementation and
offline test coverage do not establish a supported HA/hardware release.

## User guides

Each guide explains prerequisites and permissions, a small working example,
expected results and recovery. Use fictional examples on an isolated instance;
replace placeholder entity/entry IDs with those selected in your own HA setup.

Screenshots show an example configuration; titles, counts, dates and enabled
features will differ in your installation. Select any screenshot to open its
full-resolution image.

| Start here                                                     | Covers                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)                          | Installation, first recording, upgrades and rollback                                              |
| [Configuration and permissions](guides/configuration.md)       | Feature opt-ins, household/admin roles, Basic/Advanced, profiles and settings transfer            |
| [Journal and Library](guides/journal-and-library.md)           | Now Playing, recording, manual viewings, first sync, editions and collection recovery             |
| [Player controls](guides/player-controls.md)                   | Discovery, selected player, remote/power controls, experimental launch and uncertain outcomes     |
| [Metadata and artwork](guides/metadata.md)                     | Store/TMDB setup, credentials, matches, field/image review and refresh recovery                   |
| [Purchases and receipts](guides/purchases-and-receipts.md)     | IMAP/HTML blueprint setup, selected fields, unmatched purchases, duplicate review and corrections |
| [Calendars](guides/calendars.md)                               | Local Journal calendar, publishing, history export, dedicated Full Sync and recovery              |
| [Dashboard cards](guides/dashboard-cards.md)                   | All six cards, YAML, visual configuration and responsive controls                                 |
| [Entities and automations](guides/entities-and-automations.md) | Sensors, buttons, switches, actions and all five blueprint workflows                              |
| [Data management](guides/data-management.md)                   | Inspection/edits, reviewed imports, export versus backup, maintenance and restore                 |
| [Troubleshooting](guides/troubleshooting.md)                   | Diagnostics, common failures and useful support reports                                           |

The guides describe implemented workflows. They do not claim completed live
HA/browser/hardware/provider qualification; those gates remain in the roadmap.
The [security guide](development/security.md) owns trust boundaries, private
data handling and vulnerability reporting.

## Development

[Code structure](reference/code-structure.md) maps source owners, frontend
source versus compiled assets, tests and tools.
[Contributor setup](development/README.md) explains the shared terminal, editor
and CI commands. Engineering documentation has one owner per contract:

- [Architecture](development/architecture.md),
  [Journal storage](development/journal.md) and
  [title matching](development/title-matching.md).
- [Pyk ownership and compatibility](development/pyk.md),
  [logging and diagnostics](development/logging.md) and
  [security](development/security.md).
- Detailed [Library](development/library.md),
  [controls](development/playback-controls.md),
  [metadata](development/metadata.md), [calendar](development/calendar.md),
  [data management](development/data-management.md),
  [UI](development/user-interface.md), [cards](development/dashboard-cards.md),
  [sensors](development/sensors.md) and [automation](development/automations.md)
  contracts.
- [Testing](development/testing.md), [releasing](development/releasing.md),
  optional [maintainer deployment](development/deployment.md) and
  [audit methodology](development/auditing.md).
- [Roadmap](development/roadmap.md) for active work, decisions and
  qualification; [changelog](../CHANGELOG.md) for development history.

Keep setup/recovery instructions in user guides, exact behavior and constraints
in the owning reference, and current tasks in the roadmap. Historical audit
reports are evidence of their reviewed revision, not current feature contracts.

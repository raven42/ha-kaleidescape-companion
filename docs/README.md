# Companion documentation

Start here for the current architecture, implementation status and operator
workflow. Each high-level aspect has one authoritative document. Links between
aspects replace parallel specifications and repeated status histories.

- **design/** describes implemented behavior and its contracts.
- **plans/** describes remaining work, compatibility decisions and exit gates.
- **guides/** describes development and installation procedures.
- **policies/** describes cross-cutting trust and security expectations.

Filename prefixes remain useful when a document is viewed outside its directory.
Feature designs explicitly identify proposed changes; a plan is not evidence
that its implementation or hardware validation has shipped.

## Plans

| Document                                                           | Owns                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [Delivery roadmap](plans/plan-roadmap.md)                          | Implemented features, remaining product/release work and validation status                   |
| [Pykaleidescape migration](plans/plan-pykaliedescape-migration.md) | Temporary PoC status, local-device ownership, upstream/release gates and hardware validation |

## Designs

| Document                                              | Owns                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Architecture](design/design-architecture.md)         | HA lifecycle/infrastructure, runtime/module ownership and dependencies                      |
| [Journal](design/design-journal.md)                   | Storage model, observation, recording, manual viewings, recovery and backup/export contract |
| [Data management](design/design-data-management.md)   | Database administration, reviewed merge imports and offline purchase-history preparation    |
| [Title matching](design/design-title-matching.md)     | Reusable matching algorithms/interfaces and evaluation tools                                |
| [Library](design/design-library.md)                   | Local sync, versions, artwork/cache, browsing/badges and collection additions               |
| [External metadata](design/design-metadata.md)        | Enrichment workflow and standalone provider client/parser interfaces                        |
| [Player controls](design/design-playback-controls.md) | Discovery, permissions, player/title verification, remote/launch and uncertainty recovery   |
| [User interface](design/design-user-interface.md)     | Shared UI structure, roles, settings/preferences/profiles and response recovery             |
| [Dashboard cards](design/design-dashboard-cards.md)   | Six HA cards, YAML/visual configuration and test-dashboard generation                       |
| [Sensors](design/design-sensors.md)                   | 17 HA sensor values, attributes and update semantics                                        |
| [Calendar](design/design-calendar.md)                 | Local month view, HA publishing, historical export and Full Sync                            |
| [Logging](design/design-logging.md)                   | Native HA logging, safe exception summaries, severity/privacy and diagnostics               |
| [Automations](design/design-automations.md)           | HA actions, blueprint installation/versions/history, schedules and receipt troubleshooting  |

## Guides and policy

| Document                                   | Owns                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| [Development](guides/guide-development.md) | Environment, local checks/preview, testing and performance/hardware workflow          |
| [Deployment](guides/guide-deployment.md)   | Installation, SSH targets, packaging, restart, validation and rollback                |
| [Security](policies/policy-security.md)    | HA trust model, access/data/network boundaries, deployment expectations and reporting |

Maintain the owning document when code changes. Keep implementation details in
the design, remaining delivery gates in a plan, and commands/procedures in a
guide. Historical release notes belong in [CHANGELOG.md](../CHANGELOG.md).
Logging decisions come from the logging design; transport migration decisions
come from the pyk plan. All other designs continue to govern their own aspects.

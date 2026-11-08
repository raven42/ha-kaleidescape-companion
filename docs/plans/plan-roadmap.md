# Companion delivery roadmap

Status reconciled with the implementation on 2026-11-07. This is the single
product status and remaining-work list. Feature designs describe implemented
behavior; the [pyk migration plan](plan-pykaliedescape-migration.md) owns the
current PoC, upstream compatibility and hardware qualification.

Priorities are **functionality, privacy, usability, scalability, flexibility**.
Preserve the built-in HA integration, household data and pyk's established
workflow. An upstream privacy enhancement is proposed work subject to its code
owner's approval, not a condition that overrides functional migration.

## Implemented

| Aspect          | Delivered scope                                                                                                                        | Authoritative document                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Journal         | Single-player HA observation, session/restart recovery, manual entries, corrections, deletion and exports                              | [Journal](../design/design-journal.md)                                                                                             |
| Data management | Worker-owned SQLite, schema-27 purchase records and repair history, reviewed merge imports and database-backed purchase reconciliation | [Data management](../design/design-data-management.md)                                                                             |
| Library         | Opt-in local catalog/details/collections/artwork, grouped versions, cached browsing, filters and explicit collection addition          | [Library](../design/design-library.md)                                                                                             |
| Metadata        | Optional public Store/TMDB providers, reviewed matches/fields/images, cache and source preferences                                     | [Metadata](../design/design-metadata.md)                                                                                           |
| Controls        | Opt-in discovery, selected-player remote, explicit power/pause/resume and experimental movie launch, durable uncertainty recovery      | [Controls](../design/design-playback-controls.md)                                                                                  |
| UI              | Household and administrator surfaces, personal responsive profiles, settings transfer and management                                   | [UI](../design/design-user-interface.md)                                                                                           |
| HA surfaces     | 17 sensors, six dashboard cards and an explicit test-dashboard generator                                                               | [Sensors](../design/design-sensors.md), [cards](../design/design-dashboard-cards.md)                                               |
| Calendar        | Local Journal month view, optional publishing/history export and dedicated-calendar Full Sync                                          | [Calendar](../design/design-calendar.md)                                                                                           |
| Operations      | Native module logging, bounded diagnostics, backup coordination, local checks, runtime packaging and explicit SSH deployment           | [Logging](../design/design-logging.md), [development](../guides/guide-development.md), [deployment](../guides/guide-deployment.md) |
| Automations     | Three HA buttons/switches each, four versioned blueprints, change-log review, explicit updates, receipt parsing and scheduled jobs     | [Automations](../design/design-automations.md)                                                                                     |

Implemented means present in code with offline tests; it does not mean every
model, firmware, browser size or HA release is qualified. The dashboard calendar
card, native logging and metadata review are implemented features, not backlog.
Recent Library/UI work includes canonical Science Fiction genres, individual
resolution/dynamic-range/audio badges, general-audience-first rating filters,
known-rating exclusion from Unrated, cached covers in reconciliation, calendar
search/view restoration, Today navigation and the Watch Soon corner badge.
Receipt blueprint v8 requires the HTML part and reports when it cannot be
imported; v7 moved receipt extraction into Python. The settings workspace groups
configuration by feature, with searchable hints, staged changes, and a single
blueprint inventory and review workflow.

## Next delivery gates

The [2026-11-07 audit](../../audit/2026-11-07/AUDIT_FINDINGS.md) records offline
findings and release qualification gaps. Historical reports capture the audited
baseline rather than subsequent changes. The upstream and qualification gates
below remain in force.

The [authorized follow-up](../../audit/2026-11-07/FOLLOW_UP.md) records the
receipt currency, retained purchase evidence and notification fixes, corrected
documentation, development metadata and passing offline checks. The hardware,
provider, installation and restore acceptance below remains unperformed.

1. Review and upstream the local pyk patches while preserving its existing
   `Device` workflow. Verify the released package with HA's built-in integration
   before changing the shared dependency pin or removing the bundled PoC copy.
2. Qualify the migrated controls and local Library browser on the owned Strato
   K, Terra Server Compact 30 TB and Terra Server Prime 120 TB. Record firmware
   and topology. Test reads before selected player writes, then recovery and
   coexistence with the built-in integration.
3. Validate Companion's public Store scraper independently for anonymous search,
   metadata, covers, robots and request limits. Keep all public Store work out
   of pyk.
4. Replace the temporary bundled copy with a reproducible released pyk
   dependency and complete clean HA install/reload/restart validation.
5. Extend modern, hardware-testable video/capability features in small
   increments. Premiere music, vault/disc-specific workflows and alternative
   framing remain deferred without applicable hardware and a concrete use case.

These gates are dependencies, not dates. No hardware tests or deployments are
implied by documenting available equipment. The migration plan defines the
precise functional requirements, optional owner decisions and exit evidence.

## Release readiness

- Declare and test supported HA releases. Manifest repository URLs and ownership
  are populated; `0.1.0-dev.0` identifies an unqualified development build
  across the integration, project and frontend. Choose the project license
  (explicitly deferred by the owner) and final release version/distribution
  policy before publishing. HA 2026.11.0 is the development baseline, not a
  promised minimum version. The bundled pyk MIT license covers that dependency
  only.
- Make a clean checkout/build/install reproducible with the accepted released
  pyk dependency; verify setup, options reload, unload, restart and upgrade.
- Run current dependency audits against the release candidate and assess actual
  exposure. Keep findings with versions and dispositions; a dated audit count is
  neither a permanent blocker nor proof that dependencies are safe today.
- The owner reviewed the fictional administrator Settings preview and confirmed
  the requested refinements on 2026-11-07. Complete broader operator browser
  review for both roles and desktop/tablet/mobile; validate private exports,
  real-source parsing, backup/restore and calendar provider behavior. A
  fictional preview does not establish live HA behavior.
- Measure startup, reconnect, catalog size, memory and request latency on the
  supported environment before promising larger deployments.

A development deployment may use an operator-selected household HA instance. The
[deployment guide](../guides/guide-deployment.md) describes the actual tooling
and rollback limits; isolated testing remains recommended when practical.

## Later product decisions

Multiple-player recording is not implemented. Exact-edition launch, start-over,
seek/resume semantics and advanced theater automation require separate evidence
and feature decisions. Calendar behavior remains constrained by the selected HA
provider. Arbitrary SQL, generic network proxies, device network administration
and automatic replay of uncertain mutations are outside the current product.

Keep future work here or in the migration plan until implemented. Update the
owning design and tests with each delivered behavior; do not append another
parallel feature-status narrative to every guide.

# Kaleidescape Companion

A Home Assistant integration for a shared household watch journal, Now Playing,
and an optional local movie Library. It observes playback through HA's built-in
**Kaleidescape** integration and adds optional selected-player controls. Active
HA users browse household data and use enabled controls; administrators manage
configuration, records and discovery.

Recording, Library sync, collection additions, player controls, experimental
title launch, calendar publishing and external metadata are separately opted in.
The built-in integration is preserved. Companion's domain is
`kaleidescape_companion`.

## Documentation

The [documentation index](docs/README.md) identifies one authoritative document
per aspect, organized into designs, plans, guides and policies.

- [Delivery roadmap](docs/plans/plan-roadmap.md): implemented features and
  remaining release work.
- [Pykaleidescape migration plan](docs/plans/plan-pykaliedescape-migration.md):
  compatibility, missing capabilities, protocol fixes and the complete command
  inventory.
- [Architecture](docs/design/design-architecture.md) and
  [security policy](docs/policies/policy-security.md).
- [Development](docs/guides/guide-development.md) and
  [installation/deployment](docs/guides/guide-deployment.md).
- [Logging and diagnostics](docs/design/design-logging.md).

## Current capabilities

The Journal supports one-player observation, manual viewings, corrections,
recovery, private exports and a monthly calendar. Library provides cached movie
browsing, grouped editions, artwork and explicit collection additions. Optional
public Store/TMDB enrichment supports reviewed metadata and images.

The shared panel includes **Now Playing | Library | Journal | Database |
Settings**, with personal desktop/tablet/mobile preferences. HA dashboards have
six cards, including a Journal calendar, and the integration exposes 18 sensors.
Administrator database tools support bounded inspection/edits and reviewed merge
imports. HA calendar publishing and dedicated-calendar Full Sync are optional.

Controls include discovery, remote/power actions, explicit pause/resume and
experimental selected-title launch with durable uncertainty recovery. Transport
has not yet migrated to public pyk Device methods. The migration plan preserves
pyk's existing workflow and coordinates its release with HA's pinned dependency.

## Installation and development

Install the complete built `custom_components/kaleidescape_companion/` directory
under the target HA configuration, restart HA and add **Kaleidescape Companion**
through **Settings → Devices & services**. Production includes compiled frontend
assets and needs neither Node nor Vite. HA installs or reuses the pinned pyk
dependency. The deployment guide covers packaging, optional SSH deployment,
configuration checks and rollback limits.

Development requires Python 3.14.2+ with SQLite 3.35+, Node.js 22.13+ (22.x) or
24+, and npm. HA 2026.10.4 with pyk 1.1.6 is the current development baseline,
not a promised supported minimum. In the prepared developer workspace:

```sh
bash dev/dev.sh setup
bash dev/dev.sh check
```

The [development guide](docs/guides/guide-development.md) describes current
workspace prerequisites and local HA/Vite preview. Tests use fictional data;
normal checks do not control devices or deploy. Hardware validation and
deployment are explicit operator actions. Custom integrations execute with HA's
privileges; the security policy explains the actual boundaries.

## Release status

This remains a development integration. Supported HA versions, distribution
metadata/license, current dependency review and operator/hardware/backup
validation remain release work tracked in the roadmap. An operator may choose a
household deployment after reviewing those limits. This documentation does not
claim hardware qualification or completion of the planned pyk migration.

# Companion delivery roadmap

Alpha preparation started on 2026-11-09. This is the single product status and
remaining-work list. Feature designs describe implemented behavior; the
[pyk compatibility](pyk.md) owns the current PoC and dependency contracts. This
roadmap owns active upstream and hardware qualification work.

Priorities are **functionality, privacy, usability, scalability, flexibility**.
Preserve the built-in HA integration, household data and pyk's established
workflow. An upstream privacy enhancement is proposed work subject to its code
owner's approval, not a condition that overrides functional migration.

## Implemented

| Aspect          | Delivered scope                                                                                                                                 | Authoritative document                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Journal         | Single-player HA observation, session/restart recovery, manual entries, corrections, deletion and exports                                       | [Journal](journal.md)                                                        |
| Data management | Worker-owned SQLite, schema-28 collection queue and purchase repair history, reviewed merge imports and database-backed purchase reconciliation | [Data management](data-management.md)                                        |
| Library         | Opt-in local catalog/details/collections/artwork, grouped versions, cached browsing, filters and queued collection changes                      | [Library](library.md)                                                        |
| Metadata        | Optional public Store/TMDB providers, reviewed matches/fields/images, cache and source preferences                                              | [Metadata](metadata.md)                                                      |
| Controls        | Opt-in discovery, selected-player remote, explicit power/pause/resume and experimental movie launch, durable uncertainty recovery               | [Controls](playback-controls.md)                                             |
| UI              | Household and administrator surfaces, personal responsive profiles, settings transfer and management                                            | [UI](user-interface.md)                                                      |
| HA surfaces     | 17 sensors, six dashboard cards and an explicit test-dashboard generator                                                                        | [Sensors](sensors.md), [cards](dashboard-cards.md)                           |
| Calendar        | Local Journal month view, optional publishing/history export and dedicated-calendar Full Sync                                                   | [Calendar](calendar.md)                                                      |
| Operations      | Native module logging, bounded diagnostics, backup coordination, local checks, runtime packaging and explicit SSH deployment                    | [Logging](logging.md), [development](README.md), [deployment](deployment.md) |
| Automations     | Three HA buttons/switches each, five versioned blueprints, change-log review, explicit updates, receipt parsing and scheduled jobs              | [Automations](automations.md)                                                |

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

Receipt currency handling, retained purchase evidence and recovery notifications
have been corrected. Collection writes now recheck authority after the final
form read; Database query validation shares its inspection fields; bundled pyk
reconstructs from its pinned base; and blueprint recovery and sensor guidance
match the implementation. These fixes have maintained regression coverage. They
do not close the live qualification gates below. The minimatch override remains
a reviewed tooling compatibility exception with removal criteria in the
[development guide](README.md).

## Alpha preparation

The following stages are accepted work. **In progress** identifies current work;
**accepted** means planned but not complete. **Complete** applies only to the
evidence named in that row. Preservation and filtering are separate from forward
code and documentation changes. The alpha release gate has not been completed.

| Stage                          | Status   | Completion evidence                                                                                                                                                                                                         |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve and inventory         | Complete | Original history/object/report archives and the committed pre-rewrite bundle restore-tested; separate private local copies verified. Off-device backup assurance remains unverified.                                        |
| Rehearse history filtering     | Complete | Disposable main rehearsal retained 132 of 137 commits, pruning only five report-only commits; verified retained blobs, modes, metadata, ancestry and three targeted message edits against the ledger.                       |
| Contributor docs and tooling   | Complete | Maintained docs and user guides reorganized; terminal/editor/CI share direct scripts. Fresh isolated setup, full Check and deterministic packaging verified, including cancellation and asset mismatch handling.            |
| Local history filtering        | Complete | Filter retained 135 of 140 input commits, pruning the same five report-only commits; every retained tree, mode, metadata header, parent and message verified. Current audit directory removed; procedure history preserved. |
| Supported upgrades and cleanup | Accepted | Select supported database checkpoints and portable formats, then simplify current compatibility paths with fictional upgrade, rollback and restore coverage.                                                                |
| Release qualification          | Accepted | Complete the current build/test/package gate, installation and recovery guides, release policy and the external qualification matrix below.                                                                                 |
| Publish cleaned history        | Accepted | Current remote main predates the reports and remains an ancestor of cleaned local main. Recheck refs/PRs, publish by ordinary fast-forward when authorized, then verify a fresh remote clone.                               |

Retain every commit that changes retained files, including small fixes,
experiments and reversions. Mixed commits lose only selected archival content;
only removal-only commits may disappear. Preserve both historical procedure
names, `audit/review.md` and `audit/AUDIT_PROCEDURE.md`; the maintained
procedure now lives in `docs/development/auditing.md`. Do not purge `docs/` or
`audit/` wholesale or consolidate source history into milestones. Historical
checkouts need not build; the resulting current revision must pass the release
gate. Keep original reports and commit IDs privately, together with restoration
checks and rewrite mappings; do not publish archival refs or bundles.

The local rewrite preserves the three contributor-preparation commits and all
retained source history. Original history, reports and mappings remain in the
private archive. The existing stash and remote-tracking refs are unchanged;
reflogs and recovery objects have not been pruned. Both verified archive copies
are on the same machine. No shared ref was updated, and the current eight
Dependabot branches need no filtering because they predate the reports.

Maintained documentation leads with installation, first use, feature setup,
permissions and recovery. Consolidate active tasks here and lasting contracts in
their owning `docs/development/` documents, including security and auditing;
retain useful design history. Future audit output belongs in ignored
`artifacts/audits/<run-id>/` or an external directory, with verified archival
copies. Promote actionable findings and reusable regression coverage before
removing dated reports or probes.

The tooling move places implementations in `scripts/src/` and thin executable
`setup`, `build`, `lint`, `format`, `test`, `check` and `package` wrappers under
`scripts/`. Follow the [development guide](README.md) for the current interface.
Setup uses standard venv/pip with `-e '.[dev,audit]'` and frontend `npm ci`. VS
Code and CI share the same commands. Check verifies generated assets without
accepting changes; Build intentionally updates them. Optional dependency scans,
SSH deployment and restart remain separate, and deployment consumes an exact
prepared artifact. Isolated-checkout verification passed on 2026-11-09 with
Python 3.14.7 and Node 24.22.1: fresh setup, 30 provider tests, 749 integration
and tooling tests, four frontend security tests, 444 frontend component tests,
lint/format/types, project checks, pyk reconstruction and generated-asset
comparison. Packaging was inspected and its runtime archive matched the
pre-reorganization package byte for byte. No adjacent repositories, global
project tools, editor tasks or household data were required. This evidence
closes the contributor stage, not the external qualification gates.

The [user guide set](../README.md#user-guides) covers installation,
configuration/profiles, Journal and Library, controls, metadata,
purchases/receipts, calendars, all six dashboard cards,
entities/actions/automations, data management and troubleshooting. A
[code-structure reference](../reference/code-structure.md) maps contributor
ownership. The detailed system contracts remain separate from these setup and
recovery tasks. Validate the guides against the declared live environments as
part of external qualification; written instructions are not passing evidence.

Manual release validation automation now shares the full checks and runs
hassfest, HACS validation, packaging and artifact inspection before uploading
the candidate. A hosted validation run remains pending. Publication automation
awaits the version, license, reporting and distribution decisions; it must not
be inferred from producing or uploading a validation artifact.

Supported migration checkpoints remain an open decision. Choose them from
supported upgrade needs and retained operator states, not Git history alone.
Preserve monotonic schema versions, worker-owned SQL, consistent backups,
transactional failure recovery, identities and uncertain-operation barriers.
Unsupported databases must remain intact with a documented recovery route.
Remove compatibility code only in forward changes after reachability and
checkpoint tests establish the replacement behavior. Keep the runtime pyk
bundle, reconstruction tools and license until the compatibility and hardware
gates permit a separately qualified dependency change.

## Next delivery gates

The pyk compatibility and external qualification work remains open. Existing
offline fixes and reproducible source do not establish a supported release.

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
4. After upstream and compatibility qualification, replace the temporary bundled
   copy with a reproducible released pyk dependency and complete clean HA
   install/reload/restart validation. Keep the bundle until that change is
   qualified; the alpha cleanup does not itself authorize its removal.
5. Extend modern, hardware-testable video/capability features in small
   increments. Premiere music, vault/disc-specific workflows and alternative
   framing remain deferred without applicable hardware and a concrete use case.

These gates are dependencies, not dates. No hardware tests or deployments are
implied by documenting available equipment. The pyk compatibility document
defines the precise functional requirements, optional owner decisions and exit
evidence.

## External qualification

Every row remains open until the specified environment and result are recorded.
Use fictional data and isolated or disposable targets where possible. Device
actions and deployment require explicit scope; normal checks do not contact
devices. Record sanitized outcomes, versions and necessary hashes, keeping
household databases, email, credentials and raw protocol frames private.

| Surface              | Required acceptance                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native HA            | Record the HA version; exercise clean config flow, anonymous/inactive/household/admin API behavior, entity access, options reload, unload, platform refusal, setup failure and backup hooks.                                                                                                                               |
| Backup and restore   | Restore a fictional dataset with linked/unlinked purchases, corrections and uncertain intents; compare facts and recovery barriers after restart and verify no duplicate external writes.                                                                                                                                  |
| Human browser review | Have the operator review Library, Journal, Advanced → Database, Settings → Automations, Settings → Calendar and generated cards for both roles and desktop/tablet/mobile. Check focus/labels, dialogs/chips, query errors, covers/pagination, draft preservation, search-clear restoration, Today and revocation recovery. |
| Device controls      | Record model, firmware, topology and selected title/version; exercise opt-in, status/preflight, standby/wake, an explicitly selected launch/remote action, lost-response recovery without replay, and coexistence with the built-in integration.                                                                           |
| Collections          | Use selected test versions/collections; exercise final-read authority revocation, add/remove/status moves, complete-set preservation, concurrent changes, uncertainty/readback and rescan completion. Verify Paused removal separately from earlier limited live checks.                                                   |
| Public metadata      | Qualify chosen public Store/TMDB cases and the authorized credential path: current robots/API responses, TLS/destination rules, conservative matches, unavailable/rate-limited recovery and no-account scraping scope.                                                                                                     |
| Receipt and IMAP     | Qualify fetched and forwarded HTML, original/fallback dates, repeated covers/items, currencies/totals and invalid/partial/unmatched outcomes through actual HA/IMAP blueprint transport. Remove temporary sensitive diagnostics after format qualification and before broad alpha distribution.                            |
| Dedicated calendar   | Use a disposable target; verify the ownership warning, create/edit, delayed visibility, failed reads, uncertainty review, two-scan deletion quarantine, older/future/recurring event preservation, pending-delete status and backup pause.                                                                                 |
| Distribution         | Verify complete pyk provenance and the selected compatibility strategy, current local/deployed dependency scans, supported installable contents, licensing, security reporting and release policy.                                                                                                                         |

An unsuccessful case becomes a concrete defect with its own fix and acceptance
check. Automated component tests, a mocked integration suite and an offline
archive inspection do not close these external gates.

## Release readiness

- Declare and test supported HA releases. Manifest repository URLs and ownership
  are populated; `0.5.0-alpha.1` identifies the next unqualified alpha candidate
  across the integration, project and frontend. Original project work uses
  Apache-2.0; the bundled pyk MIT license covers that dependency only. Publish a
  new matching tag after the applicable external qualification gates pass. HA
  2026.11.0 is the development baseline and conservative Marketplace
  installation floor; the floor alone does not establish compatibility.
- Make a clean checkout/build/install reproducible with the qualified pyk
  dependency strategy; verify setup, options reload, unload, restart and
  upgrade. Keep tracked generated assets and folder-based distribution
  initially. Release validation must check version agreement, current
  tests/checks, asset provenance and installable package contents, with
  applicable HACS validation and hassfest. Producing an artifact and publishing
  an alpha prerelease are separate actions.
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
[deployment guide](deployment.md) describes the actual tooling and rollback
limits; isolated testing remains recommended when practical.

## Planned work

These are accepted follow-on items, not commitments for the current alpha. Each
requires an owning design, privacy/security review and regression coverage
before implementation.

| Milestone or area | Planned outcome                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooling           | Migrate project environment and dependency management from the current venv/pip workflow to `uv`, retaining reproducible local and CI setup.                                                                                                                  |
| Test suite        | Migrate test code from `unittest` to `pytest` while preserving the existing offline, fictional-data and no-device-contact guarantees.                                                                                                                         |
| Beta              | Finalize the current development and qualification work, then recruit additional testers with defined test environments, feedback paths and privacy-safe evidence handling.                                                                                   |
| Release v1        | Plan release deployment around merging qualified Companion changes into pykaleidescape and making the integration available through the Home Assistant Community Store (HACS), subject to upstream approval and HACS requirements.                            |
| Stats view        | Add a database-backed statistics view for perspectives such as most-watched genres, actors and directors, plus recurring actors across the Library. Define aggregation scope, permissions and empty/partial-data behavior first.                              |
| Relationship view | Add an interactive relationship graph linking similar movies by genre, cast and other qualified metadata; support an actor-focused graph showing frequent collaborator relationships. Establish performance limits and access-safe payloads before rendering. |
| Find related      | Add an action to find movies related to the current movie, evaluating TMDB's related-movie API alongside local similarity signals and honoring the existing metadata opt-in and credential boundaries.                                                        |
| CSV export        | Add scoped CSV exports for selected database tables, with explicit administrator authorization, bounded output and documentation of the privacy implications.                                                                                                 |
| Artwork cache     | Investigate and measure artwork-cache optimizations for faster loading, preserving current cache bounds, authentication and privacy behavior.                                                                                                                 |

## Later product decisions

Multiple-player recording is not implemented. Exact-edition launch, start-over,
seek/resume semantics and advanced theater automation require separate evidence
and feature decisions. Calendar behavior remains constrained by the selected HA
provider. Arbitrary SQL, generic network proxies, device network administration
and automatic replay of uncertain mutations are outside the current product.

Keep future work here until implemented. Update the owning design and tests with
each delivered behavior; do not append another parallel feature-status narrative
to every guide.

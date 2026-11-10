# Kaleidescape Companion comprehensive engineering audit

Audit the current repository as a Home Assistant **custom integration running
inside HA Core**, not a separately isolated add-on. Assess architecture,
functionality, security, privacy, reliability, supportability, performance,
maintainability, tests and documentation. Preserve supported behavior and
distinguish demonstrated defects from release gaps and optional improvements.

This procedure owns reusable review methodology. The individual run records its
scope, baseline, tool versions, findings and limitations. Historical findings
must be reassessed against the reviewed revision rather than carried forward as
current requirements.

## Execution rules

1. Read `AGENTS.md`, the [documentation index](../README.md),
   [security policy](security.md), [architecture](architecture.md),
   [roadmap](roadmap.md) and [pyk compatibility](pyk.md). Inspect each owning
   design alongside code and tests. Verify documentation rather than assuming it
   proves the implementation.
2. Inspect source, tests, configuration, build/deployment tools, workflows,
   dependency manifests/locks and generated-asset boundaries. Inventory files
   and explain exclusions. A large file or abstraction is not itself a defect;
   recommend structural changes only with concrete impact.
3. Read-only analysis, isolated fictional probes and normal checks are
   authorized by an audit request. Do not deploy, restart HA, control devices,
   scrape live providers or inspect household databases, credentials, email
   attachments or ignored `.ha-dev/` state during routine auditing. Treat
   external API and dependency logging behavior as outside the audit scope.
   Follow AGENTS.md; do not automate a real browser.
4. Change audit reports and explicitly requested documentation only. Do not
   change application behavior, migrations, dependencies or existing tests.
   Temporary fictional probes may live in a temporary directory or sanitized
   audit evidence. Never reset another contributor's edits.
5. Record commands, exits and meaningful summaries. Separate environmental
   failures, code defects, expected fault-injection warnings, skips and passes.
   Offline fixtures do not establish live HA, browser, device, provider or
   backup/restore acceptance.
6. Findings name the trigger, consequence, location, evidence, severity,
   confidence and validation status. Examine each issue and propose a specific
   fix, alternatives or an explicit reason no code change is appropriate, plus
   acceptance checks; do not implement the fix during the audit. Reproduce where
   feasible; label inference and uncertainty. For dependencies distinguish
   presence from reachability.
7. Finish with prioritized fixes and acceptance checks. An audit request does
   not authorize subsequent product refactoring. Existing explicit user
   authorization for implementation still governs that work; do not invent an
   additional approval requirement. For authorized follow-up work, commit each
   fix separately with its relevant tests and documentation. Prefix each audit
   and follow-up commit with a basic task type consistent with repository
   history, such as `audit:`, `bugfix:`, `doc:`, `ui:`, `test:`, `vendor:` or
   `refactor:`.

## Baseline and evidence

Create ignored `artifacts/audits/<run-id>/`, using a date and a suffix for a
distinct rerun, or write directly to a private external directory. Do not add
new reports to tracked `audit/` directories. Record source commit, branch,
working-tree changes, date/time zone, Python, SQLite, Node/npm, installed HA and
patched pyk commit/version used by tests. Identify uncommitted documentation
changes rather than claiming a clean baseline. Record hashes when a finding
depends on those edits.

Keep shared evidence sanitized and bounded: commands, fictional probes and
source references. Exclude environment trees, minified bundles, credentials,
hostnames, personal paths, raw email/HTML and household data. Assess generated
code through source/build provenance, not a claimed manual bundle review.

## Review phases

### 1. Architecture and functionality

Map HA entry points, runtime ownership, services/entities, HTTP/WebSocket
boundaries, frontend state, worker/migrations, tasks, network adapters and
standalone scrapers. Check setup failure, reload, platform-unload failure,
partial shutdown, backup pause/resume and cancellation. Verify work drains and
remaining cleanup proceeds after errors.

Preserve HA's built-in `kaleidescape` and pyk's public `Device` workflow. Read
the manifest and [pyk contract](pyk.md) for the reviewed dependency strategy and
qualification status. Verify any bundled source and release compatibility
claims. Public Store scraping belongs in Companion, not pyk. Check for private
built-in runtime access, global logger/connector changes and unsafe replay of
uncertain device/collection writes.

Trace end-to-end: observation/session recovery, manual viewings, Library
catalog/details/collections/artwork, control discovery/preflight, launch/remote
uncertainty, metadata, purchases, preferences, calendar/Full Sync, database
inspection/merge, exports and backups. Verify visible success semantics.

### 2. Data integrity and feature contracts

Read [Journal storage](journal.md), [data management](data-management.md) and
the other owning contracts. Select concrete cases from the reviewed code and
supported schema/format checkpoints, including:

- Purchase-information availability and migrations into the current ledger:
  atomicity, backups, unlinked record retention, absence of duplicate
  authoritative data, projections, SQL filters and sorts, summary counts,
  export/import and delete/unlink behavior.
- Receipts before Library scans; database-backed reconciliation without JSON or
  stopping tracking. Verify purchase-only guards, actor/revision checks, partial
  outcomes and conflicts. Check exact handles, Store IDs/URLs,
  title/year/edition ambiguity and collection matching. Numeric Store IDs are
  not local handles. Evaluate replay identity when date/title/link evidence
  changes.
- Receipt parsing and the currently bundled blueprint: quoted forwards, original
  versus local fallback dates, required HTML, cover/title repetition versus
  actual duplicate items, size limits and reconciled totals. Distinguish invalid
  parsing from unmatched records and saved partial results. Use fictional
  receipt formats.
- Blueprints: missing-only installation, semantic fingerprints, revision-bound
  updates, modified files, installed versus bundled versions, YAML histories,
  About/history UI, uncertain reload/write reporting and guarded custom-element
  registration.
- Library: Science Fiction normalization, separate
  resolution/dynamic-range/audio filters, distinct SD/SDR, G-first rating order
  and Unrated excluding groups with known ratings. Check purchase-summary
  freshness, Watch Soon priority, removed actor/director filter controls and
  retained search.
- UI: reconciliation pagination/covers, desktop branding, credit punctuation,
  compact artwork inputs; calendar search/list switching, conditional clear,
  view restoration, mobile chip and Today. Check revocation/stale responses,
  selection/draft persistence, keyboard labels and responsive logic. Simulated
  DOM tests do not prove visual correctness.
- Library conflict logs: preserve previous data on inconsistent snapshots,
  identify a bounded cause/action and report verified recovery or that
  collection consistency was not rechecked.

### 3. Security and privacy

Evaluate anonymous/inactive/household/admin scope at API and storage boundaries,
entity versus panel permissions, no-user HA automations, revocation across
awaits, stale receipts and cross-entry/dataset replay. Check private invoice,
notes, source/diagnostic fields and cache projections. UI visibility is no
guard.

Review SQL allowlists/parameters/budgets, JSON/SQLite bounds and native-parser
exposure, archives/paths/links, exports, deploy commands, secrets,
rendering/XSS, object/prototype handling and provider isolation. Check local
private-address pinning separately from public DNS/TLS/robots/redirect/body
policy. Trace TMDB credentials and arbitrary exceptions across owned boundaries.
Email sender text/forward headers are not authentication. Companion shares HA's
privileges; do not claim process isolation or a tenant boundary.

Assess current advisory results with runtime/dev classification and realistic
reachability, using primary advisory sources as needed. No live intrusive tests.

### 4. Supportability, logging and performance

Read the current [logging contract](logging.md) and
[security guide](security.md#logging-diagnostics-and-dependency-review). Verify
severity, bounds, redaction and exception handling against the owned interfaces.
Review any documented diagnostic exception, its exposure and removal gate; do
not generalize it to other subsystems or severity levels. Reassess old logging
recommendations against current ownership instead of restoring retired designs.
Keep external API and dependency logging outside the routine audit scope unless
that scope is explicitly extended.

For each subsystem map decision/outcome, conflict, retry, recovery, cancellation
and cleanup evidence. Can a maintainer identify stage, bounded cause,
preservation/rollback and next action without private identities? Check
severity, duplicate reports, poll-volume suppression, UI recovery, diagnostic
failures and overhead. Do not log every function/row or fetch data to enrich
messages. Absence of CRITICAL logs is not itself a finding. Correlation must not
add household aliases.

Check event-loop blocking, worker backpressure/shutdown, query budgets/indexes,
N+1 queries, cache invalidation/retention, frontend page bounds,
timers/listeners, network concurrency/timeouts, cancellation and resource
closure. Distinguish measured costs from speculation; document environment for
fictional scale probes.

### 5. Tests, tooling and documentation

Run `scripts/check` with the packaged pyk bundle. It covers provider/integration
tests, structure/doc links, Python lint/format, shell syntax, Markdown, frontend
lint/format/security/component tests, types and build. Some tests require
loopback sockets; if the sandbox denies them, use the tool's scoped
execution-permission workflow and record the environment failure separately from
the rerun.

Run dependency scans separately with `scripts/dependency-audit`. Record missing
tools, network failures, versions and exact results; unexecuted/offline scans
are not passes. Old advisory counts are not current claims. Do not upgrade
packages during the audit.

Inspect assertions/fault paths rather than just test counts. Assess resource
warnings, lifecycle cleanup and unexpected frontend console output. Record
missing hardware/browser/HA transport/restore acceptance. Verify CLI, VS Code
tasks, packaging and docs agree, including bundled pyk provenance. Audit
maintained Markdown for stale schema, permissions, version, UI, logging and
release claims. Keep historical evidence clearly dated rather than rewriting its
old results.

## Required reports

Write eight reports in the dated run directory, using cross-links instead of
repeating findings:

1. **ARCHITECTURE_AUDIT.md**: baseline, inventory/scope, component boundaries,
   lifecycle and intended versus actual workflows.
2. **SECURITY_AUDIT.md**: trust boundaries, controls, attack paths, privacy,
   dependency results/reachability and validation limits.
3. **CODE_QUALITY_AUDIT.md**: correctness, integrity, resources, reliability,
   performance and justified structural recommendations.
4. **SUPPORTABILITY_AUDIT.md**: safe diagnostic usefulness, severity,
   outcomes/recovery and operator/developer documentation gaps.
5. **DIAGNOSTIC_COVERAGE_MATRIX.md**: workflow, evidence, bounded context,
   current privacy/severity, gaps and finding links.
6. **TEST_COVERAGE_AUDIT.md**: exact environment/commands/results, meaningful
   coverage, fictional probes, warnings, skips and missing acceptance.
7. **AUDIT_FINDINGS.md**: stable IDs, severity/confidence/evidence/disposition;
   distinguish confirmed defects, release/validation gaps and recommendations.
   Reassess historical findings in scope individually as resolved, still
   applicable, superseded or unverified with reasons. Give new findings
   run-specific IDs. Include a prominent instruction to anyone fixing findings
   to read this audit procedure at `docs/development/auditing.md` in the
   reviewed repository revision, read `AGENTS.md` and follow standard
   contribution practices. State that authorized fixes belong in separate
   commits with task-type prefixes; the report itself does not authorize
   implementation.
8. **REFACTORING_PLAN.md**: priority/dependencies, affected files, acceptance
   and regression checks, migration/rollback risks; distinguish code fixes from
   external validation tasks.

Write a short archive README with run status, contents and the reviewed source
revision. Do not repopulate a tracked report index. Do not copy historical test
counts, advisories or removed logging contracts into the new baseline. Final
handoff names significant findings, checks, evidence and limitations, without
claiming fixes the review did not implement.

## Preserve and archive the run

Use a dated folder in a private, backed-up location outside the project.
Preserve original report text, probe bytes and source commit IDs. Include a
manifest of selected paths, sizes and SHA-256 hashes, the reviewed commit and
working-tree state, checksums, a contents README and restore instructions.
Sanitize before sharing, not by silently rewriting the original private evidence
afterward.

Copy reports and evidence to the archive, unpack/restore and verify their
hashes, and verify a separate backup before deleting local output. Keep each
archive readable without a special application. Promote actionable defects and
open qualification work into issues or the roadmap; retain reusable regression
tests and lasting rationale in the project. Do not archive the only maintained
explanation of an unresolved public limitation.

For a history cleanup, also preserve a Git bundle of all inventoried original
refs, audit files at the preservation checkpoint and relevant uncommitted
output. Inventory stashes, reflog-only/unreachable work, LFS objects and
submodules: ordinary Git bundles do not capture all of these. Restore-test the
bundle in a disposable clone and verify any supplemental object/evidence
archive. Keep a separate backup before removing original history. Store removal
ledgers, old-to-new maps and equivalence results as separate checksummed
evidence; never rewrite old reports to use the new commit IDs or publish
archival branches/tags. The original-history bundle is a one-time preservation
artifact, not a required output for every subsequent audit.

## Independent rerun

After the documentation and this procedure are updated, launch a fresh agent
with `fork_turns: none`, repository path and instruction to read this file and
perform the review. Do not seed it with editor conclusions or preferred
findings. It may delegate well-defined areas to fresh agents, but must inspect
evidence, reconcile overlap and own the final assessment.

Review the actual working tree, not only the documentation diff. The coordinator
may run checks and address documentation findings afterward, recording later
edits. Do not present a review as covering unreviewed application changes.
Findings remain open until authorized implementation/validation establishes
their disposition.

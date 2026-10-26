# Product plan

Updated: 2026-10-25

Kaleidescape Companion maintains a shared household movie journal inside Home
Assistant. Recording and browsing must work without a library import, external
service, NAS, or playback-control adapter. The built-in `kaleidescape` integration
remains the source of playback entities; this integration uses
`kaleidescape_companion`.

## Current delivery

The working implementation includes a manual journal, optional automatic tracking
of one selected player, administrator management, a regular-user reader, exports,
and seven history sensors. See [framework status](framework.md) for the complete
implemented/deferred inventory and [technical design](design.md) for code boundaries.
The [security policy](security.md) governs every phase.

| Phase | Current position | Remaining acceptance work |
| --- | --- | --- |
| 1. Foundations | Config/options flow, worker-owned SQLite, migrations, authenticated APIs/panel, diagnostics, backup hooks, exports, and local deployment tooling implemented | Validate the supported HA releases, real config-flow/platform lifecycle, and full HA backup/restore; resolve dependency findings |
| 2. Journal and read-only Now Playing | One-player timing/recovery, partials/rewatches, manual corrections, reader/admin UI, title search, and history sensors implemented; Now Playing API exists | Dedicated live Now Playing UI, authorized artwork/progress, subscriptions, operator browser review, and real-source transition validation |
| 3. Library browser | Planned | Optional server setup, safe read-only synchronization, identity evidence, cached details/artwork, poster/list browsing |
| 4. Playback and controls | Planned | Permission/capability checks, explicit commands, state confirmation, and authorized device tests |
| 5. Polish and distribution | Planned | Accessibility/localization, measured performance, release compatibility, license/ownership/reporting setup, and HACS assessment |

These phases describe product delivery, not an HA quality-scale certification.
A passing local build does not establish production readiness.

## Next: finish the journal experience

Keep Journal the default view. Add read-only Now Playing before Library, with
player/title, exact playback mode, content/credits/intermission location,
availability, and recording health. Missing catalog metadata must not hide live
playback. Show position, remaining time, and artwork only with validated source
data and appropriate entity permissions. Watched time is not a seek position.

Use revisioned snapshots plus bounded invalidation subscriptions rather than
polling every browser for the full journal. Reconnect obtains a fresh snapshot;
unload or permission changes stop delivery. Preserve current write retry and
optimistic conflict behavior. The existing household reader policy stays in place;
any additional live/entity fields require a security review before sharing them.

Before calling this the first usable release, validate:

- Playing, pause, scan, credits, short stops, title/identity rollover, and rewatches
  with the actual source entities during operator-authorized observation.
- Unavailable entities, queued-write failures, restart recovery, duplicate events,
  manual corrections, and reload without leaked tasks or listeners.
- Administrator and regular-user desktop/mobile layouts, keyboard use, safe text,
  access changes, and downloaded-data handling through operator browser review.
- Backup/restore and supported HA releases, including isolated OS/Container checks.

Multiple players can follow this slice. Keep one household dataset and independent
per-player queues/sessions; never merge simultaneous players by title. Add config
migration and duplicate-mapping validation when expanding the current one-player flow.

## Then: optional library and enrichment

Keep the database as the immediate query source. Configure a server explicitly;
fetch basic library and collection rows before lazy/throttled details and artwork.
A server outage or unrecognized page preserves cached data and cannot stop recording.
Use staged generations, complete-list validation, bounded requests, backoff, and
separate freshness/availability. Only a successful complete listing may mark a
version unavailable; never delete its viewing history.

Represent source systems, browsing groups, works/versions, exact identity aliases,
collections, details, and artwork when those features need migrations. Preserve
raw IDs and viewing snapshots. Titles alone cannot merge editions or identify a
movie. Source Played/New/Paused labels remain separate from recorded completion,
saved position, and dated history. Existing Played membership may be displayed as
“Previously played — date unknown”; it cannot manufacture a viewing.

Provide poster/list views and details with metadata, editions, collections, and
journal history. Add search/filter/sort only for available fields. A first-discovered
date is an import observation, not a purchase/download date. Retain missing metadata
and unavailable versions consistently. Keep parser fixtures small and fictional or
sanitized. [Interface research](research.md) records evidence and unresolved claims.

Provisional targets are a warm cached first page within one second, warm searches
around 300 ms, and live state within about one second of HA receipt. Measure on
representative HA hardware and synthetic large catalogs before choosing FTS,
virtualization, WAL, or broad cache warming; these are not measured guarantees.

## Then: explicit playback controls

Start with capability-gated play/pause/stop for the active player through public HA
actions, with caller context and entity permissions. Check fresh player identity
and expected revision, serialize per-player requests, and distinguish an action
acknowledgement from an observed result. Timeouts are unconfirmed outcomes, not
instructions to resend a command. Toggle-style pause must not be blindly retried.

Selected-library-title launch, edition selection, saved-title resume, seeking,
and start-over each need independently verified semantics. Unsupported actions
remain unavailable. Accumulated viewing time is not a saved resume point. Never
substitute a navigation macro or guessed protocol/HTTP command for direct launch.
An action that interrupts another title needs a clear target/interruption flow.
Device tests require an explicitly authorized playback window and must account
for the operator's existing theater automation.

## Later expansion and release gates

JSON import, permanent purge/retention controls, selective household sharing,
additional sources, ratings, and richer statistics remain separate follow-ups.
Current notes and manual entries already exist. Any import/purge must account for
sessions, request deduplication, audit references, backups, and privacy limits.
Individual viewer profiles are outside the current shared-household design.

Before publication: choose the license and real repository/documentation ownership,
establish a private reporting channel and supported HA matrix, resolve the
[dependency release blocker](security.md#known-dependency-findings-2026-10-25),
review runtime package contents, and complete the acceptance checks above. Private
SSH deployment supports development; HACS metadata alone is not a distribution release.

# Product plan

Updated: 2026-10-28

Kaleidescape Companion maintains a shared household movie journal inside Home
Assistant. Recording and browsing must work without a library import, external
service, NAS, or playback-control adapter. The built-in `kaleidescape` integration
remains the source of playback entities; this integration uses
`kaleidescape_companion`.

## Current delivery

The working implementation includes a manual journal, optional automatic tracking
of one selected player, administrator management, a regular-user reader, exports,
seven history sensors, and a compact administrator Now Playing card. See [framework status](framework.md) for the complete
implemented/deferred inventory and [technical design](design.md) for code boundaries.
The [security policy](security.md) governs every phase.

| Phase | Current position | Remaining acceptance work |
| --- | --- | --- |
| 1. Foundations | Config/options flow, worker-owned SQLite, migrations, authenticated APIs/panel, diagnostics, backup hooks, exports, and local deployment tooling implemented | Validate the supported HA releases, real config-flow/platform lifecycle, and full HA backup/restore; resolve dependency findings |
| 2. Journal and read-only Now Playing | One-player timing/recovery, partials/rewatches, corrections, reader/admin UI, sensors, and read-only Now Playing with HA cover artwork/session context implemented | Operator browser review, real-source transition validation, and HA compatibility; subscriptions/progress remain optional follow-ups |
| 3. Library browser | Opt-in hostname discovery/override, scheduled GET-only sync, cached titles/collections/details/artwork, shared cover/list browsing, multi-select filters, sortable headings, detail popups, first detection, and version identities implemented | Operator full-sync/browser/firmware validation; canonical work identities, journal links, and collection removal remain; separately opted-in Add to Collection is implemented |
| 4. Playback and controls | Planned | Permission/capability checks, explicit commands, state confirmation, and authorized device tests |
| 5. Polish and distribution | Planned | Accessibility/localization, measured performance, release compatibility, license/ownership/reporting setup, and HACS assessment |

These phases describe product delivery, not an HA quality-scale certification.
A passing local build does not establish production readiness.

## Next: finish the journal experience

Keep Journal the default view. Administrator navigation uses the ordered tabs
Now Playing, Library, Journal, Database, and Settings. Library is disabled until
explicitly enabled in Settings. Active users share cached reads through their
Library/Journal tabs; configuration and manual sync remain administrator-only.
The compact read-only Now Playing card is mounted only on its own tab. It combines the existing HA player's title,
cover, runtime, exact playback/location states, and availability with counted
session time, credits evidence, timing gaps, and recording health. It uses the
configured player and HA's existing authenticated image route; no library sync,
image service, new media-player entity, or playback controls are needed.

Visible cards request a snapshot about every five seconds; hidden/disconnected
cards stop polling and discard late replies. The full journal still refreshes
explicitly. Keep this simple snapshot approach until measurements or product
needs justify revisioned subscriptions. Reconnect/permission changes clear old
data. Preserve current write retry and optimistic conflict behavior.

Automatic entry admission uses a configurable minimum reported movie runtime,
defaulting to 10 minutes (0 disables). Short playback does not enter the journal;
unknown runtime waits when filtering is enabled. Keep this separate from counted
watch time and credits completion. Preserve existing/manual history and show
ignored/waiting reasons in Now Playing; source runtime cannot identify all trailers.

Administrator Settings on the main page uses the existing native HA options
flow; keep one validation/persistence/reload path. Display whole-second times
and two-decimal minutes without rewriting untouched observed precision.
Database provides a shared toolbar and underline table tabs, inline row selection,
viewing details/corrections, import/export dialogs, fixed-table raw inspection with 10/25/100/500-row pages, search and sorting, and confirmed selected/all purge,
with recording disabled, dataset revision checks, associated-content removal,
and content-free durable retry barriers/audit. Automatic retention remains later
work; preserve the explicit purge contract and external-copy limitations.

Now Playing retains the current administrator boundary plus source-entity read
checks. Regular users retain the household journal reader. Any broader live-data
sharing needs an explicit policy change. Watched time is counted session time,
not film position, percentage complete, or a saved resume point. Progress/remaining
time require separately validated source position and timestamp data. Previous
viewings and direct journal links can follow when they add useful context; the
current card does not query historical statistics or infer journal completion.

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

## Optional library and enrichment

The [implemented library slice](library.md) uses SQLite as the immediate query
source, with blank-host discovery, an explicit override, and opt-in scheduling.
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

Poster/list views and detail popups now include cached metadata, editions, and
collections. Source-scoped `source_group` browsing, individual-version details,
fixed/resizable table columns, format expansion, and hidden collection names are
implemented. Same-name remakes stay separate; sparse versions inherit missing
work descriptions within their group without changing raw metadata or identities.
Journal-history associations and canonical work identities remain future work.
Add search/filter/sort only for available fields. A first-discovered
date is an import observation, not a purchase/download date. Retain missing metadata
and unavailable versions consistently. Keep parser fixtures small and fictional or
sanitized. [Interface research](research.md) records evidence and unresolved claims.

The separately opted-in [Add to Collection](library-collections.md) supports one
explicit version and existing target, with durable read-back/recovery. Do not send
exploratory mutations. Operator firmware validation remains; removal requires its
own verified contract and tests.

Provisional targets are a warm cached first page within one second, warm searches
around 300 ms, and live state within about one second of HA receipt. Measure on
representative HA hardware and synthetic large catalogs before choosing FTS,
virtualization, WAL, or broad cache warming; these are not measured guarantees.

## Then: explicit playback controls

Add a small set of capability-gated play/pause/stop buttons for convenience only
when useful, calling the existing player's public HA actions with caller context
and entity permissions. Reuse HA's media player; do not build a duplicate player
integration or a generic remote-control replacement. Check fresh player identity
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

## Planned investigations

- Separate development tools, fixtures, benchmarks, and preview infrastructure
  from functional runtime pieces. Review organization and build/package boundaries
  while preserving reproducible development and runtime-only deployment artifacts.
- Explore calendar integration for viewing dates with movie titles and artwork.
  Investigate HA calendar support and external calendar publishing later.
- Explore optional Gmail integration for publishing when movies were watched.
  Determine the intended workflow, authorization, and sharing details during design.

These are rough follow-up tasks only; no calendar or Gmail connector is implemented.

## Later expansion and release gates

Automatic retention, import extensions, selective household sharing,
additional sources, ratings, and richer statistics remain separate follow-ups.
Current notes, manual entries, explicit permanent purge, and compatible viewing-only
JSON/SQLite merge imports already exist. Any import/retention extension must account for
sessions, request deduplication, audit references, backups, and privacy limits.
Individual viewer profiles are outside the current shared-household design.

Before publication: choose the license and real repository/documentation ownership,
establish a private reporting channel and supported HA matrix, resolve the
[dependency release blocker](security.md#known-dependency-findings-2026-10-25),
review runtime package contents, and complete the acceptance checks above. Private
SSH deployment supports development; HACS metadata alone is not a distribution release.


### Display and purchase metadata follow-up

Implemented shared display defaults, URL main-tab restoration, known/custom hidden
collection lists, guarded backdrop dismissal, and schema 7 local purchase-date
preview/apply. See [purchase dates](purchase-dates.md). Ambiguous/missing exact title
matches remain an operator review step. Add-only collection membership is implemented with a separate opt-in, exact
version selection, read-back confirmation and schema 8 durable receipts.
Removal remains pending operator investigation. Live add validation is still an
operator step; the copied journal does not prove a vendor protocol.

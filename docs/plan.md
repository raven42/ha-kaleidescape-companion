# Product plan

Updated: 2026-10-31

Kaleidescape Companion maintains a shared household movie journal inside Home
Assistant. Recording and browsing must work without a library import, external
service, NAS, or playback-control adapter. The built-in `kaleidescape`
integration remains the source of playback entities; this integration uses
`kaleidescape_companion`.

## Current delivery

The working implementation includes a manual journal, optional automatic
tracking of one selected player, administrator management, a regular-user
reader, exports, seven history and seven Library/storage sensors, and a shared
Now Playing display with administrator recording context. See
[framework status](framework.md) for the complete implemented/deferred inventory
and [technical design](design.md) for code boundaries. The
[security policy](security.md) governs every phase.

| Phase                                | Current position                                                                                                                                                                                     | Remaining acceptance work                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundations                       | Config/options flow, worker-owned SQLite, migrations, authenticated APIs/panel, diagnostics, backup hooks, exports, and local deployment tooling implemented                                         | Validate the supported HA releases, real config-flow/platform lifecycle, and full HA backup/restore; resolve dependency findings                                 |
| 2. Journal and read-only Now Playing | One-player timing/recovery, partials/rewatches, corrections, reader/admin UI, sensors, and read-only Now Playing with HA cover artwork/session context implemented                                   | Operator browser review, real-source transition validation, and HA compatibility; subscriptions/progress remain optional follow-ups                              |
| 3. Library browser                   | Opt-in hostname discovery/override, scheduled GET-only sync, cached titles/collections/details/artwork, shared cover/list browsing, filters/sorts, detail popups and exact Journal links implemented | Operator full-sync/browser/firmware validation; broader canonical identities and collection removal remain; separately opted-in Add to Collection is implemented |
| 4. Playback and controls             | Opt-in API discovery/default player, household controls, experimental Library launch and durable no-replay receipts implemented                                                                      | Permission/capability checks, explicit commands, state confirmation, and authorized device tests                                                                 |
| 5. Polish and distribution           | Planned                                                                                                                                                                                              | Accessibility/localization, measured performance, release compatibility, license/ownership/reporting setup, and HACS assessment                                  |

These phases describe product delivery, not an HA quality-scale certification. A
passing local build does not establish production readiness.

The current [Database tools](database.md) provide raw-first details, confirmed
supported edits/deletions, personal view options and schema-aware condition
completion. Library has sticky search/status bars, partial title/people search,
compact people filters and reusable rating/format badges. Critical system repair
beyond the documented protections remains a separate design task.

## Next: finish the journal experience

Keep Journal the default view. Administrator navigation uses the ordered tabs
Now Playing, Library, Journal, Database, and Settings. Library is disabled until
explicitly enabled in Settings. Active users share cached reads through their
Library/Journal tabs; configuration and manual sync remain administrator-only.
The shared read-only Now Playing display is mounted only on its own tab. It
combines the existing HA player's title, cover, runtime, exact playback/location
states, and availability with counted session time, credits evidence, timing
gaps, and recording health. It uses the configured player and HA's existing
authenticated image route; no library sync, image service, new media-player
entity, or playback controls are needed.

Visible cards request a snapshot about every five seconds; hidden/disconnected
cards stop polling and discard late replies. The full journal still refreshes
explicitly. Keep this simple snapshot approach until measurements or product
needs justify revisioned subscriptions. Reconnect/permission changes clear old
data. Preserve current write retry and optimistic conflict behavior.

Automatic entry admission uses a configurable minimum reported movie runtime,
defaulting to 10 minutes (0 disables). Short playback does not enter the
journal; unknown runtime waits when filtering is enabled. Keep this separate
from counted watch time and credits completion. Preserve existing/manual history
and show ignored/waiting reasons in Now Playing; source runtime cannot identify
all trailers.

Administrator Settings on the main page uses the existing native HA options
flow; keep one validation/persistence/reload path. Display whole-second times
and two-decimal minutes without rewriting untouched observed precision. Database
provides a shared toolbar and underline table tabs, inline row selection,
raw-first details, explicit supported-field edit dialogs, reviewed
import/export, and confirmed permanent selected-row deletion. Personal Options
save 10/25/100/500-row pages, per-table sorting and system-table visibility.
Schema-aware predicate completion/validation uses bound values. Targeted writes
can run with recording/sync enabled, protected by content revisions, row
snapshots, active-session checks and content-free durable retry barriers/audit.
The compatibility bulk-purge API still requires recording disabled. Automatic
retention remains later work; preserve external-copy limitations.

Now Playing shares safe display fields across active accounts with source-entity
read checks. Regular users retain the household journal reader. Any broader
live-data sharing needs an explicit policy change. Watched time is counted
session time, not film position, percentage complete, or a saved resume point.
Progress/remaining time require separately validated source position and
timestamp data. Previous viewings and direct journal links can follow when they
add useful context; the current card does not query historical statistics or
infer journal completion.

Before calling this the first usable release, validate:

- Playing, pause, scan, credits, short stops, title/identity rollover, and
  rewatches with the actual source entities during operator-authorized
  observation.
- Unavailable entities, queued-write failures, restart recovery, duplicate
  events, manual corrections, and reload without leaked tasks or listeners.
- Administrator and regular-user desktop/mobile layouts, keyboard use, safe
  text, access changes, and downloaded-data handling through operator browser
  review.
- Backup/restore and supported HA releases, including isolated OS/Container
  checks.

Multiple players can follow this slice. Keep one household dataset and
independent per-player queues/sessions; never merge simultaneous players by
title. Add config migration and duplicate-mapping validation when expanding the
current one-player flow.

## Optional library and enrichment

The [implemented library slice](library.md) uses SQLite as the immediate query
source, with blank-host discovery, an explicit override, and opt-in scheduling.
Keep the database as the immediate query source. Configure a server explicitly;
fetch basic library and collection rows before lazy/throttled details and
artwork. A server outage or unrecognized page preserves cached data and cannot
stop recording. Use staged generations, complete-list validation, bounded
requests, backoff, and separate freshness/availability. Only a successful
complete listing may mark a version unavailable; never delete its viewing
history.

Represent source systems, browsing groups, works/versions, exact identity
aliases, collections, details, and artwork when those features need migrations.
Preserve raw IDs and viewing snapshots. Titles alone cannot merge editions or
identify a movie. Source Played/New/Paused labels remain separate from recorded
completion, saved position, and dated history. Existing Played membership may be
displayed as “Previously played — date unknown”; it cannot manufacture a
viewing.

Poster/list views and detail popups now include cached metadata, editions, and
collections. Source-scoped `source_group` browsing, individual-version details,
fixed/resizable table columns, format expansion, and hidden collection names are
implemented. Same-name remakes stay separate; sparse versions inherit missing
work descriptions within their group without changing raw metadata or
identities. Journal-history associations use exact Library references; broader
canonical work identities remain future work. Add search/filter/sort only for
available fields. A first-discovered date is an import observation, not a
purchase/download date. Retain missing metadata and unavailable versions
consistently. Keep parser fixtures small and fictional or sanitized.
[Interface research](research.md) records evidence and unresolved claims.

The separately opted-in [Add to Collection](library-collections.md) supports one
explicit version and existing target, with durable read-back/recovery. Do not
send exploratory mutations. Operator firmware validation remains; removal
requires its own verified contract and tests.

Provisional targets are a warm cached first page within one second, warm
searches around 300 ms, and live state within about one second of HA receipt.
Measure on representative HA hardware and synthetic large catalogs before
choosing FTS, virtualization, WAL, or broad cache warming; these are not
measured guarantees.

## Playback controls: implemented slice and next validation

The [Companion control adapter](playback-controls.md) now consumes the
independent API through a generated runtime bundle. It adds opt-in, read-only
seed discovery, a native default-player serial setting, an administrator Now
Playing control card and separately enabled Library launch without confirmation
prompts. Fixed transport/navigation/power intents use fresh direct
identity/movie-zone/state checks; Library launch also resolves the exact cached
version and validates live content metadata. Schema 18 persists actor-bound
request outcomes and uncertainty barriers. It never replays a possible write.
Recording continues from the existing HA entities; changing a control target
does not change recording sources.

The operator's October 30 CLI launch/STOP sequence validates one player only.
The new integration UI and discovery need operator review, followed by explicit
hardware tests in a suitable theater window. Broader firmware/model command
support, standby, edition ambiguity and existing theater automation behavior
remain acceptance gates. Normal build/test tasks use fictional peers and never
connect to devices.

Next investigate persistent verified handle enrichment only if fresh namespace
resolution is inadequate. Saved-title resume, seeking, start-over, exact edition
selection, additional actions/services and live subscriptions need independently
verified semantics. Never substitute a navigation macro or guessed namespace; no
automatic wake or retry. The current fixed administrator interface preserves the
built-in player rather than registering competing entities. Any broader
user/automation capability needs its own authorization contract.

## Planned investigations

- Implemented opt-in [HA calendar publishing](calendar.md) on new completion,
  with configurable flat title/description placeholders and plain-text events.
  Internal identifiers/artwork references remain in the database. Schema 14
  includes editable description templates and explicit historical Journal export
  with matching, progress and protected delivery/job receipts.
- Implemented: Journal's saved month-calendar option, local-start-date grouping,
  overlapping authenticated covers and compact movie/viewing details. Month
  reads are bounded and use exact Library links, independently of provider
  access. Next: an HA dashboard card using this local approach, with its own
  scoped read/refresh lifecycle and operator layout review.
- Implemented: dedicated-calendar Full Sync with 1–12 month scope, daily
  schedule, prompt Journal-change reconciliation, stable UID links, delayed
  orphan cleanup, read-back and exact pending-set administrator recovery. Live
  provider and browser validation remain operator work; keep uncertainty
  barriers and age bounds when extending this feature.
- Explore optional Gmail integration for publishing when movies were watched.
  Determine the intended workflow, authorization, and sharing details during
  design.

The standalone calendar card and Gmail remain follow-up tasks. Publishing uses
the configured HA calendar provider; no direct Gmail connector exists.

The development/runtime organization pass is implemented: root `dev/` tools,
feature packages in `core/`, `library/`, `playback/` and `ui/`, frontend feature
folders, and isolated frontend development tooling. Extend those boundaries with
future features, preserving runtime-only packages and the security checks.

## Later expansion and release gates

Automatic retention, import extensions, selective household sharing, additional
sources, ratings, and richer statistics remain separate follow-ups. Current
notes, manual entries, explicit permanent purge, and compatible viewing/Library
JSON/SQLite merge imports already exist. Any import/retention extension must
account for sessions, request deduplication, audit references, backups, and
privacy limits. Individual viewer profiles are outside the current
shared-household design.

Before publication: choose the license and real repository/documentation
ownership, establish a private reporting channel and supported HA matrix,
resolve the
[dependency release blocker](security.md#known-dependency-findings-2026-10-25),
review runtime package contents, and complete the acceptance checks above.
Private SSH deployment supports development; HACS metadata alone is not a
distribution release.

### Display and purchase metadata follow-up

Implemented native landing-page defaults and URL main-tab restoration. Schema 11
moves [UI preferences](ui-preferences.md) into the database: personal view,
count, applied filters/search, sort and sizing save immediately; hidden
collection lists stay shared and administrator-managed. The Library offers
25/100/1000/All pages, status flags and explicit format chips. Dialog backdrop
dismissal remains guarded. Schema 9 folds purchase dates onto title versions and
consolidates import audit. Schema 16 renames `library_titles` to `library`,
embeds repeat invoice history and private purchase summary columns on its owner,
and removes the separate purchase table. Purchase imports require a scanned
match, with a manual picker for ambiguity; only administrators receive
prices/orders. JSON format 5 preserves the embedded history and reads legacy
formats. The one-time HTML preparation helper remains in `dev/`; live
[reviewed merge imports](imports.md) use exact IDs, selectable new/missing-data
changes and preserved conflicts. See [purchase dates](purchase-dates.md).
Add-only collection membership is implemented with a separate opt-in, exact
version selection, read-back confirmation and schema 8 durable receipts. Removal
remains pending operator investigation. Live add validation is still an operator
step; the copied journal does not prove a vendor protocol.

### Library entity summaries

Implemented seven native HA sensors for unique source-group totals,
watched/unwatched counts, database/artwork sizes, catalog timestamp and bounded
recent additions. Schema 10 keeps the latest non-empty discovery batch with
source sync state, without another table. First catalog is a baseline; unchanged
scans and new formats do not replace the batch. Full catalogs use the existing
paginated Library API; a native Media Browser or dedicated catalog dashboard can
be evaluated separately without a full-catalog sensor attribute.

## External metadata and wall-panel controls

Store/TMDB enrichment, power-aware Library launch, shared Now Playing artwork
and a portrait Remote dialog are implemented. Providers remain opt-in with
conservative title/year matching; live TMDB credential and operator layout tests
remain acceptance work. Future enrichment providers should reuse `scrapers/` and
the existing guarded worker cache rather than adding a second catalog.

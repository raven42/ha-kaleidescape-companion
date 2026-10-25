# Kaleidescape Companion

Status: Journal database, authenticated API, automatic tracking, and basic administrator management UI implemented; broader journal/Now Playing UI remains planned.
Updated: 2026-10-25

## Goal

Automatically maintain a household-wide journal of movies watched on Kaleidescape, including partial viewings and rewatches. Present the journal within Home Assistant and make the solution portable enough to share with other users. The preferred direction is to run everything on the Home Assistant host, without a NAS dependency.

## Proposed architecture

Build a custom Home Assistant integration with a responsive library, now-playing, and journal panel backed by persistent local storage.

- Monitor the existing Kaleidescape integration's entities rather than opening a second player connection initially.
- Own the viewing-session logic and durable journal records.
- Provide a Kaleidescape Companion sidebar panel for library browsing, playback, current player information, and journal history.
- Expose summary sensors and actions for dashboards and automations.
- Distribute as a custom integration, potentially through HACS. HACS packaging and eligibility remain to be confirmed.

```text
Existing Kaleidescape integration
             |
             v
Kaleidescape Companion custom integration
  - playback/session tracker
  - persistent viewing database
  - authenticated journal interface
  - summary sensors and correction actions
             |
             v
Home Assistant Kaleidescape Companion panel
```

A custom integration runs within Home Assistant Core. The `/data` convention belongs to separately hosted Home Assistant apps/add-ons, not custom integrations. If SQLite is selected, use an integration-owned database under Home Assistant's configuration directory, resolved through HA's configuration-path APIs. Do not add tables to Recorder or depend on its internal schema.

Home Assistant's versioned `Store` helper is an alternative for a modest collection of JSON records. SQLite is the proposed journal storage because it supports queries, corrections, and growing viewing history. Confirm this choice during technical design; implement database access outside the HA event loop, schema migrations, and consistent backup/restore behavior.

## Confirmed source entities

| Entity | Purpose |
| --- | --- |
| `media_player.theater_kaleidescape_theater` | Title, content ID, duration, artwork, and player state |
| `sensor.theater_kaleidescape_theater_play_status` | Playback activity |
| `sensor.theater_kaleidescape_theater_media_location` | Main-content, credits, and stopped signals |

The user supplied the following player snapshot:

- Friendly name: Kaleidescape Theater
- Platform: `kaleidescape`
- State: `paused`
- Title: `Turtle Odyssey`
- Content ID: `26-0.0-S_c446c8e2`
- Duration: 2,464 seconds (41 minutes, 4 seconds)
- Content type: `stream`
- Artwork: Home Assistant media-player proxy URL

Do not require `media_content_type: movie`: the observed movie is labeled `stream`. Treat the content ID as a candidate movie identifier; verify stability across editions and devices. Do not persist temporary artwork proxy credentials as permanent artwork URLs.

The existing theater-lighting automation uses these values:

| Sensor | Value | Meaning used by the automation |
| --- | --- | --- |
| Play status | `playing` | Playing |
| Play status | `paused` | Paused |
| Media location | `content` | Main content |
| Media location | `credits` | Credits |
| Media location | `none` | Stopped/outside content |

Keep journal tracking separate from the existing lighting automation. Its ten-second credits lighting delay is not a requirement for journal completion.

## Viewing-session behavior

1. Start or resume a session when play status is `playing`, media location is `content`, and usable movie identity is available.
2. React to changes in either sensor and the player's identity attributes. Updates may arrive in different orders; reconcile the combined state rather than assuming a fixed order.
3. Accumulate viewing time only while playing main content. Pauses retain the session without adding viewing time.
4. Mark a viewing completed on credits after meaningful playback. A five-minute minimum is a proposal, not an agreed final threshold.
5. Repeated credits events must not create duplicate viewings.
6. Location `none` or a title/content-ID change ends the current playback session. Preserve the viewing as completed or partial, and retain cached metadata if the player clears its attributes.
7. Reconnect a later resume to an unfinished viewing according to a configurable or documented merge rule. A new watch after completion should create a separate viewing.
8. Persist active-session checkpoints. On HA restart, reconcile with current playback without counting downtime as watched time or inventing missing events.
9. Handle `unknown`, `unavailable`, missing metadata, and brief transition states explicitly; do not immediately interpret them as a completed viewing or definitive stop.
10. Allow manual correction, deletion, and marking a viewing watched or partial.

Credits plus accumulated playing time is evidence of a viewing, not proof that all unique footage was watched. Playback position was not present in the supplied snapshot. Investigate whether it can be obtained before promising seek-aware progress tracking.

## Proposed data model

Separate movie identity from individual viewings and, where needed, individual playback segments.

- Movie: source/content ID, title, duration, optional enriched metadata and artwork reference.
- Viewing: stable journal ID, movie reference, first-started and last-played timestamps, completion timestamp, watched seconds, credits-reached flag, partial/completed status, optional household rating and notes.
- Active session: source entity, current identity, playback/location state, accumulated time, checkpoint timestamp, associated viewing ID.
- Optional playback segments/events: sufficient evidence for debugging or reconstruction, with an explicit retention policy.

Use timezone-aware timestamps, preferably stored in UTC and displayed in the user's local timezone. Define deduplication and database schema versions from the outset. The journal is household-wide; individual viewer profiles are out of scope.

## Journal interface

Initial scope:

- Current viewing and playback status.
- Recently watched and partial viewings.
- Search by movie title.
- Movie details with viewing dates and rewatch history.
- Manual corrections and deletion of accidental records.
- Export of journal records for portability and backup.

Potential later features:

- Poster grid and locally managed artwork cache.
- Household ratings and notes.
- Yearly movie counts, viewing hours, and rewatch counts.
- Manual entries for movies watched elsewhere.
- External metadata enrichment and historical imports.

Summary sensors could include last movie watched, current viewing, and movies watched this year. Keep the full journal in dedicated storage rather than a growing sensor attribute.

## Portability and installation

Provide a UI setup flow that selects the media player, play-status sensor, and media-location sensor. Avoid hard-coded theater entity IDs in the implementation. Initially target the Kaleidescape integration's observed state vocabulary; support other media systems only through explicit future design.

Document installation, entity selection, persistence, backup/restore, export/import, upgrades, and removal behavior. Preserve data across integration updates. Decide explicitly whether removing a configuration entry retains or deletes the journal.

Custom integrations can serve users on HA OS or HA Container. A separate app/add-on is an alternative if an independent web application becomes preferable, but would be a different distribution and deployment design.

## Kaleidescape API findings

Kaleidescape publishes a local, text-based System Control Protocol over TCP/IP, using port 10000. It includes commands, responses, unsolicited events, component queries, content details, and playback information. Home Assistant's existing integration uses `pykaleidescape`.

Kaleidescape internally tracks relevant activity: its documentation describes watched-movie offloading, and its privacy policy describes operating history including movies played. However, investigation did not identify a documented public command or endpoint for querying watched flags, watch counts, last-watched dates, or historical viewing sessions.

This is a documentation finding, not proof that no internal or partner interface exists. Do not promise historical import. A watched flag alone would not reconstruct dates or rewatches.

Local browser inspection confirmed Played and New collection membership (see findings below). Import those labels separately from journal completion. Evaluate firmware compatibility and authentication before relying on browser endpoints.

## Alternatives considered

- NAS-hosted journal subscribing through HA's WebSocket API: viable, but the current preference removes the NAS dependency.
- Native automation pushing events to a journal: shareable, but requires delivery/retry handling and splits logic across systems.
- Blueprint appending JSON Lines through the File integration: viable for a standalone recorder, but requires file/directory setup, retrieval, deduplication, and retention management.
- Recorder history: useful for short-term inspection or recovery, but ordinary raw history is purged by default and numeric long-term statistics do not preserve movie records.
- Custom integration with `Store`: a simpler persistence option if expected scale and access patterns do not warrant SQLite.

## Open decisions and validation

- Inspect full sensor states/attributes during playing, paused, credits, and stopped transitions.
- Determine whether playback position is available and whether content IDs are stable.
- Finalize SQLite versus `Store`, database location, and backup consistency.
- Choose the minimum playback threshold before credits counts as watched.
- Define resume-merging rules and treatment of credits entered while paused or after seeking.
- Confirm panel implementation, authentication, and supported HA versions.
- Evaluate local exports or vendor-supported access to existing watched data.
- Define artwork sourcing/caching and whether enrichment requires external services.
- Validate restart recovery, duplicate suppression, metadata-update ordering, title changes, and manual corrections.

## References

- [Kaleidescape integration](https://www.home-assistant.io/integrations/kaleidescape/)
- [Kaleidescape System Control Protocol](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
- [pykaleidescape](https://github.com/SteveEasley/pykaleidescape)
- [Kaleidescape browser interface](https://www.kaleidescape.com/support/article/Accessing-the-Browser-Interface)
- [Strato M FAQ](https://www.kaleidescape.com/support/article/Strato-M-FAQ)
- [Kaleidescape privacy policy](https://www.kaleidescape.com/legal/privacy-policy/)
- [Home Assistant storage helper](https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/storage.py)
- [Custom panels](https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/)
- [Recorder](https://www.home-assistant.io/integrations/recorder/)
- [Home Assistant app persistence](https://contributors.home-assistant.io/apps/how-apps-work/)

## Local library inspection findings (2026-10-20)

Read-only inspection of the actual local browser interface confirmed that a library browser and initial played-status import are feasible without a documented REST API.

- `/movies` reports 845 library entries in the inspected snapshot. Rows expose movie handles, selection-group identifiers, title, genre, parental rating, director, release year, and quality/version. Preserve title grouping separately from version handles; some movies have multiple downloaded qualities.
- `/movies?collection=Played&sort=2` reports 24 entries. All three Hobbit titles appear in this collection.
- `/movies?collection=New&sort=2` exposes the New collection. Additional collection links include Paused, Favorites, and Watch Soon.
- `/details?id=0-S_c41b6bf1&callback=true` identifies The Hobbit: An Unexpected Journey as belonging to Played. It also exposes cover-art paths (normal and larger), synopsis, genres, director, and available versions. Its selection group is `172020140`; versions include handles `0-S_c41b6bf1`, `0-S_c445a231`, and `0-S_c4609063`.
- `/KaleidescapeMovies.csv` exports Title, Genre, Rating, Lead Actor, Director, Year, Type, and Duration (mins). The inspected CSV header does not include content IDs or played status, so HTML parsing is needed for identity and collection membership.
- Played and New are editable collection memberships in the browser interface. Import them as source-reported labels, not verified full-watch completion, viewing dates, or watch counts. No historical dates or rewatch counts were observed in the inspected title details.
- The browser response restricts framing to itself and Kaleidescape domains. Build our own library UI using backend-fetched metadata rather than relying on an embedded vendor page.

Proposed extension: add a read-only, optional library synchronization component to the custom integration. Fetch the main list and collection lists periodically or on manual refresh; cache records locally and fetch details lazily or in throttled batches. Keep source collection status separate from journal-derived completion. Existing Played titles can show “Previously played — date unknown” without inventing viewing sessions. Validate how playback IDs map to browser version handles before joining records; do not assume prefix stripping is universally safe. Treat these HTML routes as firmware-dependent browser interfaces, isolate parsing, and tolerate changes or temporary outages. No collection edits, playback commands, or other device changes were performed during inspection.

## Expanded product scope (2026-10-22)

The household journal is the primary product and first usable release. Library browsing, metadata enrichment, and playback controls extend it in later phases. Journal recording and browsing must work without a library import or verified playback commands. The framework is scaffolded; feature implementation remains planned.

### Packaging and component boundaries

Prefer one custom integration containing the backend and a custom Home Assistant panel, with no required NAS or separate app/add-on. Use the existing Kaleidescape integration for live entity state and supported controls. Consider a documented direct protocol adapter only for capabilities unavailable through existing HA actions; avoid maintaining duplicate player connections without a demonstrated need.

Separate the implementation into:

- Library synchronization: retrieves server-side lists, collection membership, metadata, and artwork references.
- Library repository: indexed SQLite catalog, versions, source collections, and synchronization state.
- Playback adapter: capability detection, player selection, validated commands, and command-result reconciliation.
- Live playback coordinator: receives player updates independently of library refreshes.
- Journal tracker: maintains household viewing sessions using the existing rules.
- Authenticated API: paginated catalog queries, detail retrieval, live subscriptions, and explicit playback/correction actions.
- Panel: Journal (default), Now Playing, and Library views with shared navigation and a compact playback bar.

```text
Local server browser pages -> Library sync -> SQLite catalog
                                                |
Existing HA entities -> Live coordinator -> Journal tracker
                                                |
HA actions / documented protocol <- Playback adapter
                                                |
                               Authenticated API + HA panel
```

### Now Playing

Provide live title, artwork, duration, playing/paused status, content/credits location, and target-player identity. For multiple configured players, maintain independent live states and sessions; the viewing journal remains shared by the household.

Display progress and remaining time only if reliable playback-position data becomes available. Hide unsupported controls and clearly show unavailable players. A compact mobile playback bar should offer navigation to full controls without obstructing library browsing. Current playback should remain useful even if the movie has not yet been imported into the catalog.

### Library browser

Provide a responsive poster grid and compact list, with desktop and mobile layouts. A title card opens details containing synopsis, cast, director, runtime, rating, genres, versions, collection memberships, journal history, and supported playback actions.

Search titles, cast, and directors. Filter by genre, year/range, parental rating, quality/format, source collection, and journal viewing status. Keep source Played/New distinct from journal completed/partial; absence of journal history does not prove a movie has never been watched.

Sort by title, release year, runtime, and journal last-watched date. Only offer recently added if a trustworthy source timestamp is found. Otherwise expose a clearly labeled first-discovered date, which initially reflects import time rather than purchase or download date. Missing metadata must remain searchable by known fields and sort consistently.

Represent a movie/title separately from source versions, using selection groups and version handles as evidence. Verify edition relationships before merging; do not combine theatrical and extended editions merely because their titles resemble each other. Track which source system owns each identifier. Keep unavailable or removed titles in journal history even when they leave the current library.

### Responsiveness and synchronization

The database is the panel's immediate read source. Opening Library must not trigger a full crawl or wait for the server. Use indexed queries, bounded result pages, debounced searches, lazy image loading, and incremental rendering or virtualization for large result sets.

- Import basic rows and collection lists first, then enrich details in throttled batches or on demand.
- Serve cached details immediately and refresh stale details asynchronously.
- Cache artwork with bounded storage, invalidation, and size-appropriate delivery.
- Provide initial-sync progress, last successful sync, background-sync status, manual refresh, and understandable errors.
- Bound HTTP concurrency, use timeouts and retry backoff, and isolate firmware-dependent HTML parsing.
- Reconcile deletions only after a successful complete listing; do not empty the catalog on an error or incomplete response.
- Preserve journal data and local corrections when source metadata changes.
- Keep playback updates and journal recording independent of slow metadata requests.

Provisional performance goals, to measure on the actual HA host: cached first-page results within one second, warm search/filter responses around 300 ms, and live state reflected within roughly one second of HA delivering an update. These are design targets, not measured guarantees; artwork can load progressively. Validate against the observed 845-entry library and a larger synthetic catalog on desktop and mobile.

### Playback actions and capability validation

Allow selection of a target player and, where meaningful, an available version/edition. The backend validates the selected player, source identity, and capabilities before sending a command. Display pending state, success confirmed by player updates, or an actionable failure; prevent accidental duplicate submissions.

Investigate and distinguish:

| Action | Validation required |
| --- | --- |
| Play selected movie | Existing HA action support and mapping from browser handles to playable IDs |
| Resume saved movie | Supported command and access to the player's actual saved resume point |
| Start from beginning | Explicit protocol semantics distinct from default play/resume behavior |
| Select version | Edition/format identity, availability, and target-player compatibility |
| Pause/resume current playback | Supported media-player capabilities and resulting state updates |
| Stop | Supported action and resulting journal/session transition |

Do not label a generic play command Resume until saved-position semantics are verified. Accumulated journal viewing time is not a valid seek position. If starting another title would interrupt active playback, make the selected target and interruption clear and request confirmation in that flow. Playback controls are user initiated; library synchronization must never start content or edit collections.

No test playback is authorized merely by this planning document. Capability discovery should remain read-only until the user authorizes a playback test or implementation requiring one.

### Extended data and installation model

Extend the earlier journal model with:

- Source system: configured server/base address, identity, firmware information when available, and sync timestamps/errors.
- Catalog movie and version: source handles, selection group, edition relationships, searchable metadata, formats, availability, and first-discovered timestamps.
- Source collections: current memberships and last observation, separate from household journal status.
- Player configuration: mappings to HA entities and verified capabilities.
- Artwork cache: source reference, local cache key, freshness, and bounded retention.

SQLite becomes the preferred shared catalog/journal store for the broader scope; reserve HA Store for small configuration or runtime values if needed. Finalize the database layout and migrations before implementation. Use HA authentication for panel queries and actions; do not expose the catalog or controls through unauthenticated static files. Keep raw source addresses and temporary credentials out of exported diagnostics where appropriate.

Initial setup selects player/entity mappings and starts journal tracking. Later, optional library setup accepts a server address, validates connectivity, and starts background catalog import. Expose options for sync cadence, artwork limits, and journal rules without hard-coding the current theater names.

### Delivery phases — journal first

1. Foundations: confirm playback/credits transitions, movie identity, restart behavior, persistence, authenticated panel access, database migrations, and backup/restore. Position reporting is optional; library parsing and playback-command research must not block the journal.
2. Watch journal and read-only Now Playing — first usable release: automatic session recording, pause/resume handling, credits completion, partial viewings, rewatches, a journal-first sidebar panel, title search, viewing details, manual corrections, and export. Include a read-only Now Playing view with title, artwork, duration, playback state, content/credits status, and player identity from existing entities. Show progress only if reliable position is available. This view ships before the library browser and requires no catalog import. Validate duplicate suppression, restart recovery, and metadata-update ordering.
3. Library browser and enrichment: add optional server configuration, catalog and collection synchronization, separate Played/New labels, cached artwork, edition/version mapping, poster/list browsing, search/filter/sort, and sync status. Enrich existing journal entries without changing their recorded viewing facts.
4. Playback and controls: validate saved-resume semantics and playable identifiers, then add player/version selection and supported play/resume/start-over and transport controls. Confirm results through live updates and handle unavailable players and failed commands.
5. Polish and distribution: complete sharing documentation, HACS distribution assessment, accessibility review, diagnostics, and larger-library performance verification. Baseline reliability, migrations, and backups are requirements from the first journal release, not deferred to this phase.

Each phase must be useful without later phases. Journal opens by default; navigation follows Journal, Now Playing, then Library. Library sync and controls remain optional enhancements, and their failures must not interrupt collection or access to existing history.

Validation expands with each phase: journal correctness first, followed by parser fixtures, identity/version mapping, non-destructive synchronization, browsing performance, and control-result handling. Avoid tests tied to incidental implementation details.

## Technical design

The research-backed [technical design document](design.md), dated 2026-10-22, specifies component boundaries, observed and source-verified interfaces, storage, journal rules, authenticated panel APIs, library sync, and acceptance gates in the agreed phase order. It distinguishes supported active playback controls from unresolved movie-by-handle launch and selected-title resume.

## Project identity and scaffold

The project is named **Kaleidescape Companion**. This document is `docs/plan.md`; the technical design is `docs/design.md`. The internal integration domain is `kaleidescape_companion` because the built-in **Kaleidescape** integration (`kaleidescape`) must remain available as our playback source.

The initial manual journal backend now provides SQLite storage, authenticated queries/mutations, and exports. See the [backend guide](backend.md), [framework status](framework.md), and [development guide](development.md). One-player observation/session rules and read-only Now Playing are now implemented. The administrator [management UI](ui.md) is registered in HA and shared with the local Vite preview. Broader product UI, library, and playback controls remain planned in the agreed order.

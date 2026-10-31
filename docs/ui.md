# Household journal and management UI

Existing Journal entries can recover missing cached movie details through
**Settings → Journal Library metadata → Repair Journal Library metadata**. The
compact confirmation previews updated/unchanged/unmatched/active counts and
fills only missing fields. Open sessions are skipped; existing calendar events
are untouched. Save native settings and sync Library details first. See
[metadata repair](calendar.md#repair-existing-journal-metadata) for identity
rules, retry behavior and limits.

Both Journal roles use a single shared surface: toolbar/search/sort above a
selectable entry list and readable details pane. On narrow screens the details
stack beneath the list. Administrator Add/Edit opens a separate dialog with
consistent header-close/footer-save actions, guarded dismissal and retry
handling; Journal Delete has its own confirmation and retains stored history.
Regular users see only the household-safe summary fields and have no
edit/session controls. Administrator database size, recording/backup status and
schema/revision appear in a compact footer instead of separate overview cards.

Journal rows show the linked title, local calendar date and status on one
compact line. Select a row for full times, watched/runtime values and other
permitted details. Both Journal modes and Database use sticky header/search
controls, independently scrollable lists and details, and a sticky
status/pagination footer. Narrow screens stack the scroll areas without putting
the whole list above the selected details.

The household reader lets active users browse viewing summaries. The
administrator UI manages journal records through the existing HA API. It
provides title search, status filters, 25-record pages, manual entries,
corrections, confirmed deletion, session evidence, database health, and private
JSON/SQLite downloads. Administrators can open Settings and a Database view for
raw table inspection, supported-field corrections, permanent selected-entry
deletion, and compatible JSON/SQLite import/export. A compact administrator Now
Playing card adds live source/session context. The opt-in [Library](library.md)
provides shared cached browsing with a resizable cover grid, sortable list, and
filter/title-detail popups. **Clear Filter** resets the search and all facet
selections without changing the view, sort, or page size. Source-group editions
share a row/cover; same-name remakes stay separate, with simple Version
1/Version 2 tabs when multiple versions exist. A single version omits the tab
row. List widths stay fixed across sorts and can be resized by dragging dividers
or using Left/Right/Home on a focused divider. Entries per page offers 25, 100
(initial), 1000 and All. Personal browsing preferences save immediately in the
database through **Options**. The popup groups view, count, cover size, title
overlay, format/library badge switches and fuzzy search. Sort/order remains in
the main Library toolbar. Covers show an exclusive top-left Watched/In progress/
New marker and an independent top-right Favorite bookmark, plus only the highest
known video format. Lists retain all explicit format chips and summary badges.
Cover pages round the target to complete rows for the measured grid, adapting to
window and cover-size changes. The final page can contain fewer titles. Large
pages use compact summaries and visible-only artwork fetching, retaining
completed covers in a private bounded Library-session cache; full metadata loads
when opening a title. Settings can hide collection names without hiding movies
or editing the device. Collection additions have a separate opt-in
[contract](library-collections.md). [Player controls](playback-controls.md) and
experimental Library launch are separately opted in; progress remains later
work.

## Open in Home Assistant

Build the frontend with `npm --prefix frontend run build`, restart HA, and add
the Kaleidescape Companion integration if it is not already configured. Open
**Kaleidescape Companion** in the sidebar, or visit `/kaleidescape-companion` on
that HA instance. The panel uses the existing signed-in HA connection. Active
regular users see a read-only household Journal with title search, status
filters, pagination, and viewing times, plus the Library tab when enabled.
Administrators retain the management UI, settings, Database view, notes/session
details, health, and exports. No extra token is needed. Rebuild after frontend
edits, reload the integration to refresh the asset URL, and reload the browser
page to load the new component.

Existing entries with the old default title **Kaleidescape** are renamed to
**Kaleidescape Companion** on startup or reload. Custom entry titles are
preserved.

Only the compiled JavaScript file is registered as a static resource. The
storage directory is never served statically. Unloading the integration removes
its panel; the journal database is retained.

## Open in Vite during development

Run the two servers in separate terminals:

```sh
bash dev/dev.sh ha
bash dev/dev.sh preview
```

1. Complete onboarding at `http://127.0.0.1:8123` using an isolated development
   account and add Kaleidescape Companion.
2. Create a long-lived access token in that development user's HA profile.
3. Open `http://127.0.0.1:5173` and enter the token in **Development access
   token**.
4. Choose **Connect**. The input clears and the journal opens with the account’s
   reader or administrator permissions.
5. Choose **Disconnect** when finished. Revoke the development token in HA when
   it is no longer needed; disconnecting the UI does not revoke it at the
   server.

Use a regular development account to review the household reader and an
administrator account to review editing, observational Now Playing and exports.
All active users can use the separately enabled household playback controls.
Regular-user API responses contain only titles, times, runtime, watched time,
status, origin, and record IDs; notes, source IDs, and session evidence remain
administrator-only. All accounts see the same household journal, rather than
separate personal watch histories.

The preview connects only to `http://127.0.0.1:8123`. The token is held in
memory, never saved to browser storage, environment variables, source, or URLs.
Reloading requires entering it again. The development token UI and its
connection adapter are excluded from the distributed panel bundle. Use
development credentials only; HA tokens carry the user's wider HA authority, not
just journal access.

WebSocket calls go directly to local HA. A Vite proxy allows the explicit
journal export and query-free media-player artwork GETs, plus the scoped import
POST with fixed format/request/revision query keys, at a fixed local target. It
preserves the browser's bearer header and injects no credentials. Its
origin/Fetch Metadata checks accept the normal development origins on port 5173.
Changing ports/targets requires a reviewed development configuration change. No
wildcard CORS or HA HTTP configuration exception is needed.

For a disconnected layout review, open `http://127.0.0.1:5173/review.html` while
Vite runs. That page is explicitly labeled and uses fictional, in-memory
records. It never connects to HA or writes a database, and is not included in
the packaged panel. Its changes disappear when the page reloads.

## Now Playing

All active HA users see a larger **Now Playing** display with authenticated HA
cover artwork. Source entity read permissions still apply. Configure the
observer or a control default player with a matching built-in HA entity. Regular
users receive display metadata; administrators additionally see session and
recording context.

**Configure → Minimum runtime to record (minutes; 0 disables)** defaults to 10.
Shorter playback is visible in Now Playing but is not added to the automatic
journal; the card explains when it is below the cutoff or waiting for a known
runtime. Exactly the configured minimum qualifies. Set 0 to allow any runtime,
including missing runtime. Existing history and manual entries are preserved.
This is separate from the watched-time threshold for credits completion; see
[automatic tracking](backend.md#automatic-tracking).

The card displays the player, current title, runtime, exact playback and
location states (including scan, credits, intermission, and menus), counted
session time, credits confirmation, timing gaps, and recording/buffering health.
It handles tracking disabled, stopped/unavailable players, and connection
failures. Counted time excludes pauses/scans; it is not a seek position or
percentage watched. Credits confirmation alone does not establish journal
completion: the configured minimum watching threshold also applies. Manual
completion corrections remain visible in the journal, not inferred from this
session indicator.

Snapshots refresh about every five seconds after each request finishes while the
card/page is visible. **Refresh playback** requests an immediate snapshot and
retries artwork. Hiding the page or disconnecting clears the card, aborts image
requests, and ignores late replies; returning fetches a fresh snapshot. An
access denial clears it and pauses automatic retries until an explicit refresh,
page return, or rebind. Journal search/editor state is independent and still
refreshes explicitly.

Current cover art comes from HA's media-player image route using authenticated
fetch, without copying token-bearing picture URLs. JPEG/PNG/WebP downloads have
a five-second budget and a 5 MiB browser limit; absent, unsupported, or failed
artwork shows a placeholder. No library sync, extra server, or persistent
artwork cache is needed. HA controls upstream retrieval; it is not a Companion
cache. This observational card has no seek/progress bar. A separate household
**Player controls** card uses the opted-in API adapter; HA's existing media
controls remain available independently.

For browser review, open the sidebar as an administrator (or the fictional
`/review.html` Vite fixture), check desktop/narrow layout and safe title text,
then verify configured playback/artwork, pause/scan/credits states, tab
hide/return, disconnect, and missing artwork on an isolated HA instance. Confirm
regular users still see only the journal. Operator review is pending; automated
tests use a simulated DOM and mocked artwork, never household devices.

## Editing and recovery

Select a title to load its latest revision and session evidence. Times are shown
and edited in the browser's local timezone to whole seconds; the API retains UTC
timestamps at their original precision. Runtime and watched time display in
minutes with two decimal places. Unchanged form fields retain their full stored
precision; explicit corrections use the entered values. Watched time does not
represent a seek position. Source identifiers remain exact strings and are under
a disclosure.

The form adapts to the editor pane's own width: narrow panes stack fields even
when the journal and editor cards remain side by side. Inputs stay within their
card, including native date/time controls. For layout review, select **The
Lantern Voyage** in the fictional Vite review page and resize the window across
side-by-side and stacked layouts; check both date fields, notes, source
identifiers, and action buttons. Simulated-DOM tests do not measure layout;
operator browser verification remains required.

For observed viewings, only fields whose form values change are sent as
corrections. Saving notes does not lock the title, timestamps, watched time, or
completion status against future automatic updates. Session evidence is
read-only.

If another browser or the recorder updates the record, the optimistic revision
check rejects the save. The draft stays visible. Use **Reload entry** to discard
that draft, retrieve the current record, and review changes before editing
again. There is no force-overwrite action.

An interrupted or timed-out save may have committed. **Retry same change** keeps
the original UUID, exact payload, and expected revision; the form stays locked
until its result is known or you explicitly choose **Discard retry & inspect
journal**. This also applies when HA unloads after a commit or an unexpected
server/storage error leaves the outcome uncertain. Writes are not automatically
replayed after reconnect. If you reload/disconnect instead, the in-memory retry
is lost: inspect the journal before recreating a manual entry. Connection/user
changes invalidate old replies, clear private form/list state, and abort
outstanding downloads.

**Delete entry** requires explicit confirmation and creates a tombstone. It does
not permanently erase history, session evidence, retry responses, or backups.
Mutation request IDs use native cryptographic UUIDs, with a `getRandomValues`
fallback when `randomUUID` is unavailable (for example, on an HTTP LAN origin).
If neither secure random API is available, an error says no change was sent; the
entry/confirmation stays available rather than silently failing. This also
applies to saving, without reporting a misleading date/number error. See the
[browser API restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

Exports include private retained data; SQLite exports also contain audit
metadata. The browser bounds each download to 256 MiB and revokes temporary
object URLs; large downloads can still use substantial browser memory. Follow
the [security and retention policy](security.md).

## Settings and Database

The top-level tabs are **Now Playing | Library | Journal | Database |
Settings**. Journal remains the default. Arrow keys, Home, and End move between
tabs; the bar scrolls horizontally on narrow screens. Library stays visibly
disabled until opted in through Settings. Enabled Library metadata/artwork and
public freshness/counts are shared with active regular users through
Library/Journal tabs. Settings, manual sync, and detailed sync/storage status
remain administrator-only; see the [Library guide](library.md). Only the
selected page is mounted, so leaving Now Playing stops its polling. Regular
users retain the existing read-only journal without administrator tabs.

**Journal** has the **Add viewing** action. **Settings** displays the recording
configuration inline, using the integration's existing Configure options and the
same HA options flow, validation, and automatic reload. A separate shared UI
section saves hidden collection names directly to SQLite without a reload. The
landing-page default remains in the native form. Source fields accept HA entity
IDs. **Cancel changes** discards the form and reloads saved values without
saving. Switching tabs asks before discarding unsaved journal, database, or
settings changes. Writes and exact pending retries block navigation where
appropriate. A settings save with an unconfirmed response requires explicit
confirmation before leaving or reloading; inspect saved values before another
change.

**Database** has a toolbar, main/system table tabs, schema-aware search, an
entry list and raw details. Selecting a row always shows raw stored values;
**Edit entry** opens a separate dialog with supported fields and an explicit
save confirmation. IDs/links, dataset metadata, managed paths, audit and receipt
invariants remain protected. Database **Delete entry** permanently deletes up to
100 selected supported records after typed DELETE confirmation; Journal Delete
remains a tombstone. Open playback records are protected. Targeted operations
can run while recording/sync are enabled but reject stale revisions and
snapshots rather than overwriting concurrent changes.

**Options** persists rows per page (10/25/100/500), system-table visibility,
selected table and per-table sort/order in the user's Database settings row. The
three main tables (viewings, sessions and Library) show initially; the toggle
exposes all eighteen. Collections, artwork and sources are system tables. The
query balloon suggests trusted fields/operators. Enter searches; Tab accepts a
completion. Plain text remains literal search; conditions include
`purchased_on IS NULL`, `actors CONTAINS 'name'`, and `title LIKE 'Star%'`.
Syntax feedback includes positions and does not execute SQL. See the
[full Database contract and browser review](database.md).

Merge Import and Export remain on the Database toolbar, with reviewed
missing-data merges and guarded dialogs. Source files are never modified;
purchase preparation stays offline. See [imports](imports.md) and
[purchase dates](purchase-dates.md).

## Checks and limits

Run `bash dev/dev.sh check`. Frontend tests cover CRUD interactions, conflict
handling, retry UUIDs, unchanged-field preservation, escaped metadata, stale
responses, role changes, token cleanup, export limits, and proxy restrictions.
Vitest uses a simulated DOM; these checks do not replace visual, mobile,
accessibility, or real-browser/HA release testing. Python tests verify panel
registration, household visibility, asset scope, reload, and failure cleanup.

Journal lists refresh explicitly; only the small Now Playing snapshot refreshes
automatically. There are no live subscriptions or automatic journal-list polls.
The initial panel has not been validated across a supported HA release matrix.
The
[known upstream dependency finding](security.md#known-dependency-findings-2026-10-25)
still blocks a hardened public release.

## Display preferences and reloads

The native landing-page option and allowlisted `companion_page` URL parameter
control the selected main tab. Library browsing preferences save per HA user in
SQLite; shared hidden collection names save separately for administrators.
Changing these UI values does not reload the integration. See the
[complete UI preference and badge contract](ui-preferences.md), including
migration, All limits, failed-save retry, and concrete browser-review steps.

Native dialogs support backdrop-click dismissal through their Escape/cancel
guard. Accepted or uncertain content writes remain protected until resolved or
explicitly discarded. Purchase-history preparation is offline only; corrected
SQLite files use Database → Merge Import with review and selected approval. The
fictional fixture keeps mock preferences in memory, so test durable full-reload
restoration on isolated HA.

## Add to Collection

After enabling Library, collection sync, and **Allow Add to Collection on the
device** in Settings, administrators can open a title, select its exact version,
and choose **Add to Collection…**. The dialog loads offered existing targets on
explicit open; Add submits one version/one collection and verifies membership.
Readers receive no controls or mutation requests. Removal is deferred.

A lost response exposes **Check add result**, which sends no new add. Known
pending requests survive reload in a Library warning with **Check membership**
and explicit **Acknowledge unconfirmed add**. Inspect the device before
acknowledgment; this only retires the local uncertainty and permits a new
request. It does not undo anything or prove the previous add failed.
Accepted/unknown requests protect dialog and version navigation.
[The backend contract](library-collections.md) documents scope, receipts,
recovery and firmware limits.

For browser review, use the fictional Vite fixture with Library enabled, opt in
through Settings, open an individual title/version and inspect target choice,
submission, X/backdrop dismissal and narrow layouts. The fixture simulates
device behavior; real firmware add/read-back requires an isolated operator test.

## Manual viewings and calendar publishing

Journal's administrator Add viewing form requires selection of an exact
available cached Library version with known runtime. Free-text movie creation is
rejected by the backend. The autocomplete lists title/year/formats/runtime and
populates the selected version's data. Start uses a local date plus a text time
accepting `19:30`, `1930` or `7:30 PM`. Completed is the default; end time and
runtime are inferred. Partial reveals watched minutes and derives end from start
plus watched time. Storage retains its full timing precision; displayed time
omits milliseconds and minutes use at most two decimals. Existing viewing
corrections remain supported separately.

Journal sorting supports completion date and title in either direction. Partial
viewings stay first when sorting by completion date. Settings offers an
independent, off-by-default HA calendar publishing option with one selected
writable calendar, title/description templates and documented flat movie/session
placeholders. Automatic publishing applies to new completions. The explicit
Journal export has confirmation, duplicate-format warning, progress,
cancellation and uncertain-result handling. It matches rendered title/start/end
before creating historical events and never updates/deletes remote events.
Events contain only configured human-readable templates and times; there is no
appended Companion metadata. The Journal month view uses the local database and
Library artwork instead of parsing provider events; a dashboard card remains
planned. Provider sharing, boundaries, recovery and real-provider validation are
documented in [calendar procedures](calendar.md).

## Dialog actions and detail browsing

Settings has a sticky top action bar with adjacent Save/Cancel; native runtime
settings still save through HA. Options reloads retain the Companion sidebar
route and Settings tab; the saved form reopens when the runtime is ready.
Dialogs share consistent action footers with padding below buttons. Library
filter panes have padded headings and content. Database search/sort are aligned
together, with Options at the toolbar's far right. Database raw details remain
read-only until Edit opens a separate modal. Typing into a NULL field clears its
NULL selection; protected IDs/links/receipts remain unchanged. Existing artwork
routes provide cached previews when Library is enabled, and related-row links
switch table and select the exact target, including composite collection keys.
Missing/evicted data is reported without inventing it.

Movie details expose buttons for title/cast/director names, years, genres,
collections, watched status, formats and ratings. Names clear facets and replace
the main search across title/cast/directors. Other clicks clear search and
previous facets, applying only the chosen exact criterion. The popup closes to
page one while view/count/sort stay unchanged, and criteria save personally.
Genre/year/viewing-format filters include source labels and positive badge
categories. Format/rating badges stay above tabs and in version content; tabs
read only Version 1, Version 2 and so on. Single-version details use a labelled
region without a tab row. Dynamic numeric count labels use singular for one and
plural otherwise, including entry/entries.

## Search options

Journal and Library both offer **Options → Fuzzy search** to control one
personal search setting, saved in the `search` settings row. It governs searches
and completion across both views and manual title pickers, including Database.
It defaults enabled. Off uses literal case-insensitive partial strings; on also
tolerates bounded misspellings, transpositions, diacritics and word-order
differences. Selected facets and Database query syntax remain exact.

Modes save immediately without an HA reload, reset pagination and invalidate
older suggestions. Changing mode while a manual picker is open preserves its
text and reruns completion. Empty literal title completion offers no selection
until text is entered. Search reads are bounded and may require a more specific
query; see [backend limits](backend.md) and
[personal preferences](ui-preferences.md).

For browser review, run `bash dev/dev.sh preview` and open
`http://127.0.0.1:5173/review.html?library=1&companion_page=journal`. Review
Journal/Library options, live and restored search modes, exact/fuzzy title
completion, filter heading padding, sticky footer clearance and Database's
default/system tabs. Automated DOM tests do not verify browser geometry; this
operator review remains pending. Real-provider/device validation requires an
isolated operator test, not the fictional preview.

## Journal and Library navigation

**Journal → Options → Calendar view** switches to a saved personal month layout
with previous/next navigation. Local start dates place the posters; search and
status filters still apply. Same-day covers overlap with about 15% exposed,
bringing hovered/focused covers forward. Clicking opens compact movie and
viewing details in one popup, without purchase/detection fields. Options
provides a saved size slider and Fit month to screen. Detail names open fresh
Library searches; year, genre, rating and format links replace Library filters.
Turn Calendar view off to restore the split list/details layout. See
[calendar behavior and browser checks](calendar.md#journal-month-view).

Administrators can open **Edit viewing** from calendar details. Both Journal
layouts use the same basic editor and its **Delete entry** button, with normal
confirmation, revision checks and uncertain-write retry. Deletion marks the
viewing deleted and retains history; it does not use Database's permanent
deletion. The current calendar month refreshes after a confirmed save/delete.
Household readers see no editor or delete controls.

The list and calendar editors use **Movie from Library**, the same autocomplete
as Add viewing, with the global personal fuzzy-search choice. Typing clears the
selection; saving a changed title requires choosing a suggestion. Year and
format distinguish same-name movies/versions. Selection updates title, exact
Library link and metadata, preserving timing, runtime, watched minutes and raw
playback identity unless separately corrected. Unchanged historical titles can
remain while editing other facts; with Library disabled the movie field is
read-only. Add viewing still requires a selected version with known runtime;
editing can select a version whose runtime is missing because existing recorded
facts remain intact.

With Library enabled, Journal details show locally cached artwork and a **View
in Library** link for the saved exact version. Library title details provide
**View journal entries for this movie**, opening the Journal filtered by
source/group across all formats and rewatches. **Show all viewings** clears that
movie filter. These links work for administrators and household readers; readers
retain their existing read-only permissions.

Record navigation and movie filters remain in scoped component memory. Only the
existing main-tab parameter is written to the URL. Linked Library details open
independently of saved browsing filters, which remain unchanged. Missing,
deleted or unavailable Library entries show a graceful no-link message; disabled
Library access makes no link/artwork request. Missing artwork uses the existing
placeholder. No title-name search guesses the association.

## Device controls and movie details

Administrators use **Settings → Device discovery and controls** to enable the
feature, save the seed hostname, discover and select a default player, then save
again. Known choices are privately cached across reload/restart without network
access; source changes discard the cache. Experimental Library launch is a
separate opt-in. Neither target setting changes Journal tracking.

All active users now have **Now Playing | Library | Journal** tabs;
administrators also have Database and Settings. The household Now Playing view
contains cover artwork, safe playback context and player controls, without
private observation/session evidence. Commands, including Stop and power
changes, execute on their explicit click after automatic preflight, without a
confirmation dialog. Enabled control views read power/readiness on load; the
snapshot refreshes HA state while visible. Neither read sends a wake or playback
command. Anonymous/inactive users have no access.

Library movie details combine a large linked title, compact year/runtime/genre
summary, existing format/rating/status/favorite/recent badges and an action row.
**Play Movie** sends the selected version immediately. **Choose Player** opens a
friendly-name picker for this dialog/card, leaving the household default and
recorder unchanged. A poster and synopsis/linked credits form the body; narrow
layouts stack the poster above the details. Metadata links continue to replace
Library search/filters. Only multiple-version titles have version tabs.
Detection and purchase dates live in expandable **Library details**; private
purchase history and Collection device edits stay administrator-only.

Playback opt-ins remain off by default and exact playable edition remains
unverified. Public player choices contain opaque IDs and labels, never addresses
or serials. Device discovery/settings and uncertain-write acknowledgement stay
administrator-only. A lost response preserves the exact request/token behind
**Check command result**, retrieving the stored outcome without replay.
Uncertainty blocks that target for every user until administrator physical
inspection and acknowledgement; other players remain usable.

For browser review after deployment, open Library with a regular account and
check the combined dialog at desktop/narrow widths, version tabs, poster,
metadata links, Choose Player and absence of purchase/collection/admin controls.
Check Now Playing and the administrator discovery/settings layout separately.
Play Movie and remote controls send without a prompt, so choose live commands
only in your intended operator test window. Automated checks use fictional
players and do not verify browser layout or hardware behavior.

## Power-aware playback and remote

A single-player system hides **Choose Player** and the target label. Multiple
players offer an opaque per-view selection without changing tracking or the
shared default. Library actions first read documented power/readiness. **Power
On** sends one explicit wake; the action shows startup progress while read-only
checks wait for readiness. It never starts a movie automatically after waking.
After a timeout, **Check player** permits another status check. **Play Movie**
only becomes available when ready. Accepted play/resume/title-launch commands
navigate to Now Playing for that target; rejected/uncertain results do not.

Now Playing's **Remote** button opens a portrait dialog with power, Covers/Menu/
Back, a circular direction/select pad, chapter and transport buttons. Commands
have the existing exact-request recovery behavior, without ordinary confirmation
prompts. Single-version details omit the version count/bar; Library details sit
under the poster. External metadata and source credits appear in the existing
Library details experience; see [enrichment](enrichment.md).

## Modal presentation

All application dialogs use an accessible X button in the upper right. It runs
the same guarded dismissal path as Escape/backdrop: dirty drafts still need
discard review, and active or unresolved writes remain protected. Save, Apply,
Export and other commit actions sit in a right-aligned footer; automatically
saved Options dialogs have no empty footer. Remote uses the same surface and
border as other dialogs, without a Done box. Movie Play/Power On and Collection
buttons share a 44 px minimum height and have space below the action row.

Operator browser review: open a Library movie, Remote, filters, both Options
popups, viewing/database editors, imports/exports and calendar export. Check the
X placement, right-aligned commit actions, scrolling and tablet spacing. Verify
that closing a dirty draft requests discard review and that pending writes still
block dismissal. Automated DOM tests do not establish browser geometry.

Full Sync controls live in Settings beside calendar templates. They require a
separate-calendar acknowledgement, display a bold deletion warning, constrain
age to 1–12 months and offer a daily HA-local sweep time. Saved status provides
Run Full Sync now and guarded inspection recovery. Journal's shared edit dialog
moves end time by the start-time delta; end edits never move start.

## Administrator logs and settings transfer

The **Logs** tab provides subsystem/level filters, bounded paging, manual
refresh and text/JSON export with a privacy banner. Compact rows show readable
messages and file/line locations; **Details** expands labelled diagnostic
fields. **Options** contains the live logging level and explicit movie-metadata
value opt-in. Old records show **Not recorded** for missing source locations.
Text exports use readable messages; JSON keeps structured fields. Clear logs
hides rows through the displayed refresh; Include cleared logs reveals retained
rows. Capacity eviction still removes the oldest records. Drop/storage/sink
counters identify incomplete diagnostics.

**Settings → Export / import settings** opens category checkboxes for runtime
rules, personal browsing, shared hidden collections, logging, private
connections and custom templates. Credentials never transfer. Review selected
categories before applying; personal/shared/logging settings apply immediately
and runtime changes are staged in the native Settings form for Save settings and
validation. Imported Full Sync enablement requires a fresh dedicated-calendar
acknowledgement. Protect files containing private categories.

Operator browser review: check the Logs tab as an administrator, level/subsystem
filters, a DEBUG change, export downloads and Clear/Include cleared behavior;
verify a normal user cannot see the tab. Review settings category selection,
import review, native Save validation and narrow-screen dialog actions.
Automated component/API tests do not replace this browser review.

## Settings categories and linked diagnostics

Settings has five keyboard-accessible subtabs under the sticky Save/Cancel bar.
Switching subtabs preserves unsaved integration changes. Saving reveals the
subtab containing an invalid native form field before validation.

| Subtab         | Contents and scope                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Home Assistant | Playback source entities, calendar selection/templates and Full Sync status; shared integration configuration.          |
| Companion      | Journal recording rules, shared landing page, immediately saved hidden collections, settings transfer and reload tools. |
| Personal       | Global fuzzy search and guidance to per-view Options; saved immediately for the signed-in HA account.                   |
| Kaleidescape   | Library sync/cache, collection-write opt-in, device discovery and playback controls; shared backend configuration.      |
| Scrapers       | Separate opt-in providers, credentials, rate limits and enrichment controls; shared backend configuration.              |

Each section labels its scope and save behavior. Personal/shared database
preferences do not require Save settings or an integration reload. Settings
remains administrator-only; household users retain their own browsing Options.
Full Sync shows **Pending delete: N** and warns before a forced pass with
pending deletes or unconfirmed writes. This does not bypass the existing
safeguards.

In Logs, keyed user, viewing, event and originating-request aliases link layers.
Click an alias under **Details**, or paste it into **Linked resource /
request**, to follow related events. Export retains the active alias filter.

Operator browser review: check all five settings subtabs at desktop/tablet
widths, sticky actions, draft preservation, native validation navigation,
personal immediate saves, pending-delete status and cancelling/continuing the
pending-work warning. Review an edit's linked logs across subsystems. Automated
component tests do not replace this browser review.

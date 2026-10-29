# Household journal and management UI

The household reader lets active users browse viewing summaries. The
administrator UI manages journal records through the existing HA API. It
provides title search, status filters, 25-record pages, manual entries,
corrections, confirmed deletion, session evidence, database health, and private
JSON/SQLite downloads. Administrators can open Settings and a Database view for
raw table inspection, viewing corrections, permanent selected/all-entry purge,
and compatible JSON/SQLite import/export. A compact administrator Now Playing
card adds live source/session context. The opt-in [Library](library.md) provides
shared cached browsing with a resizable cover grid, sortable list, and
filter/title-detail popups. **Clear Filter** resets the search and all facet
selections without changing the view, sort, or page size. Source-group editions
share a row/cover; same-name remakes stay separate, with individual
format/year/version tabs in the popup. List widths stay fixed across sorts and
can be resized by dragging dividers or using Left/Right/Home on a focused
divider. Entries per page offers 25, 100 (initial), 1000 and All. Personal
browsing preferences save immediately in the database through **Options**. The
popup groups view, count, cover size, title overlay, format/library badge
switches and sort/order. Covers show an exclusive top-left Watched/In progress/
New marker and an independent top-right Favorite bookmark, plus only the highest
known video format. Lists retain all explicit format chips and summary badges.
Cover pages round the target to complete rows for the measured grid, adapting to
window and cover-size changes. The final page can contain fewer titles. Large
pages use compact summaries and visible-only artwork fetching, retaining
completed covers in a private bounded Library-session cache; full metadata loads
when opening a title. Settings can hide collection names without hiding movies
or editing the device. Collection additions have a separate opt-in
[contract](library-collections.md); progress and playback controls remain later
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
administrator account to review editing, Now Playing, and exports. Regular-user
API responses contain only titles, times, runtime, watched time, status, origin,
and record IDs; notes, source IDs, and session evidence remain
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

Administrators see a compact card on the **Now Playing** tab. Enable automatic
tracking and select the player/status/location entities in the integration's
**Configure** options. Regular users retain their read-only journal view without
this card. The snapshot API also checks read permission for the selected source
entities.

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
cache. The card has no transport controls, seek/progress bar, or library
navigation. Use HA's existing media controls for playback.

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
six main tables show initially; the toggle exposes all fifteen. The query
balloon suggests trusted fields/operators. Enter searches; Tab accepts a
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
submission, Cancel/backdrop and narrow layouts. The fixture simulates device
behavior; real firmware add/read-back requires an isolated operator test.

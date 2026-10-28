# Household journal and management UI

The household reader lets active users browse viewing summaries. The administrator
UI manages journal records through the existing HA API. It provides title search, status filters, 25-record pages, manual entries,
corrections, confirmed deletion, session evidence, database health, and private
JSON/SQLite downloads. Administrators can open Settings and a Database view for
raw table inspection, viewing corrections, permanent selected/all-entry purge,
and compatible JSON/SQLite import/export. A compact administrator Now Playing card adds live source/session context.
Library browsing, progress, and playback controls remain later work.

## Open in Home Assistant

Build the frontend with `npm --prefix frontend run build`, restart HA, and add
the Kaleidescape Companion integration if it is not already configured. Open **Kaleidescape Companion**
in the sidebar, or visit `/kaleidescape-companion` on that HA instance. The panel
uses the existing signed-in HA connection. Active regular users see a read-only
household journal with title search, status filters, pagination, and viewing times.
Administrators retain the management UI, settings, Database view, notes/session details, health, and exports. No
extra token is needed. Rebuild after frontend edits, reload the integration to
refresh the asset URL, and reload the browser page to load the new component.

Existing entries with the old default title **Kaleidescape** are renamed to
**Kaleidescape Companion** on startup or reload. Custom entry titles are preserved.

Only the compiled JavaScript file is registered as a static resource. The storage
directory is never served statically. Unloading the integration removes its panel;
the journal database is retained.

## Open in Vite during development

Run the two servers in separate terminals:

```sh
bash scripts/dev.sh ha
bash scripts/dev.sh preview
```

1. Complete onboarding at `http://127.0.0.1:8123` using an isolated development
   account and add Kaleidescape Companion.
2. Create a long-lived access token in that development user's HA profile.
3. Open `http://127.0.0.1:5173` and enter the token in **Development access token**.
4. Choose **Connect**. The input clears and the journal opens with the account’s
   reader or administrator permissions.
5. Choose **Disconnect** when finished. Revoke the development token in HA when
   it is no longer needed; disconnecting the UI does not revoke it at the server.

Use a regular development account to review the household reader and an
administrator account to review editing, Now Playing, and exports. Regular-user API responses
contain only titles, times, runtime, watched time, status, origin, and record IDs;
notes, source IDs, and session evidence remain administrator-only. All accounts
see the same household journal, rather than separate personal watch histories.

The preview connects only to `http://127.0.0.1:8123`. The token is held in memory,
never saved to browser storage, environment variables, source, or URLs. Reloading
requires entering it again. The development token UI and its connection adapter
are excluded from the distributed panel bundle. Use development credentials only;
HA tokens carry the user's wider HA authority, not just journal access.

WebSocket calls go directly to local HA. A Vite proxy allows the explicit journal
export and query-free media-player artwork GETs, plus the scoped import POST with
fixed format/request/revision query keys, at a fixed local target. It preserves the
browser's bearer header and injects no credentials. Its origin/Fetch Metadata
checks accept the normal development origins on port 5173. Changing ports/targets
requires a reviewed development configuration change. No wildcard CORS or HA
HTTP configuration exception is needed.

For a disconnected layout review, open
`http://127.0.0.1:5173/tests/review.html` while Vite runs. That page is explicitly
labeled and uses fictional, in-memory records. It never connects to HA or writes
a database, and is not included in the packaged panel. Its changes disappear
when the page reloads.

## Now Playing

Administrators see a compact card on the **Now Playing** tab. Enable automatic tracking and
select the player/status/location entities in the integration's **Configure**
options. Regular users retain their read-only journal view without this card.
The snapshot API also checks read permission for the selected source entities.

**Configure → Minimum runtime to record (minutes; 0 disables)** defaults to 10.
Shorter playback is visible in Now Playing but is not added to the automatic
journal; the card explains when it is below the cutoff or waiting for a known
runtime. Exactly the configured minimum qualifies. Set 0 to allow any runtime,
including missing runtime. Existing history and manual entries are preserved.
This is separate from the watched-time threshold for credits completion; see
[automatic tracking](backend.md#automatic-tracking).

The card displays the player, current title, runtime, exact playback and location
states (including scan, credits, intermission, and menus), counted session time,
credits confirmation, timing gaps, and recording/buffering health. It handles
tracking disabled, stopped/unavailable players, and connection failures. Counted
time excludes pauses/scans; it is not a seek position or percentage watched.
Credits confirmation alone does not establish journal completion: the configured
minimum watching threshold also applies. Manual completion corrections remain
visible in the journal, not inferred from this session indicator.

Snapshots refresh about every five seconds after each request finishes while the
card/page is visible. **Refresh playback** requests an immediate snapshot and
retries artwork. Hiding the page or disconnecting clears the card, aborts image
requests, and ignores late replies; returning fetches a fresh snapshot. An access
denial clears it and pauses automatic retries until an explicit refresh, page return, or rebind.
Journal search/editor state is independent and still refreshes explicitly.

Current cover art comes from HA's media-player image route using authenticated
fetch, without copying token-bearing picture URLs. JPEG/PNG/WebP downloads have
a five-second budget and a 5 MiB browser limit; absent, unsupported, or failed
artwork shows a placeholder. No library sync, extra server, or persistent artwork
cache is needed. HA controls upstream retrieval; it is not a Companion cache.
The card has no transport controls, seek/progress bar, or library navigation.
Use HA's existing media controls for playback.

For browser review, open the sidebar as an administrator (or the fictional
`/tests/review.html` Vite fixture), check desktop/narrow layout and safe title text,
then verify configured playback/artwork, pause/scan/credits states, tab hide/return,
disconnect, and missing artwork on an isolated HA instance. Confirm regular users
still see only the journal. Operator review is pending; automated tests use a
simulated DOM and mocked artwork, never household devices.

## Editing and recovery

Select a title to load its latest revision and session evidence. Times are shown
and edited in the browser's local timezone to whole seconds; the API retains UTC
timestamps at their original precision. Runtime and watched time display in minutes
with two decimal places. Unchanged form fields retain their full stored precision;
explicit corrections use the entered values. Watched time does not represent a seek
position. Source identifiers remain exact strings and are under a disclosure.

The form adapts to the editor pane's own width: narrow panes stack fields even
when the journal and editor cards remain side by side. Inputs stay within their
card, including native date/time controls. For layout
review, select **The Lantern Voyage** in the fictional Vite review page and resize
the window across side-by-side and stacked layouts; check both date fields, notes,
source identifiers, and action buttons. Simulated-DOM tests do not measure layout;
operator browser verification remains required.

For observed viewings, only fields whose form values change are sent as
corrections. Saving notes does not lock the title, timestamps, watched time, or
completion status against future automatic updates. Session evidence is read-only.

If another browser or the recorder updates the record, the optimistic revision
check rejects the save. The draft stays visible. Use **Reload entry** to discard
that draft, retrieve the current record, and review changes before editing again.
There is no force-overwrite action.

An interrupted or timed-out save may have committed. **Retry same change** keeps
the original UUID, exact payload, and expected revision; the form stays locked
until its result is known or you explicitly choose **Discard retry & inspect journal**.
This also applies when HA unloads after a commit or an unexpected server/storage
error leaves the outcome uncertain. Writes are not automatically replayed after reconnect.
If you reload/disconnect instead, the in-memory retry is lost: inspect the journal
before recreating a manual entry. Connection/user changes invalidate old replies,
clear private form/list state, and abort outstanding downloads.

**Delete entry** requires explicit confirmation and creates a tombstone. It does
not permanently erase history, session evidence, retry responses, or backups.
Mutation request IDs use native cryptographic UUIDs, with a `getRandomValues`
fallback when `randomUUID` is unavailable (for example, on an HTTP LAN origin).
If neither secure random API is available, an error says no change was sent;
the entry/confirmation stays available rather than silently failing. This also
applies to saving, without reporting a misleading date/number error. See the
[browser API restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

Exports include private retained data; SQLite exports also contain audit metadata.
The browser bounds each download to 256 MiB and revokes temporary object URLs;
large downloads can still use substantial browser memory. Follow the
[security and retention policy](security.md).

## Settings and Database

The top-level tabs are **Now Playing | Journal | Library | Database | Settings**. Journal
remains the default. Arrow keys, Home, and End move between tabs; the bar scrolls
horizontally on narrow screens. Library stays visibly disabled until opted in
through Settings. Enabled Library browsing, status, and sync currently require
an administrator; see the [Library guide](library.md).
Only the selected page is mounted, so leaving Now Playing stops its polling.
Regular users retain the existing read-only journal without administrator tabs.

**Journal** has the **Add viewing** action. **Settings** displays the recording
configuration inline, using the integration's existing Configure options and the
same HA options flow, validation, and automatic reload. Source fields accept HA
entity IDs. **Cancel changes** discards the form and reloads saved values without
saving. Switching tabs asks before discarding unsaved journal, database, or settings
changes. Writes and exact pending retries block navigation where appropriate.
A settings save with an unconfirmed response requires explicit confirmation before
leaving or reloading; inspect saved values before another change.

**Database** uses one shared surface: a toolbar, underline table tabs matching the
main navigation, then the entry list and right-hand details. The toolbar contains
**New Entry**, **Delete entry**, **Purge entry**, **Refresh database**, **Import**,
and **Export**. The seven table tabs show friendly names and counts for `viewings`,
`sessions`, `requests`, `manual_audit`, `maintenance_audit`, `import_audit`, and
`schema_metadata`. Arrow keys/Home/End move between tabs. Each request returns at
most 25 raw rows with counts. Checkboxes sit beside viewing names and select
deletion/purge targets; clicking a name opens its details. The entries list is padded;
row counts are on their own line above a single row of **First**, **Previous**,
and **Next** controls. Narrow screens stack the list and details within the same surface.

For `viewings`, **New Entry** in the toolbar opens the shared
manual-viewing form in the detail pane. It uses the same validated create API and
exact-request retry behavior as Journal's Add viewing. Internal tables disable
create/delete/purge controls and remain read-only. Saving refreshes the list and shows the new
viewing's details.

**Delete entry** requires exactly one checked, visible viewing and confirmation.
It uses the existing revision-checked journal delete API to hide the viewing while
retaining its database record. Multiple checked entries can be permanently purged
together. An uncertain create, edit, or delete locks the toolbar and tab row until
the exact change is retried or explicitly discarded.

The detail pane corrects the same viewing fields as the journal, including for
deleted entries, using revision checks, exact retries, and unchanged-field
precision preservation. It retains deletion status and session evidence. Internal
session, retry, audit, and schema rows are read-only. Raw JSON details retain full
precision and render as text. Changes invalidate later pages; **Refresh database**
restarts inspection. There is no SQL console or arbitrary table/field write API.

**Import** and **Export** open native modal dialogs from the shared toolbar.
Export offers JSON/SQLite with the existing private-download behavior. To import,
disable automatic recording, open **Import**, select a `.json`,
`.sqlite`, `.sqlite3`, or `.db` export, and choose **Import new entries**. Compatible
prior versions are accepted by recognized viewing keys; every row requires an
`id`, `title`, and timezone-bearing `started_at`. Other known values are validated
and optional fields get defaults. Unknown fields are ignored. The whole file must
validate before any change, and a changed dataset revision rejects the import.

Imports merge new IDs and keep existing entries unchanged, including tombstones.
They preserve viewing snapshots/precision and deleted status; source sessions,
audit metadata, request receipts, dataset identity, and configuration are not
restored. Text SQL scripts are unsupported. Files are limited to 32 MiB/10,000
viewings. Invalid rows reject the whole import; no partial import is committed.
Use **Retry same import** after an unconfirmed response; it retains the exact file,
UUID, and revision. The dialog cannot be dismissed while importing or awaiting
confirmation of an uncertain result. **Discard import retry & inspect** explicitly
drops that retry and refreshes the database. Cancelling before upload clears the
file selection; success closes the dialog and reports the result. Import audit
stores only actor/time/counts/revision. Importing
an older backup explicitly can restore content previously purged from the live DB.
For a complete trusted SQLite restore, use the offline [restore procedure](backend.md#export-backup-and-restore).

For permanent deletion, disable automatic recording in Settings first. Open
**Purge entry**, then choose **Purge selected** for checked viewings on the current
page, or **Purge all entries** (including tombstones) in the dialog.
Type **PURGE** or **PURGE ALL**, respectively,
and choose **Confirm permanent purge**. Purge removes associated sessions, manual
audit references, and cached response content transactionally. It retains minimal
retry barriers and a content-free purge receipt/audit; old mutation retries cannot
recreate purged viewings. This does not reset the dataset or remove backup/export
copies, migration snapshots, HA Recorder history, or already observed browser data.
It does not guarantee physical secure erasure. See [maintenance](backend.md#database-maintenance).

A changed dataset revision rejects a stale purge. Backup/export activity blocks
purging. An uncertain result locks the operation for **Retry same purge**, using
the exact original UUID and payload; no new purge is prepared automatically. The
purge dialog stays open and blocks cancellation until the result is resolved or
the retry is explicitly discarded.
Explicit **Discard retry & refresh**, page exit, or reconnect can lose this retry,
so inspect the database before starting another purge. Resume recording explicitly
when maintenance is finished. History sensors refresh on their next normal update.

For operator browser review, use the fictional Vite review page first: inspect
whole-second dates/two-decimal minutes without changing other fields, open Settings
and exercise keyboard focus/Cancel changes, disable recording, inspect deleted/raw
rows, and test selected/all confirmation and narrow layouts. Then review native
options reload, aligned numeric setting inputs, matching table-tab keyboard
navigation, toolbar deletion, viewing corrections, and JSON/SQLite import/export
dialogs (including Escape/focus return) on an isolated HA instance.
No real-browser review is automated. The disconnected fixture supports mock JSON
merges for layout review; real SQLite compatibility is tested on the backend.

## Checks and limits

Run `bash scripts/dev.sh check`. Frontend tests cover CRUD interactions, conflict
handling, retry UUIDs, unchanged-field preservation, escaped metadata, stale
responses, role changes, token cleanup, export limits, and proxy restrictions.
Vitest uses a simulated DOM; these checks do not replace visual, mobile,
accessibility, or real-browser/HA release testing. Python tests verify panel
registration, household visibility, asset scope, reload, and failure cleanup.

Journal lists refresh explicitly; only the small Now Playing snapshot refreshes
automatically. There are no live subscriptions or automatic journal-list polls. The initial panel has not been validated across a supported HA release
matrix. The [known upstream dependency finding](security.md#known-dependency-findings-2026-10-25)
still blocks a hardened public release.

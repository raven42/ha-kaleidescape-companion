# Journal management UI

The initial administrator UI manages journal records through the existing HA
API. It provides title search, status filters, 25-record pages, manual entries,
corrections, confirmed deletion, session evidence, database health, and private
JSON/SQLite downloads. Database tables, SQL, imports, and permanent purge are not
exposed. Library browsing, live Now Playing, and playback controls remain later work.

## Open in Home Assistant

Build the frontend with `npm --prefix frontend run build`, restart HA, and add
the Kaleidescape Companion integration if it is not already configured. Open **Kaleidescape Companion**
in the sidebar, or visit `/kaleidescape-companion` on that HA instance. The panel
uses the existing signed-in HA connection. Active regular users see a read-only
household journal with title search, status filters, pagination, and viewing times.
Administrators retain the management UI, notes/session details, health, and exports. No
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
4. Choose **Connect**. On completion, the input is cleared and the management UI opens.
5. Choose **Disconnect** when finished. Revoke the development token in HA when
   it is no longer needed; disconnecting the UI does not revoke it at the server.

Use a regular development account to review the household reader and an
administrator account to review editing and exports. Regular-user API responses
contain only titles, times, runtime, watched time, status, origin, and record IDs;
notes, source IDs, and session evidence remain administrator-only. All accounts
see the same household journal, rather than separate personal watch histories.

The preview connects only to `http://127.0.0.1:8123`. The token is held in memory,
never saved to browser storage, environment variables, source, or URLs. Reloading
requires entering it again. The development token UI and its connection adapter
are excluded from the distributed panel bundle. Use development credentials only;
HA tokens carry the user's wider HA authority, not just journal access.

WebSocket calls go directly to local HA. Downloads use a Vite proxy restricted to
the explicit journal export route and a fixed local target. It preserves the
browser's bearer header and injects no credentials. Its origin/Fetch Metadata
checks accept the normal development origins on port 5173. Changing ports/targets
requires a reviewed development configuration change. No wildcard CORS or HA
HTTP configuration exception is needed.

For a disconnected layout review, open
`http://127.0.0.1:5173/tests/review.html` while Vite runs. That page is explicitly
labeled and uses fictional, in-memory records. It never connects to HA or writes
a database, and is not included in the packaged panel. Its changes disappear
when the page reloads.

## Editing and recovery

Select a title to load its latest revision and session evidence. Times are shown
and edited in the browser's local timezone; the API stores UTC timestamps. Runtime
and watched time are entered in minutes. Watched time does not represent a seek
position. Source identifiers remain exact strings and are under a disclosure.

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
Exports include private retained data; SQLite exports also contain audit metadata.
The browser bounds each download to 256 MiB and revokes temporary object URLs;
large downloads can still use substantial browser memory. Follow the
[security and retention policy](security.md).

## Checks and limits

Run `bash scripts/dev.sh check`. Frontend tests cover CRUD interactions, conflict
handling, retry UUIDs, unchanged-field preservation, escaped metadata, stale
responses, role changes, token cleanup, export limits, and proxy restrictions.
Vitest uses a simulated DOM; these checks do not replace visual, mobile,
accessibility, or real-browser/HA release testing. Python tests verify panel
registration, admin visibility, asset scope, reload, and failure cleanup.

The UI refreshes explicitly; there are no live subscriptions or automatic journal
polling yet. The initial panel has not been validated across a supported HA release
matrix. The [known upstream dependency finding](security.md#known-dependency-findings-2026-10-25)
still blocks a hardened public release.

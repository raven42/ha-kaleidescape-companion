# Optional local library

Library sync is **disabled by default** and independent from playback recording.
The Library tab is visible but disabled until an administrator saves **Settings
→ Enable library sync**. The same options are available under the integration's
**Configure** action. Once enabled, all active HA users can browse the shared
cached library and artwork. Settings and **Sync now** remain administrator-only.

## Connection and sync settings

Leave **Library hostname** blank to attempt discovery by resolving
`my-kaleidescape.local` and validating its read-only Movies page. This uses HA's
shared DNS/mDNS resolver (host resolution as a fallback), not a subnet scan. If
local name resolution is unavailable from HA, enter a hostname, private LAN IP,
or HTTP(S) origin. Only standard HTTP/HTTPS ports are supported. Credentials,
paths, queries, redirects, and remote destinations are rejected.
Password-protected or unrecognized interfaces fail without changing the cached
catalog. Nothing is fetched or resolved by this connector while disabled.

The vendor describes this local browser interface in
[Accessing the Browser Interface](https://www.kaleidescape.com/support/article/Accessing-the-Browser-Interface).
It is a firmware-dependent HTML interface, not a promised public JSON API.

| Setting                 | Default | Behavior                                                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Enable library sync     | Off     | Starts a read-only sync after setup, then schedules further syncs                                                  |
| Library hostname        | Blank   | Attempts `http://my-kaleidescape.local`; an explicit value overrides discovery                                     |
| Sync interval           | 6 hours | Whole hours, 1–168; measured after the preceding scan finishes                                                     |
| Allow Add to Collection | Off     | Administrators may explicitly add one selected version to an existing offered target; requires collection sync     |
| Sync collections        | On      | Cache available collections and exact title memberships                                                            |
| Sync title details      | On      | Fetch available cast/director/writer/studio, genres, synopsis, and runtime                                         |
| Sync artwork            | Off     | Fetch validated covers into the private cache; can require detail-page requests even with detail metadata disabled |
| Default landing page    | Journal | Used without an allowed URL tab; reader/disabled pages fall back                                                   |
| Artwork cache limit     | 512 MiB | 32–4096 MiB, separate from the database; older covers are evicted when full                                        |

Library view/count, applied filters, sort, cover size and column widths are
[personal database preferences](ui-preferences.md), saved when changed. Hidden
collection names are shared database preferences in Settings, also saved
immediately without reloading HA. The default landing page remains native.

Basic titles, ratings, directors, genres, years, and edition labels always sync.
Other fields depend on the source; missing writers/studios remain unavailable.
Disabling collections or details retains prior cached values with their
timestamps. It does not claim that retained metadata is current. **Sync now**
coalesces with an already running scan. It cannot contact arbitrary
browser-supplied destinations.

The first detail/artwork pass can take several minutes for a large catalog.
Requests are sequential; details refresh when basic metadata changes or after
seven days. Missing covers are retried during subsequent scans. A scan has a
30-minute budget, up to 10,000 source handles, 200 collections, and 100,000
combined memberships, a 15-second request timeout, and an 8 MiB HTML response
limit. Transient transfer/backup barriers retry after at most a minute; other
failures wait for the configured interval or an explicit Sync now. A failed page
or collection generation retains previous data. A complete validated main
listing may mark missing versions unavailable; it does not delete identities or
journal records.

Hidden collection names are matched without case sensitivity (up to 200 names,
256 characters each). They affect shared Library labels, collection filters,
counts, and sorting, including individual-version details. They do not hide
movies, skip network sync, remove cached memberships, or change the device.
Played/Paused continue to determine status even if their names are hidden. Clear
the preference to show the names again without resyncing.

## Browsing

The Library page queries local SQLite, so browsing works while the server is
offline. Choose **List** or **Covers**; the cover-size slider resizes the grid,
with two pixels between covers and title captions overlaid on the artwork.
Covers use the opt-in artwork cache; missing images show placeholders. In either
view, click a title to open its details in a modal popup. Close or Escape
returns to browsing without a separate details pane. Both views show one entry
per source's `source_group`, scoped to that source. Same-name remakes with
different group keys stay separate, while editions in the same group share a row
or cover. Cover captions and detail headings include the known year. The popup
lists each original version using format/year tabs and full individual metadata.
Version tabs support Left/Right and Home/End; large groups use 50-version pages.
A source group remains a browsing identity, not permission to edit every version
together.

When a version lacks year, rating, synopsis, cast, directors, writers, studios,
or genres, its displayed/API metadata fills only empty fields from available
versions in the same source group. Detailed versions are preferred, followed by
the richest record and a stable ID tie-break. Populated values are preserved.
This is resolved at read time so source corrections take effect; raw stored
metadata is retained. Runtime, format/edition, artwork, memberships, dates, and
version IDs remain independent. Unavailable versions and other sources/groups
cannot supply fallback metadata. No title-text or guessed year/director matching
merges works.

Search titles, actor names or director names using partial text. Input debounces
for 300 ms; Search/Enter applies immediately. Matches are literal and use
Unicode case folding, including credits from another available version in the
same exact source group. Open **Filters** to select collection, actor, director,
rating, and watched-status checkboxes. Multiple checked values match **any**
value within that category; different categories must **all** match on the
**same version**. A matching group still opens all its versions, including those
that did not match. An unchecked category is unrestricted. Filter-option search
narrows collection/rating choices, not the titles. Primary filters appear as
Watched status, Collection, Rating; actor/director fields below use typed
suggestions (up to 20 from the full cached source) and removable selected-name
chips. Rating choices reuse the same badges as title details. **Apply filters**
applies the draft and returns to page one; Cancel discards it. The toolbar
**Clear Filter** clears search and all checkbox filters, including unsubmitted
search text, and returns to page one. It preserves view, sort and page size.
Each category offers up to 500 known names (collections up to 200), with at most
100 selections per category. Writer and studio filters are omitted because the
observed source supplies neither field.

List columns are title/formats, year(s), collection, length, watched status, and
Added on. Fixed-layout columns keep their widths when sorting or filtering. Drag
a column divider to resize, or focus it and use Left/Right (Home resets its
width). Widths save in the database for the signed-in user. Long titles/formats
truncate with full-text tooltips; collection labels wrap up to three lines.
Narrow screens scroll horizontally. Heading buttons toggle ascending/descending
sort; collection sorts by the first alphabetically sorted membership, and
missing year/runtime sorts first in ascending order. Cover view exposes the same
sort choices. Results are paged by **name**, with all matching versions grouped
before pagination. **Entries per page** offers **25, 100, 1000, All**,
initially 100. In Covers, numeric targets round down to a multiple of the
measured column count, with at least one full row: 100 becomes 96 at eight
columns or 98 at seven. Resizing adjusts the nearest page containing the old
first title after a short debounce. The final catalog remainder stays visible
even if its row is incomplete. All loads bounded, revision-checked chunks for
the entire matching catalog (maximum 10,000 groups and 32 MiB aggregate
metadata). Nothing is duplicated to fill rows. View, count, applied
search/filters, sort, cover size and widths save as personal database
preferences; main-tab navigation remains in the URL. See
[preference limits and badge criteria](ui-preferences.md).

The summary shows the union of visible collections/formats/years,
minimum–maximum known runtime, earliest detection, and a source status priority
of In progress, Watched, Unknown, then Unwatched. Sorts use the earliest year,
minimum known runtime, first visible collection name, and earliest detection as
applicable. Browsing preferences restore from the database when Library is
reopened.

Statuses reflect source collection membership, independently for exact source
handles: **Paused → In progress**, otherwise **Played → Watched**, otherwise
**Unwatched**. Before any complete collection sync, and for versions first
detected after the retained collection snapshot, status is **Unknown**. These
are editable source labels, not Companion journal completion, saved position, or
dated viewing evidence. No viewings are fabricated from Played membership.

Alternate editions retain exact source handles and source-scoped groups in
storage. Source-defined display grouping never merges those records or guesses
playback-ID equivalence. The header distinguishes movie groups from versions.
Concrete formats replace the browser's summary label **Multiple**. Existing
caches need the next catalog sync to read those hidden format rows; missing
formats are shown as unavailable rather than invented. **Added on** is the first
successful detection of that handle by Companion, retained across subsequent
syncs and temporary absence. All titles already present at the first sync get
that first detection date. [Reviewed imports](imports.md) can fill a missing
calendar purchase date on the schema **9** title-version row. Added on prefers
that date, falling back to first detection; detection itself is never rewritten.
Download dates remain unknown. Hidden collection preferences use known-name
checkboxes and custom values in the shared database settings row, migrated once
from former HA options. Changing the configured origin creates a separate source
namespace, even if it reaches the same physical system. Cross-host identity
reconciliation is deferred.

Sync progress/status refreshes only while the Library page is visible: about
every five seconds during a scan and 30 seconds when idle. Newly cached metadata
refreshes the current results from the first page. Leaving the tab stops status
polling, aborts cover requests, revokes their object URLs, and clears data.
Cover images load only while visible, with at most three requests at once and a
five-second budget per request. Completed images stay in a bounded session LRU
cache across scrolling, paging, view changes and title popups (1000 images / 128
MiB compressed bytes). Offscreen unfinished requests still cancel. Cache
eviction revokes URLs, preferring offscreen images; leaving Library or an
account/access/scope change clears all retained covers. See
[cover retention and layout options](ui-preferences.md). Regular users poll
cached counts/revisions/timestamps every 30 seconds, without administrator sync
progress, settings, errors, or storage details. Background scheduled sync
continues independently when enabled. There are no playback controls. The
separately opted-in [Add to Collection](library-collections.md) action is the
only supported vendor edit.

The search toolbar sticks to the top of the scrolling Library. A compact sticky
footer holds title/collection counts, last catalog sync and administrator
artwork usage. Options contains detailed freshness timestamps and
individual-version counts. Source Played is displayed as **Watched** in browsing
labels; Options explains the mapping while API/device collection names remain
unchanged.

### Cached API

The scoped `kaleidescape_companion/library/info` and `library/list` WebSocket
commands, `library/versions`, `library/suggest` (actor/director query ≤100
characters; at most 20 results), and query-free
`/api/kaleidescape_companion/{entry_id}/{dataset_id}/library/artwork/{cache_key}`
GET require an active HA user and enabled Library. `library/sync` requires an
administrator. Regular-user info contains only counts, revision, and sync times;
configuration, detailed progress/errors, and storage use remain
administrator-only. List results expose display metadata and opaque keys,
without raw source IDs, origins, or paths. Access, role, scope/readiness, and
opt-out are checked again after awaited work.

List `filters` accepts `query`, `collection`, `actor`, `director`, `rating`,
`status`, `sort`, `descending`, `offset`, optional `revision`, `grouped`, and
`limit`. `limit` must be an integer from 1 to 1000 (default 50); list responses
echo it. `grouped=true` is used by the UI; omitted/false preserves the original
version-list API. Grouped responses contain compact display summaries; full
synopses/credits are fetched only through `library/versions`. Group summaries
include `version_count`, `formats` (up to 100 with a truncation flag), `years`
(up to 100), and maximum known runtime. A group's opaque ID is a representative
current version key; it is not a permanent film identity. `library/versions`
accepts `title_id`, `offset`, and optional source `revision`, returning at most
50 positively projected versions sharing the selected source group. Regular-user
info also includes the name count and an opaque `preferences_key`. List pages
include that key; subsequent pages can send it to reject stale display
preferences without changing the source revision. Visible Library polling uses
it to refresh hidden labels after an external shared-preference change. Facets
take arrays of at most 100 strings; a single string is retained for existing
clients. `status` values are `watched`, `unwatched`, `in_progress`, and
`unknown`. `sort` is one of `name`, `year`, `collection`, `length`, `watched`,
or `added`. List pages use source/preference revisions, a 1000-entry ceiling,
and an 8 MiB conservative serialized JSON payload budget (including facets).
Oversized pages fail with `library_page_too_large`; reduce the target and retry.
Internal lookup batches stay below 999 SQLite parameters. Individual-version
pages share the byte budget and remain capped at 50. Fixed sort expressions and
bound values accept no client SQL or paths.

## Storage, artwork, and recovery

Schema **6** added `library_sources`, `library_titles`, `library_collections`,
`library_memberships`, and `library_artwork` to the existing worker-owned SQLite
database. Library writes advance revisions but never rewrite viewing snapshots,
manual corrections, session evidence, or journal status. Concurrent sync can
make a database page or maintenance revision stale; refresh before retrying.
Wait for an initial scan to finish before a large maintenance import.

The SQLite limit remains **256 MiB**, including catalog metadata. Library writes
have a **192 MiB** ceiling to leave 64 MiB of growth for the journal. A journal
already at or above that threshold remains usable while new library writes are
refused. Artwork bytes live outside SQLite at
`<HA config>/kaleidescape_companion/artwork/`, with private directory/file
permissions (`0700`/`0600`). Enabling artwork adds disk use up to the configured
cache budget plus one incoming image of at most **5 MiB**; migration backups, HA
backups, and other copies need additional space. Increase the cache limit for a
large collection. Cache eviction removes covers, not identities or history, and
a later scan can fetch them again. Covers are served only through a scoped,
authenticated active-user endpoint with opaque keys; never through `www` or
directly from metadata URLs. Only JPEG/PNG/WebP magic/type pairs are accepted.
Python does not decode images.

HA backups pause sync and drain accepted worker/file writes before copying
storage. SQLite exports include library metadata and cache indexes, but not
artwork files. JSON format 3 includes portable title metadata and purchase
dates. Missing cover files are reconciled when storage opens and can be fetched
again. [Reviewed imports](imports.md) can merge title metadata/dates but do not
restore source configuration, memberships/status, fetch/cache paths, or artwork
files. A full trusted database restore is still the offline
[restore procedure](backend.md#export-backup-and-restore).

Disabling sync retains cached library records and covers; it stops network work
and denies the Library API. Journal delete/purge does not remove this
independent catalog cache. Operator deletion of cached artwork should be done
with HA stopped; leave the journal database intact. Full dataset removal follows
the [security procedures](security.md#backup-restore-retention-and-capacity).

## Validation and limits

Automated tests use fictional HTML/data and mocked network responses. They cover
grouped versions, empty collections, encoding/escaping, malformed/partial pages,
parameterized filters, status precedence, stable first detection, migrations,
private cache limits/rollback, DNS pinning, forbidden routes/redirects, access
revocation, lifecycle cancellation, and backup barriers.

Read-only checks against one `26.1.2-27147` interface validated the main
listing, all movie-collection pages, and one detail page. The built-in
**Scenes** menu opens scene management rather than a movie listing; it is
explicitly excluded from collection discovery. This fixed initial collection
generations being rejected. Other unexpected/failed pages still preserve the
preceding collection generation instead of fabricating empty memberships. These
checks did not run a full household sync, cache its artwork, validate other
firmware, or automate a browser. Review Library and Settings first at
`http://127.0.0.1:5173/review.html`, then use an isolated HA deployment to
review actual metadata, scheduled refresh, optional artwork, narrow layouts, and
role changes. The fictional review page also links to `?library=1` and
`?library=1&role=reader` for enabled administrator/reader layouts. Its fictional
editions and separate same-name remake demonstrate source-group browsing and
detail tabs. The fictional page can enable Library in Settings without
contacting any device. Canonical work/edition identity and historical artwork
associations and library-specific import/export remain follow-ups. The
[Add to Collection action](library-collections.md) adds a separate, explicit
administrator-only POST capability; automatic synchronization remains GET-only.
Removal remains deferred.

### Performance checks

Run `.venv/bin/python dev/benchmark_library.py` for a fictional temporary
catalog with 5000 names/10000 versions, 22 collections, full cast/synopsis
metadata, and five warmed samples each at 50/250/500/1000 entries. It reports
worker query latency and compact JSON size; no HA server, device, artwork, or
network is used. The command accepts `--titles` (1–5000) and `--samples` (1–20).
It does not measure browser rendering, wire transfer, or target HA hardware. The
automated layout tests exercise up to 1000 DOM rows/covers and simulated
resize/lifecycle transitions; real-browser layout, scroll performance, and
artwork timing require operator review. For a larger browser fixture, open
`http://127.0.0.1:5173/review.html?library=1&titles=1200` while Vite runs. The
optional `titles` parameter generates 1–2000 unique fictional names in memory;
it contains no artwork and never connects to HA or a device. Check list/cover
paging at 25, 100, 1000 and All, resize the window, and change cover size.
Ordinary cover pages should have complete rows; the final page shows only the
actual remainder.

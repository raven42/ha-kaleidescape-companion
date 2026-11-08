# Library, artwork and collections

Library sync is **disabled by default** and independent from playback recording.
The Library tab is visible but disabled until an administrator saves **Settings
→ Library → Enable Library sync**. The same options are available under the
integration's **Configure** action. Once enabled, all active HA users can browse
the shared cached library and artwork. Settings and **Sync now** remain
administrator-only.

The temporary PoC uses pyk's `LocalLibrary` to parse local browser pages and the
collection forms. Companion supplies its guarded HA HTTP transport and retains
caching, scheduling, identity, authorization and durable collection outcomes.
This requires the privately bundled patched pyk source described in the
[migration plan](../plans/plan-pykaliedescape-migration.md).

## Connection and sync settings

Leave **Kaleidescape Server Address** blank to attempt discovery by resolving
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

| Setting                        | Default | Behavior                                                                                                           |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Enable Library sync            | Off     | Starts a read-only sync after setup; recurring sync requires an HA automation                                      |
| Kaleidescape Server Address    | Blank   | Attempts `http://my-kaleidescape.local`; an explicit value overrides discovery                                     |
| Allow collection changes       | Off     | Administrators may queue supported changes for an exact version; requires collection sync                          |
| Collections and watched status | On      | Cache available collections and exact title memberships                                                            |
| Movie details and credits      | On      | Fetch available cast/director/writer/studio, genres, synopsis, and runtime                                         |
| Cover artwork                  | Off     | Fetch validated covers into the private cache; can require detail-page requests even with detail metadata disabled |
| Default landing page (General) | Library | Used without an allowed URL tab; reader/disabled pages fall back                                                   |
| Artwork storage limit          | 512 MiB | 32–4096 MiB, separate from the database; older covers are evicted when full                                        |

Library defaults to Covers for new profiles. View/count, sort, cover size and
column widths are
[personal database preferences](design-user-interface.md#personal-and-shared-preferences),
saved when changed. Search and applied filters are temporary panel URL state;
old saved filters are not restored. Hidden collection names are shared database
preferences in Settings, applied with **Save visibility** without reloading HA.
The default landing page and fuzzy search are native shared settings.

Basic titles, ratings, directors, genres, years, and edition labels always sync.
Other fields depend on the source; missing writers/studios remain unavailable.
Disabling collections or details retains prior cached values with their
timestamps. It does not claim that retained metadata is current. **Sync now**
coalesces with an already running scan. It cannot contact arbitrary
browser-supplied destinations.

After a Library sync completes, Companion updates a Home Assistant persistent
notification when any available movie groups have missing metadata or artwork.
It lists each affected title once, identifies the missing categories, and uses
the same provider and artwork-expectation rules as the Library's **Missing
metadata/artwork** filter. Startup, manual, and scheduled syncs use the same
notification. A later complete sync with no missing data dismisses it. If a sync
finishes with partial errors, the notification says its list reflects the cached
Library; an incomplete, failed or cancelled sync does not clear an earlier
notification. An info-level log records the affected movie and category counts
without logging movie titles.

The notification and info log include the panel path for opening the Library
with **Missing metadata/artwork** selected. The notification uses a clickable
relative link; the log shows the path so it can be opened from the HA origin.

The first detail/artwork pass can take several minutes for a large catalog.
Requests are sequential; details refresh when basic metadata changes or after
seven days. Missing covers are retried during subsequent scans. A scan has a
30-minute budget, up to 10,000 source handles, 200 collections, and 100,000
combined memberships, a 15-second request timeout, and an 8 MiB HTML response
limit. Failed scans wait for an explicit Sync now, the HA button, or a
user-created automation; there is no built-in recurring schedule. The
`kaleidescape_companion.library_sync` action and Library sync button invoke the
same operation. A failed page or collection generation retains previous data. A
complete validated main listing may mark missing versions unavailable; it does
not delete identities or journal records.

Hidden collection names are matched without case sensitivity (up to 200 names,
256 characters each). They affect shared Library labels, collection filters,
counts, and sorting, including individual-version details. They do not hide
movies, skip network sync, remove cached memberships, or change the device.
New/Played/Paused continue to determine status even if their names are hidden.
Clear the preference to show the names again without resyncing.

## Browsing

The Library page queries local SQLite, so browsing works while the server is
offline. Choose **List** or **Covers**; the cover-size slider resizes the grid,
with two pixels between covers and title captions overlaid on the artwork.
Covers use the opt-in artwork cache; missing images show placeholders. In either
view, click a title to open its details in a modal popup. X or Escape returns to
browsing without a separate details pane. Both views show one entry per source's
`source_group`, scoped to that source. Same-name remakes with different group
keys stay separate, while editions in the same group share a row or cover. Cover
captions and detail headings include the known year. The popup lists each
original version with full metadata. Multiple versions use simple Version 1,
Version 2 and subsequent tabs, without a separate version-count line; a single
version has no tab row. The top badges summarize the group's known formats,
content ratings and visible collections. Multi-version details also show the
selected version's format-only badges beneath its artwork. Version tabs support
Left/Right and Home/End; large groups use 50-version pages. A source group
remains a browsing identity, not permission to edit every version together.

Versions are ordered by video quality: **4K Cinematic, 4K, HD, SD**, then
unknown formats. Within each quality tier, longer runtimes come first; stable
record IDs break remaining ties. The first, highest-ranked version is selected
on opening, even when a lower-quality version represented the Library search
result. An explicit version selection remains selected during metadata
refreshes.

When a version lacks year, rating, synopsis, cast, directors, writers, studios,
or genres, its displayed/API metadata fills only empty fields from available
versions in the same source group. Detailed versions are preferred, followed by
the richest record and a stable ID tie-break. Populated values are preserved.
This is resolved at read time so source corrections take effect; raw stored
metadata is retained. Runtime, format/edition, artwork, memberships, dates, and
version IDs remain independent. Unavailable versions and other sources/groups
cannot supply fallback metadata. No title-text or guessed year/director matching
merges works.

Search titles, cast, directors, writers, producers or studios using partial
text. Input debounces for 300 ms; Search/Enter applies immediately. Literal mode
uses Unicode case folding; the shared fuzzy-search setting additionally
tolerates bounded word/typo differences, including credits from another
available version in the same exact source group. Open **Filters** to select
collection, rating, genre, year, viewing-format and watched-status checkboxes.
Multiple checked values match **any** value within that category; different
categories must **all** match on the **same version**. A matching group still
opens all its versions, including those that did not match. An unchecked
category is unrestricted. Filter-option search narrows available filter values,
not the titles. Rating choices put G/NR-G first, then unclassified values
(including Unrated), then PG, PG-13, R and NC-17, with NR-prefixed equivalents
beside the corresponding rating and alphabetical ties. They reuse the badges
from title details. Viewing formats use individual format badges, including
HDR10 separately from resolution. SD resolution and SDR dynamic range remain
separate; SDR has a distinct badge. Actor/director filter inputs have been
removed from the dialog; the main search handles people. Existing saved
actor/director selections can still be removed using their chips, and the API
retains those facets for compatible clients. Sci-Fi and Science Fiction share
the Science Fiction genre label. **Apply filters** applies the draft and returns
to page one; Closing with X discards it. The toolbar **Clear Filter** clears
search and all checkbox filters, including unsubmitted search text, and returns
to page one. It preserves view, sort and page size. Each category offers up to
500 known names (collections up to 200), with at most 100 selections per
category. Writers, producers and studios are searchable when available, without
separate facet controls.

Search and display projections run on the same worker for both household roles.
One search evaluates each distinct credited name once, then resolves matches to
their existing source groups; it does not infer identities from names. A bounded
worker-local cache reuses effective metadata, and source-revision/hidden-label
keys reuse unchanged facet choices. Source-policy changes invalidate those
projections. Cached values are private memory only and are discarded on unload;
edits/imports use their new input values immediately. The two-second search
budget, source scoping and public-field allowlists still apply. There is no
additional persistent actor table or search-data migration. Fuzzy search can
take more work than literal/quoted search; the setting is shared across users.

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
metadata). Nothing is duplicated to fill rows. View, count, sort, cover size and
widths save as personal database preferences. Library search and filters live in
the panel URL for this view; they are not saved as user preferences. See
[preference limits and badge criteria](design-user-interface.md#personal-and-shared-preferences).

Shareable panel URLs use `companion_page=library` and `library_query` for
search. Repeated `library_collection`, `library_actor`, `library_director`,
`library_rating`, `library_genre`, `library_year`, `library_format` and
`library_status` parameters select facet values; boolean filters use
`library_missing_metadata_artwork=1` or
`library_missing_purchase_information=1`. The purchase filter remains
administrator-only. The URL contains the selected search and facet values;
sharing it shares those values too. A `library_filters=1` marker represents an
explicitly unfiltered view. Parameter values are bounded before use and backend
authorization and filter validation still apply.

The summary shows the union of visible collections/formats/content
ratings/years, minimum–maximum known runtime, earliest detection and known
purchase date, and source status memberships. The legacy single status used for
sorting prioritizes In progress, Watched, Unknown, Unwatched, then no status.
Sorts use the earliest year, minimum known runtime, first visible collection
name, and purchase date with detection as fallback, as applicable. Browsing
preferences restore from the database when Library is reopened.

Statuses reflect source collection membership, independently for exact source
handles: **Paused → In progress**, **Played → Watched**, and **New →
Unwatched**. A movie may show multiple statuses when the group belongs to
multiple collections. A title in none of these collections has no status. Before
any complete collection sync, and for versions first detected after the retained
collection snapshot, status is **Unknown**. These are editable source labels,
not Companion journal completion, saved position, or dated viewing evidence. No
viewings are fabricated from Played membership.

Alternate editions retain exact source handles and source-scoped groups in
storage. Source-defined display grouping never merges those records or guesses
playback-ID equivalence. The header distinguishes movie groups from versions.
Concrete formats replace the browser's summary label **Multiple**. Existing
caches need the next catalog sync to read those hidden format rows; missing
formats are shown as unavailable rather than invented. **Added on** is the first
successful detection of that handle by Companion, retained across subsequent
syncs and temporary absence. All titles already present at the first sync get
that first detection date.
[Reviewed imports](design-data-management.md#reviewed-merge-imports) can fill a
missing calendar purchase date on the schema **9** title-version row. Added on
prefers that date, falling back to first detection; detection itself is never
rewritten. Download dates remain unknown. Hidden collection preferences use
known-name checkboxes and custom values in the shared database settings row,
migrated once from former HA options. Changing the configured origin creates a
separate source namespace, even if it reaches the same physical system.
Cross-host identity reconciliation is deferred.

When a movie group has recorded or manual viewings, the consolidated movie
dialog places an expandable **Journal** section below Library details. It lists
each viewing as its status, date and start time. Completed viewings that cross
local calendar dates show separate start and completion times, and a rule
separates multiple entries. Administrators in Advanced mode can open the
revision-checked editor with **edit** in the expanded heading, choosing an entry
when there are multiple viewings. Purchase history is a separate section below
Journal, shown only in Advanced mode to administrators. An empty history has no
Journal section. The history uses the existing source-scoped group and
revision-bound pagination, and reports errors rather than claiming no viewings.
Switching versions keeps the group Journal and its expanded state; playback
controls retain their layout while their state is revalidated and cannot send a
command until that check completes.

The full dialog is shared with linked Journal entries, with no navigation
between Library and Journal pages. Each user can select the full or compact
viewing dialog in Journal options; Library always uses full movie details.

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
[cover retention and layout options](design-user-interface.md#personal-and-shared-preferences).
Regular users poll cached counts/revisions/timestamps every 30 seconds, without
administrator sync progress, settings, errors, or storage details. User-created
HA automations can schedule sync independently. Separately enabled household
[Library playback](design-playback-controls.md) can launch an exact cached
version through the protocol extension, with edition limitations. The separately
opted-in [collection management](design-library.md#collection-management) action
is the only supported vendor edit.

The search toolbar sticks to the top of the scrolling Library. On phones it
becomes square Search, Filters, Clear, Sort/Randomize and Options shortcuts,
with search in a popup and the sort method in Options. A compact sticky footer
holds Refresh cached data and administrator Sync now, along with global
movie/status totals, with a blue match count for active search/filter criteria.
Advanced mode adds collection counts, last catalog sync, artwork usage and
compact scraper progress. It is one shared status/navigation bar;
First/Previous/Next are omitted when all matching titles fit on one page,
including All. Settings → About contains detailed freshness timestamps and
individual-version counts. The user's movie-status naming choice controls
browsing labels while API/device collection names remain unchanged.

The redundant Library heading is omitted. Desktop sort method/direction remain
directly available in the search toolbar. On phones, the method is in Options
and direction/Randomize uses a toolbar icon. Refresh/sync are inside Options.
Options contains the other presentation settings, with a borderless view-type
radio group. Manual Journal additions select an exact cached version with known
runtime; see the
[viewing form](../guides/guide-development.md#local-ha-and-frontend-preview).

### Cached API

The scoped `kaleidescape_companion/library/info` and `library/list` WebSocket
commands, `library/versions`, `library/suggest` (actor/director query ≤100
characters; at most 20 results), `library/search` (partial/fuzzy title
completion, at most ten exact versions from up to 10,000 names with a one-second
scoring budget), and query-free
`/api/kaleidescape_companion/{entry_id}/{dataset_id}/library/artwork/{cache_key}`
GET require an active HA user and enabled Library. `library/sync` requires an
administrator. Regular-user info contains only counts, revision, and sync times;
configuration, detailed progress/errors, and storage use remain
administrator-only. List results expose display metadata and opaque keys,
without raw source IDs, origins, or paths. Access, role, scope/readiness, and
opt-out are checked again after awaited work.

List `filters` accepts `query`, `fuzzy`, `collection`, `actor`, `director`,
`rating`, `genre`, `year`, `format`, `status`, `missing_metadata_artwork`,
`missing_purchase_information` (administrator-only), `sort`, `descending`,
`random_seed`, `offset`, optional `revision`, `grouped`, and `limit`. `limit`
must be an integer from 1 to 1000 (default 50); list responses echo it.
`grouped=true` is used by the UI; omitted/false preserves the original
version-list API. Grouped responses contain compact display summaries; full
synopses/credits are fetched only through `library/versions`. Group summaries
include `version_count`, `formats` (up to 100 with a truncation flag), `years`
(up to 100), and minimum/maximum known runtime. A group's opaque ID is a
representative current version key; it is not a permanent film identity.
`library/versions` accepts `title_id`, `offset`, and optional source `revision`,
returning at most 50 positively projected versions sharing the selected source
group. Regular-user info also includes the name count and an opaque
`preferences_key`. List pages include that key; subsequent pages can send it to
reject stale display preferences without changing the source revision. Visible
Library polling uses it to refresh hidden labels after an external
shared-preference change. Facets take arrays of at most 100 strings; a single
string is retained for existing clients. `status` values are `watched`,
`unwatched`, `in_progress`, and `unknown`. `sort` is one of `name`, `year`,
`collection`, `length`, `watched`, `added`, or `random`. Random uses the
validated `random_seed` so pages and personal display profiles share one stable
shuffle until Randomize is clicked. List pages use source/preference revisions,
a 1000-entry ceiling, and an 8 MiB conservative serialized JSON payload budget
(including facets). Oversized pages fail with `library_page_too_large`; reduce
the target and retry. Internal lookup batches stay below 999 SQLite parameters.
Individual-version pages share the byte budget and remain capped at 50. Fixed
sort expressions and bound values accept no client SQL or paths.

## Storage, artwork, and recovery

Schema **6** added `library_sources`, `library`, `library_collections`,
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

Opt-in [TMDB enrichment](design-metadata.md) can add widescreen backdrops when
Sync artwork is enabled. They share this budget and authenticated endpoint,
using a protected reference in each movie group's enrichment JSON. They do not
replace edition covers. Mobile title dialogs start 15% below the visible screen
top, with a compact backdrop or small-poster fallback, linked credit rows and
collapsed Library/purchase details. The top offset includes device safe areas;
long content scrolls within the remaining height.

HA backups pause sync and drain accepted worker/file writes before copying
storage. SQLite exports include library metadata and cache indexes, but not
artwork files. JSON format 5 includes portable title metadata, purchase dates
and private purchase-history records. Missing cover files are reconciled when
storage opens and can be fetched again.
[Reviewed imports](design-data-management.md#reviewed-merge-imports) can merge
title metadata/dates but do not restore source configuration,
memberships/status, fetch/cache paths, or artwork files. A full trusted database
restore is still the offline
[restore procedure](design-journal.md#exports-backups-and-restore).

Disabling sync retains cached library records and covers; it stops network work
and denies the Library API. Journal delete/purge does not remove this
independent catalog cache. Operator deletion of cached artwork should be done
with HA stopped; leave the journal database intact. Full dataset removal follows
the
[security procedures](../policies/policy-security.md#storage-imports-and-rendering).

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
associations remain follow-ups. Reviewed Library metadata/purchase imports and
private exports are implemented as described in
[data management](design-data-management.md). The
[collection management action](design-library.md#collection-management) adds a
separate, explicit administrator-only POST capability; automatic synchronization
remains GET-only. Removal remains deferred.

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

## Browse from movie details

Title, cast and director names in details are buttons. Clicking a name closes
the popup, clears all selected facets and replaces the search text with that
name. The title/actor/director search finds both acting and directing
associations, including partial matches. Clicking a known year, genre, visible
collection, watched status, rating or format badge instead clears search and
every previous facet, then applies just that exact filter. It returns to the
first results page while preserving view, page size and sort, and saves the
criteria to the current HA user's preferences. These actions are available to
household readers as well as administrators and do not contact the device.
Pending collection writes block detail navigation until resolved.

Filters now offer genre, known year and viewing format alongside status,
collection and rating. The main search covers actors/directors; the dialog has
no separate people lookup controls. Each category matches any selected value,
with all populated categories required on the same matching version; grouped
results still show every version of a matching work. Format choices split
recognized combined source labels into individual positive badge categories: SD,
HD, HD Cinematic, 4K, 4K Cinematic, 8K, SDR, HDR10, Dolby Vision, Dolby Atmos
and DTS:X when present. Wholly unknown source labels remain filterable. Existing
API/source-label filters remain accepted. The 4K category represents
non-Cinematic 4K metadata; Cinematic has its own category. HDR, Cinematic and
audio badges require their positive scanned, compatible Store or manually
reviewed data; resolution alone does not supply them. Unrated selects movie
groups without a known rating on any available version; a missing rating on one
version of a rated movie does not make that movie Unrated. Years are string
values such as `2025` in API filters and preferences. Unknown years are not
linked or fabricated.

All facet selections, including clicked criteria, retain the existing
100-value/500-character bounds. SQL uses one bound JSON array per selected
category, keeping queries below older SQLite's 999-variable limit even with 200
hidden collections. Source/preference revision and payload limits still apply.
New preference fields inherit empty defaults without a schema migration or HA
reload.

## Fuzzy search option

**Settings → General → Fuzzy search** is saved with the shared integration
configuration and applies to all users and display profiles. It starts enabled
and applies to the main title/cast/director search, the filter-values search and
compatible actor/director suggestion API calls. Turning it off requires the
entered text to occur continuously, ignoring case; literal partial matches still
work, and punctuation/wildcard characters remain ordinary text. Turning it on
also tolerates small word misspellings/transpositions, word-order differences
and diacritics. Selected facet values remain exact in either mode. Mode changes
invalidate pending suggestions and refresh results from page one, including
All/Covers views. Journal and manual-viewing pickers use the same shared mode.
Previously saved personal choices are not applied to the shared setting. Direct
list/suggestion API calls retain a literal default when `fuzzy` is omitted.

Enclosing the entire search in double quotes requires a case-insensitive,
whole-word phrase, regardless of the fuzzy toggle. `"Tom Holland"` matches that
name within cast/director fields but excludes `Tom Hollander`; unquoted text
retains partial/fuzzy behavior. Punctuation stays literal and whitespace between
words may vary. People links in movie/calendar details insert double quotes and
replace existing Library search/filters. The same phrase rule applies to Journal
search, manual title pickers, filter autocomplete, import review and plain
Database search. Structured Database predicates keep their documented SQL style
operators and single-quoted values.

**Missing metadata/artwork** selects movies missing an expected provider's
metadata or an expected cover or backdrop. It uses the same grouped availability
rules as the missing-metadata and missing-artwork sensors. List rows and cover
tiles show the warning icon to administrators for those same movies, even when
there is no scraper match conflict. A conflict also shows the warning; its
accessible label identifies both causes when they occur together. The warning is
independent of the optional status/format badges. The filter lives in the
Library URL. Administrators also have **Missing purchase information**, using
the same group-level date/paid/retail completeness rules as its sensor. It adds
no warning badge and omits movies explicitly marked **Purchase information
unavailable**. A role change clears this private filter from reader requests.
See [manual resolution](design-metadata.md#review-a-single-title).

The filter panes use consistent inner heading padding, and their sticky action
footer has extra space below the buttons.

## Random order

Random sorting supports HTTP Home Assistant connections as well as HTTPS; it
uses the API client's existing browser-compatible random ID generator.

Choose **Sort by → Random** to shuffle the movie list and return to the first
page. The direction button becomes **Randomize**; each click starts a new
shuffle. Random is available in both List and Cover views, without adding a
spreadsheet column. Switching to another sort restores the usual direction
control.

Library profiles retain their own sort choice and share one shuffle seed per HA
user. Paging, filtering, switching layouts, cover resizing and reloads preserve
that order until the next shuffle. Movie groups are shuffled as units, so
alternate formats stay together. Normal content-revision checks still apply
during paging.

For the authenticated list API, `sort=random` uses the signed-in user's shared
seed. Set it through UI preferences with an empty value or a 32-character
lowercase hexadecimal string. The response returns the canonical `random_seed`;
later pages must retain it. The worker API also accepts an explicit seed for
internal callers. The worker orders a deterministic SHA-256 rank of the seed and
source group (exact version ID for ungrouped queries). Different pages and All
use the same seed; `descending` has no effect in Random mode. The seed is a
browsing preference, not a credential.

## Administrator purchase totals

Library Options includes **Show total library cost in footer**, off by default
and saved immediately in personal Library preferences. Administrators also have
an expandable **Settings → About → Purchase details** section showing total
library cost, total retail price, savings and unique transactions. Totals load
only when that section opens or the footer option is enabled, then refresh with
source revision changes. Reopening the section refreshes the totals even when a
revision has not yet changed. Household readers have neither the
purchase-display toggle nor purchase totals.

These are totals of linked purchase records for the configured Library source,
including invoices linked to unavailable versions. They also include a Library
version with a manually entered paid price and no linked invoices; a retail-only
manual value does not contribute. Unlinked purchases have no source and are
excluded until reconciled. Search/filters, page size and hidden collection names
do not change them. Each stable invoice identity is counted once across
versions; repeat purchases with different identities remain separate. Allocated
bundle prices are used as imported. Flat earliest-invoice summary columns are
not added again.

Amounts use exact integer-cent arithmetic and stay separated by their recorded
currency prefix. Missing paid/retail prices are excluded, with coverage counts
shown. Savings sum retail minus paid only for invoices with both prices in the
same currency; they can be negative. Unique transactions count distinct known
order IDs, not title/version rows. Purchases without an order ID are reported
separately rather than assigned invented transactions. These recorded totals do
not estimate missing prices or currency conversions.

## External metadata integration

Separately enable store/TMDB enrichment to extend credits and add
source-specific ratings. Source scan data, edition identities and financial
privacy stay intact. See [external metadata](design-metadata.md) for
credentials, matching, caching and request limits.

## Movie details and administrator editing

A downloaded landscape image spans the narrower desktop dialog with a dark
gradient behind the heading ending at the version-tab divider; desktop keeps the
portrait poster as well. On mobile, landscape artwork replaces the portrait.
Without it, the compact poster layout remains. Dialogs retain the 15% viewport
inset and reachable close control. Available TMDB viewer scores and separate
Rotten Tomatoes critic and audience scores share the Play/Collection/Edit action
row above version details. TMDB uses a percentage ring; RT uses its standard
tomato/popcorn score icons. Tooltips and accessible labels identify each source
and score scale. Missing scores are omitted, and Ratings and metadata sources
remains expandable.

Administrators can set shared, field-by-field provider preferences in **Settings
→ Metadata → Preferred sources**. Cached values are projected without rewriting
raw scan facts; explicit reviewed title edits win. See
[source selection](design-metadata.md#preferred-metadata-sources).

An open details popup reads fresh versions independently of its Library list's
older revision. Metadata changes refresh the selected movie without dropping its
dialog or selected version. Version pagination still detects stale reads and
restarts at the first version page. List pagination retains revision checks
because metadata can legitimately change active filters and some sort fields.

Administrators can select **Edit details**. It edits display title, sort title,
year, rating, synopsis, cast, directors, writers, producers, studios and genres
across the source group's available versions. Credits use one name per line. The
administrator's Advanced **Purchase details** section shows one combined set of
purchase values for the source-defined movie group, regardless of which version
holds them. A version link alone does not establish an edition, so all formats
share the same summary. Populated receipt fields take precedence, with missing
values filled from unambiguous receipt or manual group values. The section
reports truncated results and displays a clickable Store link for recognized
Kaleidescape Store paths.

The missing-purchase-information sensor and filter consider groups with at least
one available scanned edition. Their date, price and unavailable-flag evidence
includes retained editions in that same source/group, even when the
invoice-owning edition disappears from a later scan. The invoice stays with its
original edition; no format is inferred or link reassigned. A fully absent group
is excluded from completeness counts, and unlinked invoices do not supply
evidence to their former group.

The expanded section's **edit** link opens one dialog for purchase fields and
**Purchase information unavailable**. Checking it hides the fields and
suppresses the missing-information sensor/filter without clearing stored values.
When multiple receipts exist, select the receipt to edit; a value from another
receipt is read-only until its receipt is selected. Conflicting saved values are
flagged for review. Prices use a currency prefix and two decimal places; zero is
a known value. Purchase fields do not appear in **Edit details**. Receipt edits
retain identity checks and audit history, and matching manual values and the
unavailable flag are saved atomically and included in reversible receipt
corrections. All group edits check the snapshot and preserve exact-request
retries.

Source identity, runtime, formats, file/cache paths, memberships, watched state
and viewing records cannot be edited in the movie metadata editor. Raw scan
identity remains unchanged; display overrides survive future scans. Edits check
the movie snapshot and preserve the exact request after an uncertain save.

Schema 22 adds nullable `library.sort_title`. Alphabetical sorting uses this
value, then the display title, then the scanned title. A blank sort title resets
that override. It works in List/Covers and both sort directions. Portable
Library exports include the sort title, and reviewed imports fill a missing sort
title while preserving an existing one. Manual descriptive overrides stay in
protected enrichment JSON and private SQLite backups.

**Edit details → Restore original metadata…** is administrator-only and requires
an explicit confirmation. It removes provider caches and reviewed
display/artwork overrides, clears sort titles, and restores scanned metadata
across all versions, including temporarily unavailable editions. It preserves
source records, purchase history, collections and viewings. It does not delete
cached image files shared by other entries; normal cache eviction handles unused
bytes. Background enrichment is paused for this group, including responses
already in flight. Explicitly scraping and applying new reviewed data reenables
background enrichment.

## Compact footer

Basic mode shows global movie-group totals for each status using the selected
labels. A bold blue Matches count appears only while search or filters are
active; global totals remain unchanged. Multiple versions count as one movie per
collection, and a movie can count in multiple statuses. Unknown statuses are
included in Total. Per-page and covers-per-row labels are omitted. Collection,
artwork-cache, sync, scraper and enabled purchase-cost details remain visible
only in Advanced mode on desktop. Navigation and the refresh/sync actions stay
on the same sticky footer.

On phones, the footer keeps totals/matches on one compact line, with short
refresh/sync buttons and square paging icons only for multipage results.
Administrator cache/scraper details remain in the desktop footer and detailed
dialogs. Mobile shortcut controls reuse the same search, filter, sort and
preference behavior as desktop controls.

## Collection management

Administrators can enable **Settings → Library → Allow collection changes**; it
requires Library and collection sync. Open a movie, choose its exact version and
open **Collection**. Collection names are read from the last successful Library
sync, so opening the dialog does not contact the server. The action is queued
and the dialog can close immediately. Up to ten changes can be queued, working
or waiting for the subsequent scan. Changes run one at a time; a related change
for the same version must wait until the earlier one finishes. Conflicting
Watched/Unwatched requests are rejected with guidance.

The refresh icon in **Manage collections** reads the selected version's explicit
collection field from its details page and updates only that version's cached
membership. It requires a recognized complete field, matching title and known
collection names; otherwise it preserves the cache and asks for a Library sync.
It is unavailable while a scan or collection change is active and does not
resolve an unconfirmed write. Library notifications appear in a dismissible
upper-right overlay. Their left edges use green for success, yellow for
warnings, blue for in-progress work, red for errors and gray for neutral
information. Dismissing a finished job removes its notification, while an
unconfirmed change remains recoverable from the movie dialog.

Catalog and collection page requests and collection submissions allow up to five
minutes each; a collection operation has a 30-minute overall limit and a full
Library sync has a one-hour limit. A slow server can therefore leave work
pending for several minutes. Artwork and individual details retain their shorter
timeouts. Failures before a submission is attempted release the uncertainty
barrier; a possible submission remains unconfirmed until checked or
acknowledged. The movie details show recovery controls when an earlier
unconfirmed change blocks collection actions.

| Kaleidescape collection | Companion label | Supported change                                  |
| ----------------------- | --------------- | ------------------------------------------------- |
| Favorites               | Favorites       | Add or remove                                     |
| WatchSoon               | Watch Soon      | Add or remove                                     |
| New                     | Unwatched       | Move to/from Played                               |
| Played                  | Watched         | Move to/from New                                  |
| Paused                  | In Progress     | Remove only; starting playback creates this state |

New and Played are mutually exclusive moves, not independent add operations. If
neither status is present, the server's observed form does not supply a safe
move; review the device state. Existing non-protected custom collections can
still receive additions. Their removal remains unavailable because the generic
form has not been verified. Collection creation, renaming, deletion and bulk
edits are not supported.

The footer reports queued and in-progress changes. A pending badge is faded and
shows a spinner; a notification reports completion after the Library has been
rescanned and the selected version's requested membership is confirmed. One scan
can reconcile a batch. A failed scan does not imply that the device write
failed: inspect the device and run **Sync now**, rather than blindly repeating
an action. The selected version is the write target; a grouped badge can also
reflect other versions in that group.

### Server contract and recovery

The `26.1.2-27147` local browser uses a multipart `main` form. Companion sends
browser-style field headers without per-field content types; this device
silently ignored aiohttp's default multipart field headers despite returning a
redirect. Its add action uses `Add-To-Collection` and the form's offered opaque
value. The five observed removal actions are `Remove-Often`, `Remove-Soon`,
`Remove-New`, `Remove-Played` and `Remove-Paused`. Each requires the checkbox
for the exact selected version and a fixed collection-view route. The bundled
pyk patch checks the form, action, route, complete listing and checkbox before
sending; it never executes page JavaScript or retries a POST. An HTTP response
is not membership proof.

Before each write, Companion verifies the cached source/version against a fresh
catalog and reads the full affected collection. Watched/Unwatched moves read
both New and Played. A durable intent records hashes of the expected complete
sets before the one-shot POST. Readback must match the expected sets, including
all other titles, before the device change is confirmed. A lost response is
resolved by readback when possible; a mismatch or interrupted read remains
**unconfirmed**. **Check membership** reads again without another POST. An
administrator may acknowledge an unconfirmed result only after inspecting the
server. Acknowledgement does not undo or prove the write. Unconfirmed work
blocks further collection writes.

Queue records are private administrator data in schema 28. Browser disconnects
do not cancel accepted work; the actor, opt-in, source and permissions are
rechecked before a send. On integration restart queued/working/syncing items are
reported as interrupted or unconfirmed, and are not automatically resent. Backup
and unload stop new work and drain accepted operations. Completed/failed history
is bounded; uncertain intents remain available for recovery. A source or
configuration change, inaccessible version, stale review, full queue or
unrecognized form fails closed.

The owner explicitly authorized a live test of one title: Favorites and Watch
Soon add/remove, and Played → New → Played, were read back with the complete
collections restored to their initial memberships. The Paused removal form was
observed but no Paused mutation was tested. Broader firmware, custom-collection
removal, concurrent external writers, large-library performance and live Home
Assistant integration qualification remain open. Normal automated checks use
fictional fixtures and never contact the server.

## Badge meanings

| Badge                         | Criterion and cover placement                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Watched · green check         | Source Played status; top-left triangle                                                           |
| In progress · amber ring      | Source Paused status; top-left triangle, with no invented completion percentage                   |
| Watch Soon · blue clock       | An available version belongs to WatchSoon; top-left triangle when neither In progress nor Watched |
| Recently Added · purple stars | Retained `recently_added` sensor batch membership or a recent linked purchase; top-left triangle  |
| Favorites · gold star         | An available version belongs to Favorites; independent top-right bookmark                         |

Library options choose **Modern format** (the default: Unwatched, Watched, In
progress) or **Kaleidescape format** (New, Played, Paused). The choice only
renames the same collection-derived statuses. One Movie status filter groups
Watched, Unwatched, In progress, Favorites, Watch Soon and Recently Added; any
selected badge can match. Other filter categories still combine with that group.
All, Unknown and No status are omitted, and the source collections represented
by the status badges are not repeated in the Collection filter. The Recently
Added choice uses the same retained batch and purchase window as its badge.
Unwatched/New remains available as a filter and in list and movie details but is
not shown as a cover badge.

**Library badge style** is a per-user, per-layout choice between **Icons**
(default) and **Text**. Icons use the existing cover corners and list pills;
Text uses rectangular labels in covers and lists. In Text mode, a Recently Added
label appears below the primary status label when both apply, and the Favorites
label remains independent. The choice does not alter badge data, filters,
format/content-rating badges or the movie-details dialog.

Watched and In progress can both appear in lists and details if their source
memberships overlap. Covers prioritize the upper-left status as In progress,
Watched, then Watch Soon. If a movie is also Recently Added, a narrow purple
edge appears behind that status; otherwise Recently Added uses its own purple
corner. The Favorites bookmark remains independent in the upper-right corner. A
suppressed badge does not change its filter membership. Recently Added is
independent of the Kaleidescape **New** collection: it includes the retained
addition batch and any purchase linked to the same source-defined movie group
within the configured purchase window. Administrators set this window in
**Settings → Library → Recently Added purchase window**, in whole weeks from 0
to 520; it defaults to 2 and 0 disables the purchase-date portion. The boundary
date is included, future dates are not, and dates use Home Assistant's local
calendar day. The recently added sensor batch itself is unchanged. These use
cached source statuses and refresh with collection sync, rather than adding
playback polling or treating journal facts as device collection membership.

The Favorites badge and filter use the same group-wide source collection
membership. Movie details show it once even when the collection name is also
included in the movie's listed collections. A membership on any available
version marks the group as Favorites.

Text collection/status badges use compact outlined gradient pills: All in slate,
New in blue, Unwatched in gold, Watched in green, Favorites in purple and In
progress in amber, each with a local line icon. Their compact icons and padding
match inline format badges; movie-detail badges share the same 28 px minimum
height as the format and rating buttons. Movie-detail filter links and filter
checkboxes retain their existing actions. Selecting a movie-detail format,
content rating, status or collection badge replaces the Library filters with
that selection, including **Recently Added**; selecting **All** clears them.

Hidden collection names affect labels and filters, not status/favorite/Watch
Soon classification. Recent identity uses the source-scoped group, never title
text, so remakes remain distinct. The first scan establishes a baseline.
Unchanged scans, metadata imports and new formats of known groups do not replace
the batch. Schema 11 stores an internal source batch marker and matching version
markers. Older title-only sensor snapshots cannot safely identify groups; their
sensor values remain intact, and recent badges start with the next batch of
newly discovered groups.

Covers show the highest known video format across the group's versions: **8K >
4K Cinematic > 4K > HD Cinematic > HD > SD**, along with known Dolby Atmos or
DTS:X audio badges. Unknown video quality produces no video badge; SDR/HDR10
alone does not imply SD/HD. Lists retain all known video/HDR/audio format chips.
Resolution alone does not imply HDR or audio capability. Lists also show
collection-based statuses plus independent favorite below the title. Indicators
have accessible labels and use text/CSS without remote assets or new
dependencies.

Library Options independently controls video and audio format badges in cover
and list views. Existing preferences inherit the old format toggle for both
settings, then can be changed independently. Movie details and format filters
remain available regardless of these presentation choices.

## Cover image retention

Requests still begin only when a cover is visible, with three concurrent
requests and five-second request budgets. An offscreen or hidden page cancels
unfinished requests. Successfully loaded covers remain in a private in-memory
LRU cache for this mounted Library session, reusable across scrolling,
pagination, view changes and title popups. It holds at most 1000 images and 128
MiB of compressed image bytes. Eviction prefers the least recently used
offscreen image, revokes its object URL, and clears any mounted references. If
visible images alone exceed the budget, they can also be evicted. Browser image
decoding/DOM memory is additional and not bounded by the compressed-byte cap.
Evicted images can download again when revisited.

The cache uses entry/dataset scope and the content-hash artwork key. Changed
artwork bytes therefore use a new key. It is not local storage, a cookie, a
service worker or a shared HTTP cache. Leaving Library, disconnecting/changing
accounts, role/scope changes, detected access denial or opt-out revoke all URLs
and discard the cache; late requests cannot repopulate a disposed cache. Closing
a title popup or hiding the browser retains already accepted covers within the
same session. No tokens, source URLs or images enter UI settings.

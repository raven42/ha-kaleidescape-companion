# Library, artwork and collections

Library sync is **disabled by default** and independent from playback recording.
The Library tab is visible but disabled until an administrator saves **Settings
→ Enable library sync**. The same options are available under the integration's
**Configure** action. Once enabled, all active HA users can browse the shared
cached library and artwork. Settings and **Sync now** remain administrator-only.

The temporary PoC uses pyk's `LocalLibrary` to parse local browser pages and the
add-only form. Companion supplies its guarded HA HTTP transport and retains
caching, scheduling, identity, authorization and durable collection outcomes.
This requires the privately bundled patched pyk source described in the
[migration plan](../plans/plan-pykaliedescape-migration.md).

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
| Enable library sync     | Off     | Starts a read-only sync after setup; recurring sync requires an HA automation                                      |
| Library hostname        | Blank   | Attempts `http://my-kaleidescape.local`; an explicit value overrides discovery                                     |
| Allow Add to Collection | Off     | Administrators may explicitly add one selected version to an existing offered target; requires collection sync     |
| Sync collections        | On      | Cache available collections and exact title memberships                                                            |
| Sync title details      | On      | Fetch available cast/director/writer/studio, genres, synopsis, and runtime                                         |
| Sync artwork            | Off     | Fetch validated covers into the private cache; can require detail-page requests even with detail metadata disabled |
| Default landing page    | Journal | Used without an allowed URL tab; reader/disabled pages fall back                                                   |
| Artwork cache limit     | 512 MiB | 32–4096 MiB, separate from the database; older covers are evicted when full                                        |

Library view/count, applied filters, sort, cover size and column widths are
[personal database preferences](design-user-interface.md#personal-and-shared-preferences),
saved when changed. Hidden collection names are shared database preferences in
Settings, also saved immediately without reloading HA. The default landing page
remains native.

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
Played/Paused continue to determine status even if their names are hidden. Clear
the preference to show the names again without resyncing.

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
uses Unicode case folding; the global personal fuzzy-search option additionally
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
take more work than literal/quoted search, and different users may have
different saved fuzzy-search choices.

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
[preference limits and badge criteria](design-user-interface.md#personal-and-shared-preferences).

The summary shows the union of visible collections/formats/content
ratings/years, minimum–maximum known runtime, earliest detection and known
purchase date, and a source status priority of In progress, Watched, Unknown,
then Unwatched. Sorts use the earliest year, minimum known runtime, first
visible collection name, and purchase date with detection as fallback, as
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
that first detection date.
[Reviewed imports](design-data-management.md#reviewed-merge-imports) can fill a
missing calendar purchase date on the schema **9** title-version row. Added on
prefers that date, falling back to first detection; detection itself is never
rewritten. Download dates remain unknown. Hidden collection preferences use
known-name checkboxes and custom values in the shared database settings row,
migrated once from former HA options. Changing the configured origin creates a
separate source namespace, even if it reaches the same physical system.
Cross-host identity reconciliation is deferred.

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
opted-in [Add to Collection](design-library.md#add-to-collection) action is the
only supported vendor edit.

The search toolbar sticks to the top of the scrolling Library. On phones it
becomes square Search, Filters, Clear, Sort/Randomize and Options shortcuts,
with search in a popup and the sort method in Options. Refresh cached data and
administrator Sync now are also inside Options. A compact sticky footer holds
global movie/status totals, with a blue match count for active search/filter
criteria. Advanced mode adds collection counts, last catalog sync, artwork usage
and compact scraper progress. It is one shared status/navigation bar;
First/Previous/Next are omitted when all matching titles fit on one page,
including All. Options contains detailed freshness timestamps and
individual-version counts. Source Played is displayed as **Watched** in browsing
labels; Options explains the mapping while API/device collection names remain
unchanged.

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
[Add to Collection action](design-library.md#add-to-collection) adds a separate,
explicit administrator-only POST capability; automatic synchronization remains
GET-only. Removal remains deferred.

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
HD, 4K, 4K Cinematic, SDR, HDR10, Dolby Vision and Dolby Atmos when present.
Wholly unknown source labels remain filterable. Existing API/source-label
filters remain accepted. The 4K category represents non-Cinematic 4K metadata;
Cinematic has its own category. HDR, Cinematic and audio badges require their
own positive metadata; resolution alone does not supply them. Unrated selects
movie groups without a known rating on any available version; a missing rating
on one version of a rated movie does not make that movie Unrated. Years are
string values such as `2025` in API filters and preferences. Unknown years are
not linked or fabricated.

All facet selections, including clicked criteria, retain the existing
100-value/500-character bounds. SQL uses one bound JSON array per selected
category, keeping queries below older SQLite's 999-variable limit even with 200
hidden collections. Source/preference revision and payload limits still apply.
New preference fields inherit empty defaults without a schema migration or HA
reload.

## Fuzzy search option

**Library → Options → Fuzzy search** saves immediately to the signed-in user's
global search preferences. The same option appears in Journal Options. It starts
enabled in the UI and applies to the main title/cast/director search, the
filter-values search and compatible actor/director suggestion API calls. Turning
it off requires the entered text to occur continuously, ignoring case; literal
partial matches still work, and punctuation/wildcard characters remain ordinary
text. Turning it on also tolerates small word misspellings/transpositions,
word-order differences and diacritics. Selected facet values remain exact in
either mode. Mode changes invalidate pending suggestions and refresh results
from page one, including All/Covers views. Other users are unaffected; Journal
and manual-viewing pickers use the same saved mode. Direct list/suggestion API
calls retain a literal default when `fuzzy` is omitted.

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
rules as the missing-metadata and missing-artwork sensors. The filter saves with
other personal browsing preferences. Administrators also have **Missing purchase
information**, using the same group-level date/paid/retail completeness rules as
its sensor. It adds no warning badge and omits movies explicitly marked
**Purchase information unavailable**. A role change clears this private filter
from reader requests. Covers and List view separately indicate unresolved
scraper match conflicts. See
[manual resolution](design-metadata.md#review-a-single-title).

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
an expandable **Purchase details** section showing total library cost, total
retail price, savings and unique transactions. Totals load only when that
section opens or the footer option is enabled, then refresh with source revision
changes. Reopening the section refreshes the totals even when a revision has not
yet changed. Household readers have neither the purchase-display toggle nor
purchase totals.

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
→ Scrapers → Preferred metadata sources**. Cached values are projected without
rewriting raw scan facts; explicit reviewed title edits win. See
[source selection](design-metadata.md#preferred-metadata-sources).

An open details popup reads fresh versions independently of its Library list's
older revision. Metadata changes refresh the selected movie without dropping its
dialog or selected version. Version pagination still detects stale reads and
restarts at the first version page. List pagination retains revision checks
because metadata can legitimately change active filters and some sort fields.

Administrators can select **Edit details**. It edits display title, sort title,
year, rating, synopsis, cast, directors, writers, producers, studios and genres
across the source group's available versions. Credits use one name per line.
Purchase date, paid price and retail price apply to the selected version. The
**Purchase information unavailable** checkbox applies across every version of
the group, including temporarily unavailable versions. It suppresses the
missing-purchase-information sensor/filter without clearing stored values or
adding a badge. Prices use a currency prefix and two decimal places; zero is a
known value. Linked price edits update the earliest invoice in
`purchase_records`; without an invoice, manual prices remain on Library. A date
edit is a Library date override and does not rewrite invoice identity.

Source identity, runtime, formats, file/cache paths, memberships, invoice
identity/order/link, watched state and viewing records cannot be edited here.
Raw scan identity remains unchanged; display overrides survive future scans.
Edits check the movie snapshot and preserve the exact request after an uncertain
save.

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

Basic mode shows global movie-group totals: Total, Unwatched, Watched and
Paused. A bold blue Matches count appears only while search or filters are
active; global totals remain unchanged. Multiple versions count as one movie and
follow the same Paused-before-Watched precedence as the Library list. Unknown
statuses are included in Total. Per-page and covers-per-row labels are omitted.
Collection, artwork-cache, sync, scraper and enabled purchase-cost details
remain visible only in Advanced mode on desktop. Navigation stays on the same
sticky footer; refresh/sync are in Options.

On phones, the footer keeps totals/matches on one compact line, with square
paging icons only for multipage results. Administrator cache/scraper details
remain in the desktop footer and detailed dialogs. Mobile shortcut controls
reuse the same search, filter, sort and preference behavior as desktop controls.

## Add to Collection

Administrators can enable **Settings → Allow Add to Collection on the device**.
It is off by default and also requires enabled Library and collection sync. Open
a Library title, select its individual version tab, and choose **Collection**.
The dialog reads the server's offered targets. Choose one existing collection
and **Add selected version**. Viewing history and purchase dates are not
changed. Removal, collection creation/renaming/deletion, and bulk/group edits
remain outside this implementation.

### Protocol capability

The
[official control protocol, revision 17](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
was rechecked on 2026-10-31. `GO_MOVIE_COLLECTION` and `GO_MOVIE_COLLECTIONS`
select onscreen views; they do not change membership. The command catalog has no
movie collection membership add/remove command. The temporary patched-pyk
`LocalLibrary` provides the HTTP add capability used by Companion; an accepted
upstream release remains part of the migration gate. TCP view commands cannot
replace the HTTP add path. Removal still needs an observed, verified web request
contract and its own guarded mutation/recovery path; no guessed command or
removal request is sent.

### Observed form and compatibility

Read-only inspection on 2026-10-28 of the `26.1.2-27147` interface found the
fixed `main` Movies form: POST, multipart/form-data, current `/movies` action.
The button uses `submit_parent_form_once( event, 'Add-To-Collection' );`.
Submitted fields are `submit_type=Add-To-Collection`,
`add_to_collection_select`, and one `check-<source handle>=on`. Dropdown
JavaScript copies each option's hidden input value into the selector field.
Labels and wire values can differ; the backend resolves the fresh hidden value
instead of guessing from the displayed name. No source JavaScript is executed or
packaged.

The form is a firmware-dependent interface, not a documented stable API. No real
POST was sent during implementation. Successful real-device behavior, charset
handling, and version/group semantics still require operator validation. Normal
checks use fictional pages, mock transport and isolated databases only.

### Access and request scope

The existing authenticated HA WebSocket API exposes administrator-only commands:

- `library/collections/targets`: opaque `title_id` and source `revision`;
  returns offered, cached, visible collection labels after a bounded fresh form
  read.
- `library/collections/add`: request UUID, opaque `title_id`, one collection
  label, and expected source `revision`. Each request selects one exact source
  handle.
- `library/collections/check`: request UUID; performs read-only reconciliation.
- `library/collections/acknowledge`: request UUID and
  `confirmation=ACKNOWLEDGE`; retires an uncertain request locally without
  sending any device mutation.

All use the current entry/dataset scope. The backend resolves raw handles, form
fields, collection values and fixed routes. Hidden targets and protected labels
All/New/Played/Paused/Scenes/Trash/Deleted are rejected. Targets must be in both
the current cached collections and the source's add dropdown. No supplied URL,
path, method, arbitrary form, SQL, or action is forwarded. The opt-in, current
administrator, source/runtime identity, settings fingerprint and readiness are
checked before work and immediately before a possible POST, and access is
checked again before a result is returned. Checks/acknowledgments remain
available with collection additions switched off, as long as Library is still
enabled.

### Execution and durable outcomes

Scans and explicit collection operations share one source lock. An active scan
or collection operation returns Busy to new operations. A fresh Movies form must
still match the cached selected handle/group/title and expose its checkbox. A
complete target-collection GET establishes the expected membership set. A source
revision mismatch rejects the operation before POST.

Schema **8** adds private `library_collection_intents` alongside the shared
`requests` retry receipts. Before POST, a worker transaction records an
uncertain intent and actor/payload/source-bound UUID fingerprint. There is at
most one uncertain request per source and at most 10000 retained collection
receipts in the database. The receipt includes an expected-membership hash,
without storing a full member list. Confirmed/acknowledged intents clear their
temporary version, collection and hash fields; attribution, timestamps, outcome
and the retry barrier remain. UUID reuse with a different actor or payload
fails. SQLite snapshots and HA backups include these rows; portable JSON
transfers and journal purge do not remove them. There is no automatic receipt
pruning or replay.

Only one fixed multipart POST to the pinned configured LAN `/movies` route is
possible for a newly accepted UUID. Existing membership is a no-op, verified by
GET. TLS/Host/DNS pinning, disabled cookies/proxy environment use, size/time
limits and refused redirect following remain. POST responses accept 200 or
302/303 to exact relative `movies`/`/movies`; no redirect is followed. Responses
are bounded at 8 MiB. Operations have a 90-second budget, with existing
five-second DNS/connect and 15-second per-request limits.

After a possible POST, a complete target GET must match the expected set and
contain the selected handle before success is confirmed. Only that verified
collection snapshot updates cached memberships and source revision. Other
collections remain untouched; the global collection-snapshot timestamp is not
advanced. If the server affects additional versions or memberships, the
operation stays uncertain. The device and SQLite do not share an atomic
transaction.

Timeouts, response loss, crashes and cancellation after possible POST retain the
uncertain receipt. Repeating its UUID or choosing **Check membership** makes
GETs only and never replays the POST. New additions are blocked until it is
confirmed or an administrator explicitly acknowledges it after inspecting the
device. Acknowledgment records the acknowledging actor and permits a new
request; it neither undoes the earlier add nor proves it failed. Closed/reopened
pages and integration restarts retain pending requests in the Library warning
banner.

Accepted operations outlive browser cancellation. Backup/unload stops new work,
cancels scans and drains accepted collection work before pausing/closing SQLite.
Private previews/forms clear on role/connection changes and late replies are
ignored. In-flight or unconfirmed browser requests block implicit dialog
dismissal until checked; a known uncertain outcome can be closed and reviewed in
the banner.

### Operator validation

Build/check/package locally without deploying or mutating a device. In the Vite
fictional fixture, enable Library and the new option, select an individual
version, review the add dialog and cancellation. The fixture simulates the
operation. Real browser review remains with the operator.

On an isolated test deployment, first use a disposable existing collection and
one deliberately selected version. Verify the target, membership before/after,
unselected versions and unrelated memberships, refreshed UI/cache, and restart
reconciliation. Do not use Played/Paused or other protected collections for
tests. Successful form inspection and mocked tests do not replace this firmware
check. Removal will need its own verified contract and security review.

## Badge meanings

| Badge                       | Criterion and cover placement                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Watched · green check       | Source Played status, unless Paused takes priority; top-left triangle                             |
| In progress · amber ring    | Source Paused status; top-left triangle, with no invented completion percentage                   |
| Watch Soon · blue clock     | An available version belongs to WatchSoon; top-left triangle when neither In progress nor Watched |
| Recently Added · blue label | Retained `recently_added` sensor batch membership or a recent linked purchase; top-left label     |
| Favorite · gold star        | An available version belongs to Favorites; independent top-right bookmark                         |

Watched, In progress and Watch Soon are mutually exclusive. Progress or
completion takes precedence, followed by Watch Soon. Recently Added and Favorite
can accompany these statuses. The Recently Added badge is independent of the
Kaleidescape **New** collection: it includes the retained addition batch and any
purchase linked to the same source-defined movie group within the configured
purchase window. Administrators set this window in **Settings → Ecosystem →
Library sync**, in whole weeks from 0 to 520; it defaults to 2 and 0 disables
the purchase-date portion. The boundary date is included, future dates are not,
and dates use Home Assistant's local calendar day. The recently added sensor
batch itself is unchanged. These use cached source statuses and refresh with
collection sync, rather than adding playback polling or treating journal facts
as device collection membership.

Text collection/status badges use compact outlined gradient pills: All in slate,
New in blue, Unwatched in gold, Watched in green, Favorites in purple and In
progress in amber, each with a local line icon. Their compact icons and padding
match inline format badges; movie-detail badges share the same 28 px minimum
height as the format and rating buttons. Movie-detail filter links and filter
checkboxes retain their existing actions. Cover corner flags retain their layout
and mutually exclusive status behavior.

Hidden collection names affect labels and filters, not status/favorite/Watch
Soon classification. Recent identity uses the source-scoped group, never title
text, so remakes remain distinct. The first scan establishes a baseline.
Unchanged scans, metadata imports and new formats of known groups do not replace
the batch. Schema 11 stores an internal source batch marker and matching version
markers. Older title-only sensor snapshots cannot safely identify groups; their
sensor values remain intact, and recent badges start with the next batch of
newly discovered groups.

Covers show only the highest known video format across the group's versions:
**4K Cinematic > 4K > HD > SD**. Unknown video quality produces no format badge;
SDR/HDR10 alone does not imply SD/HD. Lists retain all known video/HDR/audio
format chips, including SDR, HDR10, Dolby Vision and Dolby Atmos. Resolution
does not imply HDR or audio capability. Lists also show the mutually exclusive
status plus independent favorite below the title. Indicators have accessible
labels and use text/CSS without remote assets or new dependencies.

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

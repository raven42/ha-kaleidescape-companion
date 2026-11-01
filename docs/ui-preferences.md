# Persistent UI preferences and Library badges

Library presentation settings live in SQLite's `settings` table, separate from
HA configuration. They save immediately when changed; no integration reload or
Save settings action is needed. Browsing preferences belong to the signed-in HA
user within this dataset. Other household users keep their own choices. Each
user also has separate desktop, tablet and mobile profiles.

## What is stored

Administrators can use the **Basic / Advanced** pill at the right of the main
view tabs. The `interface` preference area's `advanced_view` boolean defaults to
true and saves separately for each user and desktop/tablet/mobile profile. Basic
uses the household renderer, hiding management pages, editing, private
purchase/diagnostic information and scraper warnings. Advanced enables the
administrator UI. Actual HA account permissions remain authoritative. The
Library-only `show_system_buttons` preference is retired; legacy exports remain
importable and its old value is ignored.

When leaving an admin-only page or dialog, Basic navigates to the configured
landing page, or Journal if that landing page requires administrator controls.
Dirty drafts and pending writes retain their existing navigation guards. Screen
profile changes wait for dialogs/operations and mode-preference saves to settle.

| Scope                         | Values                                                                                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal Library preferences  | List/Covers, entries per page, cover size, title overlay, format/library/rating badge toggles, column widths, applied title search, selected collection/actor/director/rating/status/genre/year/format filters, sort field, direction and administrator footer-cost toggle |
| Personal search preferences   | One fuzzy-search choice across Library, Journal and manual title pickers                                                                                                                                                                                                   |
| Personal Journal preferences  | Entry list or Calendar view, calendar day-row size and fit-to-screen toggle, set in Journal Options                                                                                                                                                                        |
| Personal Database preferences | Table, row count, system-table visibility and per-table sort/order                                                                                                                                                                                                         |
| Shared UI preferences         | Hidden collection names, edited by administrators in Settings using known-name checkboxes and custom values                                                                                                                                                                |
| Native HA options             | Default landing page, playback sources and recording rules, Library connection/sync/artwork options, collection-add opt-in and device-control/player/launch settings                                                                                                       |

Open **Options** beside Filters/Clear Filter for view type, entries per page,
cover-art size (in Cover mode), title overlays, format/library/rating badge
toggles and visible cast count (1–30, initially 8). Cast uses provider billing
order when known; the full cast remains available under More credits. Random
sorting replaces the direction button with **Randomize**; the shuffle seed saves
per HA user, shared across display profiles, and remains stable across pages and
reloads. Sort/order controls are in the main sticky Library toolbar and save to
the same personal profile row. Choices save immediately and the popup stays open
while adjusting them; Done, Escape or a backdrop click closes it without rolling
back accepted changes. Titles, format and library badges start enabled. Titles
controls the cover overlay; list titles always remain available. Format and
library badge switches apply to both views. Existing preference rows receive new
toggle defaults on read without changing saved choices or row revisions. Ratings
always appear in details and rating filters; a lower-right cover rating is
optional and initially disabled. Options contains detailed freshness/version
counts, while one sticky footer shows compact counts, administrator artwork use,
basic scraper progress and last catalog sync beside refresh/sync actions.
Pagination buttons appear only when there is another result page. Search stays
sticky and debounces title/actor/director matching. The default landing page
remains in native HA settings.

List and 100 entries are the initial browsing defaults. Page size offers **25,
100, 1000, All**. Covers rounds numeric targets to a whole number of measured
rows and adjusts when resized. The final catalog remainder stays visible even
when it cannot fill a row; titles are never hidden or duplicated to fill space.
All loads every matching group using revision-bound requests of up to 1000
groups each, with a 10,000-group and 32 MiB aggregate metadata limit. Individual
responses retain the 8 MiB API limit. Artwork remains visibility-loaded with
three simultaneous requests. Large catalogs increase DOM and browser memory; All
is not a virtualization feature.

View, page size, sort and applied filters save on use. Search saves after its
300 ms input debounce or immediately on Search/Enter; filter drafts save on
Apply filters. Clear Filter saves an empty search and empty facet selections
while preserving view, sort and page size. Clickable detail values replace the
current criteria: names become a fresh title/actor/director search; year, genre,
collection, watched status, rating and format become one exact facet with an
empty search. Both save immediately and reset pagination. Cover size saves when
its slider change finishes; column widths save after resizing. Closing a filter
draft does not persist it. A failed save leaves the local choice visible with an
explicit retry message. Reopening Library or reloading restores accepted
settings. Another open tab loads them when remounted; this does not add live
cross-tab subscriptions.

On upgrade to schema 11, old HA Library defaults seed a household initial
snapshot once. A legacy count rounds up to the next offered numeric size (for
example, 50 becomes 100). Hidden names migrate to the shared database row. The
three obsolete Library UI options are then removed from HA entry data and
options. New users inherit the initial snapshot until they save their own
preferences; their later choices do not change that snapshot. The landing page
remains a native option. The existing `companion_page` URL parameter retains
only the selected main tab, not filters, searches or user IDs.

## Persistence and access contract

`ui/preferences/get` and `ui/preferences/update` accept the existing entry and
dataset scope and derive ownership only from the authenticated active HA user.
An update adds a cryptographic request UUID, row revision and validated field
patch. There is no caller-supplied owner. `ui/shared/get` and `ui/shared/update`
use the same contract but require an active administrator. These are scoped HA
WebSocket commands, with no new HTTP/proxy or device operation.

The worker atomically patches the latest row: different fields preserve one
another, and the last accepted edit to the same field wins. Preferences are
reversible setters rather than journal corrections; their revision is not an
optimistic edit lock. Exact UUID/actor/payload retries return the original row
revision without a second write. Retry receipts store a fingerprint and
revision, not copies of search/filter text. Account changes clear browser data
and ignore late responses; a previously accepted write may still commit.

UI revisions are independent of journal/catalog revisions and do not invalidate
content pages or reviewed imports. Administrator inspection of the `settings`
table uses schema 12's monotonic settings counter to reject stale pages even
when an administrator deletes a settings row. Database view/count/system-table
visibility and per-table sorts use a separate personal row; see
[Database administration](database.md). SQLite exports and HA backups contain
user IDs, searches and selections and must remain private. Portable JSON/SQLite
merge imports ignore settings, receipts and operational batch IDs.

Personal values are allowlisted and bounded to 16 KiB, 500-character searches,
at most 100 selections per facet, six 80–800 pixel column widths, and a 90–300
pixel cover target. Shared hidden names retain the 200-name,
256-character-per-name limit. These controls do not grant journal/catalog edit
access or establish isolation against code running inside HA.

## Badge meanings

| Badge                    | Criterion and cover placement                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Watched · green check    | Source Played status, unless Paused takes priority; top-left triangle                                        |
| In progress · amber ring | Source Paused status; top-left triangle, with no invented completion percentage                              |
| New · blue label         | Retained `recently_added` sensor batch membership, only when neither In progress nor Watched; top-left label |
| Favorite · gold star     | An available version belongs to Favorites; independent top-right bookmark                                    |

Watched, In progress and New are mutually exclusive. Progress/completion
suppresses New even while the movie remains in the sensor batch; the sensor
batch itself is unchanged. These use cached source statuses and refresh with
collection sync, rather than adding playback polling or treating journal facts
as device collection membership. Favorite can accompany any of the statuses.

Text collection/status badges use compact outlined gradient pills: All in slate,
New in blue, Unwatched in gold, Watched in green, Favorites in purple and In
progress in amber, each with a local line icon. Their compact icons and padding
match inline format badges; movie-detail badges share the same 28 px minimum
height as the format and rating buttons. Movie-detail filter links and filter
checkboxes retain their existing actions. Cover corner flags retain their layout
and mutually exclusive status behavior.

Hidden collection names affect labels and filters, not status/favorite
classification. Recent identity uses the source-scoped group, never title text,
so remakes remain distinct. The first scan establishes a baseline. Unchanged
scans, metadata imports and new formats of known groups do not replace the
batch. Schema 11 stores an internal source batch marker and matching version
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

## Browser review

Run `bash dev/dev.sh preview` and open
`http://127.0.0.1:5173/review.html?library=1&companion_page=library` for
fictional layout review. Open Options and check both narrow and wide layouts,
exclusive top-left status/independent top-right Favorite, the single highest
cover format, overlay switches, cover resizing, and all four page sizes. Switch
tabs and return to verify restoration. The fixture keeps mock settings in page
memory; a full reload resets its data. Use an isolated HA instance to verify
durable reload behavior, two users' independent preferences, shared hidden-name
updates without an integration reload, and visible save failures/retry. On
isolated HA, scroll back through downloaded covers and check that retained
images need no second network request; then leave Library or change accounts and
verify cleanup. Automated DOM tests do not replace this user browser review.

## Global search option

Journal and Library both offer **Options → Fuzzy search**, controlling the same
personal setting in the database's `search` row (`area=search`). It defaults to
enabled and applies across views: Journal search, Library title/cast/director
search, filter and people completion, and manual-viewing title pickers in
Journal and Database. Off uses literal case-insensitive partial strings; on
additionally tolerates bounded spelling and word-order differences. Selected
facets and Database query syntax remain exact. Other users retain their own
choices.

Double quotes around a whole search override fuzzy matching with an exact
whole-word phrase. `"Tom Holland"` excludes `Tom Hollander`; the unquoted query
matches both. This applies to Journal/Library, suggestions, manual title
pickers, import review and plain Database searches. People links insert the
quotes. Structured Database query values retain their existing syntax. The
personal Library profile also saves the **Scraper conflicts only** checkbox.
Conflict overlays remain visible when library/status badges are hidden.

Changes save immediately, with the current mode restored when opening another
view or reloading, without changing HA options. Startup consolidates old Journal
and Library choices using the most recently saved preference row, removes the
obsolete per-view fuzzy-search keys, and preserves other Journal/Library
preferences. An empty legacy Journal row is removed; a saved Calendar view is
retained. An existing global choice is never overwritten. This uses the existing
settings table and does not require a database schema change.

The active-user ownership, strict boolean validation, scoped access and exact
actor/area-bound retries still apply. Shared preferences remain Library-only;
regular users cannot inspect another user's search preferences.

## Journal layout

**Journal → Options → Calendar view** saves `view: calendar` or `view: list` in
the personal `journal` row (`area=journal`). List is the initial default.
`calendar_size` is an integer day-row height of 60–320 pixels (default 180);
`calendar_fit` is a boolean, initially false. The slider updates locally while
dragging and saves on release; Fit saves immediately and temporarily replaces
the slider size with a viewport-based height. Disabling Fit restores the saved
size. These layout changes do not reload month data or discard loaded covers.
The choice is independent of global fuzzy search and does not reload HA. Both
household roles can change their own layout. The displayed month and Journal
search/status remain temporary component state; opening Calendar starts at the
current local month. See the [month view guide](calendar.md#journal-month-view).

## Administrator purchase display

`show_library_cost` defaults to false in personal Library settings. The
administrator's Library Options toggle saves immediately and restores after
navigation/reload. The expandable Purchase details section is administrator-only
and its open state is not persisted. Regular users receive no monetary data,
even if their saved preferences contain the footer flag after a role change. See
[purchase totals](library.md#administrator-purchase-totals) for calculation
scope and missing-data behavior.

## Display profiles

Desktop (over 1024 CSS pixels), tablet (601–1024) and mobile (600 or less) keep
independent Library, Journal, Database and cross-view search preferences. This
includes cover/calendar sizes, display modes, page counts, filters, sort methods
and directions. Width categories use no device fingerprint or cookie. Settings
are still private to the authenticated HA user and dataset.

The one personal cross-profile value is `library_random.random_seed`. Profiles
independently choose Random; when both do, they use that shared seed. Randomize
changes it for the user. New reads use the latest seed; if it changes during
pagination, refresh the first page rather than mixing shuffles. Identical
filters yield the same relative order, though different page sizes show
different subsets. Existing rendered screens update on their next data read.

Profile keys are `library:desktop`, `library:tablet`, `library:mobile` (and the
same suffixes for `journal`, `database`, `search`). Unsaved profiles inherit the
legacy user row or household defaults. The first accepted profile edit creates
its independent row. The optional API `profile` is a fixed enum; ownership is
always derived from HA authentication. Omitting it retains the legacy contract.
Request receipts bind the profile too. Household hidden collections and native
HA options remain shared as before.

Crossing a width boundary reloads that format's preferences after active
dialogs, content writes, and pending/failed preference saves settle. Opening a
phone's keyboard alone does not create a new width profile. Resize-driven visual
layout continues during a deferred switch. Settings export includes all
profiles; older unprofiled settings files apply to all formats on import. The
settings file limit is 256 KiB.

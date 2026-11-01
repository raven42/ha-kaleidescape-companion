# Optional external movie metadata

External metadata is separate from the local device scan. Administrators can
enable **Kaleidescape public store (experimental)** and/or **TMDB** in
**Settings → External movie metadata** or the integration's native Configure
flow. Both are disabled by default and require Library sync. Disabled providers
make no external requests; the ordinary Library, controls and recording keep
working without them.

Research sampled a
[public movie page](https://www.kaleidescape.com/movie-store/movie/the-martian-2015)
and the store's
[public role map](https://www.kaleidescape.com/movie-store/assets/v299300/store.js).
Those pages expose structured store data suitable for an initial parser. It
remains an undocumented interface, so parser failures stop a pass rather than
guessing. TMDB uses its official API. See the independent
[provider package](../lib/scrapers/README.md) for source research and usage.

## Setup and operation

1. Enable the desired provider. For TMDB, enter your own API key or API Read
   Access Token. A blank credential keeps the saved secret; **Remove saved TMDB
   credential** explicitly clears it. Existing secrets are never prefilled into
   settings responses.
2. Set the shared request rate, **0.1–10 requests/second**, default **2**. Save
   settings. Providers share one limiter; store robots directives can reduce the
   rate further. There is no automatic retry after HTTP errors or rate limiting.
3. A successful device catalog scan starts enrichment for uncached or week-old
   metadata. **Refresh metadata** in Settings requests a fresh pass with saved
   configuration. **Check metadata status** shows progress, updates, skipped
   matches and an owned error code. Repeated clicks coalesce into one pass.

Automatic store enrichment initially needs an existing Library purchase `href`;
it never invents store slugs. TMDB initially needs the Library title and a known
release year. An administrator-approved match can supply the provider identity
instead, including for a movie without a store link or scanned year. Matching is
conservative: unresolved ambiguous or mismatched movies are skipped and marked
for review. Skipped totals are provider attempts, so one movie can contribute
twice. A pass stops after one hour; successfully cached results remain
available. It supports up to 10,000 scanned versions and processes one movie
group at a time. Unknown years and missing credentials/links are skipped without
requesting a movie.

These are internet lookups: the provider can see the request, movie identity and
the HA host's network address. No watch history, notes, invoices, prices or
order IDs are sent. Store access is public, with no login/cookies. TMDB
credentials stay in HA's native private entry configuration and can be included
in a full HA backup; secure those backups accordingly.

## Preferred metadata sources

**Settings → Scrapers → Preferred metadata sources** provides shared defaults
for cast, directors, writers, producers, studios, synopsis, genres, distributor,
each supported rating, cover art and landscape images. Save settings to apply.
The **Prefer TMDB · keep Kaleidescape covers and RT scores** preset selects TMDB
for descriptive fields and landscapes, retaining the player cover and store RT
scores. Individual dropdowns can then be adjusted independently. These are
backend settings, not personal browsing preferences, and belong to the Rules
category in settings transfer.

- **Automatic** retains the existing merged-credit behavior and fills missing
  descriptive facts from available cached providers.
- **Original library data** uses only the scanned field, without provider
  fallback. Choosing it for landscapes hides the provider image.
- A named provider uses its populated value first, then another cached provider,
  then scanned data. Explicit source selection replaces merged credit lists;
  missing facts still fall back. Per-title manual/reviewed choices take priority
  over these defaults, including image choices.

Selection never enables a scraper or changes source identities. Switching
between already cached values updates Library details, search and facets without
a new scrape. Provider caches remain available after disabling future requests.
Changing preferences invalidates old Library pages so filters are not combined
across different projections.

**Kaleidescape library cover** means the original edition-specific image cached
from the player; store search thumbnails do not replace it. **TMDB** covers use
a separate cached `w500` poster. To populate them, enable TMDB and Sync artwork,
select TMDB for Cover artwork, save, then choose **Refresh metadata**. Normal
seven-day provider caching still applies. Original covers are retained so the
choice can be reversed. Landscapes currently come from TMDB and use `w780`.
Selecting Original library data for landscapes also skips new background
landscape downloads.

## Review a single title

Administrators can open a Library title and choose **Scrape title**. The popup
lists only enabled scrapers; TMDB requires a configured credential. Missing
Library years or store links can be resolved through manual title search. Choose
a scraper, retrieve its data, then review the field checkboxes. Available fields
include full cast, directors, writers, producers, studios, genres, synopsis and
provider-specific scores. **Compare values** shows current and incoming data. No
Library data changes until **Apply selected data**.

If automatic matching finds no unique movie, the popup offers up to **eight**
candidate movies. **Title search** also accepts a different title at any time.
Results show title/year, director, up to five cast members, genres and an
optional cover preview. Cover previews require **Sync artwork**. Select **Use
this match** to review that movie's data and image choices. A no-result search
stays open so the title can be refined; it never silently chooses another movie.

Applying the review saves that provider's identity/location for the entire
Library source group, alongside the selected metadata. **Clear fields → Save
match** saves only the binding. Future manual and automatic scrapes revisit the
saved TMDB ID or store URL instead of searching the scanned title again. A new
binding invalidates the old provider cache's freshness so the next pass can
fetch it. **Change match / scraper** returns to search; original-source
restoration also clears bindings. Scanned IDs, title/year, purchase links and
viewings are preserved even if the explicitly chosen provider title/year
differs.

The private `enrichment.matches` and `enrichment.conflicts` objects use the
existing Library table; no schema migration or separate table is required.
SQLite backups retain them; portable Library JSON does not transfer provider
caches/bindings. Match/search plans share the existing eight-review,
twenty-minute limit. Each search allows at most eight detailed candidates and
512 KiB of staged metadata. Requests have a three-minute budget, including the
shared limiter and worker-slot wait; low configured rates may take longer to
display results.

No-match, ambiguous identity, missing scanned year/link and missing saved movie
pages create a **scraper conflict**. These are recorded when a new scrape is
attempted; older skipped attempts cannot be reconstructed. Transient network,
credential, rate-limit and provider-format errors remain operational failures,
without declaring a false identity conflict. A successful refresh or approved
match clears that provider's conflict. The Library shows a centered warning
overlay on affected covers, independently of badge toggles, and a warning in
List view. **Filters → Scraper conflicts only** is a sticky personal filter. The
indicator considers enabled providers needed by current field-source
preferences; disabling a provider hides its unresolved indicator without erasing
its record.

Store title search uses its anonymous public search page and the public
application headers needed by that page's JSON search route. It does not log in
or send account data. Results exclude related-person groups, prices and
ownership; fixed-size cover previews use the store's public image CDN. This
interface is experimental and may change independently of movie-page parsing.

TMDB also supplies a paged selection of posters and landscape images through its
[images API](https://developer.themoviedb.org/reference/movie-images). Artwork
sync must be enabled. Each image category starts at **Keep current image**;
select one image per category to replace it. Only visible thumbnails are
retrieved, through an authenticated administrator preview route. The store
provider currently imports metadata only; candidate covers are preview-only.
Unavailable image/field categories are not invented.

Selected facts and images apply across the movie's source-group versions.
Unselected fields remain unchanged; IDs, title/year identity, runtime, formats,
collections, purchases and viewings are preserved. Reviewed choices live in the
protected `enrichment.reviewed` JSON alongside provider caches. They take
precedence over later automatic scans, including source cover refreshes. New
versions can inherit those choices. No new table or schema migration is needed.
Private SQLite snapshots/backups retain them; portable JSON exports continue to
exclude enrichment and artwork files.

TMDB cast is sorted by explicit billing order before import. The full bounded
cast is retained (up to 500 distinct names); providers without verified billing
order retain source order. **Library → Options → Visible cast members** saves a
personal display limit of 1–30, initially 8. **More credits** shows the full
cast.

Reviews expire after 20 minutes; only the latest eight are retained. Each review
supports up to 100 scanned versions of the same movie group. A changed movie
group requires a fresh review. Metadata and selected cached images commit with
an actor-bound request receipt on the database worker. An uncertain Apply keeps
the exact selection/UUID for retry, without importing twice. Backup, unload and
access/configuration changes cancel or reject unfinished requests.

## Stored and displayed data

Schema **19** adds an `enrichment` JSON column to the existing **Library**
table. It stores provider identity/provenance, fetch time, credits and available
ratings. Results are linked through the existing source/group identity and
shared across available versions of that movie. Source identities, edition,
runtime, edition covers, watched status, purchases and raw scan metadata are
preserved. Later device scans retain the provider cache. No new metadata table
or sensor is required. Cache writes share the Library's storage budget and
SQLite worker.

When **TMDB** and **Sync artwork** are both enabled, enrichment also retrieves
the matched movie's widescreen backdrop. TMDB supplies the image reference in
its
[movie response](https://developer.themoviedb.org/docs/search-and-query-for-details);
the adapter uses the documented
[image service](https://developer.themoviedb.org/docs/image-basics) at the fixed
`w780` size. These requests share the metadata rate limit and use no credential.
The HA server downloads the raster into the existing private artwork cache;
browsers receive only an opaque cache key through the authenticated Library
artwork endpoint, never the remote image URL.

Backdrops share the configured artwork budget with edition covers, so a large
collection may need a larger cache. No new table or migration is needed:
`enrichment.tmdb.backdrop_key` (or `poster_key` for a preferred TMDB cover)
links the existing content-addressed cache index to the movie group. Eviction,
missing-file reconciliation and administrator artwork deletion clear those
references. Later scans preserve the enrichment cache; metadata refreshes retain
a prior backdrop until a replacement succeeds. New formats can inherit the same
group backdrop. Edition covers are preserved. Backdrops span Library details
with a dark fade. Desktop also keeps its poster; mobile uses only the backdrop.
Without one, the small-poster layout remains. Enable both options and use
**Refresh metadata** to populate existing movies immediately; otherwise the
normal seven-day metadata refresh applies.

Details initially keep the first eight cast names visible (configurable per
display profile); **More credits** reveals the full cast and additional credits.
**Ratings and metadata sources** expands the source-specific scores and
attribution. Details show expanded cast, directors, writers, producers and
studios, plus source-labelled review scores. People search and actor/director
facets include enriched credits. A distributor/licensor is labelled separately
from a studio. Rotten Tomatoes critic/audience percentages from the store and
TMDB's audience rating out of ten remain separate. Metadata credits include the
approved, locally bundled TMDB logo and its required attribution for both
account roles.

The compact score row shares the Play/Collection/Edit controls above version
details. TMDB votes display as a circular percentage (with the original /10
score in the accessible label). RT uses its locally bundled standard tomato and
popcorn icons beside percentages, following the
[official guide](https://www.rottentomatoes.com/about).
Certification/verification is not inferred from score alone. Missing scores stay
hidden; full provider attribution and scores remain expandable.

The cache is read-only in Database administration. It is retained by private
SQLite snapshots/HA backups; portable JSON imports/exports keep their existing
projection and do not transfer provider caches or credentials. Disable providers
to stop future requests; already cached metadata stays readable while Library is
enabled. A manually deleted Library row can return on a later scan.

## Validation and remaining review

Offline tests cover fictional provider responses, conservative matching,
credentials, robots directives, rate limiting, response bounds, fixed HTTPS
origins, public DNS pinning, cache preservation, permissions and revocation.
Public-store research used a generic public movie page, never household data. No
TMDB account/key or live device was used during implementation.

Operator testing remains: add a TMDB credential, enable one provider at a time,
save settings, run a small metadata pass and inspect representative matches,
credits, scores, throttling and failure status. Browser layout and firmware
control testing are separate from these automated tests.

## Library footer progress

The administrator's single sticky Library footer shows compact **Scrapers**
status: running/idle/off/error, processed groups during a pass, and distinct
available movie groups with cached provider/reviewed scraper data. Detailed
active/queued counts, provider updates and skips remain in Settings. A failed
pass directs the operator to logs. A group scraped by both providers counts once
in the cached total; provider updates/skips can exceed the number of titles.
Cached counts survive restart; pass counters are in memory. A title preview
counts as active work but only contributes to the cached total after Apply.
Disabled scrapers retain the cached total. Regular-user responses omit all
scraper status/count details.

Active work polls every five seconds; idle Library status polls every thirty
seconds. Reads do not start scraping. Restoring a movie's original metadata
removes its cached contribution and pauses background enrichment for that group;
an explicit title scrape and Apply reenables it. See the
[administrator editor](library.md#movie-details-and-administrator-editing).

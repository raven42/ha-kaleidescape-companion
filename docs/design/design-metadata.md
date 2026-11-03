# External metadata and provider clients

External metadata is separate from the local device scan. Administrators can
enable **Kaleidescape public store (experimental)** and/or **TMDB** in
**Settings → External movie metadata** or the integration's native Configure
flow. Both are disabled by default and require Library sync. Disabled providers
make no external requests; the ordinary Library, controls and recording keep
working without them.

The pure Store and TMDB provider clients remain in Companion's `scrapers/`
package. Public Store metadata pages, anonymous search and cover routes are
scraped only here; pyk is limited to local devices. Scheduling, authorization,
review and persistence also remain Companion responsibilities. The patched-pyk
PoC does not change these provider interfaces.

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
saved data is marked with **⚠** beside the scraper name. This indicates no
cached or reviewed data from that provider for this exact movie group, rather
than requiring every optional field to be populated. Configured scrapers remain
selectable so the missing data can be retrieved. Missing Library years or store
links can be resolved through manual title search. Choose a scraper, retrieve
its data, then review the field checkboxes. Available fields include full cast,
directors, writers, producers, studios, genres, synopsis and provider-specific
scores. **Compare values** shows current and incoming data. No Library data
changes until **Apply selected data**.

The suggested **Title search** removes a trailing `(Director's Cut)` suffix
(also accepting the typographic apostrophe) without changing the Library title.
The dialog shows the current Library title, year, up to five directors and top
five cast members above the results for comparison.

For a provider that has no matching data, choose **Mark no scraper data
available**. This administrator-only flag applies to that provider across the
movie's versions, including returning versions. It clears that provider's
conflicts and missing-data warning and skips future automatic attempts, so it
does not create new scrape failures. Other providers and same-name remakes are
unaffected. The provider remains selectable for an explicit manual search.
**Clear no-data flag** resumes automatic attempts; a manual import does not
silently clear the flag. Existing cached data is preserved, and the cumulative
historical failure counter is not decremented. Availability saves require a
current group snapshot and support exact retry after an uncertain response.

With TMDB enabled, **Edit Artwork** opens the same review flow for images only.
It still requires configured TMDB credentials and **Sync artwork**. **Poster**
and **Backdrop** previews preserve the entire image and its aspect ratio. If the
movie has no current backdrop, its first available backdrop is selected by
default; it is not saved until Apply. Existing backdrops default to keeping the
current image. Image-only review leaves descriptive fields unchanged.

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
overlay on affected covers and a warning in List view for administrators with
**Advanced view** enabled, independently of badge toggles. Standard users see no
warning overlay. **Filters → Scraper conflicts only** is a sticky personal
filter. The indicator considers enabled providers needed by current field-source
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
pass directs the operator to review scraper status. A group scraped by both
providers counts once in the cached total; provider updates/skips can exceed the
number of titles. Cached counts survive restart; pass counters are in memory. A
title preview counts as active work but only contributes to the cached total
after Apply. Disabled scrapers retain the cached total. Regular-user responses
omit all scraper status/count details.

Active work polls every five seconds; idle Library status polls every thirty
seconds. Reads do not start scraping. Restoring a movie's original metadata
removes its cached contribution and pauses background enrichment for that group;
an explicit title scrape and Apply reenables it. See the
[administrator editor](design-library.md#movie-details-and-administrator-editing).

## Provider client interfaces

The integration's `scrapers/` package contains pure parsers and an async
provider API. Its modules have no Home Assistant, database, HTTP-client or CLI
dependency. Add providers here; keep scheduling, authorization, credentials and
persistence in the integration's enrichment adapter.

```text
custom_components/kaleidescape_companion/
  scrapers/
    client.py    Common metadata/artwork API and adapter protocols
    transport.py Injected fetch, shared rate limit and cancellation
    models.py    MovieQuery, Metadata and bounded identity helpers
    providers/
      store.py   Experimental public store adapter/parser and robots policy
      tmdb.py    Official TMDB search/details/credits and optional images
tests/scrapers/   Offline fictional provider contracts
```

### Usage

Supply an async `fetch(url, headers) -> bytes` function. It must verify HTTPS,
allow only the documented provider destinations, refuse redirects, exclude
cookies/environment proxies, enforce a timeout and a **4 MiB** streamed body
limit, and raise `ProviderError` using an owned error code on HTTP errors. The
Companion adapter implements those requirements and pins public DNS answers.

```python
from custom_components.kaleidescape_companion.scrapers import MovieQuery, Providers

providers = Providers(
    fetch,
    requests_per_second=2,
    tmdb_credential=credential_from_your_secret_store,
)
metadata = await providers.metadata("tmdb", MovieQuery("Your Movie", 2025))
# Manual resolution when conservative automatic matching is ambiguous or empty:
candidates = await providers.search("tmdb", "Your Movie")
# Present candidates to the user and persist only their approved reference.
chosen = candidates[user_selected_index]
reference = {key: chosen[key] for key in ("provider_id", "title", "year", "url")}
metadata = await providers.resolve("tmdb", reference)
# Optional widescreen raster; omitted when the matched movie has no backdrop.
image = await providers.artwork("tmdb", metadata)
# Optional preferred portrait poster, separate from the landscape image.
poster = await providers.poster("tmdb", metadata)
# Requires the exact, existing store reference for that same movie/year:
metadata = await providers.metadata(
    "kaleidescape",
    MovieQuery("Your Movie", 2025, "/movie-store/movie/your-movie-2025"),
)
```

`MovieQuery` requires a nonempty title and a release year (1800–2200). Results
use the common `Metadata` projection; unavailable provider fields are omitted or
null, and scores retain their source scale. Unknown providers raise
`ProviderError("unknown_provider")` without fetching.

To add a provider, implement `MetadataProvider.metadata(movie)` under
`providers/`, using `providers.transport` for every request, and register the
adapter in `providers.adapters["provider_name"]`. Adapters own fixed routes,
authentication, parsing and source policy. The common client owns dispatch;
transport owns rate limits. Provider-specific parser functions remain usable
without HTTP. Applications own scheduling, opt-ins, secrets and storage; adding
an adapter does not authorize new network destinations in the HA integration.

Rates accept 0.1–10 requests/second. One monotonic limiter serializes both
providers; slow requests do not cause a catch-up burst. Store requests first
check `robots.txt`, including crawl delay/request-rate directives. HTTP errors,
including 429, stop the caller's pass without automatic retry. Cancellation
never retries a request. The caller should recheck robots on each pass.

TMDB accepts either a v3 API key or an API Read Access Token. The latter uses a
Bearer header; v3 keys use TMDB's documented query parameter. Do not log request
URLs, headers, exceptions containing HTTP requests, or credentials. Returned
metadata never contains authentication fields.

For an explicit image-selection workflow, call
`choices = await providers.images("tmdb", metadata)` after matching a movie. The
gallery uses TMDB's fixed `/3/movie/<id>/images` route and returns up to 100
validated JPEG paths per poster/backdrop category with optional dimensions.
`await providers.image("tmdb", choice, thumbnail=True)` fetches a `w300`
preview; the default fetch uses `w500` for posters and `w780` for backdrops. All
image requests are credential-free and use the shared limiter. Providers without
a gallery return an empty list; the store supports candidate cover previews
only. Applications must bind choices to the matched movie/actor and never accept
caller-supplied paths as choices.

TMDB cast names are sorted by the explicit `order` field, then deduplicated,
retaining up to 500 names. Unknown order keeps source order after billed names.
Display limits belong to the calling application, not the provider parser.
`Providers(..., budget=other_client.transport.budget)` lets independently owned
sessions share one rate budget, including stricter robots delays and cancelled
waits, without sharing credentials or HTTP session state.

The optional `Providers.artwork(provider, metadata)` API returns raster bytes or
`None` for an unsupported/missing image. TMDB's bounded `backdrop_path` comes
from its matched movie details. The adapter constructs only
`https://image.tmdb.org/t/p/w780/<alphanumeric>.jpg`, shares the same request
limiter, and sends no credential to the image service. It rejects URLs,
directories, queries and non-JPEG extensions instead of fetching them. Allow
that fixed HTTPS destination in the injected transport only when artwork is
opted in. The host application must verify the raster signature/type, store
bytes within its cache budget, and keep source IDs and references consistent.
Adapters can implement the optional `ArtworkProvider.artwork(metadata)`
capability without changing metadata-only providers.

`Providers.poster(provider, metadata)` is an optional companion capability for
the matched movie's default portrait image. TMDB validates `poster_path` using
the same bounded JPEG rules and fetches a fixed `w500` image without
credentials. Missing paths and adapters without `poster` return `None`; unknown
providers still raise `unknown_provider`. Callers choose whether to retrieve it
and must apply the same opt-in, raster validation and cache controls as
landscape images.

Matching requires one normalized title and release year. Ambiguous TMDB search
results, missing years and mismatched store pages fail closed. No provider ID,
poster, price, title or edition replaces the caller's existing identity. Results
contain bounded credits, provider reference and source-specific scores; TMDB
audience votes are not Rotten Tomatoes percentages.

`Providers.search(provider, query, year=None)` is a separate, explicit manual
workflow. It accepts 1–200 characters and returns up to eight detailed movie
records from the first search page, with available cast/directors/genres and
validated poster references. It never chooses a match or modifies a caller's
library. Offer title/year, a short cast list, genres and optional cover
previews, then persist the approved reference after review.
`resolve(provider, reference)` revisits its fixed TMDB movie ID or store edition
URL without searching titles; the adapter still validates provider identity.
Reference changes and caller snapshot/retry protection belong to the
application. These are optional adapter capabilities; unknown providers and
unsupported searches fail with owned codes.

Store search reads the public `/movie-store/search?text=...` page to obtain its
bounded public application version, then calls the anonymous
`/movie-store/rest/packages/search` route with the two public
`X-Kaleidescape-Application-{Id,Version}` headers. It fixes country US and
display limit 15, honors the store's robots policy, and projects only
matching-movie groups. It follows at most eight validated movie routes to
retrieve credits and genres; related-person groups, prices, accounts and
ownership are ignored. Missing/unfamiliar version/response shapes fail closed.
Country-specific catalogs are not currently configurable.

Store candidates may include a validated `poster_url` from the public
`images0[1-8].kaleidescape.com` CDN. Only fixed `132x189s`/`264x378s`
transformed JPEG cover routes are allowed.
`Providers.image("kaleidescape", choice, thumbnail=True)` accepts that
provider-owned staged poster choice for previews; full image import/gallery is
unsupported. TMDB candidates instead use the existing `poster_path` and `w300`
preview API. Callers must opt into images, enforce public DNS/TLS/body/redirect
controls on these additional routes, and serve previews through their
authenticated interface rather than expose arbitrary URLs. All requests share
the limiter and carry no account cookies or image credentials. Refining the
query replaces pagination beyond the first eight candidates; low configured
rates can require a longer application timeout.

### Research and limitations

The public Kaleidescape store currently embeds movie JSON in an inline
`window.preloadedAjaxData` assignment. The parser decodes that JSON without
executing scripts and selects only the requested edition. Account/session,
ownership, orders, prices and recommendations are ignored. Credit role IDs were
checked against the public store application's role map. Production companies
and the licensor/distributor stay separate. This interface is undocumented and
may change; unfamiliar markup stops the pass. No login, private store API,
trailer fetch or account scraping is supported.

TMDB uses its
[official API](https://developer.themoviedb.org/reference/intro/getting-started):
[movie search](https://developer.themoviedb.org/reference/search-movie),
[movie details](https://developer.themoviedb.org/reference/movie-details), and
[credits](https://developer.themoviedb.org/reference/movie-credits). Follow its
[image construction guide](https://developer.themoviedb.org/docs/image-basics),
[authentication](https://developer.themoviedb.org/docs/authentication-application),
[rate limits](https://developer.themoviedb.org/docs/rate-limiting), and
[attribution requirements](https://developer.themoviedb.org/docs/faq). Provider
access and licensing remain the caller's responsibility. There are no live API
tests requiring a key.

### Checks

```sh
PYTHONPATH=custom_components/kaleidescape_companion python -m unittest discover -s tests/scrapers
ruff check custom_components/kaleidescape_companion/scrapers tests/scrapers
ruff format --check custom_components/kaleidescape_companion/scrapers tests/scrapers
```

Run these from the workspace root. Edit the integration's `scrapers/` package
directly. Offline provider tests use that source and run without HA.

# Movie metadata providers

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

## Usage

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

## Research and limitations

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

## Checks

```sh
PYTHONPATH=custom_components/kaleidescape_companion python -m unittest discover -s tests/scrapers
ruff check custom_components/kaleidescape_companion/scrapers tests/scrapers
ruff format --check custom_components/kaleidescape_companion/scrapers tests/scrapers
```

Run these from the workspace root. Edit the integration's `scrapers/` package
directly; no separate copy or scraper vendoring step is needed. The offline
provider tests use that source directly and run without HA.

# Movie metadata providers

This independent Python **3.11+** package contains pure parsers and an async
provider API. It has no Home Assistant, Companion, database, HTTP-client or CLI
dependency. Add providers here; integrate scheduling, authorization, credentials
and persistence in the calling application.

```text
lib/scrapers/
  pyproject.toml
  src/kaleidescape_scrapers/
    client.py    Common Providers.metadata API and MetadataProvider protocol
    transport.py Injected fetch, shared rate limit and cancellation
    models.py    MovieQuery, Metadata and bounded identity helpers
    providers/
      store.py   Experimental public store adapter/parser and robots policy
      tmdb.py    Official TMDB search/details/credits adapter/parser
  tests/         Offline fictional provider contracts
```

## Usage

Install with `python -m pip install -e lib/scrapers`, or use the source
directory as `PYTHONPATH`. Supply an async `fetch(url, headers) -> bytes`
function. It must verify HTTPS, allow only the documented provider destinations,
refuse redirects, exclude cookies/environment proxies, enforce a timeout and a
**4 MiB** streamed body limit, and raise `ProviderError` using an owned error
code on HTTP errors. The Companion adapter implements those requirements and
pins public DNS answers.

```python
from kaleidescape_scrapers import MovieQuery, Providers

providers = Providers(
    fetch,
    requests_per_second=2,
    tmdb_credential=credential_from_your_secret_store,
)
metadata = await providers.metadata("tmdb", MovieQuery("Your Movie", 2025))
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

Matching requires one normalized title and release year. Ambiguous TMDB search
results, missing years and mismatched store pages fail closed. No provider ID,
poster, price, title or edition replaces the caller's existing identity. Results
contain bounded credits, provider reference and source-specific scores; TMDB
audience votes are not Rotten Tomatoes percentages.

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
[authentication](https://developer.themoviedb.org/docs/authentication-application),
[rate limits](https://developer.themoviedb.org/docs/rate-limiting), and
[attribution requirements](https://developer.themoviedb.org/docs/faq). Provider
access and licensing remain the caller's responsibility. There are no live API
tests requiring a key.

## Checks and runtime copy

```sh
PYTHONPATH=lib/scrapers/src python -m unittest discover -s lib/scrapers/tests
ruff check lib/scrapers
ruff format --check lib/scrapers
python dev/vendor_scrapers.py
python dev/vendor_scrapers.py --check
```

Run these from the workspace root. Companion's generated runtime copy is under
`custom_components/kaleidescape_companion/_vendor/kaleidescape_scrapers/`; edit
this canonical package and regenerate it. Root checks enforce equality.

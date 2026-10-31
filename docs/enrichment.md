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

Store enrichment needs an existing Library purchase `href`; it never invents
store slugs. TMDB needs the Library title and a known release year. Matching is
conservative: ambiguous or mismatched movies are skipped. Skipped totals are
provider attempts, so one movie can contribute twice. A pass stops after one
hour; successfully cached results remain available. It supports up to 10,000
scanned versions and processes one movie group at a time. Unknown years and
missing credentials/links are skipped without requesting a movie.

These are internet lookups: the provider can see the request, movie identity and
the HA host's network address. No watch history, notes, invoices, prices or
order IDs are sent. Store access is public, with no login/cookies. TMDB
credentials stay in HA's native private entry configuration and can be included
in a full HA backup; secure those backups accordingly.

## Stored and displayed data

Schema **19** adds an `enrichment` JSON column to the existing **Library**
table. It stores provider identity/provenance, fetch time, credits and available
ratings. Results are linked through the existing source/group identity and
shared across available versions of that movie. Source identities, edition,
runtime, artwork, watched status, purchases and raw scan metadata are preserved.
Later device scans retain the provider cache. No new metadata table or sensor is
required. Cache writes share the Library's storage budget and SQLite worker.

Details keep the first eight cast names visible; **More credits** reveals the
full cast and additional credits. **Ratings and metadata sources** expands the
source-specific scores and attribution. Details show expanded cast, directors,
writers, producers and studios, plus source-labelled review scores. People
search and actor/director facets include enriched credits. A
distributor/licensor is labelled separately from a studio. Rotten Tomatoes
critic/audience percentages from the store and TMDB's audience rating out of ten
remain separate. Metadata credits include the approved, locally bundled TMDB
logo and its required attribution for both account roles.

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

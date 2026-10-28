# Optional local library

Library sync is **disabled by default** and independent from playback recording.
The administrator Library tab is visible but disabled until **Settings → Enable
library sync** is saved. The same options are available under the integration's
**Configure** action. Regular users retain the household journal reader; Library
management/browsing currently requires an active administrator.

## Connection and sync settings

Leave **Library hostname** blank to attempt discovery by resolving
`my-kaleidescape.local` and validating its read-only Movies page. This uses HA's
shared DNS/mDNS resolver (host resolution as a fallback), not a subnet scan. If local name resolution is unavailable from HA,
enter a hostname, private LAN IP, or HTTP(S) origin. Only standard HTTP/HTTPS ports
are supported. Credentials, paths, queries, redirects, and remote destinations are
rejected. Password-protected or unrecognized interfaces fail without changing the
cached catalog. Nothing is fetched or resolved by this connector while disabled.

The vendor describes this local browser interface in
[Accessing the Browser Interface](https://www.kaleidescape.com/support/article/Accessing-the-Browser-Interface).
It is a firmware-dependent HTML interface, not a promised public JSON API.

| Setting | Default | Behavior |
| --- | --- | --- |
| Enable library sync | Off | Starts a read-only sync after setup, then schedules further syncs |
| Library hostname | Blank | Attempts `http://my-kaleidescape.local`; an explicit value overrides discovery |
| Sync interval | 6 hours | Whole hours, 1–168; measured after the preceding scan finishes |
| Sync collections | On | Cache available collections and exact title memberships |
| Sync title details | On | Fetch available cast/director/writer/studio, genres, synopsis, and runtime |
| Sync artwork | Off | Fetch validated covers into the private cache; can require detail-page requests even with detail metadata disabled |
| Artwork cache limit | 512 MiB | 32–4096 MiB, separate from the database; older covers are evicted when full |

Basic titles, ratings, directors, genres, years, and edition labels always sync.
Other fields depend on the source; missing writers/studios remain unavailable.
Disabling collections or details retains prior cached values with their timestamps.
It does not claim that retained metadata is current. **Sync now** coalesces with an
already running scan. It cannot contact arbitrary browser-supplied destinations.

The first detail/artwork pass can take several minutes for a large catalog.
Requests are sequential; details refresh when basic metadata changes or after
seven days. Missing covers are retried during subsequent scans. A scan has a
30-minute budget, up to 10,000 source handles, 200 collections, and 100,000 combined memberships, a 15-second
request timeout, and an 8 MiB HTML response limit. Transient transfer/backup
barriers retry after at most a minute; other failures wait for the configured
interval or an explicit Sync now. A failed page or collection generation retains
previous data. A complete validated main listing may mark missing versions
unavailable; it does not delete identities or journal records.

## Browsing

The Library page queries local SQLite, so browsing works while the server is
offline. Search titles and combine collection, actor, director, writer, studio,
rating, and watched-status filters. Credit fields support suggestions and typed
exact names; suggestions are bounded to 500 values. Fields with no known metadata
are disabled. Sort by name, length, or watched status, ascending or descending.
Results are paged in groups of 50. Select a title to view details and cached artwork.

Statuses reflect source collection membership, independently for exact source
handles: **Paused → In progress**, otherwise **Played → Watched**, otherwise
**Unwatched**. Before any complete collection sync, and for versions first detected
after the retained collection snapshot, status is **Unknown**.
These are editable source labels, not Companion journal completion, saved position,
or dated viewing evidence. No viewings are fabricated from Played membership.

Alternate editions retain exact source handles and source-scoped groups; titles
are never merged by name or guessed playback-ID equivalence. The header distinguishes
source title groups from individual versions. **Added on** is the first successful
detection of that handle by Companion, retained across subsequent syncs and
temporary absence. All titles already present at the first sync get that first
detection date; purchase/download dates are unknown.
Changing the configured origin creates a separate source namespace, even if it
reaches the same physical system. Cross-host identity reconciliation is deferred.

Sync progress/status refreshes only while the Library page is visible: about every
five seconds during a scan and 30 seconds when idle. Newly cached metadata refreshes
the current results from the first page. Leaving the tab stops status polling,
aborts the single displayed-cover request, revokes its object URL, and clears data.
Background scheduled sync continues independently when enabled. There are no
playback controls or calls to the vendor's editing routes.

## Storage, artwork, and recovery

Schema **6** adds `library_sources`, `library_titles`, `library_collections`,
`library_memberships`, and `library_artwork` to the existing worker-owned SQLite
database. Library writes advance revisions but never rewrite viewing snapshots,
manual corrections, session evidence, or journal status. Concurrent sync can make
a database page or maintenance revision stale; refresh before retrying. Wait for
an initial scan to finish before a large maintenance import.

The SQLite limit remains **256 MiB**, including catalog metadata. Library writes
have a **192 MiB** ceiling to leave 64 MiB of growth for the journal. A journal
already at or above that threshold remains usable while new library writes are
refused. Artwork bytes
live outside SQLite at `<HA config>/kaleidescape_companion/artwork/`, with private
directory/file permissions (`0700`/`0600`). Enabling artwork adds disk use up to
the configured cache budget plus one incoming image of at most **5 MiB**; migration
backups, HA backups, and other copies need additional space. Increase the cache
limit for a large collection. Cache eviction removes covers, not identities or
history, and a later scan can fetch them again. Covers are served only through a
scoped, authenticated administrator endpoint with opaque keys; never through
`www` or directly from metadata URLs. Only JPEG/PNG/WebP magic/type pairs are
accepted. Python does not decode images.

HA backups pause sync and drain accepted worker/file writes before copying storage.
SQLite exports include library metadata and cache indexes, but not artwork files;
JSON exports/imports remain viewing-only. Missing cover files are reconciled when
storage opens and can be fetched again. Compatible journal imports do not restore
source configuration, library data, or artwork. A full trusted database restore is
still the offline [restore procedure](backend.md#export-backup-and-restore).

Disabling sync retains cached library records and covers; it stops network work
and denies the Library API. Journal delete/purge does not remove this independent
catalog cache. Operator deletion of cached artwork should be done with HA stopped;
leave the journal database intact. Full dataset removal follows the
[security procedures](security.md#backup-restore-retention-and-capacity).

## Validation and limits

Automated tests use fictional HTML/data and mocked network responses. They cover
grouped versions, empty collections, encoding/escaping, malformed/partial pages,
parameterized filters, status precedence, stable first detection, migrations,
private cache limits/rollback, DNS pinning, forbidden routes/redirects, access
revocation, lifecycle cancellation, and backup barriers.

Read-only checks against one `26.1.2-27147` interface validated the main listing,
Played/Paused pages, and one detail page. They did not run a full household sync,
cache its artwork, validate other firmware, or automate a browser. Review Library
and Settings first at `http://127.0.0.1:5173/tests/review.html`, then use an isolated
HA deployment to review actual metadata, scheduled refresh, optional artwork,
narrow layouts, and role changes. The fictional page can enable Library in Settings
without contacting any device. Broader household Library access, grouped-edition
presentation, historical artwork associations, and library-specific import/export
remain follow-ups.

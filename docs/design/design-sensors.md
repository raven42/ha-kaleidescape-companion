# Home Assistant sensors

The integration creates eighteen read-only sensors under a **Kaleidescape
Companion** service device. Restart/reload the integration after updating its
files. Find the actual entity IDs under **Settings → Devices & services →
Kaleidescape Companion**; names/IDs can vary if you rename entities or already
have matching names.

## Watch history

These seven sensors retain their existing identities and behavior.

| Sensor name                        | State                                                    | Attributes                                            |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Last watched movie                 | Latest completed movie title; `unknown` when none exists | `movie`: full title, `watched_at`: UTC time           |
| Movies watched last 7 days         | Integer completed-viewing count                          | `movies`: list of title strings, `truncated`: boolean |
| Movies watched last 30 days        | Integer completed-viewing count                          | `movies`: list of title strings, `truncated`: boolean |
| Movies watched last 7 days count   | Integer completed-viewing count                          | None                                                  |
| Movies watched last 30 days count  | Integer completed-viewing count                          | None                                                  |
| Movies watched last 365 days count | Integer completed-viewing count                          | None                                                  |
| Partially watched movies           | Integer count of all unfinished partial viewings         | `movies`: list of title strings, `truncated`: boolean |

HA states are scalar values, so the two list sensors expose actual string arrays
in the `movies` attribute. Separate count sensors provide simple dashboard and
automation values. For example, after selecting your actual entity ID:

```jinja
{{ state_attr('sensor.kaleidescape_companion_movies_watched_last_7_days', 'movies') }}
```

Counts represent viewings, including repeated watches of the same movie. Title
lists preserve repeats and sort newest first. A completed viewing uses its
explicit end time, otherwise its completion/credits time, otherwise its start
time. Manual date corrections therefore move records between windows. Windows
are rolling 7×24, 30×24, and 365×24 hours in UTC, with the lower boundary
excluded and current time included; they are not local calendar
weeks/months/years. Future-dated completed viewings and deleted records are
excluded. A partial viewing moves out of the partial sensor when completed or
deleted; partials are not included in the completed history sensors. The partial
sensor has no age cutoff and excludes viewings whose start time is in the
future.

Lists contain the newest 50 titles at most and have an 8 KiB UTF-8 JSON budget.
`truncated: true` means the array is incomplete; its state still gives the exact
count. Use the journal's paginated UI for the full history. Titles can contain
up to 500 characters: the last-movie state is limited to HA's 255-character
maximum, with the full value in `movie`.

One shared coordinator refreshes the summaries every 30 seconds while enabled
sensor entities have listeners. Changes and entries aging out of windows appear
on the next refresh. A failed storage refresh makes the sensors unavailable
rather than publishing zero counts. No players are contacted. History summaries
derive from the existing journal without extra history storage. Schema 10 adds
the Library batch fields described below.

Titles, viewing times, and counts become HA state data. HA's entity permissions,
Recorder configuration, automations, dashboards, and backups govern their
visibility and retention. The sensors include no journal notes, raw device IDs,
sessions, audit actors, or paths. See the
[security policy](../policies/policy-security.md#access-boundaries).

## Library and storage

The eleven additional sensors share a separate coordinator refreshing local
SQLite summaries every 30 seconds. No sensor starts a scan, resolves a hostname
or contacts a device. Updating files and restarting/reloading the integration
adds them to the same service device; existing history unique IDs are unchanged.

| Sensor key           | Name / state                   | Notes and attributes                                                                                                                                                                            |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total_movies`       | Total movies: integer          | Available movies unique by `source_group` in the configured source, matching the grouped Library view                                                                                           |
| `database_size`      | Database size: MiB             | Main Companion SQLite file size; excludes artwork, backup/export files and transient SQLite sidecars                                                                                            |
| `last_library_sync`  | Last library sync: timestamp   | Most recent committed complete catalog snapshot; HA renders the UTC timestamp in local time                                                                                                     |
| `artwork_cache_size` | Artwork cache size: MiB        | Indexed image payload bytes for the entire managed cache, counting shared files once; excludes filesystem overhead and temporary files                                                          |
| `watched_movies`     | Watched movies: integer        | Groups marked Played, excluding Paused groups; `unknown_movies` and `collections_synced_at` attributes                                                                                          |
| `unwatched_movies`   | Unwatched movies: integer      | Grouped Played/Paused status, with `unknown_movies` and `collections_synced_at` attributes                                                                                                      |
| `recently_added`     | Recently added movies: integer | Exact count for the latest addition batch; attributes `movies` (title strings), `truncated`, and `added_at`                                                                                     |
| `last_scrape_date`   | Last scrape date: timestamp    | Latest finished automatic pass or manual provider search/preview, including failed attempts; older installations initially use their latest saved provider/review timestamp                     |
| `scraper_conflicts`  | Scraper conflicts: integer     | Current available scanned movie groups with an unresolved conflict for a desired enabled provider, counted once per title; attributes `movies` and `truncated`                                  |
| `scraper_failures`   | Scraper failures: integer      | Persistent cumulative failed automatic passes and manual provider search/preview operations since activity tracking began; nested requests and cancellations are not additional failures        |
| `missing_artwork`    | Missing artwork: integer       | Available scanned movie groups without a selected cached poster or backdrop; a title missing both counts once, and images may come from different versions; attributes `movies` and `truncated` |

Sizes use HA's data-size device class, measurement state class and two-decimal
display precision. Timestamps use the timestamp device class. Sizes, timestamps,
scraper counts and missing artwork are diagnostic entities. Counts are integers;
only `scraper_failures` is a lifetime counter with the total-increasing state
class. Conflict and missing-artwork counts use the measurement state class. Size
sensors remain available when Library sync is disabled, because retained storage
still occupies space. Other Library sensors become unavailable when disabled.
With Library enabled but no successful catalog yet, movie counts and timestamps
are unknown; the new failure counter starts at zero. Failed storage reads make
the whole Library/storage coordinator unavailable; they do not publish zeroes.
History failures are independent.

Only the configured source is counted. Unavailable old versions and inactive
versions added by imports are excluded. Same-name remakes with different source
groups count separately; additional formats of one group count once. Across
versions the same priority as browsing applies: **Paused → Played → unknown →
unwatched**. Hidden collection names still determine status. If collection data
is missing or any current group has unknown status, both `watched_movies` and
`unwatched_movies` stay unknown rather than publishing incomplete counts.
Existing cached collection data can be older than the last catalog: its
timestamp is exposed. A valid catalog updates `last_library_sync` even if later
detail/artwork requests fail; it does not assert that every cover or collection
was synchronized.

Scrape activity persists per Library source in a private `settings` record and
survives restarts. Successful operations advance the date without resetting
failure totals. A failed full pass stops on its first operational failure, so it
increments the counter once. Matching problems such as missing/ambiguous movies
contribute to conflicts instead. Aborted operations due to revoked access,
configuration changes or cancellation are excluded. Previews/searches record
activity but do not import movie fields. Sensor reads never scrape. No scraper
names, failure messages, provider IDs, image keys or movie lists are added as
sensor attributes. Missing artwork checks indexed selected image references, not
a filesystem rescan; normal cache recovery handles missing files.

The watched count describes the cached Library Played collection, independently
of completed journal viewings and rewatches. Paused takes priority even when
another format of the same movie belongs to Played. It refreshes with the
existing Library coordinator; this sensor needs no database migration.

### Recently added batches

The first successful catalog establishes a baseline and reports zero, rather
than calling the whole library new. Existing cached catalogs also form the
baseline after an upgrade. A later scan discovering never-before-known
`source_group` values replaces the batch with those movie groups. Alternate
formats, returning previously known groups, metadata changes, purchase-date
imports, and unchanged scans do not replace or clear the batch. A later scan
with a new group starts a new batch. The batch is a first-discovery observation,
independent of corrected purchase dates or the Library's Added on sort.

Schema **10** stores only a bounded title snapshot, the exact count and batch
timestamp on `library_sources`. No additional table or per-title duplicate is
created. The snapshot survives restarts, temporary removals and unchanged scans;
it describes that addition event, not a current-availability filter. Titles may
repeat for distinct source groups. Failed catalog transactions roll back batch
changes together with the catalog. Stored/imported catalogs cannot import or
replace this operational batch state.

The `movies` attribute has at most 50 titles and an 8 KiB UTF-8 JSON budget,
matching history lists. A large batch retains its exact integer count and sets
`truncated: true`. The timestamp is when Companion detected those additions, not
their purchase/download date. Before any addition batch, `movies` is empty and
`added_at` is null. Example using your actual entity ID:

```jinja
{{ state_attr('sensor.kaleidescape_companion_recently_added_movies', 'movies') }}
```

## Full catalogs with thousands of movies

Keep the full catalog in SQLite and use the paginated **Library** view or
existing authenticated `kaleidescape_companion/library/list` WebSocket API.
Thousands of movies are appropriate there. Do not put the entire collection into
a sensor's attributes: HA's
[state attribute guidance](https://contributors.home-assistant.io/core/entities/state-attributes/)
recommends small attributes and notes that Recorder stores them with state
changes. A dashboard/catalog card should request pages instead of relying on a
catalog-sized entity attribute. A future native Media Browser integration can be
considered separately; it is not provided by these sensors.

A grouped title page for the enabled source:

```json
{
  "id": 1,
  "type": "kaleidescape_companion/library/list",
  "entry_id": "current-entry-id",
  "dataset_id": "current-dataset-uuid",
  "filters": { "grouped": true, "sort": "name", "limit": 250, "offset": 0 }
}
```

Use the returned `revision` and `preferences_key` on subsequent requests and
advance the offset until `has_more` is false. Restart pagination if the revision
or preferences change. Pages accept 1–1000 groups with the existing byte cap and
active-user/enabled-Library checks. Collection exclusions remain display
preferences. This API returns positive display fields and opaque title keys; it
does not expose source handles/groups, private paths or journal notes. All
sensors retain the wider HA entity/Recorder privacy boundary above.

Missing-artwork and scraper-conflict sensors include `movies` (title strings)
and `truncated`, matching the history-list attribute shape. Lists sort
alphabetically, count each source movie group once across versions, and are
bounded to 50 titles and 8 KiB of UTF-8 JSON. Their state always retains the
exact affected-group count. Poster and backdrop absence together still count
once. Explicit provider no-data markers continue to exclude that provider from
conflicts. Attributes contain no provider IDs, credentials, device identities,
invoice data or filesystem paths.

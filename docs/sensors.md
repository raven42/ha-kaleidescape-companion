# Watch-history sensors

The integration creates seven read-only sensors under a **Kaleidescape Companion**
service device. Restart/reload the integration after updating its files. Find
the actual entity IDs under **Settings → Devices & services → Kaleidescape Companion**;
names/IDs can vary if you rename entities or already have matching names.

| Sensor name | State | Attributes |
| --- | --- | --- |
| Last watched movie | Latest completed movie title; `unknown` when none exists | `movie`: full title, `watched_at`: UTC time |
| Movies watched last 7 days | Integer completed-viewing count | `movies`: list of title strings, `truncated`: boolean |
| Movies watched last 30 days | Integer completed-viewing count | `movies`: list of title strings, `truncated`: boolean |
| Movies watched last 7 days count | Integer completed-viewing count | None |
| Movies watched last 30 days count | Integer completed-viewing count | None |
| Movies watched last 365 days count | Integer completed-viewing count | None |
| Partially watched movies | Integer count of all unfinished partial viewings | `movies`: list of title strings, `truncated`: boolean |

HA states are scalar values, so the two list sensors expose actual string arrays
in the `movies` attribute. Separate count sensors provide simple dashboard and
automation values. For example, after selecting your actual entity ID:

```jinja
{{ state_attr('sensor.kaleidescape_companion_movies_watched_last_7_days', 'movies') }}
```

Counts represent viewings, including repeated watches of the same movie. Title
lists preserve repeats and sort newest first. A completed viewing uses its explicit
end time, otherwise its completion/credits time, otherwise its start time. Manual
date corrections therefore move records between windows. Windows are rolling
7×24, 30×24, and 365×24 hours in UTC, with the lower boundary excluded and current
time included; they are not local calendar weeks/months/years. Future-dated
completed viewings and deleted records are excluded. A partial viewing moves out
of the partial sensor when completed or deleted; partials are not included in the
completed history sensors. The partial sensor has no age cutoff and excludes
viewings whose start time is in the future.

Lists contain the newest 50 titles at most and have an 8 KiB UTF-8 JSON budget.
`truncated: true` means the array is incomplete; its state still gives the exact
count. Use the journal's paginated UI for the full history. Titles can contain up
to 500 characters: the last-movie state is limited to HA's 255-character maximum,
with the full value in `movie`.

One shared coordinator refreshes the summaries every 30 seconds while enabled
sensor entities have listeners. Changes and entries aging out of windows appear
on the next refresh. A failed storage refresh makes the sensors unavailable rather
than publishing zero counts. No players are contacted. No database migration is
needed; summaries derive from the existing journal.

Titles, viewing times, and counts become HA state data. HA's entity permissions,
Recorder configuration, automations, dashboards, and backups govern their visibility
and retention. The sensors include no journal notes, raw device IDs, sessions,
audit actors, or paths. See the [security policy](security.md#household-read-access-and-sensors).

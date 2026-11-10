# Entities and automations

Companion exposes 17 read-only sensors, three job-request buttons, three
configuration switches and five actions under `kaleidescape_companion`. Five
optional blueprints connect those features to HA automation. Installing
Companion or a blueprint does not create or enable a scheduled automation.

Open **HA Settings → Devices & services → Kaleidescape Companion** and its
service device to find the entities. Use the entity IDs shown in your own HA
installation; names can be changed and IDs can gain suffixes. Administrators
configure Companion and call its actions interactively. HA entity permissions
govern buttons and switches; trusted HA automations without a user context can
call the actions.

## Read the sensors

For the smallest check, open **Database size** on the service device. Expect a
size in MiB once Companion is ready, without needing Library or a player. After
Library sync or a completed viewing, inspect the related sensors below. Their
refresh reads cached data, normally every 30 seconds while subscribed; it does
not trigger a device scan or provider request.

| Sensor name                  | Meaning                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Last watched movie           | Latest completed title; `movie` and `watched_at` retain the full title and UTC completion time. |
| Movies watched last 7 days   | Number of completed viewings in the rolling seven-day window.                                   |
| Movies watched last 30 days  | Number of completed viewings in the rolling 30-day window.                                      |
| Movies watched last 365 days | Number of completed viewings in the rolling 365-day window.                                     |
| Partially watched movies     | Number of unfinished partial viewings, without an age cutoff.                                   |
| Total movies                 | Available movie groups from the selected Library source, grouping editions.                     |
| Database size                | Main SQLite database size in MiB, excluding its sidecar files.                                  |
| Last library sync            | Last committed catalog sync time, not proof that all detail/artwork work finished.              |
| Artwork cache size           | Indexed cached artwork payload size in MiB.                                                     |
| Watched movies               | Available movie groups in the source's Played collection.                                       |
| Unwatched movies             | Available movie groups in the source's New collection.                                          |
| Recently added movies        | Count in the most recent batch of newly discovered movie groups.                                |
| Last scrape date             | Most recently finished enrichment attempt, including a failed attempt.                          |
| Scraper conflicts            | Movie groups with unresolved enabled-provider matching conflicts.                               |
| Missing metadata             | Movie groups missing expected saved data from enabled providers.                                |
| Missing artwork              | Movie groups missing expected selected poster/backdrop cache data.                              |
| Missing purchase information | Movie groups missing required date/paid/retail evidence, except those marked unavailable.       |

History counts are viewings, not distinct titles: a rewatch counts again.
Windows are rolling UTC 24-hour periods, not calendar weeks/months. Deleted and
future entries are excluded. The seven-day, 30-day and partial sensors include
bounded `movies` lists. Recently added and missing/conflict sensors also expose
bounded lists. Lists contain at most 50 titles and 8 KiB; `truncated: true`
means the count is still complete but the list is not.

The first Library scan establishes a baseline, so Recently added starts at zero.
A later batch of new groups replaces it; unchanged scans do not clear it. It
measures discovery, not purchase dates. Watched/Unwatched come from device
collections, separately from Journal completion, and can overlap. Missing
collection evidence is unknown, not proof of zero.

Library-dependent sensors become unavailable when Library is disabled; the two
size sensors remain usable. HA's entity/Recorder permissions apply to these
states and movie-name attributes, so they can expose household viewing
information outside the Companion panel. They do not contain invoice prices or
private Journal notes. Use the paginated Library, not sensor attributes, for a
full catalog. See the [sensor reference](../development/sensors.md) for exact
counting and availability rules.

## Request jobs and change feature settings

| Button             | Prerequisite and effect                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| Library sync       | Enabled Library; requests a background catalog sync.                         |
| Refresh metadata   | Enabled Library and enrichment; requests provider work.                      |
| Calendar full sync | Configured, enabled dedicated-calendar Full Sync; requests one guarded pass. |

Buttons are unavailable when their feature is not ready. Pressing one does not
enable the feature. A successful request is not evidence that the background job
completed; check Library, metadata or Full Sync status in Companion.

| Switch                         | Setting changed                                                   |
| ------------------------------ | ----------------------------------------------------------------- |
| Add watched movies to calendar | Enables/disables publication to the configured calendar.          |
| Automatically record playback  | Enables/disables tracking from the configured HA source entities. |
| Enable library sync            | Enables/disables the selected Library connection.                 |

Set required source/calendar/connection options in
[Configuration](configuration.md) first. Switches validate and save those
options and reload the integration. They do not configure a missing source for
you.

All actions below use the `kaleidescape_companion.` prefix. Interactive calls
require an active administrator and a ready integration.

| Action                  | Data and result                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `library_sync`          | No data; request enabled Library sync.                                                                                                            |
| `calendar_full_sync`    | No data; request one guarded Full Sync pass.                                                                                                      |
| `refresh_metadata`      | Optional `providers` list (`kaleidescape`, `tmdb`) and `only_missing` boolean, default false. Empty/omitted providers uses all enabled providers. |
| `import_purchase_email` | Required `invoice` object or JSON string; supports an HA response variable for saved results and review issues.                                   |
| `database_cleanup`      | Optional `calendar`, `collections`, `playback` retention days, each 0–3650. Default 0 keeps that history.                                         |

After enabling Library, the smallest action example in **Developer Tools →
Actions → YAML mode** is:

```yaml
action: kaleidescape_companion.library_sync
```

Expect an accepted sync request, then inspect Library status for its outcome.
For an already configured and enabled TMDB provider, this requests only missing
metadata or expected artwork:

```yaml
action: kaleidescape_companion.refresh_metadata
data:
  providers:
    - tmdb
  only_missing: true
```

Provider values must be a list, not comma-separated text. An action does not
enable a provider or supply its credentials. Follow
[Purchases and receipts](purchases-and-receipts.md) for receipt setup and
review; `needs_review` can mean valid purchases were saved. Cleanup removes
selected finalized operation history while preserving pending/uncertain work,
retry barriers, purchases, Library and Journal records. It does not compact
SQLite; see [Data management](data-management.md).

## Install, update, create and enable blueprints

1. As an administrator, open **Companion → Advanced → Settings → Automations**.
   Compare installed and bundled versions. Missing templates are normally
   installed when HA's blueprint manager is available, under
   `blueprints/automation/kaleidescape_companion/` in HA's configuration folder.
2. For a missing file choose **Install**; for a known older version choose
   **Update**. **Change log** shows bundled history. Review the changes before
   confirming. **Review replacement** warns when an installed file has local or
   unrecognized changes; preserve edits you want before accepting replacement.
3. Open HA's **Settings → Automations & scenes → Blueprints**, choose the
   desired Companion blueprint and create an automation. Select its required
   inputs and intended local time. Configure the corresponding Companion feature
   first.
4. Review and save the automation, then verify it is enabled when you intend it
   to run. Check its trace and Companion's feature status after a trigger.

Uploading a new Companion version preserves existing blueprint files. A
successful explicit update reloads dependent automations. If a write/reload is
unconfirmed, inspect the installed file and automation state before retrying. An
unavailable inventory can indicate that HA's blueprint manager is not ready.

| Bundled blueprint                                           | Inputs and behavior                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import purchase receipts (`purchase_email_parser.yaml`, v8) | Select an IMAP entry, optional sender substring filter and at least one of transaction ID, purchase price, retail price or purchase date; all four are selected by default. Receipt events fetch HTML and import valid items. |
| Schedule library sync (`library_schedule.yaml`, v1)         | Daily local time, default 03:00; requests Library sync.                                                                                                                                                                       |
| Schedule metadata refresh (`metadata_schedule.yaml`, v1)    | Daily local time, default 04:00; providers default to all enabled, Only missing defaults true.                                                                                                                                |
| Schedule calendar full sync (`calendar_schedule.yaml`, v1)  | Daily local time, default 03:00; requests a pass, waits 11 minutes, requests another. Requires dedicated-calendar acknowledgement and enabled Full Sync.                                                                      |
| Schedule maintenance (`maintenance_schedule.yaml`, v2)      | Daily local time, default 03:00; cleanup defaults on with 180-day calendar/collection and 90-day playback retention. Optional Library sync and metadata refresh default off.                                                  |

For example, once the Library blueprint is installed and Library is enabled,
this is a minimal automation configuration in HA's automation YAML editor:

```yaml
alias: "Companion: daily Library sync"
use_blueprint:
  path: kaleidescape_companion/library_schedule.yaml
  input:
    time: "03:00:00"
```

This example does not imply an automation has been created or enabled for you.
The schedule uses HA's local time and single-run mode. Choose separate times for
independently scheduled jobs as appropriate; a sync request starts background
work and does not make the next requested job wait for completion. Maintenance
retention accepts 0 to keep a history indefinitely. After updating to v2, review
existing retention inputs because previously ignored values are now applied.

The receipt blueprint uses queued mode with at most ten runs. It listens for
`imap_content` on the selected entry and a subject containing “Kaleidescape
Store Receipt”; the sender filter is routing, not authentication. Missing or
unusable HTML yields a notification without import. **Run actions** alone lacks
the required message trigger fields. Use the receipt guide's recovery workflow
and protect traces/logs, which can contain the full email.

## Stop or recover automation work

Disable an automation in HA to stop future triggers. Disable its corresponding
Companion feature to stop new work there too; accepted background/provider
operations may still finish. Scheduling neither enables a disabled feature nor
bypasses its safeguards. The calendar's delayed second pass can be lost during
an HA restart, and a successful request does not guarantee deletion.

For failures, inspect the trace first, then the owning feature's status. Fix
missing prerequisites before retrying. For uncertain calendar/player writes or
partially saved receipts, inspect the external state or saved records rather
than assuming failure meant rollback. Follow [calendar recovery](calendars.md),
[player recovery](player-controls.md) or
[receipt review](purchases-and-receipts.md) as appropriate. HA/native provider
qualification remains separate from offline tests; detailed blueprint and action
contracts live in the [automation reference](../development/automations.md).

# Configuration, permissions and display profiles

Companion settings control shared household features and each user's view of
them. Configure the integration as an HA administrator after
[installation](../getting-started.md). Other active HA users can browse enabled
household features and change their own view options. Companion uses HA login;
it has no separate user database or frontend password.

## Roles and presentation

| Surface or action                                           | Access                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Household Journal and enabled Library                       | Active HA users; private notes, invoice details and recorder internals are omitted     |
| Now Playing                                                 | Active users with access to the selected HA source entities                            |
| Enabled playback controls                                   | Active HA users; the administrator separately enables controls and experimental launch |
| Settings, discovery, metadata review and collection changes | Administrators                                                                         |
| Journal edits, purchases, Database, imports and exports     | Administrators                                                                         |
| Personal Library and Journal Options                        | The signed-in user's own preferences                                                   |

The header's **Basic / Advanced** switch is an administrator presentation
choice. Basic displays the household interface; Advanced exposes management
surfaces. Switching modes does not change the HA account's permissions.
Household users do not gain management access by changing a URL or a saved
preference. HA separately controls access to Companion entities and automation
actions; a hidden panel button is not an entity-permission rule.

## Save shared configuration

Open **Settings** and choose a category. Search matches setting labels and hints
and takes you to the matching control. A category change keeps the current
draft. The save bar shows pending native settings; **Save settings** validates
and applies them, then reloads the integration as needed. Read any field error
before saving again. Saving is disabled when no native fields changed.

| Category    | Start here                                                                           |
| ----------- | ------------------------------------------------------------------------------------ |
| General     | Shared default landing page and fuzzy search                                         |
| Journal     | Recording source entities and runtime/completion/resume rules                        |
| Library     | Server address, sync, details, artwork, cache limit and collection-change permission |
| Playback    | Control address, discovery, default player and experimental launch                   |
| Metadata    | Provider opt-ins, TMDB credential, refresh rate and source preferences               |
| Calendar    | Publication target/templates and separately acknowledged Full Sync                   |
| Automations | Installed/bundled blueprint review and links to HA automation setup                  |
| Maintenance | Settings transfer, metadata repair, cleanup, dashboard generation and reload         |
| About       | Versions, bounded summaries and support links                                        |

A minimal configuration change is **Settings → General → Default landing page →
Journal**, followed by **Save settings**. Opening the panel without a selected
page in its URL should then choose Journal. A valid selected URL page takes
precedence; disabled or inaccessible pages fall back to an available household
view.

Settings marked **saves immediately** are different from native configuration.
Per-view Options save personal preferences immediately. Shared hidden collection
names use **Save visibility**; save or discard that draft before saving native
settings. Hiding a collection name does not hide its movies or change device
membership.

## Feature opt-ins and prerequisites

| Feature                    | Prerequisites and first operation                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic recording        | Select one media player and its distinct play-status/media-location sensors, then enable tracking. See [Journal](journal-and-library.md).                                           |
| Library                    | Save an accepted local server address or use discovery, enable sync, then inspect the first scan. Artwork is separately enabled.                                                    |
| Collection changes         | Enable Library collection sync and explicitly allow device collection changes. The administrator queues exact-version operations.                                                   |
| Playback controls          | Save the control connection, discover players, select/save a default. Title launch is a further opt-in. See [controls](player-controls.md).                                         |
| External metadata          | Enable Library and the desired provider; TMDB needs your credential. Save, then request a refresh. See [metadata](metadata.md).                                                     |
| Calendar publishing        | Select a calendar that supports the required operation, then enable publication. Full Sync requires a dedicated target and separate acknowledgement. See [calendars](calendars.md). |
| Recurring jobs or receipts | Review the matching blueprint, then create, configure and enable an HA automation. Installing a blueprint alone starts no schedule. See [automations](entities-and-automations.md). |

The Journal recording source and playback-control target are separate choices.
Changing the latter does not redirect recording. Library scans do not run
metadata refreshes; each job has its own explicit trigger or automation.

## Personal views and width profiles

For a small personal change, open **Library → Options**, choose List or Covers,
and wait for the save result. Navigate away and return: the accepted choice is
retained for that account and display profile without reloading HA. Journal and
Database have their own Options and do not reuse the Library choices.

Profiles depend on CSS viewport width: desktop is over 1024 pixels, tablet is
601–1024 and mobile is 600 or less. No device fingerprint is used. A first edit
creates an independent profile; an unedited profile inherits its initial
defaults. Width changes wait for active dialogs, writes and pending/failed
preference saves to settle. Opening a mobile keyboard alone does not switch the
profile. Another mounted tab is not updated live; revisit or refresh it to load
accepted changes.

Library search and filters are URL state, not saved profile settings. Sharing a
Library URL shares its search/facet values. View, count and sort choices remain
personal. The Journal's selected month can also appear in its panel URL; it is
separate from saved list/calendar layout.

## Transfer settings between prepared instances

As administrator, open **Settings → Maintenance → Export / import settings**.
Select categories and use **Export selected**. To import, select the JSON file,
choose categories, then **Review selected categories** and inspect the values
before **Apply selected settings**.

Browsing/shared choices apply immediately. Native runtime fields are staged on
the Settings page for validation and **Save settings**. Full Sync requires a
fresh dedicated-calendar acknowledgement. Credentials are excluded; configure
TMDB separately. Connection names, entity IDs and templates can still be
private, so protect the file. This transfer is limited to 256 KiB and is not a
Journal/Library import or a complete backup.

## Failures, recovery and disablement

- If a save fails validation, use the field explanation; the page can open the
  affected category for you. Discovery and refresh operations use saved
  settings, not an unsaved draft.
- If a preference save is unconfirmed, retry the same save or reload and inspect
  what was stored before creating a different change. A closed dialog does not
  undo an accepted backend operation.
- For a TMDB credential, an empty replacement keeps the stored value. **Remove**
  stages deletion, **Undo** cancels it, and **Save settings** applies it; the
  stored secret is never shown back to the browser.
- Disable a feature and save to stop its new work. Existing cached metadata and
  household records are retained according to that feature's contract. Disable
  its HA automation separately if it should stop requesting jobs.

These instructions describe implemented behavior, not completed live HA or
browser qualification. The [UI contract](../development/user-interface.md) and
[security guide](../development/security.md) own exact persistence and access
boundaries.

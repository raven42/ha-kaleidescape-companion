# Dashboard cards

Companion includes six HA cards for remotes, Now Playing, Library browsing and
the local Journal calendar. The installed integration registers its frontend
module globally. Reload the HA browser or app after updating, then use **Edit
dashboard → Add card** and search for **Kaleidescape**. There is no separate
frontend download or manual JavaScript resource to add.

You need an active signed-in HA user and permission to edit the chosen
dashboard. Cards display the household interface even for administrators.
Configure features and perform management/recovery in the Companion panel's
Advanced mode. Library cards need Library enabled and synced; remote controls
and Library title playback have separate administrator opt-ins. Adding a card
does not send a device command. Pressing an enabled control does.

## Add the smallest useful card

For an existing Journal, add a manual card with this YAML and save:

```yaml
type: custom:kaleidescape-journal-calendar-card
```

Expect the current local month, navigation controls and posters for its
viewings. An empty month is valid; navigate to a month with records. This card
reads the local Journal, independently of HA calendar publishing. The visual
editor exposes the same options as YAML.

| Card type                                   | Use and prerequisites                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `custom:kaleidescape-remote-card`           | Portrait remote with power, navigation, transport and player selection; requires enabled controls and a selected player. |
| `custom:kaleidescape-now-playing-card`      | Observed title, cover, runtime and playback status; optional controls require their separate setup.                      |
| `custom:kaleidescape-library-covers-card`   | Paginated covers and title popups from the enabled Library.                                                              |
| `custom:kaleidescape-library-search-card`   | Search titles, actors and directors in Library cards with a matching channel.                                            |
| `custom:kaleidescape-library-card`          | Full Library with covers/list, search, filters and sorting.                                                              |
| `custom:kaleidescape-journal-calendar-card` | Monthly local Journal with viewing popups and month totals.                                                              |

All six work in Sections and masonry layouts. Each accepts optional `title` and
`entry_id`; omit `entry_id` to use the loaded integration. Card configuration
does not need access tokens, provider keys, device addresses or serial numbers.

## Remote and Now Playing

Add either example as its own card:

```yaml
type: custom:kaleidescape-remote-card
```

```yaml
type: custom:kaleidescape-now-playing-card
show_controls: false
```

Set `show_controls: true` on Now Playing to display its remote controls; true is
the default. Both cards accept optional `player_id`, an opaque Companion player
ID, not an HA `media_player` entity ID, IP address or serial number. Leaving it
out uses the shared default. **Choose Player** selects a local target without
changing that default or the Journal's recording source. Use **Choose Player**
for an interactive selection instead of guessing an ID.

HA can conditionally display a card. For example, replace the fictional
`media_player.cinema` below with the HA entity corresponding to your selected
player to show the controls only while that entity reports playing:

```yaml
type: conditional
conditions:
  - condition: state
    entity: media_player.cinema
    state: playing
card:
  type: custom:kaleidescape-now-playing-card
  show_controls: true
```

Exit dashboard editing to test the condition. HA also offers a card's Visibility
tab for conditions; see its
[conditional card documentation](https://www.home-assistant.io/dashboards/conditional/).
Visibility and `show_controls` affect presentation, not authorization or player
selection. Companion still enforces its shared feature settings and command
uncertainty barriers. See [Player controls](player-controls.md) before sending
commands.

## Link search and covers

This single stack supplies both a search card and a cover card. Type part of a
known title or actor's name; expect only the matching covers in this group.

```yaml
type: vertical-stack
cards:
  - type: custom:kaleidescape-library-search-card
    channel: cinema
  - type: custom:kaleidescape-library-covers-card
    channel: cinema
    columns: 3
    page_size: 12
```

Matching `channel` values connect cards on the current dashboard view, within
the same integration entry and dataset. The default channel is `main`. Give
separate groups different channels. Search does not navigate away or change
saved Library preferences. Unquoted text matches partial names; double quotes
request exact word matching.

`columns` accepts 1–20 and `page_size` accepts 1–1000. These are explicit
counts, so the last row can be partially filled. Start with two or three columns
on a phone and increase them for a wider tablet or desktop card. Keep page size
modest for a small display. Pagination remains available when `show_stats` is
false.

The cover and full Library cards accept independent `show_titles`, `show_format`
(video), `show_audio_format`, `show_badges`, `show_rating` and `show_stats`
switches. If `show_audio_format` is omitted, it inherits `show_format`. Missing
artwork uses a placeholder; cached artwork loads as it becomes visible. Open a
cover for its details. Enabled Library launch still requires an explicit Play
action.

## Full Library and calendar layouts

Use a wide Sections card or a panel view for the full Library. It does not
automatically change the dashboard layout or enter fullscreen.

```yaml
type: custom:kaleidescape-library-card
view: covers
columns: 5
page_size: 25
search_position: top
show_filters: true
show_sort: true
```

Choose `view: list` for a list. `search_position` accepts `top`, `bottom` or
`off`; filters and sorting can each be hidden independently. Layout and browsing
changes remain local to the card, separate from the panel's saved desktop,
tablet and mobile preferences. A matching search card can supply search when the
embedded search is off.

The calendar fits all seven weekday columns to its available width:

```yaml
type: custom:kaleidescape-journal-calendar-card
calendar_size: 100
calendar_fit: false
```

`calendar_size` accepts 60–320 pixels per day row. `calendar_fit: true` adapts
height to the available screen. On narrow cards the controls/footer compact and
posters retain their proportions. Month navigation and **Today** are local to
the card and do not change the HA URL. Cross-day cut posters represent one
viewing; see [Calendars](calendars.md) for counting rules.

## Generate examples and recover failures

Administrators can use **Companion → Advanced → Settings → Maintenance →
Generate test dashboard**, enter a name and choose **Create test dashboard**.
Save settings first. This adds a separate HA-managed dashboard with seven views
of examples and checklists; it does not replace an existing dashboard. **Open
test dashboard** opens it and **Download YAML** saves its configuration.

Generation requires loaded HA dashboards, an enabled nonempty Library, enabled
controls with a saved default player, an existing HA observation source and at
least one visible Journal viewing. Metadata scrapers, calendar publishing,
active playback and Library launch opt-in are not prerequisites. Creation sends
no device commands; buttons in the created dashboard can act on real players.

After a lost creation response, use **Check and finish setup** for the same
attempt. Inspect **HA Settings → Dashboards** before starting another; an empty
dashboard may remain after an incomplete setup. Remove unwanted dashboards
through HA's dashboard settings.

If HA reports an unknown custom card, verify Companion loaded successfully and
reload the browser/app after the update. Do not add a duplicate panel resource.
For unavailable data, check feature enablement and the owning panel's status;
for disconnected search, check channel, entry and dataset. For an unconfirmed
player action, use the [control recovery workflow](player-controls.md).

Remove a card to stop showing it. Hide controls for a display-only layout, or
disable controls in Companion to stop new device requests everywhere. Cards do
not create/edit Journal entries or provide administrator metadata/database
tools. Browser layout and real-device qualification remain operator checks; the
[card reference](../development/dashboard-cards.md) records the detailed options
and review coverage.

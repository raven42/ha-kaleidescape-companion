# Home Assistant dashboard cards

Updating/reloading Companion registers its versioned frontend module globally.
Reload the HA browser/app after updating, then use **Edit dashboard → Add card**
and search for **Kaleidescape**. All six cards support the visual editor, YAML,
Sections and masonry layouts. No HACS frontend download, copied JS file or
manual resource is needed. Avoid adding the panel JS separately as a dashboard
resource. The same module serves the sidebar and cards.

Cards need an active signed-in HA user. Library must be enabled for Library
data; controls and movie launch retain their separate administrator-managed
opt-ins. Cards display the household interface even for administrators. Use
Companion's Advanced mode for settings, metadata management and
uncertain-command review. Cards do not create or edit Journal records. Nothing
is sent to a player merely by adding a card; enabled controls explicitly send
commands when pressed.

## Cards

| Type                                        | Purpose                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `custom:kaleidescape-remote-card`           | Inline portrait remote, power, direction/select, transport and player choice                  |
| `custom:kaleidescape-now-playing-card`      | Current title, cover, playback status and runtime, with optional remote controls              |
| `custom:kaleidescape-library-covers-card`   | Covers only, configurable row/page counts and badges, with title detail popups and pagination |
| `custom:kaleidescape-library-search-card`   | Search titles, actors and directors in matching Library cards                                 |
| `custom:kaleidescape-library-card`          | Full Library, suited to a panel/full-width dashboard view                                     |
| `custom:kaleidescape-journal-calendar-card` | Local monthly Journal with stacked posters, viewing/movie popups and selected-month footer    |

```yaml
# Each of these can be added as its own card.
type: custom:kaleidescape-remote-card
```

```yaml
type: custom:kaleidescape-now-playing-card
show_controls: true
```

```yaml
type: custom:kaleidescape-journal-calendar-card
calendar_size: 100
calendar_fit: false
```

The remote reuses the exact panel command/uncertainty protections and readiness
checks. When multiple players are available its Choose Player dialog selects a
local target without changing household defaults. Both playback cards accept
optional `player_id`, the opaque Companion player ID (not an IP, serial number
or HA media-player entity ID); omit it to use the household default.

Calendar uses the local database and cached artwork, independently of HA
calendar publishing. It has previous/next month navigation, 60–320 px sizing and
optional screen fitting. Clicking person/genre/year/rating links opens a
household Library popup within the card. Dashboard month navigation does not
change the HA URL.

## Linked search and covers

Place these cards on the same dashboard view. They work together when `channel`
values match. Separate channels support independent Library groups. Scope is
also restricted to the same loaded integration entry and dataset. Search does
not navigate away from the dashboard or change personal Library preferences.
Unquoted text supports partial names; double quotes use exact word matching.
Fuzzy-search behavior follows the user's shared search preference.

```yaml
type: vertical-stack
cards:
  - type: custom:kaleidescape-library-search-card
    channel: cinema
  - type: custom:kaleidescape-library-covers-card
    channel: cinema
    columns: 5
    page_size: 20
    show_titles: false
    show_format: true
    show_badges: true
    show_rating: false
    show_stats: false
```

Covers per row (`columns`, 1–20) and covers per page (`page_size`, 1–1000) are
explicit counts, including partial last rows. Smaller screens may benefit from
2–3 columns. Cached images retain the same visibility-triggered loading and
bounded cache as the panel. Pagination remains available when statistics are
hidden; opening a cover uses the existing movie detail dialog.

## Full Library

Use HA's full-width/panel layout or a full-width Sections card as appropriate
for your dashboard. The card does not enter the browser's Fullscreen API or
change dashboard layout automatically.

```yaml
type: custom:kaleidescape-library-card
columns: 8
page_size: 100
view: covers
search_position: top
show_filters: true
show_sort: true
show_titles: false
show_format: true
show_badges: true
show_rating: true
show_stats: true
```

`search_position` is `top`, `bottom` or `off`. Filter/clear controls and sort
controls are independently configurable. `view` is `covers` or `list`. Format,
Library status/favorite/recent, rating, title overlay and footer statistics have
separate toggles. Card options are independent of saved desktop/tablet/mobile
Library settings. Sort/filter changes while browsing are local to that mounted
card; the visual editor/YAML controls its initial layout. It uses the user's
shared random seed if Random is chosen.

All cards accept optional `title`. Optional `entry_id` selects a loaded
Companion entry; leaving it blank uses the loaded integration. These are
identifiers, not credentials. Never put HA access tokens, provider API keys,
addresses or serial numbers in card configuration. Errors are displayed within
the card; unavailable or disabled Library/control features do not bypass their
server settings.

## Icons and installation checks

The eight background-free PNG cutouts are in [assets/icons](../assets/icons/).
The first is installed as `brand/icon.png` (256 px) and `icon@2x.png` (512 px).
HA 2026.3 and newer uses local integration branding automatically; the sidebar
continues to use its standard movie icon. The brand folder and dashboard code
ship in the normal Companion package.

Automated component/API tests use fictional data. Operator browser review
remains necessary: check all six cards as administrator and regular user;
portrait/tablet sizes; row/page settings; search channels; top/bottom/off
search; badge/stat switches; empty/failed calendar months; cover popups; and
remote player selection, readiness and guarded uncertainty. Device-control
verification requires your explicit test action; automated checks never contact
real players.

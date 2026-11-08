# Household journal and management UI

Status: implemented. The compiled Lit frontend serves the HA sidebar and
[dashboard cards](design-dashboard-cards.md). Production uses the signed-in HA
session and authenticated Companion endpoints; no separate frontend server or
stored browser token is needed. Development preview setup is in the
[development guide](../guides/guide-development.md).

## Navigation and roles

The page order is **Now Playing | Library | Journal | Database | Settings**. The
native default landing-page option is used without an allowed selected tab;
`companion_page` preserves the tab in the URL. Disabled/inaccessible pages fall
back to an available household view. Administrator Basic/Advanced is a saved
presentation preference: Basic uses the household renderer, while Advanced
exposes management. The header switch shows the current mode as Basic or
Advanced. The header uses the same Kaleidescape Companion title and
page-specific subtitle in both modes. Backend HA permissions remain
authoritative.

| Surface     | UI responsibility                                                                                               | Feature contract                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Now Playing | Permitted HA playback display/artwork; administrators also see recording context; optional remote/player choice | [Controls](design-playback-controls.md), [journal](design-journal.md) |
| Library     | Shared cached list/covers, search/filter/options, version detail dialogs; admin edits and provider review       | [Library](design-library.md), [metadata](design-metadata.md)          |
| Journal     | Shared list/month view and details; administrator manual create/correct/delete                                  | [Journal](design-journal.md), [calendar](design-calendar.md)          |
| Database    | Administrator inspection, supported edits/deletion and reviewed imports/exports                                 | [Data management](design-data-management.md)                          |
| Settings    | Shared configuration, provider/control/calendar opt-ins, personal settings and configuration transfer           | This document and the relevant feature designs                        |

The Journal list combines a sticky toolbar, selectable entries and details with
a compact footer. Narrow layouts stack regions; Calendar uses compact month
controls. Ordinary users see no notes, source/session identifiers, purchase
prices or raw diagnostics. Administrators retain detailed operational context in
Advanced mode. The calendar card is implemented, independent of HA publishing.

## Settings and persistence ownership

Settings groups configuration by function in a keyboard-accessible desktop
sidebar and a category selector on narrow screens. Search matches setting names,
keys and hints, then opens the category and focuses the matching control.

| Category    | Scope                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General     | Shared landing page, shared fuzzy search and guidance to per-view Options                                                                                       |
| Journal     | Media player, play-status and media-location entities; tracking, minimum runtime, minimum watch time and resume window                                          |
| Library     | Local address, scanning, collection/detail/artwork options, collection-change permission, artwork storage, recent-purchase window and shared hidden collections |
| Playback    | Control opt-in, address, player discovery/default and experimental Library title launch                                                                         |
| Metadata    | Store/TMDB opt-ins, credential replacement/removal, request rate, preferred source for each metadata field, per-title auto-save and enrichment status/actions   |
| Calendar    | Publishing opt-in, destination, title/description templates, dedicated-calendar Full Sync acknowledgement/window and export                                     |
| Automations | One installed/bundled blueprint inventory, installation, update review, change logs and HA setup guidance                                                       |
| Maintenance | Configuration transfer, metadata repair, test-dashboard generation and reload                                                                                   |
| About       | Companion/pyk/API/schema versions, Library and purchase summaries, documentation, release notes and support links                                               |

Switching categories preserves drafts. A sticky save bar shows the number of
changed native settings, with markers beside affected categories. Save is
disabled when nothing has changed. Validation reveals and focuses an invalid
field even when it is in another category or the nested metadata form. Numeric
fields show units and bounds. Non-obvious settings have a round question-mark
button beside their labels: hover, keyboard focus or tap opens a text balloon.
Escape or an outside interaction dismisses it, and balloons stay within the
viewport. Inputs retain accessible labels and descriptions. Destructive-action
warnings remain visible. Native integration settings require **Save settings**.
Personal SQLite view preferences save immediately without reloading HA. Hidden
collection changes require **Save visibility**; save or discard them before
saving native configuration. Settings is administrator-only; household users
retain Options for their own views.

Journal source inputs suggest existing HA entity IDs and friendly names, with
bounded lists of media players and sensors. The TMDB card reports whether a
credential is stored without returning it; an empty replacement retains the
saved secret. The right-aligned **Remove** button stages removal for **Save
settings** and becomes **Undo** until then. Library uses **Kaleidescape Server
Address** and Playback uses **Kaleidescape Player Address** to distinguish their
connections. Calendar template buttons insert supported placeholders at the text
selection. Playback guides the administrator through saving the connection,
discovering players, selecting a default and saving again. Discovery and
metadata sync require the relevant saved configuration. Legacy in-process
scheduling fields are not presented as active controls; schedules use optional
HA automations.

Configuration transfer supports reviewed category selection and excludes
secrets. It is distinct from journal/Library merge imports, which exclude
settings and operational receipts. Save settings before discovery-dependent
dashboard creation; the [card guide](design-dashboard-cards.md) owns its
prerequisites and lost-response recovery.

**Automations** compares installed and bundled versions in one table. **Update**
or **Review replacement** opens a review with both versions and the bundled
change log before confirmation. Known older versions show changes since that
version; modified files also warn that local edits will be replaced. **Install**
uses the same visible review, and **Change log** is available independently.
Loading or failed history requests cannot be confirmed. Installing a blueprint
does not create or enable an automation: the page links to HA Blueprints and
describes choosing inputs and enabling the desired workflow. The
[automation design](design-automations.md) owns revision checks and update
recovery. Bundled history does not describe an operator's local edits.

## Database and per-title management

Database shows Viewings, Sessions, Library and Purchases by default. Options
exposes protected system tables and fixed or viewport-fitted row counts. Its
entry list and details have separate keyboard-scrollable regions, with a shared
footer showing row range, total, selection count and First/Previous/Next
navigation. Library and artwork rows can preview authenticated cached covers;
relationship links open the referenced row. Protected records remain read-only.

**Reconcile purchases** loads unmatched purchases already saved in the database.
Review starts with no purchases selected; unresolved purchases appear first and
**Match title…** selects an available Library movie. The review and match picker
use cached covers when available. Review search, 25/100/500-row pages and
selection across pages help manage larger sets. Purchase reconciliation remains
available while automatic recording is enabled; general Merge Import requires
recording disabled. See [data management](design-data-management.md) for
revision checks, conflict preservation, limits and retry behavior.

The administrator's Library metadata dialog separates **Scraper Sources**,
**Field Mapping** and **History**. Refresh searches the selected source even if
it has cached data; multiple candidates require a choice. Per-field source
choices, source-use switches and cover/backdrop availability declarations follow
the configured auto-save mode: immediate save when enabled, otherwise a draft
until Save. Available TMDB image choices can replace covers/backdrops, with
reset actions where an earlier image is retained. These controls use the
[metadata review contract](design-metadata.md), not unrestricted image URLs or
browser-supplied provider data.

## Personal and shared preferences

Preferences live in SQLite's `settings` table, scoped to the authenticated HA
user and dataset. No request selects another owner. Profiles are desktop (over
1024 CSS pixels), tablet (601–1024), and mobile (600 or less); width uses no
cookie or device fingerprint. Library, Journal, Database and interface view
choices have independent profile values. Shared fuzzy search is a native
household setting; legacy personal search values are retained for compatibility
but no longer determine behavior.

| Area             | Stored choices                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `interface`      | Administrator Basic/Advanced presentation                                                                                  |
| `library`        | List/covers, page size, badge style, cover/cast presentation, sort/direction, column widths and administrator cost display |
| `journal`        | List/calendar, day size and fit-to-screen                                                                                  |
| `database`       | Table, count mode, system-table visibility and per-table sort/order                                                        |
| `search`         | Legacy personal fuzzy-search values retained for compatibility; no longer used by the views                                |
| `library_random` | One random seed shared across the user's display profiles                                                                  |
| Shared UI        | Administrator-maintained hidden collection names and initial inherited defaults                                            |

Updates use entry/dataset scope, a cryptographic request UUID, row revision and
validated field patch. The worker patches the latest row, preserving unrelated
fields; the last accepted same-field setter wins. Preference revisions are not
journal optimistic locks. Exact actor/profile/payload retries return the
original revision. Receipts contain fingerprints/revisions, not copies of
searches.

Library search and filters are temporary panel URL parameters rather than user
preferences. Opening a filter URL replaces the current search and filters; a URL
without Library filter parameters starts unfiltered. Previously saved Library
search/filter fields remain readable for compatibility but are not restored by
the panel. URLs can contain search terms and selected facet names, so copying or
sharing one also shares those values. View and sort preferences remain personal
and do not come from the URL.

Settings revisions are separate from content revisions. Raw Database settings
inspection has a monotonic counter even across row deletion. Personal patches
are bounded to 16 KiB; searches to 500 characters, selections to 100 per facet,
six column widths to 80–800 pixels and cover targets to 90–300 pixels. Shared
hidden names are capped at 200 names of 256 characters. Feature-specific options
have additional enum/range validation.

Unsaved profiles inherit legacy user preferences or initial household defaults;
a first accepted edit creates an independent row. Existing legacy profile input
remains compatible. Settings transfer includes profiles and applies older
unprofiled files across formats, within a 256 KiB file limit. Private SQLite/HA
backups contain user IDs and saved searches; household read responses do not
expose another user's rows.

Crossing a width boundary switches profiles after active dialogs, writes and
pending/failed preference saves settle. Opening a mobile keyboard alone does not
change a width profile. Another mounted tab reloads accepted settings when
remounted; there is no live cross-tab preference subscription.

## Search, calendar state and display

Fuzzy search defaults on; off uses case-insensitive partial matching. A whole
search enclosed in double quotes requests exact whole-word matching. People
links quote names to avoid near-name matches. Selected facets and the Database
condition language stay exact. Matching for imports/provider identity has its
own [title-matching contract](design-title-matching.md); fuzzy display search
cannot authorize a movie launch or silently merge identities.

Journal Options saves list/calendar (Calendar for new profiles), 60–320 pixel
day height (default 180) and fit-to-screen (default off). Slider release saves
the size; fitting temporarily uses the available viewport and disabling it
restores the saved value. Month selection is retained as
`companion_month=YYYY-MM` in the panel URL while the Journal is active, falling
back to the current local month; navigating away removes it. It is not a
personal settings field. Dashboard month navigation remains local to the card.
Search/status state and displayed month must not be confused with persisted
layout.

An active Journal search temporarily shows list results without changing the
saved view. The desktop search field has a clear button; mobile exposes the
active query as a dismissible search chip. Clearing restores the preferred
list/calendar view and the selected month while retaining other filters.
Calendar's **Today** button returns to the current local month.

Library badges, filters, pagination and browser image retention are specified
once in the [Library design](design-library.md). Personal Options save accepted
choices immediately; closing a draft filter does not apply it. Native settings
and dashboard card configuration remain separate from personal profile choices.

## Dialogs, writes and response recovery

Render untrusted content as text. Reuse accessible dialogs, labeled controls,
keyboard navigation, focus handling and responsive sticky actions. Dirty drafts
require discard review. Current close/Escape behavior can dismiss a failed or
pending request: this cancels browser retry/ignores late responses, not an
already accepted backend mutation. Refresh/inspect the result before creating a
new intent. An open dialog preserves its exact retry payload/UUID.

Use server-side revisions and owned error codes. A stale edit keeps the draft
visible and offers reload/review. Do not silently resubmit a mutation under a
new UUID after a timeout. Controls, collection changes, calendar actions,
metadata reviews and imports have distinct durable/review-token contracts; link
their feature designs rather than assuming one generic retry behavior.

Account/role/scope changes clear cached private responses and artwork object
URLs. Frontend visibility is not an authorization boundary. No HTML from a movie
or provider response is executable in the panel.

## Validation

Automated component/proxy tests use fictional transport and a simulated DOM;
production bundles exclude preview fixtures and development proxy code. On
2026-11-07 the owner reviewed the fictional administrator Settings preview and
confirmed the requested names, hints and credential-removal refinements. Broader
operator browser review still covers desktop/tablet/mobile, both roles,
focus/keyboard, responsive profiles, dirty/pending dialogs, empty/loading/error
states and reload persistence. Use the concrete preview URLs in the development
guide; automated checks do not launch a real browser or send real player
commands.

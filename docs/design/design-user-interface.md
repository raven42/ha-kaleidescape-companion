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
exposes management. Backend HA permissions remain authoritative.

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

Settings has five keyboard-accessible subtabs below sticky Save/Cancel actions:

| Subtab         | Scope                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Home Assistant | Recording source entities, calendar selection/templates/Full Sync and test-dashboard generation |
| Companion      | Recording rules, landing page, shared hidden collections, settings transfer and reload          |
| Personal       | Fuzzy search and guidance to per-view Options                                                   |
| Kaleidescape   | Loaded pyk version, local Library/cache, collection-add opt-in, discovery and playback controls |
| Scrapers       | Provider opt-ins, credentials, rate limits, preferred sources and enrichment controls           |

Switching subtabs preserves unsaved configuration. Invalid native form fields
reveal their subtab before validation. Native integration settings require Save;
personal and shared SQLite UI preferences save immediately without reloading HA.
Sections identify that distinction. Settings is administrator-only; household
users retain Options for their own views.

Configuration transfer supports reviewed category selection and excludes
secrets. It is distinct from journal/Library merge imports, which exclude
settings and operational receipts. Save settings before discovery-dependent
dashboard creation; the [card guide](design-dashboard-cards.md) owns its
prerequisites and lost-response recovery.

## Personal and shared preferences

Preferences live in SQLite's `settings` table, scoped to the authenticated HA
user and dataset. No request selects another owner. Profiles are desktop (over
1024 CSS pixels), tablet (601–1024), and mobile (600 or less); width uses no
cookie or device fingerprint. Library, Journal, Database, search and interface
choices have independent profile values.

| Area             | Stored choices                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `interface`      | Administrator Basic/Advanced presentation                                                                                     |
| `library`        | List/covers, page size, cover/cast presentation, filters/search, sort/direction, column widths and administrator cost display |
| `journal`        | List/calendar, day size and fit-to-screen                                                                                     |
| `database`       | Table, count mode, system-table visibility and per-table sort/order                                                           |
| `search`         | Fuzzy-search boolean shared across the views in that display profile                                                          |
| `library_random` | One random seed shared across the user's display profiles                                                                     |
| Shared UI        | Administrator-maintained hidden collection names and initial inherited defaults                                               |

Updates use entry/dataset scope, a cryptographic request UUID, row revision and
validated field patch. The worker patches the latest row, preserving unrelated
fields; the last accepted same-field setter wins. Preference revisions are not
journal optimistic locks. Exact actor/profile/payload retries return the
original revision. Receipts contain fingerprints/revisions, not copies of
searches.

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

Journal Options saves list/calendar, 60–320 pixel day height (default 180) and
fit-to-screen (default off). Slider release saves the size; fitting temporarily
uses the available viewport and disabling it restores the saved value. Month
selection is retained as `companion_month=YYYY-MM` in the panel URL, falling
back to the current local month; it is not a personal settings field. Dashboard
month navigation remains local to the card. Search/status state and displayed
month must not be confused with persisted layout.

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
new UUID after a timeout. Controls, collection additions, calendar actions,
metadata reviews and imports have distinct durable/review-token contracts; link
their feature designs rather than assuming one generic retry behavior.

Account/role/scope changes clear cached private responses and artwork object
URLs. Frontend visibility is not an authorization boundary. No HTML from a movie
or provider response is executable in the panel.

## Validation

Automated component/proxy tests use fictional transport and a simulated DOM;
production bundles exclude preview fixtures and development proxy code. Operator
browser review still covers desktop/tablet/mobile, both roles, focus/keyboard,
responsive profiles, dirty/pending dialogs, empty/loading/error states and
reload persistence. Use the concrete preview URLs in the development guide;
automated checks do not launch a real browser or send real player commands.

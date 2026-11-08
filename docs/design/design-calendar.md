# Watched movies calendar

## Journal month view

Open **Journal → Options → Calendar view** to switch between the entry list and
a monthly calendar. This choice saves immediately for your HA user. Previous and
next arrows move one month; **Today** returns to the current local month. The
selected `companion_month=YYYY-MM` stays in the URL across reloads and
reopening. Invalid/missing months start at the current month. This view reads
the local Journal and needs no HA calendar entity or publishing opt-in.
Administrator and household readers share the same calendar.

With Calendar view enabled, Options also offers **Calendar size** (60–320 px day
rows, initially 180 px) and **Fit month to screen**. Dragging the slider updates
covers immediately and saves when released. Fit sizes the rows to the available
viewport height, accounting for the header, footer and number of weeks; it
follows window resizing and month navigation. Turning Fit off restores the saved
slider size. Extremely small screens may still require scrolling to keep dates
and covers usable. These choices save separately for each HA user and display
profile.

Viewings appear on their browser-local start date, including partial viewings
unless excluded by the Journal status or Library movie filter. An active search
temporarily displays list results, using the saved fuzzy-search preference,
without changing the saved Calendar view. Clear it with the desktop input's
clear button or the mobile search chip to return to the selected month; other
filters remain active. Deleted entries are excluded. Each viewing has a poster;
same-day posters overlap diagonally with about 15% of each rear cover exposed.
Hover or keyboard focus brings that poster forward. Poster stacks keep portrait
proportions within the available day width and height, with 5 px insets. All
seven weekday columns fit the container, including narrow dashboard cards. The
date sits above the artwork as a small readable overlay instead of reserving a
separate row.

Cross-day completed viewings have two endpoint covers: the start-day cover has a
diagonal lower-right cut, and the completion-day cover has a complementary
upper-left cut. Both open the same viewing details/editor. Intermediate days are
not filled. Same-day viewings and partial entries retain whole covers. Month
reads include either endpoint, so a prior-month start still appears on its
completion date. Local dates and half-open month bounds include timezone and DST
changes.

The single sticky Journal footer shows all-time totals and the selected month's
viewing count and watched time. Month totals ignore search/status filters and
count each viewing once by completion date (partial: start date), assigning its
whole watched time to that month rather than splitting it across days. A viewing
spanning two months can have posters in both while contributing totals only
once. Loading, no-matches and error/retry messages also live in that footer; the
calendar has no separate status labels above or below the grid. On phones, the
compact footer shows only the selected month's count and watched time.

Click a linked poster to open the same full movie details used by the Library,
including its expandable Journal history. Journal options can select the compact
movie details instead. When Library is disabled or the exact link is
unavailable, the compact viewing details remain available. The compact dialog
shows artwork, rating, cast, directors, genres, runtime, year, format/version
badges, watched minutes and status; it omits purchase and detection details.
Close, Escape or a backdrop click dismisses the popup.

Administrators in Advanced mode can choose **edit** in the expanded Journal
heading of the full dialog, then choose an entry if there is more than one, or
**Edit viewing** in the compact dialog. It loads the current Journal record and
opens the same editor as the list view for title, start/end, runtime, watched
minutes, status and notes. Its Movie from Library field uses the same
autocomplete as Add viewing; changing the title requires selecting an exact
version, distinguished by year/format. That selection updates the title, Library
link and metadata together while preserving recorded timing, watched minutes and
playback identifiers. Existing history can still receive timing or note
corrections with Library disabled, but changing the movie requires Library
access. Changing start time shifts end time by the same elapsed interval;
manually changing end time leaves start time alone. **Delete entry** opens the
normal confirmation; its X returns to the editor. Confirming sets the viewing's
deletion marker and hides it from Journal/calendar reads, retaining the stored
row and session history for recovery. This action never permanently purges the
record. Saving or deleting refreshes the current month. Household readers retain
read-only details. Revision checks, unsaved-change guards and explicit retries
after uncertain writes match the list editor.

In the current dialog, the movie title opens its full Library details in place.
Person-name links open Library with a fresh search matching actors and
directors; year, genre, rating and format links use one exact filter. These
search and filter actions clear old Library search and facet selections,
preserve sort/display preferences, reset pagination and save the new criteria.
They require enabled, linked Library metadata and work for both household roles.

The exact saved Library version supplies current cached metadata and artwork
when Library is enabled and that version remains available in the current
source. Missing metadata or artwork uses a placeholder. Images use the existing
visibility-loaded authenticated cache, retained while this calendar is mounted
and cleared on account/scope changes or departure. No device or calendar
provider is contacted. A month read is limited to 1000 viewings and a two-second
SQLite budget; narrow the status or Library movie filter if that limit is
exceeded.

Operator browser review: check a month with multiple same-day viewings, hover
and keyboard focus on rear posters, previous/next/Today navigation, search clear
and month restoration, same-day versus overnight date labels, missing artwork,
all seven columns at mobile widths and popup dismissal. Check the slider, Fit on
five- and six-week months, and detail links replacing old Library criteria.
Automated component tests do not establish rendered browser geometry.

Also review Edit viewing, X, Save, and Delete entry → X/Confirm deletion on
fictional entries, including the nested confirmation and editor button
alignment. Verify the removed viewing disappears from the month and that
household users have no edit action.

## Publish to an HA calendar

Enable **Add watched movies to calendar** in the integration's Configure options
or Companion **Settings**. It is disabled by default. Select one existing HA
calendar that supports creating events; read-only calendars cannot be used. The
default is create-only publishing. Full Sync, described below, additionally
maintains completed Journal entries within a bounded age window. The Companion
Settings field suggests up to 100 currently writable calendar entities; the
native HA form uses its calendar entity selector. Registered targets follow
entity renames, without rebinding a deleted registry identity.

In create-only mode, new completions, including manually added completed
viewings and a partial viewing changed to completed, queue an event. Existing
completed history, imports and ordinary corrections are not automatically
backfilled. Use the explicit Journal export below for existing history. Calendar
publishing does not mark a Library title Watched, change collections, or control
playback. Library sync need not be enabled for automatic viewing titles/times to
publish; Library metadata is included when an exact cached version can be
resolved.

Manual and observed viewings save the same bounded Library snapshot and version
reference. Recording fills missing snapshot fields at checkpoints, including
completion before its calendar receipt is queued. This works with Library sync
enabled even when calendar publishing is disabled. If no cached version matches,
recording continues with viewing titles/times; it does not contact the device to
look up details. Calendar rendering also attempts the same local resolution for
older entries whose snapshots are missing or incomplete.

## Repair existing Journal metadata

After updating Companion, sync the Library's title details, save any Settings
changes, then use **Settings → Journal Library metadata → Repair Journal Library
metadata**. Review the counts and choose **Repair missing metadata**. This
updates the live Journal through its worker; replacing or importing the database
is unnecessary. Take a normal HA backup first if you want a restore point.

The repair fills missing snapshot values and version references without
overwriting existing values, viewing/session times, completion state or notes.
It skips tombstones and open sessions, reports unmatched entries, and can be run
again after a later Library sync. Matching is scoped to the configured source
and uses exact version IDs/handles. The locally verified spelling bridge
`26-N.0-S_<eight hex digits>` → `N-S_<same digits>` is also accepted; other
spellings stay exact, and ambiguous handles are skipped. This bridge comes from
saved playback/browser data, not a general vendor guarantee. Movie names, years
and fuzzy searches are never used to guess a version. Descriptive fallback still
follows the Library's exact source group, keeping remake metadata apart.

The preview is checked again before an atomic repair. Changed candidates require
another review. Recording/sync may stay enabled; active entries are left for
their next checkpoint or a later repair. Backup and active import/export block
new repairs. The action is bounded to 10,000 visible Journal entries and a
ten-second application budget checked between rows; a limit rolls back the
entire repair. Request UUIDs retain the original actor-bound result after a lost
response. Revisions change only for updated viewings; a protected content-free
`database_audit` receipt records the action.

Repairing metadata does **not** directly queue calendar writes. Full Sync will
notice repaired Journal revisions and refresh managed descriptions. In
create-only mode, existing events remain unchanged. The ordinary Journal export
skips matching title/start/end events and does not refresh their descriptions.
Correct already-created events in the calendar provider if their details need
updating.

## Templates and event metadata

The default event title is `Watched: {title}`. The editable description starts
with generic session details: title/year, start/end, watched minutes/runtime,
rating, cast, director, genre, collections and synopsis. Both templates accept
these flat placeholders:

```text
{title} {year} {collection} {cast} {director} {writer} {studio} {genre}
{duration} {watched} {rating} {format} {edition} {synopsis}
{purchase_date} {added_on} {status} {started_at} {ended_at}
```

Names use singular forms; lists become comma-separated text. Duration is runtime
in minutes to two decimals; `{watched}` is actual watched minutes. Missing
metadata is blank. `{{` and `}}` escape literal braces. Attribute access,
indexing, conversions, format specifications and executable/Jinja templates are
rejected. Title templates are limited to 500 characters, description templates
to 5000, rendered titles to 1024; descriptive substitutions are bounded to 512
UTF-8 bytes and lists to 20 items. A title that renders too long is cancelled
before calling the calendar. Source `Played` is displayed as Watched and shared
hidden collection names are omitted from the snapshot.

The event spans the viewing's start through its end, falling back to completion
time when playback is still in credits. A non-positive interval gets at least
one second or its known watched time. It is a timed event, not an all-day event.
Timestamps include their timezone, so HA and the selected calendar own display
conversion. The fixed
[HA calendar.create_event action](https://www.home-assistant.io/actions/calendar.create_event/)
receives the selected entity, summary, start/end timestamps and description.

Events contain only the rendered title/description and viewing interval. An
empty description template produces an empty description. Companion does not
append JSON, dataset/viewing/version IDs, or artwork-cache references. Old
templates containing `{artwork}` remain valid but that placeholder now renders
blank. No credentials, signed image URLs, image bytes, notes, device origins,
raw handles or filesystem paths are published. Descriptions are capped at 32
KiB. In create-only mode, existing events are not rewritten; older descriptions
may still contain the previous metadata block.

The Journal month view reads the local database and exact linked Library
version, using authenticated artwork access. The
[dashboard calendar card](design-dashboard-cards.md) uses the same local
approach, without parsing provider events or requiring an export. Evicted or
missing artwork shows a placeholder. Provider copies of previously published
details remain independent of local deletion.

## Delivery and recovery

Schema migration 13 introduced the private `calendar_publications` outbox.
Completion and its queued receipt commit in the same worker transaction. A
viewing ID has only one publication receipt, including across restarts, status
changes and calendar configuration changes. Receipts contain
target/state/timestamps and a config fingerprint, not copied titles, notes,
templates or event descriptions. The two protected viewing columns hold an exact
version reference and bounded public metadata snapshot for manual and observed
entries. They are not part of household viewing responses or portable JSON
imports/exports; SQLite backups preserve them.

The publisher checks for queued work every ten seconds, at most one event per
tick. An unavailable calendar/service leaves work queued. Before an external
call it persists `sending`, rechecks the calendar opt-in/configuration and uses
only that configured entity. Service calls have a 30-second budget. Confirmed
calls become `sent`; a provider failure, timeout or interrupted attempt becomes
`uncertain`. Restart changes a retained `sending` receipt to `uncertain`. There
is no automatic retry of an uncertain call: HA's general create action provides
no cross-provider idempotency guarantee, and the event may already exist.
Inspect the calendar and **Database → Options → Show system tables →
calendar_publications**. This table is read-only. The explicit export below can
resolve uncertainty when a matching remote event is found; it does not blindly
repeat an unconfirmed attempt. A failed final receipt write can leave `sending`;
inspect it before retrying, even if an event exists.

Changing/disabling calendar options cancels unsent receipts on reload. Deleted
or no-longer-completed viewings are cancelled before dispatch. Already accepted
external calls can finish after opt-out or a local edit/deletion. In create-only
mode, local changes never update/delete an existing calendar event. Backup and
unload drain accepted calendar work before closing/suspending storage; no
service call is held open through a backup. These rules prefer avoiding
duplicate writes over guaranteed delivery. Taking/reinstalling an older SQLite
snapshot can lose newer receipts; review calendar contents before enabling
publishing on a restored copy.

## Export existing Journal viewings

With Full Sync disabled, save the calendar settings first, then use **Settings →
Export Journal to calendar → Sync all watched movies to calendar**. The
confirmation displays the count and warns that changing the title format can
produce duplicate events. Only completed, nondeleted Journal viewings are
included; Library's Watched collection is not a substitute for session history.
Imported completed viewings can be exported too. An unavailable calendar or
missing event-lookup service prevents starting.

This administrator-only background job reads existing events with HA's fixed
[calendar.get_events action](https://www.home-assistant.io/actions/calendar.get_events/).
It skips matches with the same rendered title and start/end instants, normalized
to UTC whole seconds. Description-only changes do not update existing events.
Rewatches with different times remain separate events. Changing the title
template may create duplicates, as shown in the confirmation. No remote event is
edited or deleted.

The job processes at most 10,000 viewings, in chronological order, reading one
UTC month plus seven days at a time. Calendar replies are limited to 10,000
events / 8 MiB per window; one window's keys are retained. Viewing intervals
longer than seven days are rejected. Each service call has a 30-second timeout.
A failed or malformed lookup stops remaining work; it is never interpreted as an
empty calendar. A changed/deleted viewing is skipped before creating an event.
Authority, saved configuration and calendar availability are rechecked across
waits. Automatic publication and historical export serialize calendar
reads/writes.

Progress shows created, matched, skipped, failed, uncertain and cancelled
counts. Cancel stops unstarted items and drains an accepted call; events already
created remain. Successful browser submission continues after
navigation/disconnect, while the originating HA user remains active and an
administrator. An unconfirmed browser response offers an exact UUID retry, not
another export. Backup pauses between items, drains accepted calls and resumes
after storage returns. Restart/reload cancels pending items and preserves
uncertain attempts for review; jobs are not automatically resumed after restart.

Schema migration **14** introduced protected `calendar_sync_jobs` and
`calendar_sync_items` system tables. They retain actor, target/configuration
fingerprint, viewing IDs, times and states without copied event content.
Completed/matched items suppress pending automatic publication for the same
configuration. A provider failure or interrupted write is uncertain; a later
explicit export may match it remotely, but never repeats an unconfirmed write
with unchanged configuration. Different configurations can generate another
event. Retained retry/job receipts are not purged automatically and count toward
the database limit. A stale restored database or an external writer can still
produce duplicates; this is not cross-provider exactly-once delivery.

## Full Sync for a dedicated calendar

Enable **Settings → Watched movies calendar → Full Sync** and acknowledge the
dedicated-calendar warning, then save. Full Sync is disabled by default.
**Assign its own separate calendar. Within the age window, events that do not
match a completed, nondeleted database Journal entry will be permanently
deleted.** Partial viewings are not calendar events. No live provider writes
occur during development checks.

Configure **Full Sync age window** to 1–12 whole months (default **3**). The
rolling window uses calendar months, ending at the current instant. Older and
future events stay outside maintenance. Recurring events are skipped, including
their instances, to avoid deleting a series. The calendar must expose stable
event UIDs and support reading, creation and deletion. When it also supports
updating, edits keep the event UID; otherwise a verified replacement is created
first and the old event enters normal deletion quarantine.

No Full Sync pass is scheduled automatically. **Run Full Sync now**, the
**Calendar full sync** HA button, and the
`kaleidescape_companion.calendar_full_sync` action request one guarded pass. The
optional calendar blueprint requests a pass at the chosen local time and another
11 minutes later; HA restart or automation cancellation during the delay can
prevent the second pass, so the next manual or scheduled check must complete it.
This mode replaces the create-only publisher/export for that target. Existing
events are adopted by rendered title and UTC whole-second start/end instants;
private UID links then identify them across title, interval and description
edits. Changing a start in the shared Journal editor moves its end by the same
elapsed interval. Manual end edits do not move the start.

Descriptions always append **Maintained by Kaleidescape Companion via Home
Assistant**, even with an empty description template. There are no appended
internal IDs, metadata blocks or artwork references. Templates and sharing
privacy otherwise follow the same rules as ordinary publishing.

Unmatched events need **two successful scans** with the same
Journal/configuration and unchanged event contents, at least **ten minutes**
apart, before deletion. A later user-requested pass must perform the recheck;
the integration does not schedule one itself. Changed Journal data, changed
event contents or settings restart the quarantine. Reads that fail, exceed
bounds, lack UIDs or contain ambiguous IDs stop the pass; they are never treated
as an empty calendar. Creates/updates must be read back before cleanup. A final
narrow read checks each candidate before its UID is deleted, and
Journal/settings/capabilities are rechecked before every write. Reads support at
most 10,000 events / 8 MiB, the window at most 10,000 Journal rows, calls have
30-second budgets and a pass five minutes. Viewing intervals over seven days
stop the pass rather than authorizing cleanup.

Schema migration **20** introduced protected system tables:
`calendar_managed_events` holds UID/viewing links,
`calendar_reconcile_candidates` holds quarantine hashes and observation times,
and `calendar_reconcile_intents` holds durable operation receipts. They contain
no copied titles or event descriptions. Confirmed/reviewed receipts are pruned
in batches when the 10,000-receipt limit is reached; unconfirmed intents are
retained. These tables stay separate from Library and Journal facts and cannot
be manually edited/deleted/imported.

Before each external write, a `sending` intent commits. Timeout, failure,
interruption or delayed read-back leaves an uncertain barrier; subsequent passes
use reads to resolve it and never blindly replay it. No cleanup proceeds while
uncertainty remains. Check **Full Sync status**, inspect the assigned calendar,
then **Review unconfirmed writes → Check again**. Only after inspecting should
an administrator choose **I inspected the calendar · acknowledge** to permit new
attempts. That approval is bound to the exact pending set, so a stale dialog
cannot acknowledge a newer failure. Provider visibility delays can still cause
duplicates after explicit acknowledgement; quarantine subsequently handles
unmatched duplicates. Generic HA APIs cannot prove that a provider never
silently truncates results or guarantee cross-provider exactly-once delivery.

Backup/unload stops new work and drains accepted writes before pausing SQLite.
Disabling/changing options revokes unstarted writes; already accepted calls can
finish. Errors use safe status text and require a later user-requested check.
The single publisher lock serializes maintenance and all other calendar work.

Operator review: use a disposable dedicated calendar. Verify the bold warning,
required acknowledgement, 1–12 month limits and optional automation schedule;
create/edit/delete a fictional completed viewing, confirm its maintenance note,
then add an unrelated event within the window and check it survives initial
scans but disappears after the grace period. Verify older, future and recurring
events remain. Check unavailable-calendar recovery and uncertainty review
without a duplicate send. Automated tests use simulated HA entities; no live
calendar has been modified.

## Verification and next steps

Automated tests use temporary SQLite and a simulated HA calendar action, never a
real provider. On an isolated HA instance, configure a disposable writable
calendar, enable the option, complete a fictional movie, and check title,
timezone, interval, rendered description and exactly one receipt/event after
reload. Review opt-out and unavailable-calendar behavior. Export existing
fictional history twice and confirm the second run matches events; verify
description templates and the format-change warning. This operator check is
still needed; no live calendar was used to implement the feature.

The Journal month view is also available as a
[dashboard card](design-dashboard-cards.md). Dedicated-calendar
reconciliation/edit/delete is implemented as Full Sync above. Gmail or other
sharing connectors need a separate authorization and privacy design; they are
not implemented by this feature.

## Diagnosing unconfirmed Full Sync writes

A write is verified with up to three reads (immediate, after one second, then
after three more seconds), using a one-minute boundary margin. No external write
is retried by these reads. Provider failures and ambiguous or absent results
leave the durable uncertainty barrier intact. Inspect the actual calendar before
acknowledgement; acknowledgement does not fix a provider that transforms or
cannot confirm event content.

## Edits, replacements and pending deletion

When the provider supports HA's `UPDATE_EVENT` capability, Full Sync locates the
saved calendar UID and updates that event in place. Providers exposing only
create/delete support use a verified replacement instead. The prior event then
joins normal guarded cleanup; both events can remain visible during the grace
period. The replacement is never followed by an immediate unguarded deletion. An
unchanged pass after at least ten minutes can remove the prior event, subject to
the window, completeness, concurrency and uncertainty safeguards.
Journal/configuration/event changes restart quarantine.

**Settings → Calendar → Existing viewing history** displays **Pending delete:
N** alongside unconfirmed writes when Full Sync is enabled. A successful pass
can still have pending deletes. **Run Full Sync now** refreshes status and warns
before proceeding when either count is nonzero. Continuing rechecks pending
work; it does not waive the grace period or acknowledge uncertain writes. The
status response reports the current pending-work counts.

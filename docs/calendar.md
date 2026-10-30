# Watched movies calendar

## Journal month view

Open **Journal → Options → Calendar view** to switch between the entry list and
a monthly calendar. This choice saves immediately for your HA user. Previous and
next arrows move one month; reopening starts at the current month. This view
reads the local Journal and needs no HA calendar entity or publishing opt-in.
Administrator and household readers share the same calendar.

With Calendar view enabled, Options also offers **Calendar size** (60–320 px day
rows, initially 180 px) and **Fit month to screen**. Dragging the slider updates
covers immediately and saves when released. Fit sizes the rows to the available
viewport height, accounting for the header, footer and number of weeks; it
follows window resizing and month navigation. Turning Fit off restores the saved
slider size. Extremely small screens may still require scrolling to keep dates
and covers usable. These choices save separately for each HA user.

Viewings appear on their browser-local start date, including partial viewings
unless excluded by the Journal status filter. Search, fuzzy-search mode and a
Library movie filter apply to the month. Deleted entries are excluded. Each
viewing has a poster; same-day posters overlap diagonally with about 15% of each
rear cover exposed. Hover or keyboard focus brings that poster forward.

Click a poster to open compact viewing/movie details: artwork, rating, cast,
directors, genres, runtime, year, format/version badges, watched minutes and
status. The viewing date appears once; a start/end date range appears only when
the local dates differ. Purchase and detection details are omitted. Close,
Escape or a backdrop click dismisses the popup.

Administrators also have **Edit viewing** in the popup. It loads the current
Journal record and opens the same editor as the list view for title, start/end,
runtime, watched minutes, status and notes. **Delete entry** in that editor
opens the normal confirmation; Keep entry returns to the editor. Confirming sets
the viewing's deletion marker and hides it from Journal/calendar reads,
retaining the stored row and session history for recovery. This action never
permanently purges the record. Saving or deleting refreshes the current month.
Household readers retain read-only details. Revision checks, unsaved-change
guards and explicit retries after uncertain writes match the list editor.

Title and person-name links open Library with a fresh search matching titles,
actors and directors. Year, genre, rating and format links open Library with one
exact filter instead. Both actions clear the old Library search and facet
selections, preserve sort/display preferences, reset pagination and save the new
criteria. Names search across actor/director roles. These controls require
enabled, linked Library metadata and work for both household roles.

The exact saved Library version supplies current cached metadata and artwork
when Library is enabled and that version remains available in the current
source. Missing metadata or artwork uses a placeholder. Images use the existing
visibility-loaded authenticated cache, retained while this calendar is mounted
and cleared on account/scope changes or departure. No device or calendar
provider is contacted. A month read is limited to 1000 viewings and a two-second
SQLite budget; narrow the search/status filter if that limit is exceeded.

Operator browser review: check a month with multiple same-day viewings, hover
and keyboard focus on rear posters, previous/next navigation, same-day versus
overnight date labels, missing artwork, mobile horizontal scrolling and popup
dismissal. Check the slider, Fit on five- and six-week months, and detail links
replacing old Library criteria. Automated component tests do not establish
rendered browser geometry.

Also review Edit viewing, Cancel, Save, and Delete entry → Keep entry/Confirm
deletion on fictional entries, including the nested confirmation and editor
button alignment. Verify the removed viewing disappears from the month and that
household users have no edit action.

## Publish to an HA calendar

Enable **Add watched movies to calendar** in the integration's Configure options
or Companion **Settings**. It is disabled by default. Select one existing HA
calendar that supports creating events; read-only calendars cannot be used. The
Companion Settings field suggests up to 100 currently writable calendar
entities; the native HA form uses its calendar entity selector. Registered
targets follow entity renames, without rebinding a deleted registry identity.

New completions, including manually added completed viewings and a partial
viewing changed to completed, queue an event. Existing completed history,
imports and ordinary corrections are not automatically backfilled. Use the
explicit Journal export below for existing history. Calendar publishing does not
mark a Library title Watched, change collections, or control playback. Library
sync need not be enabled for automatic viewing titles/times to publish; Library
metadata is included when an exact cached version can be resolved.

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

Repairing metadata does **not** queue calendar writes or change existing events.
The ordinary Journal export skips matching title/start/end events and does not
refresh their descriptions. Correct already-created events in the calendar
provider if their details need updating.

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
KiB. Existing events are not rewritten; older exported descriptions may still
contain the previous metadata block.

The Journal month view reads the local database and exact linked Library
version, using authenticated artwork access. A future dashboard card will use
the same local approach, without parsing provider events or requiring an export.
Evicted or missing artwork shows a placeholder. Provider copies of previously
published details remain independent of local deletion.

## Delivery and recovery

Schema 13 adds a private `calendar_publications` outbox. Completion and its
queued receipt commit in the same worker transaction. A viewing ID has only one
publication receipt, including across restarts, status changes and calendar
configuration changes. Receipts contain target/state/timestamps and a config
fingerprint, not copied titles, notes, templates or event descriptions. The two
protected viewing columns hold an exact version reference and bounded public
metadata snapshot for manual and observed entries. They are not part of
household viewing responses or portable JSON imports/exports; SQLite backups
preserve them.

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
repeat an unconfirmed attempt. Provider exceptions are logged without their
private response text. A failed final receipt write can leave `sending`; inspect
it before retrying, even if an event exists.

Changing/disabling calendar options cancels unsent receipts on reload. Deleted
or no-longer-completed viewings are cancelled before dispatch. Already accepted
external calls can finish after opt-out or a local edit/deletion. Local changes
never update/delete an existing calendar event. Backup and unload drain accepted
calendar work before closing/suspending storage; no service call is held open
through a backup. These rules prefer avoiding duplicate writes over guaranteed
delivery. Taking/reinstalling an older SQLite snapshot can lose newer receipts;
review calendar contents before enabling publishing on a restored copy.

## Export existing Journal viewings

Save the calendar settings first, then use **Settings → Export Journal to
calendar → Sync all watched movies to calendar**. The confirmation displays the
count and warns that changing the title format can produce duplicate events.
Only completed, nondeleted Journal viewings are included; Library's Watched
collection is not a substitute for session history. Imported completed viewings
can be exported too. An unavailable calendar or missing event-lookup service
prevents starting.

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

Schema **14** adds protected `calendar_sync_jobs` and `calendar_sync_items`
system tables. They retain actor, target/configuration fingerprint, viewing IDs,
times and states without copied event content. Completed/matched items suppress
pending automatic publication for the same configuration. A provider failure or
interrupted write is uncertain; a later explicit export may match it remotely,
but never repeats an unconfirmed write with unchanged configuration. Different
configurations can generate another event. Retained retry/job receipts are not
purged automatically and count toward the database limit. A stale restored
database or an external writer can still produce duplicates; this is not
cross-provider exactly-once delivery.

## Verification and next steps

Automated tests use temporary SQLite and a simulated HA calendar action, never a
real provider. On an isolated HA instance, configure a disposable writable
calendar, enable the option, complete a fictional movie, and check title,
timezone, interval, rendered description and exactly one receipt/event after
reload. Review opt-out and unavailable-calendar behavior. Export existing
fictional history twice and confirm the second run matches events; verify
description templates and the format-change warning. This operator check is
still needed; no live calendar was used to implement the feature.

Planned: an HA dashboard card for the Journal month view and explicit provider
event reconciliation/edit/delete workflows. Gmail or other sharing connectors
need a separate authorization and privacy design; they are not implemented by
this feature.

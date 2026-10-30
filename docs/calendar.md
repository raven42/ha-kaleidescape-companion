# Watched movies calendar

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

## Templates and event metadata

The default event title is `Watched: {title}`. The editable description starts
with generic session details: title/year, start/end, watched minutes/runtime,
rating, cast, director, genre, collections and synopsis. Both templates accept
these flat placeholders:

```text
{title} {year} {collection} {cast} {director} {writer} {studio} {genre}
{duration} {watched} {rating} {artwork} {format} {edition} {synopsis}
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

The rendered description is followed by a versioned JSON object identified by
`kaleidescape_companion.calendar.v1`: dataset/viewing/version references, a
cached artwork key and bounded movie/timing fields. `{artwork}` is an opaque
`kaleidescape_companion:artwork:<key>` reference, not a downloadable URL. No
credentials, signed image URLs, image bytes, notes, device origins, raw handles
or filesystem paths are published. Descriptions are capped at 32 KiB. Existing
calendar providers do not automatically display a cover from this reference.
Future Companion calendar views/cards can resolve the version through the
authenticated Library API; eviction or unavailable metadata must show a
placeholder. Event descriptions and references remain in calendar-provider
storage, exports and shared calendars independently of local deletion.

## Delivery and recovery

Schema 13 adds a private `calendar_publications` outbox. Completion and its
queued receipt commit in the same worker transaction. A viewing ID has only one
publication receipt, including across restarts, status changes and calendar
configuration changes. Receipts contain target/state/timestamps and a config
fingerprint, not copied titles, notes, templates or event descriptions. The two
protected viewing columns hold an exact version reference and bounded public
metadata snapshot for manual entries. They are not part of household viewing
responses or portable JSON imports/exports; SQLite backups preserve them.

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
timezone, interval, metadata and exactly one receipt/event after reload. Review
opt-out and unavailable-calendar behavior. Export existing fictional history
twice and confirm the second run matches events; verify description templates
and the format-change warning. This operator check is still needed; no live
calendar was used to implement the feature.

Planned: a monthly Journal calendar with cover artwork, an HA dashboard card for
that view, and explicit event reconciliation/edit/delete workflows. Gmail or
other sharing connectors need a separate authorization and privacy design; they
are not implemented by this feature.

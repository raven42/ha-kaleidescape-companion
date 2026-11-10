# Calendars

Companion has a local Journal month view and two optional ways to publish
completed viewings to an HA calendar. The month view needs no calendar provider.
Publishing is disabled by default and requires administrator setup. Calendar
providers and anyone sharing the destination can see the rendered movie and
viewing information.

| Use                                                                                          | Choose                            |
| -------------------------------------------------------------------------------------------- | --------------------------------- |
| Browse viewings inside Companion or a dashboard                                              | Local Journal calendar            |
| Add new completions without maintaining old events                                           | Create-only publishing            |
| Keep a separate movie calendar aligned with the Journal, including removing unmatched events | Full Sync on a dedicated calendar |

## Browse the local Journal calendar

Any active signed-in HA user can open **Journal → Options → Calendar view**.
With at least one recorded or manually entered viewing, navigate to its month
and open its poster. Expect the viewing's local date and details; administrators
use Advanced mode for editing. See [Journal setup](journal-and-library.md) if
there are no viewings yet.

Use previous/next month or **Today** to navigate. **Calendar size** changes day
height from 60–320 pixels; **Fit month to screen** adjusts the layout to the
available screen. These display choices do not publish anything. A search
temporarily shows the list; clear the search input or mobile search chip to
return to the calendar with other filters preserved. Turn off **Calendar view**
to return to the list permanently.

A completed viewing spanning two dates has complementary cut posters on its
start and completion dates. These represent one viewing. Month totals count it
once, by completion date; partial viewings use their start date. Intermediate
days of a long viewing are not filled with additional posters. A month query is
bounded to 1000 viewings and two seconds; narrow filters if it reaches a limit.
The [Journal calendar card](dashboard-cards.md) uses the same local records and
does not read events from your published HA calendar.

## Publish new completions

1. Set up an existing HA calendar that supports creating events. Choose a
   destination whose audience should see your movie history.
2. As an administrator, open **Companion → Advanced → Settings → Calendar**.
   Enable **Add watched movies to calendar** and select the destination. The
   integration's HA **Configure** form also exposes these options.
3. Keep Full Sync disabled for create-only publishing. For a minimal template,
   use event title `Watched: {title}` and description
   `Watched {watched} minutes`. Save the settings.
4. Complete a new viewing through your configured tracking source, or add an
   intentional completed viewing through Journal's administrator tools. Inspect
   the destination calendar for the corresponding timed event.

For example, a newly completed viewing titled _Example Movie_ should produce
`Watched: Example Movie` with the viewing's start/end interval. This is an
expected result, not evidence that a provider write has been tested. Use an
isolated instance and test calendar for fictional entries.

Templates use flat placeholders, not Jinja. Missing metadata becomes blank;
watched time and duration are in minutes. Events use HA's time zone. Private
Journal notes and raw identities are not included, but selected metadata such as
cast, synopsis or purchase date can be published if included in the template.
See the
[template reference](../development/calendar.md#templates-and-event-metadata)
for the allowed fields.

New completions, including manual completions and partial viewings changed to
completed, queue an event. Existing history, imported records and ordinary
corrections are not automatically backfilled. Publishing does not change Library
Watched status, device collections or playback.

If the calendar is unavailable, queued work waits for it. A failed or timed-out
call that may have reached the provider becomes uncertain and is not retried
automatically. Inspect the real calendar first. Administrators can review
publication receipts under **Database → Options → Show system tables →
calendar_publications**; these records are read-only.

## Export existing completed history

With Full Sync off, save calendar settings, then open **Settings → Calendar →
Existing viewing history → Sync all watched movies to calendar**. Review the
count and confirm. This exports completed, nondeleted Journal records, including
imported history; a Library title's Played collection is not a Journal viewing.

The job creates missing events and skips matches with the same rendered title
and start/end times. It does not edit or delete existing events. Changing only
the description does not refresh a matched event; changing the title format can
create duplicates. Review progress counts for created, matched, skipped, failed,
uncertain and cancelled work.

Cancel stops unstarted work; already accepted provider calls may finish. After a
lost response, check the existing job rather than starting another export.
Restart cancels remaining work and does not resume it automatically. A later
explicit export can recognize an uncertain event by reading a matching event; it
does not blindly recreate every uncertain write.

## Maintain a dedicated calendar with Full Sync

**Full Sync permanently deletes unmatched events within its age window. Assign
it a separate calendar with no other appointments.** It requires calendar
read/create/delete support and stable event identifiers. Update support allows
edits in place; otherwise Companion verifies a replacement before the older
event becomes eligible for deletion.

1. Select the dedicated calendar, then open **Settings → Calendar → Dedicated
   calendar maintenance**.
2. Turn on **Enable Full Sync**, acknowledge the dedicated-calendar warning and
   choose the age window: 1–12 whole months, default 3. Save.
3. Choose **Run Full Sync now** and inspect both **Full Sync status** and the
   destination calendar. This requests one guarded pass.
4. If you want a daily schedule, explicitly create and enable the calendar
   blueprint described in
   [Entities and automations](entities-and-automations.md).

Full Sync replaces create-only publishing/export for the selected target. It
maintains completed Journal records inside a rolling window ending now; older
and future events remain outside maintenance. Recurring events and their
instances are skipped. Managed descriptions include a Companion maintenance
notice.

Deletion needs two successful unchanged scans at least ten minutes apart.
Journal, configuration or event changes restart that waiting period. Failed or
ambiguous calendar reads do not count as an empty calendar. **Pending delete:
N** can remain after a successful pass; another **Run Full Sync now** rechecks
work without waiving the waiting period. The optional blueprint requests a
second pass after 11 minutes; an HA restart or cancelled automation can prevent
that request.

If Full Sync reports an unconfirmed write, inspect the assigned calendar, then
use **Review unconfirmed writes → Check again**. Only after inspecting should an
administrator choose **I inspected the calendar · acknowledge**. Acknowledging
permits another attempt; it is not proof that a delayed provider write is
absent. Provider visibility delays can still lead to duplicates after
acknowledgement.

Disable Full Sync or calendar publishing and save to stop new work. Disable its
HA automation to stop scheduled requests too. Calls already accepted by a
provider may finish, and existing events are not removed just because you
disabled the feature. After restoring an older database, inspect the destination
before re-enabling publishing because the restored copy may lack newer receipts.

Native calendar-provider, time-zone and recovery checks remain operator work.
For detailed reconciliation rules and diagnostics, see the
[calendar reference](../development/calendar.md) and
[troubleshooting](troubleshooting.md).

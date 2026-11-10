# Journal and Library

The Journal records viewings; Library is a cached catalog of versions on a
selected server. They keep separate identities and enablement. Administrators
configure them and edit records; active HA users browse enabled household
summaries. Private notes, purchases, exports and database tools have narrower
access. Start with [installation](../getting-started.md) if the panel is absent.

## Record and review playback

Select one existing HA media player and its distinct play-status and
media-location sensors, then enable tracking in Configure or Companion Settings.
Player-control selection does not change the recording source. Observation reads
HA states and does not send commands to the device.

Use **Now Playing** to check that the intended source is visible. During
eligible playback, watched time counts only the exact playing state; pauses,
scans and intermissions do not accrue time. A credits indication completes a
viewing only after the configured minimum main-content time. Missing runtime can
delay recording when the minimum-runtime filter is enabled.

Open **Journal** to browse the list or calendar. Search temporarily displays a
list; clearing it restores your selected view. **Today** returns the calendar to
the current month. A partial viewing may resume for the same player/content
within the configured window; a completed viewing followed by playback is a
rewatch. Same titles alone do not merge records.

If no viewing appears, confirm the three source entities, tracking state and
usable runtime before retrying playback. Interrupted observations preserve
recovery evidence rather than inventing time. Disabling tracking stops new
recording; restart/unload retains a checkpoint. See the
[recording reference](../development/journal.md#automatic-tracking) for exact
thresholds and recovery behavior.

## Sync the Library

1. As an administrator, open **Settings → Library**.
2. Enable Library sync. Leave **Kaleidescape Server Address** blank for
   `my-kaleidescape.local` discovery, or enter the selected server's private LAN
   hostname/origin, such as fictional `http://cinema-server.local`.
3. Choose whether to sync collections, details and cover artwork. Covers use a
   separate bounded disk cache; artwork is off by default.
4. Save and inspect the Library's sync status. Use **Sync now** for an explicit
   retry or later refresh. An active scan coalesces another sync request.

The first detail/artwork pass can take several minutes for a large catalog.
Successful sync produces locally browsable titles, grouped editions and
available metadata. Missing covers display placeholders. Browsing uses cached
data while the server is offline; a failed scan preserves prior data and does
not establish that it is current.

If discovery fails, verify that HA can resolve the server hostname and reach its
local browser interface. Only standard HTTP/HTTPS ports and private LAN
destinations are accepted; URLs containing credentials, paths or queries are
rejected. Password-protected or unrecognized pages are unsupported. Disable
Library sync to stop new connector activity.

Recurring sync uses an HA automation; there is no built-in periodic schedule.
Review the bundled Library sync blueprint under **Settings → Automations**, then
create and enable the desired automation in HA. See
[Library reference](../development/library.md) and
[automation setup](../development/automations.md).

## Add or correct a viewing

After Library sync, an administrator in Advanced view can use **Add viewing** in
Journal, select the exact Library version with a known positive runtime and set
the local start time. Completed is the default; a partial entry needs positive
watched time within that runtime. The backend derives the title, identity and
end time from the chosen version and time values.

Open an existing viewing to review or correct supported fields. Corrections
preserve recorder evidence and protect manual choices from later recorder
updates. Deleting an entry hides it with a tombstone; it does not erase backups,
exports or retained recovery evidence. A stale revision means another change
won: refresh and review the current record before submitting again.

Manual entries can publish to a configured calendar, so use fictional records
only on an isolated instance with suitable feature settings. See
[data management](../development/data-management.md) for permanent
administration and [calendar behavior](../development/calendar.md) for external
publication and uncertainty recovery.

## Collection changes and uncertainty

Library sync does not enable device writes. **Allow collection changes** is a
separate administrator setting and requires collection sync. Changes target an
exact version and enter a durable queue. Refresh status after a lost response;
do not repeatedly submit the same external mutation. An uncertain outcome needs
readback/reconciliation before another write. The
[collection contract](../development/library.md) explains supported moves,
authorization checks and recovery limits.

# Inspect, transfer and recover data

The **Database** page is an administrator tool for inspecting Companion's
private records and making supported, reviewed changes. Use Advanced view. It
changes local data, not the device's catalog or arbitrary HA/filesystem state.
Keep a usable backup before bulk changes and use fictional data on an isolated
instance when learning the workflow.

## Inspect before editing

Open **Database**, select Viewings, Sessions, Library or Purchases, then select
a row to inspect its details. **Options** controls page size, table and
system-table visibility for your account/profile. Relationship links open the
referenced local record. Protected system tables remain read-only when shown.

A minimal read-only example is to choose **Library** and enter this condition:

```text
purchased_on IS NULL
```

The result contains Library rows with no visible purchase date under the same
projection used in the detail pane. Select a row and inspect its purchase/source
details; do not infer from the query alone that the movie was never purchased.
For a fictional-title search, `title CONTAINS 'Example'` selects matching text.

The search box also accepts ordinary text. Conditions support allowlisted
fields, comparisons, `IS NULL`, `LIKE`, `CONTAINS` and boolean combinations.
Text values use single quotes; NULL uses `IS NULL`, not `= NULL`. This is a
bounded condition language, not an SQL console: statements, subqueries and
functions are not accepted. A syntax message identifies the position to review.

## Correct or delete a local record

Select a supported row and choose **Edit entry**. Only editable fields appear;
IDs and relationships remain protected. Review the values and save confirmation.
Use the explicit NULL control when a value should be missing rather than an
empty string. For ordinary viewing corrections, prefer the
[Journal workflow](journal-and-library.md#add-or-correct-a-viewing).

Recording can remain enabled for targeted edits, but open playback sessions and
their viewings cannot be edited or deleted. A concurrent change invalidates the
selected revision/token; refresh and review again. Some source-owned values may
be restored by a later Library sync. Local Database edits do not change device
collection memberships; use the
[Library collection controls](journal-and-library.md#collection-changes-and-uncertainty)
for supported device writes.

**Delete entry** requires selecting supported rows and typing **DELETE**.
Database deletion is permanent in the live dataset and can remove dependent
session references. Journal Delete instead hides a viewing with a tombstone.
Neither erases separate downloads or backups. Purchases, Library versions and
operational replay/uncertainty evidence are not general delete targets. Purchase
correction and reversal use the [receipt guide](purchases-and-receipts.md).

## Choose the right transfer or backup

| Operation                      | Intended use and limits                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Export JSON**                | Portable Journal/Library facts and private purchases; excludes operational recovery state and UI preferences. Useful for reviewed merging, not a complete restore. |
| **Export SQLite**              | A consistent private database snapshot, including operational evidence and settings. It does not include artwork files or HA configuration.                        |
| **Merge Import**               | Review supported JSON/SQLite records and fill eligible missing data in the current dataset. Does not replace the live database or recreate all recovery state.     |
| **Export / import settings**   | Selected native/display configuration categories; credentials excluded. Does not move Journal/Library content.                                                     |
| Compatible full HA/data backup | Recover configuration and private data together, accounting for artwork, credentials, schema and pending external operations. Restore with HA stopped.             |

To make a private download, choose **Database → Export**, review the privacy
notice and select **Export JSON** or **Export SQLite**. Confirm the download
completed and store it in a protected location. Exports can contain deleted
history, prices, source identities and other private records; they are not the
household reader's limited view.

For an optional offline integrity check of a downloaded SQLite export, a
prepared contributor checkout provides:

```sh
scripts/validate-database /private/path/companion-export.sqlite3
```

Use a copy, not a live database. A successful structural validation does not
prove that every business fact, external operation or supported upgrade is
correct. The UI does not require the developer tooling.

## Review a merge import

1. For a general merge, disable automatic recording and save. Purchase-only
   reconciliation is a separate operation that can run while recording remains
   enabled.
2. In **Database → Merge Import**, choose a private `.json`, `.sqlite`,
   `.sqlite3` or `.db` export and select **Review import**. This uploads and
   previews; it does not write records yet.
3. Inspect counts and expand proposed before/after changes. Eligible
   viewing/Library additions or merges start selected; purchase rows start
   unchecked so their matches receive explicit review. Search does not change
   the selection.
4. Select only the intended changes, then **Apply N selected changes**. They
   commit together; a failed transaction rolls back its writes.

Viewings match exact UUIDs and Library versions match exact source/version
identities. Titles alone do not merge those records. Existing populated values,
tombstones and manual corrections are preserved under the merge rules; conflicts
stay visible. Scan the intended source before importing Library/purchase data.
An import cannot make an unknown network source active or create a live device
membership.

Reviews expire after ten minutes, replacement, unload or a database revision
change. Reopen a stale review. After a lost apply response, **Retry same
import** keeps the original operation identity and selection; do not start a
different import before inspecting an unconfirmed result. A committed result can
still be confirmed after review expiry or restart, while an uncommitted expired
review must be recreated. **Discard import retry & inspect** is an explicit
recovery choice; reloading the browser loses the pending retry state.

Uploads are limited to 32 MiB and 10,000 combined records; the bounded review
can also require splitting large inputs. The source file is never modified.
Imports do not transfer sessions, memberships, artwork files, operational
receipts, purchase repair evidence or replay barriers as a full restore would.
See the
[merge contract](../development/data-management.md#reviewed-merge-imports) for
exact supported portable formats and fill-missing rules.

## Transfer settings and perform maintenance

Use **Settings → Maintenance → Export / import settings** for configuration, not
Merge Import. Choose categories, review the file and apply. Display/shared
preferences apply immediately; native fields are staged for **Save settings**.
Credentials remain excluded and Full Sync needs a new dedicated-calendar
acknowledgement. See
[configuration](configuration.md#transfer-settings-between-prepared-instances).

**Database cleanup** in Database or Settings → Maintenance previews eligible
finalized operation history. Recommended retention is 180 days for calendar and
collection history and 90 days for playback history; Advanced settings choose
each policy or keep all. Review before applying. Pending/uncertain operations,
request barriers, purchases, Library and Journal history are protected. Cleanup
frees reusable SQLite pages; it does not shrink the file automatically. Disable
an HA maintenance automation separately to stop scheduled requests.

Metadata repair is another explicit reviewed operation: it can fill missing
Journal metadata from exact cached Library identities. It is not a database
restore or permission to rewrite a published calendar. Review its preview and
the
[calendar repair contract](../development/calendar.md#repair-existing-journal-metadata)
before applying it.

## Restore and recover from failures

- **Busy:** wait for the active backup, transfer or operation to finish and
  inspect status before retrying. Do not remove database locks or replace files.
- **Stale record/review:** refresh and review the current values; another change
  may already have been accepted.
- **Unsupported/newer schema:** preserve the files and use compatible code or a
  compatible backup. Never treat a schema error as permission to initialize over
  the database.
- **Unconfirmed write:** keep the same retry where offered and inspect the
  current record/outcome. A disconnect or closing the page cannot undo an
  accepted backend change.

For a full recovery, stop HA, preserve the current database/configuration,
restore a compatible backup and restart. Include the needed artwork and HA
configuration as well as the database. Account for changes made since the
backup. Code rollback alone does not reverse schema upgrades; never replace the
live SQLite file. Keep purchase repair history and pending-operation barriers,
since they help prevent duplicate external writes.

The current database uses schema 28; final supported alpha upgrade checkpoints
are still being selected. A JSON merge or offline validator is not evidence that
every historical database can be restored safely. Fictional full restore and
native HA backup qualification remain release gates in the
[roadmap](../development/roadmap.md#external-qualification).

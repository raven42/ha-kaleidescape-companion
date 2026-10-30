# Reviewed database merge imports

Use **Database → Merge Import** to merge a private `.json`, `.sqlite`,
`.sqlite3`, or `.db` export into the current database. Disable automatic
recording first. This is an administrator operation. It never replaces the live
database or contacts Kaleidescape.

1. Select the file and choose **Review import**. Uploading and reviewing do not
   write records.
2. Review the counts for **new**, **merge**, **unchanged**, and **skip**. Search
   the compact table, show changes only, or use 25/100/500-row pages. Expand a
   row's **Changes** to inspect the proposed before/after values.
3. Eligible new/merge viewing/title rows start checked. Purchase-history rows
   start unchecked so their proposed Library associations receive explicit
   review. Change individual checkboxes, choose **Select none**, or **Select all
   changes** across all review pages. Search does not change the selection.
4. Choose **Apply N selected changes** to approve that exact selection. The
   selected changes commit together; a failed write rolls back the transaction.

Reviews expire after ten minutes, a replacement review, integration unload, or
any change to the live database revision. A stale review requires uploading and
reviewing again. Only one bounded review is retained per loaded repository; its
token is bound to the reviewing administrator. Another administrator cannot
apply that review. A successful apply returns new, updated and skipped counts.

After an interrupted apply, **Retry same import** uses the same selection,
review token, revision and request UUID. A committed result remains confirmable
after review expiry or an HA restart. An uncommitted expired review requires a
fresh review. The UI blocks changes and dismissal while work or its result is
unconfirmed. **Discard import retry & inspect** explicitly drops the retry;
inspect the database before submitting a replacement operation. Reloading the
browser loses an unconfirmed retry. There is no automatic write retry.

## Matching and merge rules

- Viewings match by exact UUID. New records preserve validated snapshot
  precision, correction markers and deletion status. Existing tombstones stay
  deleted and are skipped. For existing visible viewings, only missing
  end/runtime/source/player/content/notes fields may be filled. Explicit manual
  corrections, including intentionally empty notes, are protected. Title,
  start/status, watched time and completion evidence remain local.
- Library versions match by the exact source-scoped version ID, checked against
  `source_id` and `source_handle`. Names, years and group representatives are
  never used as import identity. A title must belong to a source already present
  locally; unknown sources are skipped. Sync the intended source before import.
- Missing Library display metadata and `purchased_on` may be filled. Missing
  means `NULL`, empty text or an empty list; zero is a value. Populated values
  and arrays are kept, rather than overwritten or combined. Conflicting fields
  are listed in the review. First detection, source grouping and existing
  availability/freshness are preserved.
- New Library versions are stored inactive with no artwork paths/keys. A later
  server sync must verify their availability before they appear in Library.
  Imported source origins, configuration and URLs cannot initiate networking.
- Session evidence, collection memberships/status, artwork files/cache indexes,
  source audit/receipts, dataset identity and operational recorder state are not
  imported. Library sync owns membership/availability; backups own full
  recovery. A new import can intentionally restore a previously purged viewing
  UUID.

For the one-time purchase corrections, select the preserved `corrected.sqlite`,
review the **library_titles** rows with **purchased_on** changes, and approve
those rows. Legacy schema-7/8 `library_purchase_dates` records are joined to
exact version IDs during validation. Existing live purchase dates remain
unchanged; conflicts are visible in review. The source file is never modified.
The saved HTML is no longer needed by the integration. See
[purchase dates](purchase-dates.md) for the retained offline helper.

## Import purchase-history JSON

Select `purchases.json` using the same **Database → Merge Import** dialog. The
six-field array from the offline helper is accepted directly. Schema 15 stores
each purchase in `library_purchases`, separate from scanned title versions:
`title`, `purchased_on`, `purchase_price`, `retail_price`, `order_id`, and
`href`, plus an internal identity, optional Library source/group link, and
import time. Repeat orders remain separate; prices are not copied onto every
video format. Allocated bundle shares from the helper are retained as supplied.

Review each proposed link before selecting rows, or explicitly use **Select all
changes** after reviewing the matches. A case-insensitive exact title match must
identify just one available source/group across the cached Library. It suggests
a movie group, not ownership of any particular version. Ambiguous, unmatched or
unverified explicit links appear first in the review. Choose **Match title…** to
search cached Library titles by a partial name, then choose the intended movie
using its year, director and version count. This explicitly associates the
purchase with that known movie group, even when its store title differs. Choose
**Keep unlinked** to retain the purchase without a Library association. Changing
a choice only revises the review; **Apply selected changes** performs the
writes. Existing unlinked purchases can be matched on reimport, including
otherwise unchanged rows. Previously stored links are preserved. No new Library
titles are created from purchases, and names never replace exact IDs for
ordinary title imports.

Each match choice issues a new review token without extending its expiry. A lost
matching response requires a fresh file review. Search/filtering and page
changes preserve the selection, and unresolved rows stay above other results.
Manual associations remain on the stored purchase. A portable import into a
different database may require matching again when the purchase and Library
names differ; a full trusted database restore retains the stored association.

The purchase identity is derived from title, date, order ID and store link.
Duplicate identities in one input are rejected. Reimporting fills missing prices
or links and reports conflicting populated prices without overwriting them.
Changed identity fields describe a different purchase. Purchase rows show their
date and proposed group in the compact review; **Changes** includes prices and
order fields. The same selection, expiry, revision, retry and atomic-write rules
apply as for other imports.

Library **Purchased/Added on** and date sorting use the earliest linked purchase
where a version has no explicit purchase date. Existing version dates keep
priority. Prices, order IDs and store links are private administrator data;
normal Library responses and calendar templates do not expose them. Saved links
are passive text and are never fetched. Use **Database → Options → Show system
tables → Library purchases** to inspect, search, edit prices or delete
purchases. Identity fields and links are protected. Deleting a purchase removes
its derived date contribution; deleting a source detaches its purchases without
erasing their history. Sync preserves purchases and their links.

## Formats, limits and APIs

Limits are 32 MiB per file, 10,000 combined viewing/title/purchase records, an 8
MiB review response, and a 30-second upload/validation/review budget. Oversized
reviews must be split into smaller files. Older viewing JSON arrays and objects
with `viewings` remain supported. JSON format 4 includes portable
`library_titles` and private `library_purchases`; older format-3 titles remain
supported. Recognized keys are validated regardless of schema/version; unknown
keys are ignored. UI settings, actor preferences and operational recent-batch
markers are never merged from exports. SQLite snapshots still contain these
private rows; see [UI preference storage](ui-preferences.md). Every viewing
needs `id`, `title`, and an ISO `started_at` with timezone. Titles need exact
ID/source/handle/group/title keys. Purchase records need title/date; optional
prices must be nonnegative currency strings with two decimal places, and order
IDs/links are bounded validated text. SQLite imports read only known columns
from regular allowlisted tables in a defensive, query-only in-memory connection;
SQL text, views, virtual tables, functions and attachments are rejected. No
source schema or code is installed.

Upload the raw file to the scoped, authenticated preview route:

```text
POST /api/kaleidescape_companion/{entry_id}/{dataset_id}/import/preview?format=json
POST /api/kaleidescape_companion/{entry_id}/{dataset_id}/import/preview?format=sqlite
```

The result contains `plan_id`, dataset `revision`, `expires_in`, `counts` and
compact `rows` with selection keys, action, changes, preserved conflicts and a
skip reason. Apply through the authenticated HA WebSocket command:

```json
{
  "id": 1,
  "type": "kaleidescape_companion/database/import",
  "entry_id": "current-entry-id",
  "dataset_id": "current-dataset-uuid",
  "request_id": "new-request-uuid",
  "plan_id": "returned-review-uuid",
  "revision": 42,
  "selected": ["library_titles:returned-exact-version-id"]
}
```

Apply returns `imported_count`, `updated_count`, `skipped_count` and `revision`.
Receipts bind the actor, review, revision and exact selection. Audit retains
only actor, request, counts, time and revision, without file names or record
contents. Backup, transfer and storage barriers apply; all imported writes use
the 192 MiB Library ceiling to preserve journal headroom. HTTP responses are
noncacheable. Vite permits only the exact preview route at the fixed local HA
origin; apply uses HA's existing WebSocket connection.

Administrator-only `database/import/search` and `database/import/match`
WebSocket commands operate on the current actor-bound review, revision and
purchase key. Search accepts at most 100 characters and returns up to 20 grouped
title choices. Match accepts an available exact title ID (or null), revises the
ephemeral proposal and returns a new `plan_id`, updated row and counts. These
commands write no database records; the final import keeps its normal approval
and retry contract. Neither command contacts the device or adds an HTTP route.

Use the [offline restore procedure](backend.md#downloads-and-offline-restore)
for a complete trusted recovery, including sessions and retry/audit state.
Automated tests use fictional data. Review the compact dialog in your own
browser before production use.

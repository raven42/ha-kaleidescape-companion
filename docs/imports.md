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
review the **library** rows with **purchased_on** changes, and approve those
rows. Legacy schema-7/8 `library_purchase_dates` records are joined to exact
version IDs during validation. Existing live purchase dates remain unchanged;
conflicts are visible in review. The source file is never modified. The saved
HTML is no longer needed by the integration. See
[purchase dates](purchase-dates.md) for the retained offline helper.

## Import purchase-history JSON

Select `purchases.json` using **Database → Merge Import**. The purchase-record
array from the offline helper is accepted directly. Purchases are merged into
the existing **Library** table, not a separate purchase table. Every imported
purchase must belong to an existing scanned Library entry; Library entries
without purchases remain valid.

The helper also exports a separate release `year` inferred from `href`, or
`null` when unknown. The importer derives the same year from the link; the
additional field does not change invoice identity or the stored invoice fields.

Each Library row has `purchase_history`, containing the title, purchase date,
paid/retail prices, order ID, store reference and stable invoice identity for
every purchase. Flat `purchase_price`, `retail_price`, `order_id` and `href`
columns summarize its earliest invoice. Repeat orders are retained; a
movie-group purchase belongs to one stable representative version, rather than
being copied across all formats. Bundle allocations are retained as supplied.
Invoice import times are retained as private provenance. Compatible flat Library
exports with purchase columns are also accepted; supplied summary values must
agree with embedded history when both are present.

Purchase rows start unchecked. Auto-matching compares the purchase title, cached
`title_search`/display titles and the title/year inferred from the movie-store
`href`. Normalized keys handle punctuation, accents, articles, common edition
suffixes, written numbers and numbered franchise subtitles. Store paths are
parsed as passive text; no link is fetched. The release year must match a known
year in that source group when the link supplies one. A group's populated
version metadata can supply the year for sparse versions.

The review distinguishes purchase records from Library entries: **Add purchase
to Library entry** attaches a new invoice to the matched existing movie;
**Update purchase record** fills missing fields on an already imported invoice.
**Purchase record to add** shows the original field keys and before/after values
for that invoice, including `title`. The matched Library title appears
separately in the entry details; adding an invoice preserves that Library title.

Only a single source/group can become a proposal. Conflicting title hints,
different explicit sequel numbers, unknown/conflicting release years and
multiple candidates remain unresolved. Existing stored links and exact entry IDs
retain their prior identity rules. A match rate counts proposals, not
independently verified accuracy; review before applying. Matching builds one
index per review, bounded to 20,000 available versions and the existing review
time budget.

Unmatched purchases appear first and cannot be selected/applied. Choose **Match
title…**, search a partial name, then choose the intended movie using its year,
director and version count. **Clear match** returns it to unresolved; leave it
unchecked to skip it. **Select all changes** includes only eligible matched
rows. No new Library row is created by a purchase import.

Match choices only revise the review. Each issues a fresh approval token without
extending expiry; a lost response requires reviewing again. **Apply selected
changes** commits all selected invoices with revision checks, receipts and audit
counts in one transaction. Already stored associations are preserved. Invoice
identity uses title/date/order/link; duplicate identities are rejected, and
reimporting fills missing prices while preserving populated conflicts. Changing
an identity field describes another purchase. Exact entry IDs embedded in new
exports preserve reviewed store-name aliases when that entry exists locally.

An upgrade from schema 15 preserves previously unlinked purchases as unavailable
Library entries with `purchase_match_pending=1`. They never appear in the
scanned Library or sensors. Export JSON, review that export, and use **Match
title…** on those purchases to move their history onto real scanned entries.
Empty pending entries are removed after the move. Upgrade backups retain the
original data.

Library **Purchased/Added on** uses an explicit version date, otherwise the
earliest purchase in its movie group. Existing explicit dates keep priority.
Administrator title details show purchase history; **Database → Library** shows
its raw columns and supports confirmed price edits. Editing summary prices also
updates the earliest invoice. Identity/order/link/history fields remain
protected. Deleting a Library entry or source permanently deletes its owned
purchases too; export first if they must be retained. Sync preserves purchase
columns/history.

Standard-user APIs omit prices, orders, store links and the complete history;
only the date is shared. Sensors, viewing snapshots and calendar templates never
receive those private fields. Store references remain passive text and are never
fetched. JSON and SQLite exports are private administrator downloads.

## Formats, limits and APIs

Limits are 32 MiB per file, 10,000 combined viewing/title/purchase records, an 8
MiB review response, and a 30-second upload/validation/review budget. Oversized
reviews must be split into smaller files. Older viewing JSON arrays and objects
with `viewings` remain supported. JSON format 5 includes portable `library`
entries with embedded purchase history. Legacy `library_titles`, schema-15
`library_purchases`, and schema-7/8 purchase-date tables remain readable.
Recognized keys are validated regardless of schema/version; unknown keys are
ignored. UI settings, actor preferences and operational recent-batch markers are
never merged from exports. SQLite snapshots still contain these private rows;
see [UI preference storage](ui-preferences.md). Every viewing needs `id`,
`title`, and an ISO `started_at` with timezone. Titles need exact
ID/source/handle/group/title keys. Purchase records need title/date; optional
prices must be nonnegative currency strings with two decimal places, and order
IDs/links are bounded validated text. Each entry supports up to 1000 invoices
and 2 MiB of embedded history. Scan the source before importing purchase
history; new metadata rows imported in the same review do not qualify as scanned
targets. SQLite imports read only known columns from regular allowlisted tables
in a defensive, query-only in-memory connection; SQL text, views, virtual
tables, functions and attachments are rejected. No source schema or code is
installed.

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
  "selected": ["library:returned-exact-version-id"]
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

## Shared title matching for import adapters

`library/title_matching.py` exposes `TitleQuery`, `TitleMatcher` and
`TitleMatch`. The engine accepts title/year/alternate-title evidence and
optional source scope, without invoice fields or file-format assumptions. Format
adapters supply that evidence and own identity validation, review and writes.
The purchase adapter is in `library/purchases.py`; other import tools can reuse
the same engine.

The development evaluator accepts existing JSON/SQLite exports or a title-only
manifest. It suggests candidates without writing or changing the live import
rules. Viewing imports still match UUIDs and Library metadata imports still use
exact version IDs. See [reusable title matching](title-matching.md) for the API,
manifest format and commands.

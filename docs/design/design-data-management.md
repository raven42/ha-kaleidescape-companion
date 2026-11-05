# Data management, imports and exports

Database is a private administrator surface over the Companion SQLite database.
It changes local records/cache metadata, never the device, HA entity actions or
filesystem paths supplied by a browser. The household Library/Journal readers
retain their existing positive field projections. Journal Delete still creates a
tombstone; Database Delete permanently removes supported stored entries.

## Browse, options and edit

Select a row to see its raw stored values in the right-hand pane. **Edit entry**
opens a separate dialog containing only supported fields; IDs and relationship
keys are omitted. JSON metadata uses a JSON text editor. Nullable fields have an
explicit NULL checkbox so empty text and a missing value remain distinct. Review
the changes and check the save confirmation before applying them.

The header/search controls and footer stay visible while browsing. The row list
and selected details have separate, keyboard-focusable scroll areas; scrolling
hundreds of rows no longer pushes details below the list. Pagination, row counts
and selection counts live in the sticky footer. Narrow screens stack the two
scroll regions. Changing page resets the list position; selecting another entry
starts its details at the top.

**Options** saves rows per page (default **Fit to screen**, or 10/25/100/500),
system-table visibility, the selected table and each table's sort field/order as
personal database preferences. These use a separate settings row from Library
preferences and require no HA reload. Initially the three main tables are
visible: viewings, sessions and Library. Collections, artwork and sources are
system tables. **Show system tables** exposes the full trusted inspection
allowlist; private operational state is excluded. It does not remove write
protections.

Fit to screen measures the rendered list area and row height, recalculates on
viewport/list resize, and requests between 1 and 500 rows. The pane uses its
actual position inside HA and observes enclosing containers across shadow roots,
including layout changes without window events. It takes the smaller visible
viewport/window height and no longer caps pane height at 820 px. Reloading
remeasures the current space; only the `fit` choice is saved, never the
calculated row count. Resizing preserves the selected detail row and moves to
the page containing it; ordinary pagination still clears details. Existing fixed
page-size choices remain unchanged. Resize requests use the current snapshot
revision, so concurrent database changes can require a refresh instead of
silently selecting a different row.

| Table                                                                          | Supported editing/deletion                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `viewings`                                                                     | Correct title/times/runtime/watched time/status/notes; permanently delete closed entries and their session references                                                                |
| `sessions`                                                                     | Correct title/runtime/watched time or delete closed sessions; viewing summaries are not automatically recalculated                                                                   |
| `library`                                                                      | Correct title, known descriptive metadata JSON, purchase/detection dates, paid/retail summary prices and availability; delete versions, owned purchase history and local memberships |
| `library_collections`                                                          | Correct detection dates/availability; delete a local collection and its memberships                                                                                                  |
| `library_sources`                                                              | Correct the source detection date while keeping sync state protected; delete a source and its local versions/collections/memberships when receipts permit                            |
| `library_artwork`                                                              | Delete a managed cache entry, clear all title references, then unlink its private managed file; byte size/type/hash are protected                                                    |
| `library_memberships`                                                          | Delete a local membership; relationship keys cannot be edited                                                                                                                        |
| `settings`                                                                     | Validate/edit recognized personal/shared UI preference JSON or delete an allowed row to restore defaults                                                                             |
| Audit, request, dataset metadata, calendar and collection-write receipt tables | Inspect/search/sort only; identity, attribution and replay barriers remain protected                                                                                                 |

The private purchase table keeps each invoice once and links it to its Library
version when matched. Library price and history views are derived from it; price
edits update the invoice. A manually entered price without an invoice remains on
the Library version. Deleting a Library version or source leaves its purchase
records unlinked for reconciliation. Prices, orders, links and history never
enter standard-user responses.

Source-owned values may be replaced or recreated by later synchronization.
Deleting cached collection membership does not remove it on the device.
Confirmed/pending device-write receipts protect their source/version references;
resolve uncertain operations before changing related source data. There is no
arbitrary insert/SQL/DDL tool. New Entry creates a viewing through the existing
validated journal API.

Select at most 100 rows, choose **Delete entry**, and type **DELETE**. Deletion
is permanent in the live dataset and may remove dependent session/membership
references. Existing downloads, migration backups, HA backups and Recorder data
remain separate. Retry receipts remain content-free barriers; viewing deletion
redacts cached viewing response content and removes its old manual-audit links,
with a new database operation audit retaining actor/count/field metadata.

## Concurrent recording and sync

Recording and Library sync can stay enabled for these targeted operations.
Writes run in one worker transaction and require both the inspected content
revision and each selected row's snapshot token. Any intervening content change
returns a conflict before applying changes; refresh and review again. Open
playback sessions and their viewings cannot be edited/deleted. Backup and
import/export barriers also apply. Library edits retain reserved journal space.
This prevents overwriting an unreviewed change; it does not stop future source
sync from restoring authoritative metadata. General bulk imports and the legacy
purge API still require recording disabled. Purchase-only reconciliation can run
while recording is enabled; the server rejects files containing Library or
viewing records in that mode. A recording change can invalidate a review, which
must then be reopened.

Every new database operation records a schema-12 `database_audit` row with
actor, request UUID, operation/table, changed field names, count, revision and
time, without copies of row content/IDs. Exact request retries bind actor and
payload, including after a possible commit or during backup. An uncertain result
locks its payload for explicit retry; dismissal/navigation cannot discard it
implicitly. Already accepted writes may commit after disconnect/access loss;
private results are withheld if access changes across awaited work.

Schema 12 also adds a monotonic settings revision: deleting a UI row cannot make
raw settings pages accidentally look current. Ordinary UI changes still do not
alter journal/catalog revisions or invalidate a reviewed content import.

## Search conditions and completion

Plain text searches literal substrings across the selected table's fields. For
predicates, use a field/operator condition, optionally beginning with WHERE:

```sql
purchased_on IS NULL
artwork_key IS NULL
actors CONTAINS 'partial name'
directors CONTAINS 'director' AND year >= 2000
title LIKE 'Star%' AND purchased_on IS NOT NULL
NOT (rating = 'R') AND (year >= 2000 OR year IS NULL)
```

Library metadata aliases include `actors`, `directors`, `writers`, `studios`,
`genres`, `formats`, `year`, `rating`, `edition`, `synopsis` and
`duration_seconds`; `data.actors` and similar names also work. All actual
columns, including immutable IDs, can be queried. Query access does not grant
edit access.

The field/operator balloon uses the selected table's returned schema. Type a
prefix, use arrows and Tab to accept a suggestion, and Enter to search. Pausing
while typing validates syntax and displays position-based guidance without
executing a search. Text values use single quotes; escape a quote by doubling
it. NULL uses `IS NULL` or `IS NOT NULL`, not `= NULL`. Supported operators are
`=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `LIKE`, `NOT LIKE`, `CONTAINS`, plus
AND/OR/NOT and parentheses. LIKE accepts SQL `%`/`_` patterns and `*` as `%`.
CONTAINS matches literal partial text, including individual JSON array strings,
using Unicode case folding. SQLite's ordinary comparison/LIKE case rules apply
to the other operators.

This is a small predicate language, not executable SQL. Field names resolve only
to trusted schema expressions; values become bound parameters. Functions,
subqueries, arbitrary JSON paths, comments, semicolons and statements are not
accepted in predicate syntax. Inputs are bounded to 2000 characters, 128 tokens,
eight nesting levels and a two-second inspection execution budget. Results keep
the 8 MiB response limit and revision-bound pagination.

## Transfers and review

Merge Import and Export retain their existing authenticated review/download
contracts; see [imports](design-data-management.md#reviewed-merge-imports).
SQLite exports/backups contain private preferences, source identities, audit
actors and retry state. JSON format 5 contains portable viewing/Library metadata
and private purchase history; it excludes UI/audit operational rows. Purchase
JSON arrays can be uploaded directly for reviewed import. Enable **Show system
tables** to inspect Library purchases; prices are editable, while invoice
identity fields and Library associations are protected. See the
[purchase import rules](design-data-management.md#import-purchase-history-json).

Run `bash dev/dev.sh preview` and open
`http://127.0.0.1:5173/review.html?library=1&companion_page=database` for
fictional layout/interaction review. Verify raw-first selection, edit
confirmation, NULL controls, system-table visibility, sticky options, query
completion, and guarded modal dismissal. The fixture is in-memory and does not
execute the real parser; automated repository/API tests use real temporary
SQLite for validation. Review real query results, persistent reloads and
conflict behavior on isolated HA.

## Detail navigation and form behavior

Library sources, Library collections and Library artwork are system tables:
enable **Options → Show system tables** to inspect them. Search and sort/order
sit together above the entries, with Options at the toolbar's far right. Choices
remain personal database preferences.

Raw detail panes show cached cover previews for Library/artwork using the
existing authenticated Library artwork endpoint. Library must be enabled and the
artwork still referenced by the configured source; unavailable or evicted
artwork shows a placeholder. There is no direct device/image fetch from this
view. Related-row buttons follow approved foreign keys (including composite
collection keys) and known local references, switch table, apply an exact
condition and select the matching row. Missing targets are reported, not
recreated.

Typing into an editable NULL field clears its NULL selection. Checking NULL
explicitly clears the stored value on save. IDs and other integrity protections
still apply. Edit/delete dialogs use a common action footer with adjacent Cancel
and Save/Delete buttons and space for focus outlines.

Provider enrichment is a protected JSON column on **Library** (schema 19). It is
readable here but not manually editable/importable. The Library detail view
augments source credits from that cache; raw Database fields continue to show
their stored values. See [enrichment](design-metadata.md).

## Library sort titles

`library.sort_title` is a nullable display-order override, separate from raw
scan identity. It is administrator-editable and included in portable Library
exports and fill-missing merge imports. Manual display facts remain in the
protected enrichment JSON. See
[Library editing](design-library.md#movie-details-and-administrator-editing).
Profile preferences reuse `settings`, with fixed format suffixes and one
actor-owned `library_random` row; no device identifiers or new preference table
are introduced.

## Reviewed merge imports

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

### Matching and merge rules

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

Legacy schema-7/8 purchase-date records remain readable by the import validator
and are joined to exact version IDs. Review proposed missing-date fills;
existing live dates are preserved and conflicts stay visible. Source files are
never modified. Use the
[offline preparation workflow](#purchase-history-preparation) when starting from
saved purchase HTML.

### Import a purchase email from an automation

To set up the optional IMAP receipt automation, open **Companion Settings → Home
Assistant → Optional automations**, choose **Purchase receipt email**, then open
**Home Assistant Blueprints**, select the installed blueprint, choose an IMAP
integration, and save an automation. The optional sender text filter helps
narrow matching mail; it does not authenticate the sender. An invalid receipt or
an unresolved import produces a generic notification. Open **Database →
Reconcile purchases** to link saved purchases to scanned Library entries. The
parser expects a text receipt with an `Item Quality Price` section and
reconciled dollar amounts; other layouts must be reviewed or adapted. The IMAP
integration must be configured separately. Missing blueprints are installed at
startup when HA automations are available; no automation is enabled for you.
Each blueprint description has a version number. Settings shows whether each
file is current, outdated, modified, missing or unavailable. Known outdated
versions produce a startup warning and a persistent HA notification. Review and
explicitly update existing files in Settings; HA reloads automations that use
them and sends an update notification. Customized files are never replaced
automatically. The Settings About tab compares installed and bundled blueprint
versions and displays release notes.

The `kaleidescape_companion.import_purchase_email` action accepts the parsed
email object, or its JSON string, in `invoice`. Configure the integration and
optionally sync the Library first. For example, if an earlier automation step
provides a `parsed_purchase_email` variable:

```yaml
- action: kaleidescape_companion.import_purchase_email
  data:
    invoice: "{{ parsed_purchase_email }}"
  response_variable: purchase_import
- if: "{{ purchase_import.status == 'needs_review' }}"
  then:
    # Open Database → Reconcile purchases for unmatched saved purchases.
    - stop: "Purchase email needs manual review"
```

The object has `source: kaleidescape`, the order ID and purchase date, and a
`purchases` array with title, date, order ID, paid and retail currency strings,
store link, and optional `included_titles` containing movie titles and links.
The item date and order may be omitted when supplied at the top level; if both
are present they must agree. A `prices_reconciled: false` email is rejected.
Inputs are limited to 1 MiB and 1,000 movies. Totals and taxes from the email
are not stored separately.

A set is expanded to its included movies. Its paid and retail prices are
**estimates** split evenly in cents among those movies, with any remaining cents
assigned in stable identity order. They add up exactly to the set price; the
individual allocations are not actual itemized charges. Matching uses the same
Library title/group rules as the manual importer. This automated action accepts
a unique proposal without human review, so a uniquely named but incorrectly
identified title can still be matched incorrectly. Check the results and use
manual import when that risk is unacceptable.

The response status is `imported`, `unchanged`, or `needs_review`, with counts.
Unambiguous matches and unmatched purchases are saved together; unmatched rows
remain unlinked until an administrator reviews them. Replaying a receipt does
not duplicate an invoice. Existing populated values are not replaced. A changed
value for an existing invoice is reported as a conflict in the action response;
it is not applied automatically. Existing blueprint installations should be
updated to version 3 so their notifications describe the database workflow.

HA automations without a user context and active administrators can call this
action; a user context must belong to an active administrator. The payload and
response include private orders and prices: protect automation traces and any
saved review records using HA's normal access and retention settings.

In **Library → movie → Edit details**, administrators can edit the purchase
date, purchase price, and retail price for the selected version. Enter prices
with a currency symbol and two decimal places, such as `$9.99`. The **Purchase
information unavailable** checkbox applies to the whole movie and removes it
from the missing-purchase-information sensor and filter until unchecked. It does
not change its stored purchase fields or add a warning badge. Manual prices can
be saved before an invoice is available; when an email later conflicts with
them, the automation returns the email for review.

When a Kaleidescape store metadata refresh finds the same valid public base
price across its purchase packages, it fills a missing retail price on the
selected Library version. Existing retail prices and all purchase prices remain
untouched. Differing or unsupported package prices are skipped. A retail price
can exist before an invoice; later invoice imports preserve it when the invoice
does not include a retail price. The price is current store metadata, not proof
of the historical price at purchase.

### Import purchase-history JSON

Receipt imports store each invoice once in the private `purchase_records` table,
with a nullable Library link. Schema 25 moves embedded invoice histories to that
table and retains an upgrade backup. Library summaries and purchase history
views are derived from these records. Manually entered prices without an invoice
remain on the Library entry until an invoice is linked.

Open **Database → Reconcile purchases** to review unlinked database records and
choose a scanned Library entry. No receipt JSON is required, and automatic
tracking may remain on. A new Library scan makes entries available for manual
matching. JSON exports contain linked invoices in the compatible Library export
and unlinked purchases separately; SQLite backups retain the purchase table.
General merge imports still require an explicit Library match for each purchase.

The optional offline helper's `purchases.json` can also be reviewed using
**Database → Merge Import**.

The helper also exports a separate release `year` inferred from `href`, or
`null` when unknown. The importer derives the same year from the link; the
additional field does not change invoice identity or the stored invoice fields.

Portable Library JSON presents `purchase_history` and flat summary values for
compatibility. They are views of the earliest and other linked invoice records,
not separate editable database copies. Repeat orders are retained; a movie-group
purchase belongs to one representative version. Compatible flat exports remain
accepted and supplied summary values must agree with embedded history.

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

An upgrade from schema 15 moves legacy unlinked invoices into the purchase table
without a Library link. Use the database reconciliation dialog to link them.
Upgrade backups retain the original data.

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

### Formats, limits and APIs

Limits are 32 MiB per file, 10,000 combined viewing/title/purchase records, an 8
MiB review response, and a 30-second upload/validation/review budget. Oversized
reviews must be split into smaller files. Older viewing JSON arrays and objects
with `viewings` remain supported. JSON format 5 includes portable `library`
entries with embedded purchase history. Legacy `library_titles`, schema-15
`library_purchases`, and schema-7/8 purchase-date tables remain readable.
Recognized keys are validated regardless of schema/version; unknown keys are
ignored. UI settings, actor preferences and operational recent-batch markers are
never merged from exports. SQLite snapshots still contain these private rows;
see
[UI preference storage](design-user-interface.md#personal-and-shared-preferences).
Every viewing needs `id`, `title`, and an ISO `started_at` with timezone. Titles
need exact ID/source/handle/group/title keys. Purchase records need title/date;
optional prices must be nonnegative currency strings with two decimal places,
and order IDs/links are bounded validated text. Each entry supports up to 1000
invoices and 2 MiB of embedded history. Scan the source before importing
purchase history; new metadata rows imported in the same review do not qualify
as scanned targets. SQLite imports read only known columns from regular
allowlisted tables in a defensive, query-only in-memory connection; SQL text,
views, virtual tables, functions and attachments are rejected. No source schema
or code is installed.

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

Use the
[offline restore procedure](design-journal.md#exports-backups-and-restore) for a
complete trusted recovery, including sessions and retry/audit state. Automated
tests use fictional data. Review the compact dialog in your own browser before
production use.

### Shared title matching for import adapters

`library/title_matching.py` exposes `TitleQuery`, `TitleMatcher` and
`TitleMatch`. The engine accepts title/year/alternate-title evidence and
optional source scope, without invoice fields or file-format assumptions. Format
adapters supply that evidence and own identity validation, review and writes.
The purchase adapter is in `library/purchases.py`; other import tools can reuse
the same engine.

The development evaluator accepts existing JSON/SQLite exports or a title-only
manifest. It suggests candidates without writing or changing the live import
rules. Viewing imports still match UUIDs and Library metadata imports still use
exact version IDs. See [reusable title matching](design-title-matching.md) for
the API, manifest format and commands.

## Purchase history preparation

Purchase-history HTML processing is an offline development tool. The integration
has no HTML upload, Library purchase-import button, or purchase-specific API.
The scripts remain in `dev/`; they are excluded from the runtime package. The
helper can extract saved purchases as JSON or prepare a corrected SQLite copy.
Both use the general
[reviewed merge import](design-data-management.md#reviewed-merge-imports),
without replacing the live database.

### Extract purchase records as JSON

From the repository root, with development dependencies installed:

```sh
.venv/bin/python dev/import_purchase_dates.py \
  --format json \
  --history purchases.html \
  --output purchases.json
```

The output is a JSON array with one record per completed owned-title line item.
Repeated purchases or editions with the same name remain separate records;
invoice order and title order are preserved. Each record has these keys:

| Key              | Value                                                |
| ---------------- | ---------------------------------------------------- |
| `title`          | Rendered title name                                  |
| `year`           | Release year inferred from the store link, or `null` |
| `purchased_on`   | Invoice date as `YYYY-MM-DD`                         |
| `purchase_price` | Paid price or allocated bundle share, or `null`      |
| `retail_price`   | Captured original price, or `null`                   |
| `order_id`       | Displayed customer order number, or `null`           |
| `href`           | Captured movie-store link, or `null`                 |

`year` is an integer when the movie-store URL contains a recognized release
year. It is independent of the invoice date; missing or unrecognized release
years remain `null`. The helper reuses the importer's passive store-link parser
and never fetches the linked page.

Prices retain currency text, such as `"$19.99"`. Bundle charges are divided
evenly among the invoice's explicitly included movies. For multiple bundles on
one invoice, the saved page exposes no movie-to-bundle mapping, so their
combined total is divided across all included movies. These prices are allocated
shares, not individual store charges. Integer-cent arithmetic preserves the
exact total; any leftover cents go to the first included movies in source order.
Individual retail prices remain unchanged. Missing, unsupported or
mixed-currency bundle charges leave the allocation unknown (`null`). The helper
does not infer currencies or treat credits as individual paid prices. Original
prices are retained even when hidden by the page's discount display. Links
retain their captured relative or HTTP(S) form without resolving or fetching
them. Missing, generic store-root and unsupported links become `null`. Pending
orders, cancelled rows, rentals and bundle headings are excluded; individual
titles within bundles are retained.

JSON mode needs no database and changes neither the saved HTML nor any database.
It refuses existing outputs and creates the file with owner-only permissions,
without changing an existing output directory's permissions. Root
`purchases.json` is ignored by Git; keep outputs elsewhere private too. Import
this array directly with **Database → Merge Import**, review the proposed
Library matches, then explicitly select the purchases to apply. Schema 16 stores
the invoice fields and repeat orders in the matched Library entry's private
`purchase_history`, with flat summary columns for its earliest invoice. The
exported `year` is a matching hint derived from `href`, rather than an
additional invoice field stored in `purchase_history`. Ambiguous or unmatched
names require a known-title choice before import; they cannot be stored as
disconnected purchases. See the
[purchase import rules](design-data-management.md#import-purchase-history-json).

### Import an existing corrected copy

Open **Database → Import**, select the private SQLite copy and choose **Review
import**. Approve the proposed missing purchase-date changes using the normal
review workflow. The reader supports older separate purchase-date tables as well
as current embedded purchase history; it never modifies the source file. Current
storage is the `library` table, and ordinary catalog sync preserves purchase
data.

**Added on** uses the calendar purchase date when present, otherwise first
detection; grouped titles use their earliest known purchase date. Version
details show purchase date and detection separately. Purchase dates are not
download/viewing times. Importing them does not rewrite detection or journal
facts. Schema 16 additionally derives dates from embedded purchase history where
an explicit version date is missing. JSON format 5, SQLite exports and HA
backups include the dates and private purchase records.

### Prepare another corrected SQLite copy

SQLite remains the helper's default output mode. To correct dates from another
saved history, create a new private copy and a private match report:

```sh
.venv/bin/python dev/import_purchase_dates.py \
  --database /path/to/copied-journal.sqlite \
  --history /path/to/saved-purchases.html \
  --output /path/to/new-corrected.sqlite
```

The input database opens read-only. Existing outputs are refused; only the new
copy is migrated. `dev/purchase_history.py` parses bounded UTF-8 HTML (8 MiB),
ignores pending/cancelled/rental rows, and uses the earliest completed invoice
date per exact case-insensitive title. It fetches and executes nothing. The
helper applies unambiguous single-source-group matches only, leaving ambiguous
or unmatched names in its report for manual investigation. Name matching is a
preparation heuristic, not proof of edition ownership; the live merge uses exact
version identities from the resulting copy.

Keep HTML, JSON, reports and SQLite files private and out of Git/static roots.
Do not replace a running HA database with an older corrected copy. The normal
test suite uses fictional invoices to check extracted fields, repeat purchases,
exclusions, ambiguity, private output creation and input preservation; merge
tests separately cover legacy dates, identity validation, conflicting values,
revisions, retries and access changes.

### Measure matching against a current export

Use the read-only evaluator with a schema-16-or-newer SQLite export and purchase
JSON. It reports aggregate exact-title and normalized title/store-year coverage:

```sh
.venv/bin/python dev/benchmark_title_matching.py \
  --database /path/to/private-export.sqlite \
  --input .ha-dev/purchases.json \
  --report .ha-dev/new-purchase-match-review.json
```

The optional report includes title/year proposals and unresolved rows first,
with no prices, order IDs or raw links. It is private household data, created
`0600`, and existing outputs are refused. Existing invoice links are ignored
when measuring fresh matching. Inputs open read-only and their hashes are
checked for changes; no import, migration, HA process, device or remote request
is started. Proposal coverage is not independently verified accuracy. Review
unresolved rows and the proposed matches through **Database → Merge Import**
before applying them.

The evaluator and matching engine are shared infrastructure. Purchase inputs use
an adapter to extract title/year hints from the store link. Library/Journal
exports and title-only manifests use the same matcher; see
[reusable title matching](design-title-matching.md).

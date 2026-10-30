# Administrator database tools

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

**Options** saves rows per page (10/25/100/500), system-table visibility, the
selected table and each table's sort field/order as personal database
preferences. These use a separate settings row from Library preferences and
require no HA reload. Initially the three main tables are visible: viewings,
sessions and Library titles. Collections, artwork and sources are system tables.
**Show system tables** exposes all eighteen tables for inspection; it does not
remove write protections.

| Table                                                                          | Supported editing/deletion                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewings`                                                                     | Correct title/times/runtime/watched time/status/notes; permanently delete closed entries and their session references                                     |
| `sessions`                                                                     | Correct title/runtime/watched time or delete closed sessions; viewing summaries are not automatically recalculated                                        |
| `library_titles`                                                               | Correct title, known descriptive metadata JSON, purchase/detection dates and availability; delete versions and local memberships                          |
| `library_collections`                                                          | Correct detection dates/availability; delete a local collection and its memberships                                                                       |
| `library_sources`                                                              | Correct the source detection date while keeping sync state protected; delete a source and its local versions/collections/memberships when receipts permit |
| `library_artwork`                                                              | Delete a managed cache entry, clear all title references, then unlink its private managed file; byte size/type/hash are protected                         |
| `library_memberships`                                                          | Delete a local membership; relationship keys cannot be edited                                                                                             |
| `settings`                                                                     | Validate/edit recognized Library/shared/Database preference JSON or delete a row to restore defaults                                                      |
| Audit, request, dataset metadata, calendar and collection-write receipt tables | Inspect/search/sort only; identity, attribution and replay barriers remain protected                                                                      |

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
sync from restoring authoritative metadata. Bulk imports and the legacy purge
API still require recording disabled.

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
contracts; see [imports](imports.md). SQLite exports/backups contain private
preferences, source identities, audit actors and retry state. JSON format 3
remains portable viewing/Library metadata and excludes UI/audit operational
rows.

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

Raw detail panes show cached cover previews for Library titles/artwork using the
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

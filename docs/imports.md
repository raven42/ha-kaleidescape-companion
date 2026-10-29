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
3. Eligible new/merge rows start checked. Change individual checkboxes, choose
   **Select none**, or **Select all changes** across all review pages. Search
   does not change the selection.
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

## Formats, limits and APIs

Limits are 32 MiB per file, 10,000 combined viewing/title records, an 8 MiB
review response, and a 30-second upload/validation/review budget. Oversized
reviews must be split into smaller files. Older viewing JSON arrays and objects
with `viewings` remain supported. JSON format 3 additionally includes portable
`library_titles`. Recognized keys are validated regardless of schema/version;
unknown keys are ignored. Every viewing needs `id`, `title`, and an ISO
`started_at` with timezone. Titles need exact ID/source/handle/group/title keys.
SQLite imports read only known columns from regular allowlisted tables in a
defensive, query-only in-memory connection; SQL text, views, virtual tables,
functions and attachments are rejected. No source schema or code is installed.

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

Use the [offline restore procedure](backend.md#downloads-and-offline-restore)
for a complete trusted recovery, including sessions and retry/audit state.
Automated tests use fictional data. Review the compact dialog in your own
browser before production use.

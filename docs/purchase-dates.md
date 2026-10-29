# Purchase dates

Purchase-history HTML processing was a one-time offline preparation step. The
integration no longer exposes an HTML upload, Library purchase-import button, or
purchase-specific API. The scripts remain in `dev/`; they are excluded from the
runtime package. A corrected SQLite copy can be imported through the general
[reviewed merge import](imports.md), without replacing the live database.

## Import an existing corrected copy

Keep `corrected.sqlite` in its current private location. Open **Database → Merge
Import**, select that file and choose **Review import**. Approve the
title-version rows showing missing `purchased_on` values. Use search, per-row
checkboxes and **Select all changes** as appropriate. Populated live dates are
preserved and conflicts shown. Older separate purchase-date tables are supported
by the reader. The file is read into memory; it is never migrated, overwritten
or removed.

Schema **9** stores `purchased_on` and `purchase_imported_at` directly on
`library_titles`. Migration copies prior dates, consolidates historical purchase
and general import audit into `import_audit`, and removes the two purchase-only
tables. Original actors, timestamps and source revisions are retained without
inventing dataset revisions for historical purchase applies. Migration keeps a
private pre-upgrade backup. Subsequent catalog syncs preserve purchase columns.

**Added on** uses the calendar purchase date when present, otherwise first
detection; grouped titles use their earliest known purchase date. Version
details show purchase date and detection separately. Purchase dates are not
download/viewing times. Importing them does not rewrite detection or journal
facts. JSON format 3, SQLite exports and HA backups include the dates.

## Retained offline helper

If another saved history must be processed later, the helper creates a new
private copy and a private match report:

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

Keep HTML, reports and SQLite files private and out of Git/static roots. Do not
replace a running HA database with an older corrected copy. The normal test
suite uses fictional invoices to check exclusions, ambiguity, private copy
creation and input preservation; merge tests separately cover legacy dates,
identity validation, conflicting values, revisions, retries and access changes.

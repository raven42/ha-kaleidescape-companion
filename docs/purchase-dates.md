# Purchase dates

Purchase-history HTML processing is an offline development tool. The integration
has no HTML upload, Library purchase-import button, or purchase-specific API.
The scripts remain in `dev/`; they are excluded from the runtime package. The
helper can extract saved purchases as JSON or prepare a corrected SQLite copy.
Both use the general [reviewed merge import](imports.md), without replacing the
live database.

## Extract purchase records as JSON

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
[purchase import rules](imports.md#import-purchase-history-json).

## Import an existing corrected copy

Keep `corrected.sqlite` in its current private location. Open **Database → Merge
Import**, select that file and choose **Review import**. Approve the
title-version rows showing missing `purchased_on` values. Use search, per-row
checkboxes and **Select all changes** as appropriate. Populated live dates are
preserved and conflicts shown. Older separate purchase-date tables are supported
by the reader. The file is read into memory; it is never migrated, overwritten
or removed.

Schema **9** stores `purchased_on` and `purchase_imported_at` directly on
`library_titles` (renamed `library` in schema 16). Migration copies prior dates,
consolidates historical purchase and general import audit into `import_audit`,
and removes the two purchase-only tables. Original actors, timestamps and source
revisions are retained without inventing dataset revisions for historical
purchase applies. Migration keeps a private pre-upgrade backup. Subsequent
catalog syncs preserve purchase columns.

**Added on** uses the calendar purchase date when present, otherwise first
detection; grouped titles use their earliest known purchase date. Version
details show purchase date and detection separately. Purchase dates are not
download/viewing times. Importing them does not rewrite detection or journal
facts. Schema 16 additionally derives dates from embedded purchase history where
an explicit version date is missing. JSON format 5, SQLite exports and HA
backups include the dates and private purchase records.

## Prepare another corrected SQLite copy

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

## Measure matching against a current export

Use the read-only evaluator with a schema-16-or-newer SQLite export and purchase
JSON. It reports aggregate exact-title and normalized title/store-year coverage:

```sh
.venv/bin/python dev/benchmark_title_matching.py \
  --database .ha-dev/kaleidescape-journal.sqlite \
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
[reusable title matching](title-matching.md).

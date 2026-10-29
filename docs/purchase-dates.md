# Purchase dates

Administrators can open **Library → Import purchase dates** and select saved,
rendered Kaleidescape purchase-history HTML. A file containing several appended
history pages is supported. Files must be UTF-8 and at most 8 MiB. Preview parses
invoice dates and title rows offline; it does not open links, fetch images,
execute scripts, contact the store/device, or retain uploaded HTML.

Pending invoices, visible rental labels, and cancelled rows are excluded. Repeated
purchase names use their earliest completed invoice date. Dates have calendar-day
precision; they are not download dates or viewing times.

Preview matches exact case-insensitive names in the configured cached source.
Store links are not assumed equivalent to local IDs. Years and formats are
shown for review. **Select unambiguous matches** selects versions only when all
matches share one source group; names matching multiple groups require manual
selection. This is a heuristic, not proof of edition ownership. Unmatched names
remain unchanged. Up to 50 candidate versions per purchase name are shown and
1000 explicit version corrections can be applied per request. Nothing is
selected on upload. Review versions before **Apply purchase dates**.

Corrections live in schema **7** in `library_purchase_dates`, surviving later
syncs. **Added on** uses imported purchase date when present, otherwise first
detection. Groups use their earliest known purchase date. Version details show
purchase date and first detection separately. Neither `first_seen`, the journal,
session evidence, nor history sensors are rewritten.

Apply requires an active administrator and enabled Library. The backend validates
opaque version IDs, source membership, dates, and source revision. UUID/actor/
payload-bound receipts protect retries. Unconfirmed applies lock the exact
payload until retried or explicitly discarded. Source changes require a fresh
preview. Content-free `library_purchase_audit` rows record actor, request, count,
revision, and time. Raw tables remain administrator-only. SQLite exports/backups
include these tables; viewing-only JSON transfers do not carry Library data.

## Offline copied database

The optional helper makes a new private copy, applies only unambiguous matches,
and writes a private JSON match report beside it:

```sh
.venv/bin/python scripts/import_purchase_dates.py \
  --database /path/to/copied-journal.sqlite \
  --history /path/to/saved-purchases.html \
  --output .ha-dev/purchase-corrections/corrected.sqlite
```

The input database is opened read-only and never replaced. The helper requires
one Library source, refuses an existing output, upgrades only the new copy, and
uses owner-only storage. The output is an inspection snapshot. Use the deployed
Library import UI to apply dates to the current dataset instead of replacing a
running HA journal with an older snapshot. The report contains private titles
and IDs. Keep it and the HTML out of Git and public web roots.
`docs/purchases.html` and SQLite files are ignored. Real purchase history must
never enter fixtures, logs, documentation, or the runtime package.

## Review

Automated checks use fictional invoices and isolated databases to test parsing,
matching, rollback, scope/revisions, retries, role changes, upload limits, and
input preservation. The Vite fixture simulates a fictional purchase preview;
it does not parse purchase files or upload to HA. Browser review remains with
the operator. On isolated HA, verify a real preview before applying corrections.

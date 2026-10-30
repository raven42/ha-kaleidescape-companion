# Reusable title matching

`library/title_matching.py` provides local Library candidate suggestions for
import adapters and development tools. It normalizes titles and checks release
years, source groups, remakes and sequel evidence. It does not parse financial
records, apply imports or contact devices.

## Matcher interface

Build one `TitleMatcher` per review on the repository worker. Supply validated,
format-independent evidence through `TitleQuery`:

```python
from .title_matching import TitleMatcher, TitleQuery

matcher = TitleMatcher(db, deadline)
result = matcher.match(
    TitleQuery("Example Film", alternate_title="Alternate Name", year=2025)
)
```

A query has `title`, optional `alternate_title` and `year`, and optional paired
`source_id`/`source_group` scope. The constructor validates text bounds, release
years and scope. `TitleMatch` returns an opaque target ID or `None`, an evidence
method, a review description and the supplied year. Conflicting evidence or
multiple candidate groups stay unresolved. `preferred_ids` can preserve a
caller's existing representative entry within a group; it grants no write
access. The matcher indexes at most 20,000 available versions within the review
deadline.

Adapters own source-format validation, identities, record fields, permissions,
review and atomic writes. The purchase adapter in `library/purchases.py`
converts its passive store link into title/year evidence and retains invoice
identity and ownership. Future adapters can supply other metadata through the
same contract. Viewing imports retain exact UUIDs; Library metadata imports
retain exact source/version IDs. A title suggestion does not replace these
integrity rules.

## Read-only comparison tool

With development dependencies installed, compare a JSON or SQLite input against
an exported reference database:

```sh
.venv/bin/python dev/benchmark_title_matching.py \
  --database .ha-dev/kaleidescape-journal.sqlite \
  --input .ha-dev/purchases.json \
  --report .ha-dev/new-title-match-review.json
```

`--input` accepts the [supported Companion exports](imports.md), purchase
arrays, or an explicit title-only manifest. JSON is the default; `.sqlite`,
`.sqlite3` and `.db` select SQLite. `--format json|sqlite` overrides suffix
detection. Mixed Companion exports report each record's type separately. Journal
exports provide title evidence; Library exports also supply known years and
source scope. Purchase arrays use their format adapter. Existing associations
are ignored when measuring fresh suggestion coverage.

A title-only JSON manifest is useful for another importer without constructing
invoice or viewing records:

```json
{
  "titles": [
    { "title": "Example Film", "year": 2025 },
    { "title": "Another Film", "alternate_title": "Alternate Catalog Name" }
  ]
}
```

Manifest rows allow only the five `TitleQuery` fields. Inputs retain the 32 MiB
and 10,000-record limits. Coverage counts proposals, not verified accuracy.

The reference database opens read-only; the tool starts no HA process, import,
migration or device request. Both input hashes are checked for changes. Standard
output contains aggregate counts only. Optional reports contain private title
evidence/results with unresolved rows first, omit notes/prices/orders/raw URLs,
use `0600`, and refuse existing paths. Keep reports outside Git/static roots.

# Home Assistant actions and automations

Reviewed 2026-11-04. Companion exposes HA actions, three configuration switches,
three buttons and four optional automation blueprints. HA owns automation
execution and traces; Companion owns validation, background jobs and
persistence. The [data-management design](design-data-management.md) owns
purchase storage, matching and reconciliation; this document owns the automation
workflow.

## Install, inspect and update blueprints

When HA's automation blueprint manager is available, Companion installs missing
files under `blueprints/automation/kaleidescape_companion/`. Setup preserves
existing files. It does not create or enable an automation. Create an automation
from the desired blueprint in HA and choose its inputs explicitly.

**Settings → Home Assistant → Optional automations** provides installation,
status refresh and reviewed updates. **Settings → About → Automation blueprint
versions** compares the installed version with the version bundled in the loaded
Companion build. “Latest” means that bundled version; no remote release lookup
runs. **View history** opens the bundled blueprint's comment history, not a
history of the operator's edits.

| Blueprint                    | Bundled version | Inputs and behavior                                                                          |
| ---------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `purchase_email_parser.yaml` | 6               | Selected IMAP entry and optional sender filter; validates and imports receipt events         |
| `library_schedule.yaml`      | 1               | Daily local time, default 03:00; requests Library sync                                       |
| `metadata_schedule.yaml`     | 1               | Daily local time, default 04:00; selected enabled providers and Only missing, default true   |
| `calendar_schedule.yaml`     | 1               | Daily local time, default 03:00; requests Full Sync, waits 11 minutes, requests another pass |

All schedules use HA's local time and single-run mode. The receipt automation
uses queued mode, at most ten runs. Empty metadata provider selection means all
enabled providers. Scheduling does not enable a disabled feature or bypass its
prerequisites. Calendar Full Sync still needs the configured dedicated calendar,
explicit Full Sync enablement, quarantine/reconciliation and deletion guards.
The delayed second request gives a later pass a chance to recheck pending work;
it is not a guarantee that an earlier job finished or that deletion will occur.

Status uses a normalized YAML fingerprint, ignoring formatting and comments.
Declared version labels alone are not update evidence:

- **Current**: fingerprint matches the bundled template.
- **Outdated**: fingerprint matches a known previously shipped template.
- **Modified or unrecognized**: valid contents differ from both sets, including
  an unrecognized newer/local file. The displayed version is self-reported.
- **Missing**: no installed file.
- **Unavailable**: HA's manager or the bounded file read/parse is unavailable.

Known outdated templates produce a startup warning and HA persistent
notification. **Review update** warns about replacing local edits and reloading
dependent automations. Explicit acceptance checks the installed revision and
administrator access again before HA writes. A successful write triggers an
update notification; an uncertain write/reload tells the operator to inspect the
installed file and automation state before retrying. Uploading a new integration
package does not replace an existing HA blueprint automatically.

Developers must increment the visible version, add a concise entry between
`# Version history:` and `# End version history` in the YAML, retain the
previous fingerprint in `KNOWN_OLDER`, and update `CURRENT` and `LATEST_VERSION`
in `ui/automation_templates.py`. Keep histories factual and free of household
data. Fingerprint/history tests detect inconsistent bundled revisions.
Comment-only changes do not alter the normalized fingerprint.

## Actions and entity controls

Actions use the `kaleidescape_companion` domain:

| Action                  | Data                                                                          | Result                                                                 |
| ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `library_sync`          | None                                                                          | Requests the enabled Library job                                       |
| `calendar_full_sync`    | None                                                                          | Requests the configured Full Sync job                                  |
| `refresh_metadata`      | Optional `providers` list and `only_missing` boolean (action default false)   | Requests enrichment for enabled providers; empty list uses all enabled |
| `import_purchase_email` | `invoice` object or JSON string; optional compatibility field `allow_partial` | Imports validated purchase records; supports an HA response variable   |

Calls with a user context require an active administrator. Trusted HA automation
calls without a user context are supported. Sync acceptance means the job was
requested, not that it completed. Review the owning feature's UI status and
[logs](design-logging.md) for outcomes.

The buttons **Library sync**, **Refresh metadata**, and **Calendar full sync**
request the same jobs. The switches **Add watched movies to calendar**,
**Automatically record playback**, and **Enable library sync** validate and save
the corresponding options and reload the integration. HA entity-control
permissions govern these entities. For prerequisites and lifecycle see
[architecture](design-architecture.md#home-assistant-controls).

## Receipt parsing and HTML recovery

The receipt blueprint listens for `imap_content` on the selected IMAP entry and
a subject containing “Kaleidescape Store Receipt”. The optional sender substring
filter is a routing filter, not sender authentication. `imap.fetch` retrieves
the complete message; the event's text preview may be truncated.

Blueprint version 7 passes the fetched message text and the available HTML part
to the Python importer. It attempts both representations, extracts bounded item
evidence and imports independently valid items. Incomplete values and
subtotal/total discrepancies are returned as review issues rather than rejecting
the entire receipt. A missing date remains unknown; forwarded messages do not
use the forward date as the purchase date. Parsing does not authenticate the
sender or guarantee a match to the correct Library edition.

The blueprint offers `transaction-id`, `purchase-price`, `retail-price` and
`purchase-date`; at least one must be selected. Title and a Store link are
always extracted when available. Unselected fields are not stored. Missing
selected fields and unidentified items are reported for review. With fewer
identity fields, distinct purchases can be harder to distinguish; check
duplicates before accepting a separate purchase.

The importer reads movie and set rows from the decoded HTML tables, including
forwarded HTML and included movies in set rows. A crossed-out price is the
retail price and an unmarked price is the purchase price. A missing retail price
stays empty and is reported when selected; multiple unmarked prices are reported
as ambiguous. If HTML is unavailable or incomplete, the importer uses
identifiable text rows as a fallback and flags text-only items. For a single
price in plain text, it records the purchase price only when that amount
reconciles exactly with the subtotal and all other known item prices.

The automation attempts `imap.fetch_part` whenever HA lists an HTML part. If
that fetch fails, it still passes the text to the importer and reports the
missing HTML. HA's IMAP actions and automation traces may contain the full
email.

Store numeric IDs and local Library content handles are different identities.
Preserving a Store ID improves retained evidence but does not, by itself, make
it a directly comparable Library key. The current matcher does not directly join
numeric Store detail IDs to local handles. See
[title matching](design-title-matching.md) for actual matching precedence and
limitations; do not invent a Library ID from an email link.

## Saved purchases and review

Schema 25 moves embedded invoice history into `purchase_records`. Valid
unmatched purchases are retained with no Library reference, including receipts
received before a scan. Known nonconflicting matches can be linked in the same
import. Existing populated invoice values are preserved when a replay conflicts.
The action response distinguishes saved results from issues; retain that
distinction when customizing notifications. A `needs_review` response does not
mean nothing was saved. Legacy `allow_partial` does not restore the former
all-or-nothing matching workflow.

Open **Database → Reconcile purchases** to review saved unlinked purchases,
choose available Library entries (with cached cover art where available), and
apply selected changes. Playback tracking can remain enabled for purchase-only
reconciliation. This workflow reads the database; it does not require JSON from
the email trace. Linked price conflicts use the Library purchase editor rather
than the unlinked-purchase picker. Detailed mutation/conflict rules and current
editing limits are in [data management](design-data-management.md).

## Troubleshooting and retry

1. Check **About** for the installed receipt blueprint version, then review any
   update under **Home Assistant → Optional automations**. A new Companion build
   alone does not update an installed older blueprint.
2. Inspect the failed automation trace. Failure before the import action means
   no purchase import was attempted by that run. Check the IMAP fetch and field
   selection, then review the action response and receipt diagnostics. Failure
   after import needs inspection of the response and saved records; do not
   assume a later notification failure rolled back purchases.
3. If the response needs review, inspect its bounded reasons and the saved
   purchases. Unlinked purchases can be reconciled after Library sync. A
   conflicting value needs deliberate review, not blind replacement.
4. To retry the same mailbox message, an administrator can fire `imap_content`
   in HA Developer Tools → Events with that trace's `entry_id`, `uid`, `subject`
   and `sender`. The blueprint fetches the body itself. Keep the message in the
   same configured mailbox so the UID still identifies it. **Run actions** alone
   lacks the trigger fields this blueprint needs. Toggling read/unread is not a
   reliable substitute for replaying the event.

Replay identity depends on the normalized receipt fields. Unchanged records are
deduplicated; editing/forwarding a message can change available dates or links,
so first inspect saved purchase state when diagnosing a retry. Do not promise
universal deduplication across arbitrary rewrites of an email.

HA automation traces can contain the full private email, HTML part and invoice
response. Share only necessary redacted reason values and parsing results.
Receipt import warnings start with saved, updated, unchanged and pending counts,
followed by issue details, the full bounded email and parsed results; successful
receipt input is logged at debug. Protect HA logs accordingly. Source tests use
fictional receipts, never copied household traces; see the
[security policy](../policies/policy-security.md).

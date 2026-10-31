# Add to Collection

Administrators can enable **Settings → Allow Add to Collection on the device**.
It is off by default and also requires enabled Library and collection sync. Open
a Library title, select its individual version tab, and choose **Collection**.
The dialog reads the server's offered targets. Choose one existing collection
and **Add selected version**. Viewing history and purchase dates are not
changed. Removal, collection creation/renaming/deletion, and bulk/group edits
remain outside this implementation. The operator is investigating removal.

## Protocol capability

The
[official control protocol, revision 17](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
was rechecked on 2026-10-31. `GO_MOVIE_COLLECTION` and `GO_MOVIE_COLLECTIONS`
select onscreen views; they do not change membership. The command catalog has no
movie collection membership add/remove command. The standalone TCP API therefore
cannot replace the verified HTTP add path. Removal still needs an observed,
verified web request contract and its own guarded mutation/recovery path; no
guessed command or removal request is sent.

## Observed form and compatibility

Read-only inspection on 2026-10-28 of the `26.1.2-27147` interface found the
fixed `main` Movies form: POST, multipart/form-data, current `/movies` action.
The button uses `submit_parent_form_once( event, 'Add-To-Collection' );`.
Submitted fields are `submit_type=Add-To-Collection`,
`add_to_collection_select`, and one `check-<source handle>=on`. Dropdown
JavaScript copies each option's hidden input value into the selector field.
Labels and wire values can differ; the backend resolves the fresh hidden value
instead of guessing from the displayed name. No source JavaScript is executed or
packaged.

The form is a firmware-dependent interface, not a documented stable API. No real
POST was sent during implementation. Successful real-device behavior, charset
handling, and version/group semantics still require operator validation. Normal
checks use fictional pages, mock transport and isolated databases only.

## Access and request scope

The existing authenticated HA WebSocket API exposes administrator-only commands:

- `library/collections/targets`: opaque `title_id` and source `revision`;
  returns offered, cached, visible collection labels after a bounded fresh form
  read.
- `library/collections/add`: request UUID, opaque `title_id`, one collection
  label, and expected source `revision`. Each request selects one exact source
  handle.
- `library/collections/check`: request UUID; performs read-only reconciliation.
- `library/collections/acknowledge`: request UUID and
  `confirmation=ACKNOWLEDGE`; retires an uncertain request locally without
  sending any device mutation.

All use the current entry/dataset scope. The backend resolves raw handles, form
fields, collection values and fixed routes. Hidden targets and protected labels
All/New/Played/Paused/Scenes/Trash/Deleted are rejected. Targets must be in both
the current cached collections and the source's add dropdown. No supplied URL,
path, method, arbitrary form, SQL, or action is forwarded. The opt-in, current
administrator, source/runtime identity, settings fingerprint and readiness are
checked before work and immediately before a possible POST, and access is
checked again before a result is returned. Checks/acknowledgments remain
available with collection additions switched off, as long as Library is still
enabled.

## Execution and durable outcomes

Scans and explicit collection operations share one source lock. An active scan
or collection operation returns Busy to new operations. A fresh Movies form must
still match the cached selected handle/group/title and expose its checkbox. A
complete target-collection GET establishes the expected membership set. A source
revision mismatch rejects the operation before POST.

Schema **8** adds private `library_collection_intents` alongside the shared
`requests` retry receipts. Before POST, a worker transaction records an
uncertain intent and actor/payload/source-bound UUID fingerprint. There is at
most one uncertain request per source and at most 10000 retained collection
receipts in the database. The receipt includes an expected-membership hash,
without storing a full member list. Confirmed/acknowledged intents clear their
temporary version, collection and hash fields; attribution, timestamps, outcome
and the retry barrier remain. UUID reuse with a different actor or payload
fails. SQLite snapshots and HA backups include these rows; portable JSON
transfers and journal purge do not remove them. There is no automatic receipt
pruning or replay.

Only one fixed multipart POST to the pinned configured LAN `/movies` route is
possible for a newly accepted UUID. Existing membership is a no-op, verified by
GET. TLS/Host/DNS pinning, disabled cookies/proxy environment use, size/time
limits and refused redirect following remain. POST responses accept 200 or
302/303 to exact relative `movies`/`/movies`; no redirect is followed. Responses
are bounded at 8 MiB. Operations have a 90-second budget, with existing
five-second DNS/connect and 15-second per-request limits.

After a possible POST, a complete target GET must match the expected set and
contain the selected handle before success is confirmed. Only that verified
collection snapshot updates cached memberships and source revision. Other
collections remain untouched; the global collection-snapshot timestamp is not
advanced. If the server affects additional versions or memberships, the
operation stays uncertain. The device and SQLite do not share an atomic
transaction.

Timeouts, response loss, crashes and cancellation after possible POST retain the
uncertain receipt. Repeating its UUID or choosing **Check membership** makes
GETs only and never replays the POST. New additions are blocked until it is
confirmed or an administrator explicitly acknowledges it after inspecting the
device. Acknowledgment records the acknowledging actor and permits a new
request; it neither undoes the earlier add nor proves it failed. Closed/reopened
pages and integration restarts retain pending requests in the Library warning
banner.

Accepted operations outlive browser cancellation. Backup/unload stops new work,
cancels scans and drains accepted collection work before pausing/closing SQLite.
Private previews/forms clear on role/connection changes and late replies are
ignored. In-flight or unconfirmed browser requests block implicit dialog
dismissal until checked; a known uncertain outcome can be closed and reviewed in
the banner.

## Operator validation

Build/check/package locally without deploying or mutating a device. In the Vite
fictional fixture, enable Library and the new option, select an individual
version, review the add dialog and cancellation. The fixture simulates the
operation. Real browser review remains with the operator.

On an isolated test deployment, first use a disposable existing collection and
one deliberately selected version. Verify the target, membership before/after,
unselected versions and unrelated memberships, refreshed UI/cache, and restart
reconciliation. Do not use Played/Paused or other protected collections for
tests. Successful form inspection and mocked tests do not replace this firmware
check. Removal will need its own verified contract and security review.

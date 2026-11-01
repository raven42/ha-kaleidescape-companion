# Operational logging

Operational diagnostics use catalogued subsystem, operation and outcome codes
with human-readable messages generated from a static explanation catalog.
Callers cannot supply arbitrary message text. Requests, response bodies, wire
frames, SQL, headers, URLs, filesystem paths, identities, configuration
contents, exception strings and tracebacks are never passed to this logger.
Resource identifiers use installation-keyed HMAC aliases so different devices
and records remain distinguishable without publishing their identities. Separate
target aliases distinguish backend devices and providers from the per-record or
per-request resource alias. This is pseudonymous operational data, not anonymous
telemetry. Nothing is sent to an external logging service.

New events include `file` and `line` for the logging call. Files are derived
from trusted Python package names, relative to the package root; absolute
machine paths and usernames are never captured. The viewer shows a compact
filename and line with the full relative location in its tooltip and exports.
Unknown external callers are labelled `external`. Historical events receive a
readable fallback message when queried, but source locations cannot be
reconstructed.

Failure classification inspects at most five exception causes/contexts, using
exception types and bounded numeric HTTP status codes. It never formats,
persists or forwards the exceptions, their arguments or traceback text. Known
causes explain missing fields, incompatible types, authorization, timeouts,
connections, storage and validation failures. Unclassified provider failures
explicitly say the original text was withheld. Owned calendar reason/stage codes
explain blocked writes, changed snapshots and failed read-back comparisons.
Background request acceptance is distinct from actual sync completion.

INFO is the default. Administrators can change the level live, including the
standalone protocol logger. DEBUG adds network stages and comparisons without
payloads. A failed calendar verification records which comparisons matched, then
uses bounded read-only retries. An uncertain write is never blindly replayed.

The database owns the log book on its existing single worker. A bounded memory
queue separates callbacks from SQL; logging cannot recursively log itself.
Shutdown drains accepted events and unregisters the owned sink, releasing its
repository and event-loop references while leaving other registered sinks
usable. The retained serialized event budget is 5 MiB, including hidden events.
Oldest entries are evicted at capacity. SQLite page allocation, indexes,
temporary journals and backups can exceed this payload budget. Clear hides
retained rows; it does not immediately erase them. Backups can retain older
entries.

Only administrators can query, configure, hide or export logs. Text and JSON
exports include a privacy banner. The compact viewer leads with the message and
source location, with structured diagnostics collapsed under **Details**. Text
exports use readable messages and labelled details; JSON retains the structured
fields. Live logging controls are under **Options**. Existing identity/audit and
retry tables remain private functional records; they are not copied into
operational logs. Generic journal exports exclude operational logs and the
private alias key.

The viewer's **Minimum level** filter includes the selected severity and all
higher levels: **WARNING** includes WARNING, ERROR and CRITICAL. **All** and
**DEBUG** include every retained severity. Paging and text/JSON exports use the
same filter. This only selects retained entries; it does not change the live
logging threshold or recover events that were never recorded.

The optional Log database values setting permits bounded movie metadata fields
only (title, cast, directors, writers, producers, studios, genres, rating,
formats). Suspicious values are suppressed in full by a second sensitive-pattern
check before storage. Connection information, arbitrary database fields, notes,
credentials and account values have no logging path, even with this option
enabled. This opt-in deliberately exposes movie/person metadata; regex matching
is defense in depth, not a general secret detector. Do not put credentials or
household information into movie metadata. Disable the option for content-free
exports. Changing it does not erase previously retained values.

Settings transfer is separate from log export. The administrator selects the
categories to export/import and reviews imported changes before applying them.
Credentials are never exported or accepted. Connection/entity choices and custom
templates require explicit category selection. Settings files can therefore
contain private information and are not covered by the log privacy banner.

## Coverage and future development

Every new mutation or external operation must use the structured logger. Add a
static enum if a new operation is needed; never accept caller-provided logger
names, message formats or error text. Log start/result and a resource alias for
external writes; DEBUG may record safe counts/stages. Ordinary UI reads need no
INFO record. Database changes are detected at the worker boundary, without SQL
tracing or parameter capture. Log storage/configuration operations are
explicitly excluded from that hook. Sink failures are counted, never re-logged.
Bounded queues may drop diagnostics under pressure; the Log view reports dropped
events and sink failures. Functional writes must not fail solely because the
diagnostic store is full or unavailable.

## Following an action across layers

Log context links the authenticated request, database worker and nested device
or calendar calls. `actor` is a keyed user alias, `resource` is the current
object, `related` links a related viewing/session, `trace` identifies the
originating request and `trigger` explains why work began. Revisions distinguish
successive records without publishing private field values. Click an alias under
**Details**, or paste it into **Linked resource / request**, to filter across
subsystems; exports preserve that filter.

A journal edit logs database admission, a committed viewing revision and a
calendar reconciliation notification. Full Sync consults the private mutation
audit for that exact revision, recovering the request/user relationship after a
reload. It logs prior-event lookup, content comparison, update/replacement
selection, preflight reads, provider writes, verification and saved links. Only
keyed aliases reach the logger. Idempotent requests report a stored-result
replay instead of another calendar notification. Observed playback links
sessions and viewings separately from manual edits.

Async context is scoped to each action and explicitly copied into the repository
worker. Context values contain sanitized aliases/codes, never raw identifiers.
Independent actions restore context on exit; scheduled scans and persistent
protocol receivers clear earlier request attribution. Cross-layer linkage is
best effort: imported records or unrelated provider activity can lack an
originating request. Periodic Full Sync summaries have their own trace;
per-viewing operations use the saved mutation trace when available.

Create/delete-only calendar providers report their capability limitation and
replacement strategy. Pending cleanup logs explain the two-scan, ten-minute
grace period and report its count. Full Sync can succeed while deletion remains
pending.

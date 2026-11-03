# Home Assistant logging and diagnostics plan

Status: **Draft for review; implementation has not started.**

Reviewed: 2026-11-02. This plan derives from sections 7–13 of
[the audit instructions](../audit/review.md), especially section 8, and the
current Companion source. The installed HA **2026.10.4** development dependency
was inspected for lifecycle and coordinator behavior. This is a proposed design,
not a description of logging already delivered.

## Proposed outcome

Companion should explain what it is doing, why it made important decisions, what
failed, and how it will recover through Home Assistant's normal logging
infrastructure. Use Python's standard `logging` module, readable messages, and
HA's existing controls for log levels and output.

Keep the audit's severity principles and protection of household data. Simplify
their implementation: ordinary log statements, a few shared privacy helpers
where needed, and tests at important boundaries. A message should be useful to a
person reading the HA log without decoding an event schema or consulting an
operation-code catalog.

This proposal adds no Companion log database, log viewer, log export endpoint,
custom logging levels, diagnostic-data setting, or parallel logging framework.
The existing journal audit records and durable command/calendar receipts remain
application state; operational logs do not replace them.

## Current baseline and audit reconciliation

The current baseline has three distinct parts:

- Companion's custom logging modules, log UI, and associated settings have been
  removed. Schema 23 drops `operation_logs` and `log_state` in
  [the migrations](../custom_components/kaleidescape_companion/core/migrations/__init__.py).
- [The sensors](../custom_components/kaleidescape_companion/sensor.py) still
  pass a standard module logger to HA's `DataUpdateCoordinator`.
  [Diagnostics](../custom_components/kaleidescape_companion/diagnostics.py)
  still return a limited health snapshot. These are native HA integration
  facilities.
- The recently bundled API still contains
  [`SafeLogger`](../custom_components/kaleidescape_companion/_vendor/kaleidescape_api/logging.py),
  its event schema, a bounded memory buffer, and a Python logging sink. Its
  client and transport create that logger by default. Companion's control
  adapter does not attach the sink. The absence of Companion log statements
  therefore does **not** mean every dependency is free of custom logging.

The audit remains useful as a review methodology, but these passages need a new
interpretation for this work. `audit/` remains unchanged; the table records the
proposed corrections for review.

| Audit location                                     | Assessment and proposed correction                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objective; sections 2 and 19                       | Companion is a custom integration running inside HA Core. Replace references to its own HA add-on lifecycle with integration setup, reload, unload, shutdown, and packaging.                                                                                                                                                                            |
| Sections 1–6                                       | Retain discovery, evidence-based findings, simple architecture, trust boundaries, and reliability review. Apply ingress/container concerns only where they actually exist in deployment; do not invent a separate Companion server or Supervisor app.                                                                                                   |
| Section 7 and Execution Rules                      | The instruction to preserve an existing logging infrastructure is obsolete for Companion's deleted framework. Reuse HA's infrastructure and explicitly address the residual API logger.                                                                                                                                                                 |
| Section 8: DEBUG and INFO                          | Retain functional explanations and meaningful activity/outcome messages. Coverage means reviewing workflows and decisions, not logging every function, poll, response, row, or task wake-up.                                                                                                                                                            |
| Section 8: WARNING and ERROR                       | Choose severity by actual impact. Optional metadata absent by design, user validation errors, and handled cancellation are not operational warnings/errors. HA-owned errors should not be logged again by Companion.                                                                                                                                    |
| Section 8: CRITICAL                                | Retain severe, unrecoverable loss of essential functionality as the criterion. A failed setup or unavailable device alone does not qualify. HA's own lifecycle reporting takes precedence over adding a duplicate CRITICAL message.                                                                                                                     |
| Section 9                                          | References to an existing sensitive-data flag are obsolete. Propose one privacy policy at every log level. HA registry device/entity names and the authenticated HA username are useful and permitted context; credentials and IP addresses still need protection. Other directly identifying PII, movie content, and database values remain protected. |
| Section 9: centralized enforcement                 | Share small helpers for genuinely repeated privacy-sensitive transformations. Do not recreate a typed event protocol, schema validator, sink registry, or global redaction engine. Review and test each logging boundary.                                                                                                                               |
| Section 10                                         | Retain lightweight correlation for workflows that cross tasks or components. Do not require every frontend read, database query, and library call to carry a new tracing contract.                                                                                                                                                                      |
| Sections 11–12                                     | Retain workflow coverage, truthful outcomes, noise control, and lazy formatting. HA and its installation own handlers, destinations, and retention; Companion owns how much it emits.                                                                                                                                                                   |
| Section 13; section 19; supportability deliverable | Replace tests of a sensitive-data toggle with privacy tests at all levels, including DEBUG, exception chains, framework-generated messages, and dependency logs.                                                                                                                                                                                        |
| Sections 14–18 and 20; remaining deliverables      | Retain behavioral regression tests, small reviewed changes, evidence, and an independent review pass. The authorized logging removal is the new baseline; preservation rules do not require restoring the deleted framework.                                                                                                                            |

Approval of this plan would establish these interpretations for the logging
overhaul. It would not approve unrelated audit remediation or broader changes to
configuration, device controls, data retention, or permissions.

## Native logging design

### Module loggers and HA ownership

Each Python module that has useful events to report uses the normal pattern:

```python
import logging

_LOGGER = logging.getLogger(__name__)
```

For Companion this produces names below
`custom_components.kaleidescape_companion`, such as `.library.sync`,
`.playback.observer`, and `.calendar.publisher`. Module names identify the
component; HA provides timestamps, severity, and source information. Do not
repeat those fields inside every message.

Call `_LOGGER.debug()`, `.info()`, `.warning()`, `.error()`, or `.critical()`
directly. Use lazy `%s` formatting. A small helper may prepare a safe exception
summary or an operation reference; it should not wrap all log calls or dictate
every permitted sentence and field.

HA owns logger configuration and log delivery. Companion should not call
`basicConfig()`, install handlers or formatters, override the global logger
class, set runtime logger levels, or disable propagation. It should not write
log files or implement its own buffering, rotation, retention, or background log
writer. These choices follow
[HA's Logger integration](https://www.home-assistant.io/integrations/logger/).

Operational logs are Python log records routed through HA. They are separate
from HA's activity/logbook history and event bus. Do not emit business events,
call `system_log.write`, or create notifications just to record a diagnostic
message. A future Repairs issue is appropriate only for a separately justified,
actionable persistent problem.

### Independent packages and the planned pyk migration

Companion's logging should depend on standard Python logging, not the API's
`SafeLogger` classes or a future pyk-specific diagnostic interface.

The target for both the protocol package and reusable scrapers is standard
module loggers with no HA imports. The integration logs the household operation
and its outcome; the library supplies useful transport/parser details, mostly at
DEBUG. This keeps library failures from being reported twice at ERROR.

Resolve the remaining API framework in its canonical `../kaleidescape-api/`
source, then regenerate the vendor copy. The recommended interim approach is to
move its active client/transport logging to standard Python logging. Account for
the standalone package's public logging API and tests in that separate change.
If the pyk migration lands first, removing the old dependency can satisfy this
step instead. Do not build a new Companion bridge to the legacy event schema.
The end-to-end overhaul is not complete while an active bundled dependency still
requires that custom logging path.

Inspect library messages before enabling their DEBUG output, including raw
protocol frames and exception text. Declare separately named library loggers in
`manifest.json` when appropriate, using their actual emitted names. A vendored
module using `__name__` is already below Companion's namespace; adding an
unrelated top-level package name would not control it. HA documents the library
association in
[the manifest's `loggers` field](https://contributors.home-assistant.io/core/integrations/manifest/#loggers).
Do not enable broad shared loggers such as `aiohttp` on behalf of this
integration.

## Severity and message content

Section 8 supplies the following policy for messages owned by Companion.

| Level    | Intended use                                                                                                                                       | Example                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DEBUG    | Meaningful internal decisions, state transitions, cache behavior, transaction boundaries, retries, cancellation, and reasons for skipping work.    | `Library synchronization skipped: cached inventory is current`                                                                      |
| INFO     | Significant operational activity, external actions, lifecycle transitions, and concise outcomes.                                                   | `Library synchronization completed: 42 records processed, 3 updated, 39 unchanged`                                                  |
| WARNING  | Unexpected degradation or a partial result that the integration can recover from, with an explanation of the response and impact.                  | `Library synchronization incomplete: details unavailable for 3 records; previous details retained`                                  |
| ERROR    | An operation failed or its outcome cannot be established. Explain the affected capability, safe cause, data impact, and recovery action.           | `Playback command outcome is unknown after connection loss; automatic replay blocked pending review`                                |
| CRITICAL | A confirmed unrecoverable condition prevents essential Companion functionality and requires intervention. Use only where Companion owns reporting. | `Journal storage disabled after confirmed corruption; recording and journal writes are unavailable; restore from a verified backup` |

These examples are proposed messages, not claims that the current code performs
those recovery actions. Each implementation must verify the stated outcome.

### Applying severity consistently

- Normal absence of optional metadata, an empty library, a cache miss, an
  explicitly disabled feature, or a stale UI request is a DEBUG explanation when
  useful. A rejected form submission normally needs only its existing
  user-facing validation response.
- A missing provider field is WARNING only when it violates an expected response
  and affects a useful result. Aggregate affected records instead of warning
  once per movie.
- A transient loss of availability is a state transition. For a directly managed
  connection, report loss and recovery once at INFO. A failed explicit command
  or exhausted sync can still be ERROR because a requested operation failed.
  Repeated polls during the same outage should not repeat that error.
- Expected cancellation during reload, backup, or shutdown is DEBUG, not ERROR.
  Cancellation does not erase a failure that has already occurred or settle an
  uncertain external write.
- CRITICAL is not a synonym for an exception, a disabled feature, or a failure
  that can be retried. Never infer corruption or permanent unavailability from a
  generic storage error.

Where HA already owns failure reporting, use its established exceptions and
coordinator behavior. Supply useful safe messages for `ConfigEntryNotReady`,
`ConfigEntryError`, and `UpdateFailed`; avoid a second Companion warning/error
for the same failure. This may produce a different native severity than the
table. HA documents that ownership in
[setup failures](https://contributors.home-assistant.io/core/integrations/setup-failures/)
and its
[availability logging rule](https://contributors.home-assistant.io/core/quality-scale/log-when-unavailable/).

The installed HA coordinator logs an initial `UpdateFailed` at ERROR, suppresses
repeated failures while unavailable, and reports recovery at INFO. Setup retries
also have their own reporting. Do not add custom suppression or escalation on
top of those owners merely to force the section 8 examples into every path.

### Truthful outcomes and one reporting owner

The operation boundary with the best context owns its final outcome. Lower
layers may explain an internal decision at DEBUG or raise a useful exception.
They should not each log the same final failure while passing it upward.

Start messages are useful for long operations, but every normal completion,
failure, or cancellation should have an appropriate outcome. For quick reads, a
single useful summary or no log may be sufficient. Do not add ceremonial
entry/exit messages to every method.

Distinguish attempted, sent, accepted, committed, verified, and uncertain. A TCP
write is not proof that playback changed; a returned calendar action is not
proof of read-back verification. Report a journal write as recorded only after
commit. Say data was preserved, rolled back, or retried only when the owning
code confirms it. Logging must never trigger a probe, retry, or replay itself.

## Privacy without a custom logging protocol

### One policy at every level

Enabling DEBUG increases functional detail; it does not grant permission to log
household content. The proposed design has no sensitive-data switch.

Useful message fields include actual HA registry device names, entity names and
entity IDs; the username from HA's authenticated user record when useful for
authorization or access diagnostics; operation names chosen by the code;
provider names; aggregate counts; durations; attempt numbers; protocol/HTTP
status codes; feature enablement; and reviewed failure categories. Use names as
HA presents them so users can match a log entry to the entity or device they
configured. These remain ordinary message arguments, not a required
structured-event schema.

**Allowed:** HA device and entity names and IDs, plus the username from HA's
authenticated user record, may be logged as operational context when relevant.
Use the values as HA presents them; do not treat a username from an arbitrary
request field as the authenticated HA identity. The network-address rules below
still apply to addresses that appear in these values.

**Not allowed:** Do not log movie titles, descriptions, search terms, notes,
watch-history values, purchase information, database row values, raw content
handles, internal HA/account IDs, separately supplied contact or identity
fields, device serials, household file paths, or full URLs. Do not dump configs,
HA state objects, request/response objects, database statements with parameters,
HTML, image content, or protocol frames. Credentials, tokens, cookies, API keys,
and authentication headers are never logged or hashed for correlation. The
allowed HA names and username do not make movie or other household record
content safe to log.

### Network addresses and direct identifiers

Never print a complete IPv4 or IPv6 address. When an address helps a user
identify the endpoint, retain only its final portion:

- IPv4: replace the first three octets and preserve the final octet, such as
  `192.168.1.42` becoming `x.x.x.42`.
- IPv6: preserve only the final four bytes (32 bits), such as
  `2001:db8::1234:5678` becoming `…:1234:5678`.

Use a small address-formatting helper backed by Python's `ipaddress` module so
compressed IPv6 forms, embedded IPv4 forms, and invalid input are handled
consistently. Apply it to standalone addresses and addresses embedded in a
device/entity name or safe error context. This is a targeted address formatter,
not a general text-redaction framework. Never include a full URL or credentials
alongside the shortened address. If parsing fails, omit the value instead of
emitting it unchanged.

Omit or redact direct identifiers such as separately stored email addresses,
phone numbers, internal HA user/account IDs, and precise location data. The
actual username from HA's authenticated user record is an explicit exception
when useful for authorization or access diagnostics, even if the username is
person-identifying. This exception applies only to that username value; it does
not permit logging adjacent contact fields or credentials. Continue to sanitize
network addresses in usernames and in device/entity names according to the
address rules above. A normal HA-assigned label such as `Family Room Player` or
`media_player.family_room_player` is permitted; a name containing a full network
address is sanitized before logging.

For example, a connection failure may identify the configured entity while
keeping its address useful but partial:

```text
Could not reach Family Room Player (media_player.family_room_player) at x.x.x.42; connection timed out
```

Static table/operation names and aggregate row counts can explain storage work;
raw SQL and query results do not belong in the log. A fixed provider label and a
status can explain an HTTP failure without its URL or response body. Keep the
allowance for names limited to values supplied by HA's entity/device registry;
do not extend it to arbitrary provider text or imported names. Never use
external text as a format string.

Review privacy at the emitting call site, before constructing a log record.
Logging arguments and `extra` fields can be retained by handlers even if the
default formatter does not display them. HA log filters are operator controls,
not a security boundary or a replacement for safe arguments.

Operational counts and the timestamp of a message may still reveal activity.
These logs are designed to omit identifying content, not to guarantee that a
complete HA log is anonymous. Other integrations and HA itself have their own
output; Companion cannot promise to sanitize the entire installation's logs.

### Exceptions and framework boundaries

Expected failures should report the known operation, a safe failure category,
and the recovery decision. Avoid interpolating arbitrary `str(error)` or
`repr(error)`. A timeout, HTTP status, or reviewed SQLite error code is often
more useful and safer than a library's free-form exception message.

Unexpected faults still need actionable code locations. Use standard
`_LOGGER.exception()` only when the exception text and its complete chain are
known to be safe. Otherwise use a small helper that produces the exception type
and bounded module/function/line information without raw exception arguments,
locals, source-line contents, or household paths. The helper prepares text for
the standard logger; it does not implement a second logging system.

Review `__cause__`, `__context__`, and nested exception groups, not only the
outer message. The current repository wraps storage exceptions in a safe
`JournalError` while retaining the original cause. HA's lifecycle and
coordinator code can emit full exception information at DEBUG. A safe outer
sentence therefore does not prove that the resulting log is private.

At a boundary that hands an unsafe exception to HA, construct a safe public
exception and suppress unsafe chaining where necessary. Preserve an actionable
safe cause and code location for troubleshooting. Verify the actual HA log
output in tests; do not patch HA's global handlers to hide our mistakes.

### Lightweight correlation

Use an opaque random operation reference only when concurrent or multi-stage
work is otherwise difficult to follow. Pass it through the existing operation
arguments or task state. A retry of the same live operation keeps its reference;
a new operation gets a new one. Use a consistent name such as `operation_id`.

Generate references independently of user, device, movie, and receipt
identities. Do not reuse authentication material, idempotency tokens, or
household database IDs. References are not persisted across restart by default.
In device-related messages, a safe HA device/entity name can identify the
selected player or library source directly; use an operation reference when it
is still needed to connect concurrent stages.

No mandatory tracing context, global registry, new frontend field, or persisted
HMAC secret is proposed. If stable identity correlation later becomes necessary,
review that specific use and its lifetime separately; an unsalted hash of a
title, serial, or user ID is not anonymization.

Put useful references in the readable message, rather than only in `extra`
fields that HA's normal formatter may not render. For example:

```text
Library synchronization started (operation_id=8f4a2c71d0b64e92)
Inventory unchanged; refreshing stale details (operation_id=8f4a2c71d0b64e92)
Library synchronization completed: 42 processed, 3 updated, 39 unchanged (operation_id=8f4a2c71d0b64e92)
```

The messages would use INFO, DEBUG, and INFO respectively. The reference and
counts are illustrative and contain no household identifiers.

## Coverage and ownership plan

Paths below are relative to `custom_components/kaleidescape_companion/`. Apart
from HA-managed sensor/lifecycle output, this is planned coverage, not
implemented instrumentation. Each work package should review all branches of its
workflows; the matrix identifies the useful boundaries rather than a quota of
log statements.

| Workflow and owner                                                                                             | DEBUG detail                                                                                                             | INFO activity/outcome                                                                                 | Failure and recovery coverage                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup, reload, shutdown: `__init__.py`, `config_flow.py`                                                       | Enabled features, initialization stages, deferred work, cancellation and cleanup decisions                               | Ready, unloading, stopped when useful                                                                 | Use HA setup errors; identify failed stage safely; inspect swallowed cleanup failures; avoid claiming all resources closed after partial cleanup                        |
| Storage and migrations: `core/repository.py`, `core/migrations/`                                               | Queue pressure, transaction/rollback boundaries, migration selection, read-cache invalidation                            | Migration start/completion with schema versions; significant maintenance completion                   | One failure owner; safe storage cause; truthful rollback/durability; confirmed essential-storage loss only considered for CRITICAL                                      |
| Backup and durable task drain: `backup.py`, repository/feature owners                                          | Write barrier, buffer/drain decisions, expected cancellation                                                             | Backup preparation/resume summaries                                                                   | WARNING for recoverable delays; ERROR for failed preparation, flush, or resume; identify what is paused and the next action                                             |
| Observation and journal recording: `playback/observer.py`, `tracker.py`, `recording.py`                        | Playback transitions, admission decisions, checkpoints, gaps, ignored duplicates                                         | Durable viewing completion and meaningful recording pause/recovery, without movie details             | Aggregate overflow/gap warnings; ERROR when recording/checkpoint persistence fails; do not log every state tick                                                         |
| Sensors and Now Playing: `sensor.py`, `playback/now_playing.py`                                                | Significant cache/permission/state decisions, not routine snapshot contents                                              | Availability recovery owned by HA where applicable                                                    | Raise safe `UpdateFailed`; preserve HA deduplication; ordinary no-playback states are not failures                                                                      |
| Device discovery and controls: `playback/controls.py`, protocol package                                        | HA device/entity name, capabilities, preflight decisions, transport stages; partially masked address when useful         | Discovery summary naming the matched HA device; significant intent sent and accepted/verified outcome | Failed command at one adapter boundary; uncertain writes clearly distinguished and never replayed by logging; availability transitions handled once                     |
| Library, artwork, collections: `library/sync.py`, parsers/stores                                               | Cache decisions, parsing stages, skipped/deferred detail work, collection verification                                   | Sync start/summary; explicit collection action and confirmed result                                   | Partial results at WARNING; failed operation at ERROR; preserve prior cache where code guarantees it; no per-image or per-title INFO stream                             |
| Metadata enrichment/review: `enrichment/`, `scrapers/`                                                         | Provider selection, matching decisions, cache/rate-limit behavior                                                        | Refresh/review batch summary                                                                          | Missing optional data at DEBUG; degraded batch at WARNING; failed batch or required provider at ERROR; report provider/status without queries or payloads               |
| Calendar publishing/Full Sync: `calendar/`                                                                     | Queue selection, conflict/quarantine/read-back decisions                                                                 | Batch/action summary and verified completion                                                          | Actionable partial conflict at WARNING; failed or uncertain write at ERROR; keep uncertain receipts and no-replay behavior                                              |
| Imports, exports, database maintenance: `core/importing.py`, `import_merge.py`, `maintenance.py`, `ui/http.py` | Validation stages, rejected format category, merge/rollback/cleanup decisions                                            | Start/finish and aggregate counts for accepted significant operations                                 | Invalid user input normally returned to the caller; storage/transfer failures once; no filenames, row values, or exported bytes                                         |
| HTTP/WebSocket and settings: `ui/`, `core/settings_transfer.py`                                                | Route/operation decisions, stale scope/revision, expected authorization rejection; authenticated HA username when useful | Significant settings application or transfer summary                                                  | Use existing safe client errors; ERROR for unexpected failed operations not already reported by their owner; repeated rejection summarized only if operationally useful |
| Diagnostic download: `diagnostics.py`                                                                          | Snapshot unavailable/partial reason if useful                                                                            | Normally no message for a successful read                                                             | Safe bounded health snapshot even during partial setup or unload; no recursive log export or household data                                                             |
| Frontend: `frontend/src/`                                                                                      | Developer console only where useful, with the same content restrictions                                                  | Backend owns operation outcomes                                                                       | Keep user-facing error feedback; no new browser-to-server log shipping, private object dumps, or duplicate backend failure reporting                                    |
| Development and deployment tools: `dev/`, standalone package CLI                                               | Existing tool-specific diagnostic output                                                                                 | Local build/deployment progress belongs to the tool's console                                         | Apply secret/content hygiene; do not start HA logging services or configure HA loggers from packaging scripts                                                           |

The API's internal logger is a separately identified dependency task. Its
current events are not evidence that the proposed native transport coverage
exists.

## Volume, lifecycle, and performance

INFO should describe significant work, not every network response. Repetitive
polls, idle scheduled checks, unchanged values, low-level packets, and
individual records belong at DEBUG only when they add diagnostic value. Batch
detail fetches and provider updates into useful summaries. Review rapid control
repeats for noise without losing the outcome of a user action.

For Companion-owned persistent failures, use the feature's existing state to
report the initial failure, a material change in cause/impact, and recovery.
Repeated identical retries remain quiet or provide bounded DEBUG detail. Keep
any suppression state scoped to that feature/runtime and reset it on recovery;
do not create another global event store. Never let suppression conceal a new
failed command or a different failure.

Use monotonic timing for operation durations. Do not perform extra database
queries, serialize a payload, or format an expensive diagnostic value unless it
is needed and the log level is enabled. Logging should add no network traffic,
write to the journal, or change task cancellation, queue limits, retries, locks,
permissions, or transaction outcomes.

Keep any shared formatting helper safe for both async tasks and the repository
worker. It must not require event-loop access, retain private objects, or let a
formatting failure replace the original operation error. No new handler or
writer thread is needed; HA handles delivery.

## HA diagnostics and operator workflow

Keep `diagnostics.py` as a snapshot of current health: readiness, integration
and schema versions, feature enablement, aggregate storage/queue counts, and
safe current failure categories. Add other values only when they answer a
concrete support question. Handle missing runtime state and storage that cannot
be read without turning diagnostic download into another unhandled failure.

Build that response from deliberately selected safe values. Avoid dumping
`entry.data`, options, runtime objects, or exceptions. HA's redaction helper is
available for specific nested fields but is not a substitute for choosing the
right data. Follow
[HA's diagnostics guidance](https://contributors.home-assistant.io/core/integrations/diagnostics/).
No diagnostic snapshot should contain a history of log records.

After implementation, the support workflow should be:

1. View normal integration messages through HA's Core logs.
2. Enable debug logging for Companion in the integration's HA menu, reproduce a
   narrowly scoped issue, then disable it and collect the output HA provides.
3. Download the integration's health diagnostics separately when useful.
4. Review the captured material before sharing; HA's complete logs may include
   data from other components outside this policy.

HA describes per-integration debug logging in its
[contributor workflow](https://contributors.home-assistant.io/core/first-contribution/).
Verify the actual enable/disable/download behavior for this custom integration
on the development baseline before declaring it supported.

For an explicit namespace setting, the intended configuration is:

```yaml
logger:
  default: warning
  logs:
    custom_components.kaleidescape_companion: debug
```

The severity policy does not require users to change HA's default. INFO and
DEBUG appear only when the configured threshold allows them. Keep normal
operation quiet at WARNING and above. Operators choose log storage and retention
through HA and their deployment; do not assume every HA installation writes a
`home-assistant.log` file.

## Implementation work packages after review

### 1. Establish native logging and safe boundaries

Add module loggers to a small reference workflow and define only the shared
exception/correlation helpers it demonstrates a need for. Cover lifecycle and
coordinator handoffs, including exception chains rendered by HA. Inventory the
bundled API's active legacy logging and select the canonical-source change that
will retire it from Companion's runtime path.

Acceptance: native log records reach the expected namespace; HA controls their
levels; representative failures retain useful context without private data or
duplicate outcome messages. No custom log schema, sink, handler, or database is
introduced.

### 2. Instrument storage, lifecycle, and recording

Cover repository/migration operations, setup/unload, backup barriers, worker
completion, observation transitions, queue overflow, and durable recording.
Review currently swallowed exceptions and fire-and-forget task results so
failures have an accountable owner. Keep any necessary behavioral fix separate
and justified rather than disguising it as instrumentation.

Acceptance: fictional startup/storage/overflow/backup failure scenarios reveal
the failed stage, actual data impact, and recovery behavior; repeated failures
do not flood logs; success is logged only after durability is established.

### 3. Instrument external work and retire legacy dependency logging

Cover device discovery/controls, library and collection work, metadata
providers, and calendar publishing/maintenance. Complete the standard-logging
change in the independent API and regenerate its vendor copy, or remove that
runtime dependency as part of the reviewed pyk migration. Preserve
library/application separation and audit the replacement library's log output
before enabling it.

Acceptance: operation traces distinguish intent, acknowledgement, verification,
partial completion, and uncertainty. Dependency details reach standard logging
without a custom bridge, no raw traffic is exposed, and instrumentation causes
no extra device calls or retries.

### 4. Complete API boundaries, diagnostics, and support documentation

Cover imports/exports, settings, HTTP/WebSocket failures, and diagnostic
snapshots. Review frontend messages and console use without adding a telemetry
channel. Update the security/development guides to describe delivered behavior,
removing stale claims about the old framework. Verify the HA debug controls and
library logger names for the packaged integration.

Acceptance: ordinary validation remains a useful client response; operational
failures are identifiable once; diagnostics work while partially initialized;
the documented operator steps match HA behavior.

### 5. Validate complete workflows and review the result

Use fictional data and fault injection to test normal operation, partial
failure, terminal failure, recovery, cancellation, and uncertain external
writes. Capture actual formatted logs and inspect log arguments, extra fields,
and exception information for injected secret/content markers. Include
HA-generated output and library output at DEBUG, not only Companion messages.

Test severity, useful context, ownership, bounded repetition, and truthful
outcomes rather than exact punctuation or a fixed event catalog. Confirm that HA
device/entity names and the authenticated HA username remain visible when
included, IP addresses use the documented partial form, and secrets, internal
IDs, and separately supplied contact fields are absent at every level. Exercise
long outages, repeated reloads, concurrent operations, queue pressure, and
logging disabled at higher thresholds. Verify no extra requests/writes occur and
no prohibited values remain in retained logging data.

Run focused tests for each package and `bash dev/dev.sh check` for relevant code
changes. Inspect the deployment archive and perform a separate review of the
resulting changes. Use an isolated HA instance for lifecycle/debug-download
validation; browser and real-device checks remain explicit operator review.
Record any checks that could not be completed rather than treating unit tests as
proof of live HA behavior.

For each work package, keep commits independently reviewable and preserve
configuration, API responses, receipts, schemas, and device-control behavior.
Rolling back instrumentation should require reverting code and rebuilding the
bundle, not restoring a log database or migrating household records. Coordinate
any standalone-library public API change with its own compatibility plan.

## Decisions proposed for this review

- Adopt standard per-module Python logging with HA-owned configuration and
  output, plus only small shared privacy helpers demonstrated by actual usage.
- Adopt section 8's severity meanings with the explicit HA ownership and
  expected-condition qualifications above. CRITICAL remains exceptional.
- Keep one privacy policy for normal and DEBUG logging. Do not restore a switch
  that exposes titles, database values, or raw traffic.
- Use operation-scoped random references when useful; defer persistent identity
  pseudonyms and broad tracing infrastructure.
- Retire the bundled API's custom runtime logging at its source, or through its
  planned replacement, rather than adopting it as Companion's new foundation.

This document is the review deliverable. Runtime logging, tests, configuration,
and `audit/` have not been changed by creating it.

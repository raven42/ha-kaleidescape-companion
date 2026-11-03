# Logging and diagnostics

Status: native logging is implemented across Companion. This document owns the
logging mechanism, message policy and diagnostics contract. Remaining upstream
pyk privacy proposals belong to the
[migration plan](../plans/plan-pykaliedescape-migration.md#compatibility-and-upstream-path);
they are optional and require pyk's code-owner approval.

## Native HA logging

Each module uses `logging.getLogger(__name__)` and normal Python logging calls.
HA configures handlers, formatting, levels, rotation and export. Companion does
not install handlers, a log queue, a custom record/event schema or a separate
log file. Its logger hierarchy is `custom_components.kaleidescape_companion`.
The small
[core helper](../../custom_components/kaleidescape_companion/core/logging.py)
only prepares safe exception descriptions; it is not a logging framework.

Warnings and errors propagate to HA logs without additional Companion setup.
Informational lifecycle records and debug detail are visible when HA's selected
level permits them. Use the integration's HA debug-logging action where
available, or configure HA's
[logger integration](https://www.home-assistant.io/integrations/logger/):

```yaml
logger:
  default: warning
  logs:
    custom_components.kaleidescape_companion: debug
```

For routine informational output use `info` instead of `debug`. Remove the extra
verbosity after diagnosis. Do not set a process-wide debug level merely to
troubleshoot Companion. Logs do not replace visible UI outcomes or durable
receipts, and enabling them must not cause network work or change retry
behavior.

## Severity and truthful outcomes

| Level   | Intended use                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| DEBUG   | Bounded operational detail, expected skips/cancellations, freshness or authorization decisions without private inputs  |
| INFO    | Significant lifecycle and aggregate work completion, including recovery; avoid per-item/event chatter                  |
| WARNING | Recoverable degradation, skipped incomplete work, uncertain external outcomes or conditions needing operator attention |
| ERROR   | An owned operation cannot complete or storage/lifecycle integrity is affected                                          |

A rejection before sending, an acknowledged write, a possible send without an
ACK, a stale read and a later observation are different outcomes. Say what is
known. A matching state does not prove a command caused it. Calendar warnings
from failure-injection tests are expected when the tests exercise uncertainty;
the test result determines whether the check passed, not the presence of a
warning on the console.

Log an outcome at its owning boundary. Lower helpers return owned codes or typed
failures without repeatedly logging the same incident. Missing optional
metadata, ordinary cancellation and normal permission denials do not need
warning storms. Long scans and provider work use aggregate completion/progress
rather than titles or a log line per movie. UI recovery should remain actionable
without log access.

## Privacy at every level

Allowed context is bounded operational data: fixed operation names/error codes,
state categories, schema/package versions, counts, timings and safe code
locations. Use placeholders for values and lazy logger arguments. Aggregate
counts can still describe household activity; diagnostic downloads remain
private.

Do not log titles, notes, searches, calendar text, collections, content handles,
player names/serials, addresses/hostnames, source URLs, database paths, account
identifiers, credentials, tokens, cookies, authorization headers, invoice data,
raw SQL/rows, request/response bodies, HTML, images or wire frames. DEBUG is not
an exception to this policy. Truncation and hashing are not substitutes for
omitting household identifiers. Do not fetch data simply to enrich a message.

Raw exception messages and traceback chains can contain any of those values. Use
`safe_exception(error)` at owned exception boundaries, including cleanup,
background tasks, config-entry errors and diagnostic failures. It returns a
validated exception class and at most four Companion module/function/line
locations, excluding arguments, chained exceptions and filesystem paths. For
example:

```text
Input exception:
OSError('cannot read /config/journal.sqlite3; token=fictional-secret')

Safe description (illustrative code location):
OSError at custom_components.kaleidescape_companion.core.repository._open:142
```

Without eligible frames the result is just `OSError`. Avoid `logger.exception`,
`exc_info=True`, interpolating arbitrary errors or exposing their causes through
framework-facing exception chains. Preserve programmatic cancellation/typed
error behavior while making owned user/log messages safe. This is deliberate
omission, not a universal scrubber for arbitrary strings.

## Coverage and ownership

| Boundary                            | Operational evidence                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Setup/options/unload                | Runtime readiness, storage failure, cleanup and safe setup failure                                              |
| Repository/migrations/import/export | Schema transition, queue/storage constraints, bounded operation results and failures                            |
| Observation/recorder                | Lifecycle, recovery/gaps/overflow, checkpoint trouble without playback content                                  |
| Library/collections                 | Sync/cache outcomes, failed generations, durable mutation uncertainty and reconciliation                        |
| Controls                            | Discovery/status/preflight lifecycle, rejection/ACK/uncertainty and restart recovery without targets or handles |
| Enrichment/provider clients         | Pass summaries, matching outcomes and provider-owned error categories without movie queries or credentials      |
| Calendar                            | Publication/reconciliation counts, uncertainty and recovery without event text or calendar identities           |
| HTTP/WebSocket/UI services          | Safe owned operation failures, authorization/scope handling and cleanup                                         |
| Backup/diagnostics/sensors          | Pause/resume, unavailable snapshots and local refresh failures                                                  |

Ordinary transport activity must not produce unbounded per-frame logs. Keep
formatting cheap and avoid synchronous I/O on HA's event loop. Existing bounded
queues and persisted receipts serve their application purpose, not a second
logging pipeline. Add focused privacy/volume tests when extending a boundary.

## Diagnostics and support

The HA diagnostics hook returns integration readiness/version and, when storage
is available, schema/revision, viewing count, database bytes/limit, backup and
queue state, tracking/Library flags, owned error categories and observation
overflows. It omits configuration dumps, household rows, paths, source
identities and provider secrets. Snapshot failure returns an availability
indicator rather than the raw exception. See
[diagnostics.py](../../custom_components/kaleidescape_companion/diagnostics.py).

To troubleshoot, note the visible action/result and package version, reproduce
with narrowly scoped logging if needed, and review the resulting logs and HA
diagnostics before sharing. A full HA log can contain other integrations' data;
Companion's policy cannot sanitize those records retroactively. Do not request a
full private database as routine diagnostic evidence.

Pyk is shared with the built-in integration. Do not change its global logger
configuration or claim its exceptions are private by default. Proposals cover
frame logging, request/error representations, refresh failures and dispatcher
arguments while retaining standard Python logging. A manifest `loggers`
association should be reviewed against that exposure and HA's
[manifest guidance](https://contributors.home-assistant.io/core/integrations/manifest/)
before adding it. It is not required for Companion's own logs to appear.

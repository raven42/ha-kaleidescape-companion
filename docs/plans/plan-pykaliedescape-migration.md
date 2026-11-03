# Migration to pykaleidescape

Status: proposed implementation plan, 2026-11-03. No runtime changes or hardware
tests were made for this plan. Priority order: **functionality, privacy,
usability, scalability, flexibility**. Preserving pyk's existing workflow is a
hard requirement throughout; upstream logging changes are optional and depend on
code-owner approval.

## Decision and completion targets

Make pykaleidescape the library used by Companion, and develop Companion around
pyk's persistent `Device`, state objects, async methods, dispatcher and
automatic reconnect. Extend those interfaces where needed. Preserve ordinary
Device usage; short-lived sessions and a generic command catalog must not become
prerequisites for using pyk.

There are two independently verifiable completion targets:

1. **TCP migration:** every current Companion control/discovery operation uses
   supported public pyk interfaces, with independently buildable Companion
   tooling. Existing optional title launch is included, not silently removed.
2. **All Kaleidescape interaction:** local HTTP library reads, artwork,
   collection additions, and public Kaleidescape Store requests also use
   supported pyk capabilities. Pyk does not currently provide these HTTP
   interfaces. They need a separate, maintainer-approved scope extension.

The second target must not be reported complete after only the first. If pyk's
owner declines HTTP or experimental-launch support, record the remaining scope
explicitly and obtain a product decision; do not disguise a private fork or a
second transport as full upstream adoption. An approved pyk extension interface
could host a small application-specific experimental command, but that is a
distinct ownership outcome that must be documented and approved.

Companion's database, permissions, durable receipts, title matching, observation
logic, calendars, user interfaces and third-party TMDB integration remain
application responsibilities. Moving them into pyk is not part of either target.

## Evidence and current baseline

| Source                                | Examined baseline                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Companion                             | `af825de1a659bd9452bbadd0abc071239e98ec34`, clean before this documentation work                                                               |
| Local pyk                             | `50df2869349667d1e68d429b9b619e32ede9879b`, version `1.2.0`, clean                                                                             |
| Installed HA / pyk                    | HA `2026.10.4`, pyk `1.1.6`; Companion and HA manifests both pin `1.1.6`                                                                       |
| Protocol                              | Official [Rev 17 manual](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf), June 2026 |
| Available hardware, reported by owner | Strato K; Terra Server Compact 30 TB; Terra Server Prime 120 TB. Firmware and topology still to be recorded during validation.                 |

The online [pyk project](https://github.com/SteveEasley/pykaleidescape) and
[HA development manifest](https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/kaleidescape/manifest.json)
were also checked. The inspected HA manifest pins `1.1.6`; this is not a promise
about a future release. Recheck the actual supported HA release before cutover.

An offline source inventory reproduced **206 official request names, 50 present
in pyk, 156 missing**, with 28 names reachable through public `Device` wrappers.
Pyk additionally implements `GET_SYSTEM_PAIRING_INFO`. Companion also requires
experimental `PLAY_MOVIE`, currently absent from pyk. Both are outside that
denominator. Installed pyk `1.1.6` has the same request-name set as the local
`1.2.0` snapshot; this does not imply identical lifecycle behavior. The
[command inventory](#command-inventory) assigns every official request a
migration/expansion disposition. Coverage is not correctness or hardware
certification.

Current implementation observations:

- [Controls](../design/design-playback-controls.md) use pyk command names and
  some state constants; their transport has not yet migrated to public Device
  methods.
- Companion uses native Python/HA logging, implemented throughout its modules.
  [Logging and diagnostics](../design/design-logging.md) owns that policy.
- Local pyk 1.2.0 calls `refresh()` during `connect()`; installed 1.1.6 does
  not. Request-slot cleanup and rotation also differ. Test the HA baseline and
  proposed upstream release separately.
- P1, P2, P6, P7, P8 and P9 below were reproduced with fictional in-memory
  inputs during planning. P3–P5 and lifecycle concerns were reviewed in source;
  their independent reproductions remain required. No full package suite or
  hardware qualification was run for the plan.

## Compatibility contract: the hard requirement

Preserve
`Device(host, port=..., timeout=..., reconnect=..., reconnect_delay=...)`,
`connect()`, `refresh()`, `disconnect()`, existing async command methods, their
normal return values, and the five state objects. Preserve
`Dispatcher.connect()` and signal disconnection, existing callback argument
shapes and event names, hostnames/custom ports, and existing `KaleidescapeError`
catches. Preserve the public lower-level request classes as well as the `Device`
facade.

Test existing third-party Request subclasses as an extension contract. New
response-contract metadata should be optional for existing custom subclasses;
provide it for built-in requests and every migrated Companion operation. Do not
make all external subclasses adopt a new schema merely to keep working, and do
not claim strict response-shape validation for an unspecified custom contract.

New exceptions should extend existing exception families. New target selectors,
freshness metadata and capabilities should be additive. Keep `pause()`'s current
toggle behavior; add explicit-state methods. Keep `cancel()` as `CANCEL`; add
`back()` as `BACK`. Keep existing helpers, including volume feedback and
pairing. Do not replace successful `None` returns with mandatory receipt
objects.

Automatic reconnect continues to restore monitoring and refresh state. It must
never replay a failed user command. Correctness fixes may change previously
incorrect failure behavior, but must retain this ordinary user workflow. Changes
to timeout recovery or initialization need specific compatibility tests and
release notes, not an assumption that passing old happy-path tests is enough.

Defaults retain pyk's initialization and device syslog identification. Companion
must accommodate that traffic. Its existing language promising no connection
writes/event processing needs a scoped update: no playback, power, catalog or
collection mutation is implied by connecting, but pyk performs initialization,
receives local events, and sends library-version identification. A passive mode
or syslog opt-out can be proposed separately; neither is a migration
prerequisite. Local events do not require explicit `ENABLE_EVENTS`; routed
subscriptions do.

No monkeypatching pyk internals, borrowing HA's private `entry.runtime_data`,
reconfiguring shared loggers, or installing a second incompatible pyk version in
HA. A Companion-owned `Device` per active player is the initial integration
model. HA's built-in integration remains an independent owner of its devices;
sharing a connection would require a supported HA contract in a separate effort.

## Requirements, in priority order

Labels below distinguish **required for current behavior**, **optional upstream
improvement**, **expansion on available hardware**, and **future hardware
work**. Correctness is a prerequisite of functionality, not a lower-priority
category.

### 1. Functionality

| ID / Companion goal                                  | Present in pyk                                                                                                | Required enhancement and ownership                                                                                                                                                                                                                                                                                                 | Gate                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| F1 Ordinary remote and power                         | 13 of Companion's 16 control commands have public methods                                                     | Companion calls the matching `Device` method. Add explicit pause-on, pause-off and back methods/classes in pyk; preserve toggle pause and cancel.                                                                                                                                                                                  | Current-behavior cutover                                                      |
| F2 Seed discovery and stable player selection        | Public serial/CPDID lists; identity/model/zone requests exist privately; requests currently target local `01` | Add public routed identity/capability reads and a Device-oriented discovery helper. Enumerate through the approved seed without opening connections to reported addresses. Companion retains its bounded cache, known-target selection and serial normalization.                                                                   | Current-behavior cutover                                                      |
| F3 Verify the intended player                        | `device.system` contains identity/zones                                                                       | Expose a fresh identity/capability read and connection-generation/freshness evidence. Verify selected serial and movie capability at first connection, reconnect and preflight. Compare canonical identity without truncating long IDs into collisions; preserve existing Companion IDs and pyk's established serial presentation. | Before any migrated write                                                     |
| F4 Fresh status/readiness                            | State objects and private reads exist                                                                         | Public refresh/read path covering power, readiness, zone availability, actual play status and actual playing title; distinguish cached values from successful current reads. Do not treat highlighted metadata as proof of the playing title. Companion retains standby gating and bounded wake observation.                       | Current-behavior cutover                                                      |
| F5 Content metadata                                  | `get_content_details()` exists                                                                                | Correct zero-row/multipart handling; verify response identity, count, row indices and handle. Return the same public overview/details interface. Companion retains Library-source, title/year, availability and revision checks.                                                                                                   | Before title-launch migration; parser fixes also protect ordinary pyk refresh |
| F6 Selected-title launch                             | Missing                                                                                                       | Add an explicitly experimental, opt-in `Device` capability using the same pyk request/connection lifecycle. Preserve the existing opaque namespace/handle validation and profile; never guess a prefix. Companion owns preflight tokens and user intent.                                                                           | Full TCP migration, subject to upstream experimental-feature policy           |
| F7 Durable command outcomes                          | Errors exist, but no sufficient transmission/acknowledgement distinction                                      | Pyk provides correlated success/rejection and additive error evidence for not-sent versus possibly-sent work. Companion retains its durable UUID receipts, one-attempt rule, restart barrier and administrator recovery. Post-command state is separate evidence from ACK.                                                         | Before any migrated write                                                     |
| F8 HA observation and coexistence                    | Built-in HA already uses pyk                                                                                  | Keep public HA states/entities as Companion's observation source. Validate built-in media player/remote/sensors alongside Companion. Avoid duplicate recording streams and private runtime access.                                                                                                                                 | Every release gate                                                            |
| F9 Local Library, artwork and collections            | Absent                                                                                                        | Separate optional HTTP client/parser surface in pyk, if accepted; migrate reads first, then the existing explicit collection-add operation. Companion retains scheduling, caches, data storage and receipts.                                                                                                                       | All-interaction target, after TCP migration                                   |
| F10 Public Kaleidescape Store metadata/search/images | Absent                                                                                                        | Separate optional anonymous Store client, if accepted. Preserve robots checks, request budgets, domain/path restrictions and public-only scope. No account, purchase or credential workflow is implied.                                                                                                                            | All-interaction target, separate owner decision                               |

Exact current TCP mapping:

| Feature                   | Wire requests                                                                                                                                                | Target pyk surface                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Discovery / verification  | `GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER`, `GET_DEVICE_INFO`, `GET_NUM_ZONES`, `GET_DEVICE_TYPE_NAME`, `GET_FRIENDLY_NAME`                                    | Existing serial list plus additive discovery and identity methods on `Device`               |
| Status                    | `GET_DEVICE_POWER_STATE`, `GET_SYSTEM_READINESS_STATE`, `GET_PLAY_STATUS`, `GET_PLAYING_TITLE_NAME`                                                          | State objects plus an explicit fresh control-state read/refresh                             |
| Existing commands         | `PLAY`, `STOP`, `NEXT`, `PREVIOUS`, `UP`, `DOWN`, `LEFT`, `RIGHT`, `SELECT`, `KALEIDESCAPE_MENU_TOGGLE`, `GO_MOVIE_COVERS`, `LEAVE_STANDBY`, `ENTER_STANDBY` | Existing corresponding public methods                                                       |
| Missing explicit commands | `PAUSE_ON`, `PAUSE_OFF`, `BACK`                                                                                                                              | Proposed `pause_on()`, `pause_off()`, `back()`; exact names agreed upstream                 |
| Launch preparation / send | `GET_HIGHLIGHTED_SELECTION`, `GET_CONTENT_DETAILS`, experimental `PLAY_MOVIE`                                                                                | Public fresh highlighted read, existing details method, additive experimental launch method |

That is 27 documented commands, of which 24 already have pyk message classes,
plus one experimental command. Implementing three classes alone does not resolve
the discovery, freshness, correctness or launch gaps. Pyk's own initialization
uses additional commands, which also belong in the compatibility test contract.

### 2. Privacy

Companion keeps its native logging policy, safe exception boundaries, positive
response projections, private storage and content-free durable receipts.
Dependency privacy improvements are proposals to pyk's owner, not conditions for
starting or completing the TCP migration.

| ID / location                                             | Exposure to review                                                                            | Proposed optional pyk change                                                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-log1 `connection.py` send/receive and unmatched replies | Raw frames/fields; target addresses; warnings can include request bodies                      | Log operation name, status, timing and connection state with standard module loggers; omit raw payloads from routine diagnostics.                                                        |
| P-log2 `message.py` request errors/debug/repr             | Content handles, metadata and a content-details passcode can appear                           | Avoid embedding raw request representations in default messages; use safe command/status summaries. Preserve useful programmatic exception fields without assuming `str(error)` is safe. |
| P-log3 `error.py` and parser traceback chains             | Raw commands retained by `MessageError`/`MessageParseError`; traceback causes can expose them | Review default exception text and chains together, preserving exception classes and status codes. Add tests at DEBUG, WARNING, ERROR and traceback boundaries.                           |
| P-log4 `device.py` refresh failures                       | Exception interpolation may repeat sensitive request text                                     | Summarize the failed query and failure category while preserving useful diagnostics.                                                                                                     |
| P-log5 `dispatcher.py`                                    | Debug output includes callback arguments, which can contain titles and metadata               | Log event name/listener count without payload by default.                                                                                                                                |
| P-log6 connect-time syslog identification                 | Pyk sends its version to the device                                                           | Document it. An optional opt-out is owner-controlled; preserve the default workflow. This is not itself evidence that household content is being sent.                                   |

Do not import Companion's logging helpers, HA or application-specific event
taxonomy into pyk. No mandatory custom trace/sink framework. If raw wire capture
is retained, its exposure and opt-in behavior need explicit owner agreement.

If these proposals are declined, Companion can still make its own messages and
exceptions safe, but cannot promise that independent pyk or built-in HA logs are
content-free. Document that limitation. Do not globally suppress/filter the
shared `kaleidescape` logger or pretend disabling DEBUG solves warning/exception
exposure. Audit dependency logs before advertising an HA debug-log association.

### 3. Usability

| ID  | Work                                                                                                                                                                                                  | Priority / ownership              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| U1  | Keep ordinary scripts as connect → await Device methods/read state → disconnect; retain dispatcher-based monitoring and reconnect.                                                                    | Hard compatibility contract, pyk  |
| U2  | Explain connected versus synchronized versus ready, unsupported features, ACK versus observed outcome, and experimental launch limits. Provide an actionable Companion error without protocol jargon. | Required, both projects           |
| U3  | Add examples for discovery, explicit pause/resume, fresh status, reconnect, cleanup and optional launch; avoid redundant startup refresh for versions that already refresh.                           | With the corresponding feature PR |
| U4  | Replace Companion's development CLI wrapper with a pyk-based validation tool using the same Device methods as production. General arbitrary-command CLI parity is optional.                           | Before TCP cutover                |
| U5  | Keep credentials, handles, raw destinations and arbitrary commands out of household UI/API inputs. Preserve existing controls and player choices without new confirmation dialogs.                    | Required, Companion               |

### 4. Scalability

| ID  | Work                                                                                                                                                                                                            | Timing                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| S1  | Track/cancel event and callback tasks; isolate callback failures; coalesce overlapping refreshes. Preserve callback delivery semantics and state ordering.                                                      | Lifecycle foundation before adopting long-lived Companion Devices  |
| S2  | Bound admitted requests and multipart work using limits justified by pyk workloads. Preserve pyk's normal concurrent request model; distinguish admission failure from possible transmission.                   | Lifecycle foundation, limits validated against real replies        |
| S3  | Use a bounded set of lazy, persistent Devices with idle cleanup and deterministic unload. Coordinate user writes per player; never let a reconnect start a receipt replay.                                      | Companion migration                                                |
| S4  | Measure startup, reconnect, event bursts and concurrent HA/Companion connections on the available system. More sockets are a tradeoff to measure, not a reason to replace Device with a routed fleet transport. | Hardware qualification; larger-fleet claims deferred               |
| S5  | For HTTP, retain pagination/collection/body budgets, incremental metadata refresh and cache limits; test large fictional catalogs separately from owned capacity.                                               | HTTP phase; storage TB does not establish a library-size benchmark |

### 5. Flexibility

| ID  | Work                                                                                                                                                                               | Timing                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| X1  | Add optional serial/zone addressing beneath existing Request classes and public Device discovery helpers. Preserve positional constructor compatibility and local-device defaults. | Required serial routing early; music-zone hardware support later |
| X2  | Keep standard Request/Response classes. Factor internal serializer/validation helpers only when they remove demonstrated duplication; retain imports and registrations.            | Small changes with features; no prerequisite schema rewrite      |
| X3  | Add modern video/capability queries and optional advanced controls through descriptive Device methods.                                                                             | After core migration, on Strato K/Terra evidence                 |
| X4  | Consider binary framing, broader protocol negotiation, generic CLI access, transport injection and other future transports independently.                                          | Deferred until a concrete supported use case and owner approval  |

## Correctness and protocol work: when and how

The issue IDs below are stable planning references. Start each fix with an
independent failing test and a small, reviewable PR. Verify expected behavior
against the official manual and independent fixtures. Controlled-zone response
and network-setting blank-field ambiguities need specification review before
implementing those optional families.

| Finding                                        | Fix within pyk's architecture                                                                                                                                                                                                                                                    | Sequence / acceptance evidence                                                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2 field escaping; P7 cached serialization     | One printable-field encoder; validate delimiter/character/size behavior before writing. Serialize the current request/sequence or make reuse behavior explicit without breaking normal callers. Preserve request constructor usage.                                              | Phase 1. Golden frames for empty fields, colon, slash, backslash, controls and supported character encoding; reject unsupported input before any write. Logging a request must not change later transmission. |
| P1 omitted zone                                | Serialize an explicit zone; add optional serial target without changing the default local address.                                                                                                                                                                               | Phase 1 codec work, Phase 3 public routing. Synthetic serial and zone cases now; zone hardware certification stays deferred.                                                                                  |
| P8 unknown sequence; P9 unknown response/enums | Represent `?` distinctly from events; preserve unknown response names/raw values. Known field validation raises typed library errors or exposes a documented unknown state.                                                                                                      | Phase 1. Never associate `?` with an arbitrary pending command. Malformed escapes, missing fields and future values cannot leak incidental `KeyError`/`IndexError` into consumers.                            |
| P6 empty metadata; multipart integrity         | Accept zero rows; validate overview, requested handle/table as applicable, row names/counts/unique indices and bounded size. Agree duplicate-key handling instead of silently overwriting ambiguous data.                                                                        | Phase 1 basic empty fix; complete collection validation by Phase 2. Missing, duplicate, reordered, mixed-handle and oversized replies tested independently.                                                   |
| P3 wrong response/target accepted              | Correlate connection generation, sequence, canonical addressed device and zone; validate each request's response class/name/shape, including empty ACKs and error replies. Account for documented serial padding/local aliases deliberately.                                     | Phase 2, before writes or routed discovery. Inject same-sequence wrong-device, wrong-zone, wrong-name and event frames. No arbitrary class cast counts as validation.                                         |
| P4 stale ACK after sequence wrap               | Retire an ambiguous stream before its identifiers can acknowledge new work. Recommended: close that generation, promptly fail its pending work, and let pyk's existing configured reconnect establish/resync a fresh generation.                                                 | Phase 2. Replay delayed replies after all ten sequence slots rotate; cancel during write/collection; exercise multiple concurrent requests. Never replay user commands.                                       |
| P5 unbounded drain / separate time budgets     | Apply one per-request deadline to admission, write/drain and response collection; clean up promptly on failure. Bound connect/DNS separately and document the scope.                                                                                                             | Phase 2. Stalled drain, saturated admission and slow multipart tests; unsent timeout differs from possibly-sent timeout.                                                                                      |
| Pending requests on disconnect                 | Signal every pending waiter and clean up request/task ownership deterministically; preserve cancellation semantics.                                                                                                                                                              | Phase 2. Explicit disconnect, socket loss and unload leave no orphan tasks or long timeout waits.                                                                                                             |
| Partial refresh / reconnect identity           | Add synchronization/freshness metadata and a public fresh-read route; re-establish identity on new connection generations. Retain last known state without marking failed fields current.                                                                                        | Phase 2–3. Failed readiness/title refresh must block Companion's dependent write without discarding useful cached display state.                                                                              |
| Server and older-device initialization         | Make reads capability-aware: Terra must not depend on movie-only refresh. Treat only documented unsupported-command responses as unsupported; transport failures must not masquerade as readiness. Preserve Companion's legacy-readiness fallback semantics with emulator tests. | Phase 3, validate both owned Terra servers. Legacy hardware certification deferred.                                                                                                                           |
| Event races and refresh storms                 | Track tasks and serialize/coalesce state refresh where needed; preserve event argument shapes and meaningful order. Do not silently drop events to meet a cap.                                                                                                                   | Phase 2–3. Slow callback, burst, disconnect and stale-generation tests. A full dispatcher redesign is unnecessary.                                                                                            |

Changing the transport's timeout-recovery behavior is the largest compatibility
decision. Existing local tests intentionally expect reuse after timeout; replace
that expectation with a test for safe recovery while retaining automatic
reconnect for normal Device users. For `reconnect=False`, terminal disconnection
must be explicit and consistent with manual connection ownership. Do not require
every ordinary pyk caller to implement Companion's receipt workflow. Sequence
quarantine is an alternative only if late replies, finite slot exhaustion and
recovery are demonstrably safe; a rotation delay alone is not.

The required protocol change is an incremental repair of printable framing,
collection and correlation under existing classes. Binary framing is not needed
for current Companion behavior. If later justified, first add a dedicated
incremental decoder and split/coalesced-packet tests, then explicit negotiation
on supported hardware; preserve printable framing as the default. Do not send
binary-mode negotiation through a newline-only reader. TCP checksum arithmetic
is not a mandatory migration prerequisite; stricter validation must be justified
without rejecting legitimate firmware replies.

## Companion implementation shape

Create a small adapter that owns long-lived pyk Devices and maps Companion's
fixed intents to their methods. It is an application adapter, not a second
protocol implementation.

- Construct/connect lazily when enabled work first needs a seed or selected
  player. Loading cached discovery must still open no socket. Retain the
  disabled-feature behavior, bounded operation budgets and explicit discovery.
- Companion validates DNS/LAN policy and pins a destination before constructing
  its Device. General pyk keeps hostnames and custom ports; Companion policy
  must not become a global library restriction. Re-evaluate policy/identity when
  replacing a connection or destination.
- Use a seed Device's public serial discovery/identity methods, then directly
  verify a player Device. Do not automatically connect to every returned IP.
  Reject server-only targets for movie control. Persistent connections can
  coexist with fresh per-preflight identity reads.
- Read ordinary display state from pyk's cache/events, but require successful
  fresh evidence for preflight and post-command observations. A reconnect event
  alone is not proof that identity and state synchronization succeeded.
- Keep permission/revision checks, expiring actor-bound tokens, durable
  receipts, write barriers, standby behavior and exact-edition limitations in
  Companion. Reserve before sending, perform at most one command invocation,
  then record correlated ACK/rejection or uncertainty. A successful state read
  cannot erase a missing command acknowledgement or prove causality/exact
  edition.
- A failed observation after an ACK remains acknowledged. Cancellation or lost
  connection after possible transmission remains uncertain. On backup/unload,
  stop admitting work, invalidate preflights, drain accepted operations, then
  disconnect owned Devices and callback signals before releasing storage.
- Keep built-in HA entity observation. Validate that event-driven control state
  does not introduce a second Journal recorder or change existing entity IDs.

During development, move one feature group at a time behind an explicit internal
backend choice. Only one backend may issue a given user operation. Do not try
another transport automatically when pyk times out, and do not shadow-send
mutations. Read-only comparison must also be bounded and opt-in. Remove the
temporary selection once the release gates pass.

## HTTP work needed for the literal all-interaction target

This is a separate proposal to pyk's owner. Keep TCP `Device.connect()` free of
new HTTP/Internet activity and preserve its dependency footprint for existing
users. Agree an optional HTTP extra or an injected async transport/session with
explicit ownership. Prefer separate public clients for local browser access and
public Store access rather than making every Device method depend on scraping.

| Existing Companion interface          | Work to extract into an accepted pyk surface                                                                | What stays in Companion                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /movies` and collection listings | Firmware-aware catalog/collection parsers, exact source handles and completeness/error results              | Scheduling, source namespaces, DB generations, grouping rules and preserved last-good snapshots                |
| `GET /details?id=…&callback=true`     | Version metadata parsing and validated local artwork references                                             | Matching, fill-only enrichment, persistence and UI projections                                                 |
| Local artwork GET                     | Validated image bytes/type with bounded transfers; no arbitrary URL follow                                  | Opt-in private cache, authorization, retention and UI serving                                                  |
| `POST /movies`, `Add-To-Collection`   | Parse the live offered form; submit exactly one selected version once; expose response/uncertainty evidence | Authorization, protected collections, exact membership pre/post checks, durable receipts and recovery barriers |
| Public Store routes                   | Robots-aware anonymous metadata pages, search/version handling and approved thumbnail routes                | Provider selection, request budgets, reviewed matching/enrichment, caches and user presentation                |

The inspected local HTTP code is in
[library/sync.py](../../custom_components/kaleidescape_companion/library/sync.py),
[parser.py](../../custom_components/kaleidescape_companion/library/parser.py)
and
[collections.py](../../custom_components/kaleidescape_companion/library/collections.py).
The public website code is in
[store.py](../../custom_components/kaleidescape_companion/scrapers/providers/store.py)
and
[store_search.py](../../custom_components/kaleidescape_companion/scrapers/providers/store_search.py).

Do not substitute TCP `BROWSE` for movie Library sync: it is a music hierarchy
interface. `GO_MOVIE_COLLECTION` changes the on-screen view, not collection
membership. Neither is evidence of a catalog/membership replacement.

Preserve endpoint restrictions, pinned connections, TLS hostname checks,
redirect/cookie/proxy policy, response limits and unknown-firmware handling. Do
not introduce automatic collection POST retries. Move parsing and network
mechanics independently from application transactions. Keep removal, collection
creation and bulk mutation out until they have a separately verified contract.

## Hardware-testable expansion and future backlog

Every expansion needs a named use case, public Device interface, independent
wire/response tests, capability/error behavior, documentation and a hardware
result for the claimed model/firmware. Adding a request name alone is
incomplete.

| Expansion                                                                                                | Why / validation target                                                                                                                                                   | Disposition                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET_VIDEO_MODE2`, content color, system/zone capabilities, protocol/time information                    | Strato K video reporting and capability-driven UI; Terra identity/system information where supported. Rev 17 specifically directs 8K identification to `GET_VIDEO_MODE2`. | First expansion, read-only. Actual 8K output validation needs suitable content/display chain; owning Strato K alone does not prove that path.                                                       |
| Explicit idle wake, richer movie views/search, page/held navigation, intermission controls               | Useful remote functionality on the owned player                                                                                                                           | Add in small feature PRs after core cutover; certify only supported contexts. Press/release requires paired-release and interruption tests.                                                         |
| Protocol-version/event controls, status-cue period                                                       | Improve specific event/state behavior only when the new feature requires it                                                                                               | Capability-gated, preserve defaults; no blanket protocol upgrade during connect.                                                                                                                    |
| Volume feedback, automation/masking/video commands                                                       | Preserve existing volume workflow; expand only with the needed receiver/display/automation setup                                                                          | Existing APIs remain covered; new writes require a distinct hardware scenario.                                                                                                                      |
| Scripts, parental/child controls, naming/network settings, scene editing/calibration                     | Optional future administration or advanced integration                                                                                                                    | Separate high-impact backlog, not automatic migration work. Network reconfiguration is excluded from normal hardware tests.                                                                         |
| Premiere music zones, SATP `BROWSE`/`PERFORM_ACTION`, music presets/repeat/random, controlled-zone state | No applicable hardware reported                                                                                                                                           | Maybe someday. Synthetic protocol fixes now are not hardware support claims. Resolve controlled-zone response/parameter ambiguities before implementing that family.                                |
| Disc/vault, DVD/Blu-ray menus, angles and disc-specific color keys; Co-Star                              | No disc/vault/Premiere topology reported                                                                                                                                  | Maybe someday or content-specific investigation. A disc-related name alone does not prove it is unusable with digital content; promote only after a relevant Strato K content path is demonstrated. |
| RS-232, binary-response mode, alternative transports, broad generic CLI                                  | No current Companion requirement                                                                                                                                          | Later proposals, not prerequisites for migration or 206-name parity.                                                                                                                                |

The accompanying inventory distinguishes required commands, existing pyk
behavior to preserve, modern expansion candidates, separately gated advanced
features, deferred legacy/content-specific work and deferred framing work.

## Delivery phases and exit gates

| Phase                                | Deliverables                                                                                                                                                                                                                 | Exit gate / dependencies                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Baseline and agreements          | Freeze supported pyk/HA snapshots; add workflow contract tests; agree additive APIs/error semantics with pyk owner; define experimental and HTTP ownership; create isolated hardware harness.                                | Existing Device/HA usage contracts recorded; hardware profiles identified without putting addresses/serials in source. No production dependency change.                                                     |
| 1 — Message correctness              | Separate small PRs for encoder/serialization, unknown responses, empty details and addressing syntax, each with regression tests.                                                                                            | Existing public imports/methods unchanged; golden protocol tests pass. No expanded control rollout yet.                                                                                                     |
| 2 — Request and state lifecycle      | Correlation, deadlines, prompt cleanup, stale-ACK isolation, additive failure evidence, tracked tasks and freshness foundation.                                                                                              | Adversarial emulator suite plus original Device/dispatcher/HA contracts pass; no failed-command replay. Privacy PRs can run alongside this but do not block it.                                             |
| 3 — Required Device capabilities     | Public fresh state/identity and serial discovery, server-aware initialization, explicit pause/resume/back, experimental launch proposal/implementation.                                                                      | All current Companion operations available through supported pyk interfaces; owned hardware read tests then player controls pass. Launch gate may complete separately but is required for full TCP removal. |
| 4 — Companion migration              | Persistent Device adapter; migrate discovery/status, ordinary controls, then launch. Move the development harness and transport-coupled tests to public Device methods. Update networking/lifecycle policy for pyk workflow. | Functional/permission/receipt/backup/restart tests pass; no implicit fallback/replay; built-in integration coexists on hardware.                                                                            |
| 5 — Compatible release and packaging | Upstream pyk release containing accepted fixes; matching HA dependency update; compatible Companion manifest; make runtime packaging and development checks self-contained around the released pyk dependency.               | Test a clean install on each supported HA release with one pyk version; all control imports use supported pyk surfaces; no sibling checkout is needed; archive and unload checks pass.                      |
| 6 — Local HTTP then public Store     | Separate accepted library client proposals; migrate reads before collection writes; migrate public Store independently.                                                                                                      | Each extracted interface passes existing application invariants and owned-hardware or public-endpoint qualification. All-interaction target closes only when all listed routes use accepted pyk interfaces. |
| 7 — Modern expansion                 | Read-only capability/video features first, then separately chosen remote/automation features                                                                                                                                 | One independently tested hardware-backed feature group per PR. Legacy work remains deferred.                                                                                                                |

Phases are dependency gates, not calendar estimates. Phase 7's read-only Strato
K work can run after the transport foundation without waiting for HTTP
acceptance. Implement and validate on isolated branches/environments before
upstream release; do not upgrade the shared HA installation to an incompatible
development wheel.

For each pyk PR include the bug/use case, compatibility impact, independent
regression tests and applicable hardware matrix result. Ensure contributed code
can be licensed under pyk's MIT license; reimplement protocol facts where needed
rather than assuming existing source is reusable. No submission to maintainers
is performed by this planning task.

## Test strategy and concrete hardware runs

Use the same public Device methods in emulator and hardware tests. Add a
`hardware` test marker excluded from ordinary runs and a separate explicit
runner/profile; no network discovery, secrets, or device mutation in normal CI.
An inventory answer is not authorization to run device-control tests now.

The private operator profile supplies explicit targets, expected identities and
test content. Reports committed to source use aliases, model/firmware, package
revision, test names and outcomes; raw frames, titles, IPs, handles and serials
stay private. Sanitized fixtures must preserve wire structure, escaping,
checksums and row relationships, not merely delete identifying substrings.

| Layer                   | Required cases                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline protocol        | Every required command's field/response contract; P1–P9; independent golden frames; malformed/unknown data; blank fields; serial padding; zero/duplicate/missing/oversized multipart rows. Tests must not generate expected answers exclusively from the same catalog as production.                                                                     |
| Emulated lifecycle      | Out-of-order/event-interleaved replies, all ten occupied slots, wrong target/type, delayed ACK after wrap, stalled write, disconnect with pending requests, cancellation before/after write, reconnect and partial refresh, callback failure/overload, server startup and unsupported readiness.                                                         |
| Public compatibility    | Existing examples/imports, methods/returns, pause toggle, volume/pairing, state properties, sync/async dispatcher callbacks, automatic reconnect and explicit disconnect, hostname/custom-port behavior, supported Python versions. Compare HA's `1.1.6` consumer expectations with the candidate release rather than promising all new APIs on `1.1.6`. |
| Companion application   | Opt-ins, authorization across awaits, identity mismatch, known-target allowlist, opaque public projections, no wake from reads, freshness, tokens, UUID deduplication, one send, durable uncertainty, post-ACK read failure, restart recovery, backup/unload, preserved serial/player IDs and entity observation.                                        |
| Packaging / integration | Upstream lint/type/test matrix; Companion `bash dev/dev.sh check` for implementation changes; isolated HA setup/reload/unload; matching dependency pins; runtime archive with the released pyk dependency contract.                                                                                                                                      |

Hardware runs, in order:

1. **Inventory and baseline:** record model, kOS/protocol versions, topology and
   capabilities for Strato K and both Terra servers. Establish whether they are
   members of one system; do not assume they are independent systems or have
   duplicate catalogs. Observe existing HA functionality before changes.
2. **Non-playback reads:** connect/initialize, read identity/state and enumerate
   through each supported seed; confirm all discovered roles and identities.
   Test both Terra models without movie commands. Observe pyk's normal syslog
   identification/local events; do not describe this as literally zero writes.
3. **Strato K controls in an agreed session:** test play, explicit pause twice,
   explicit resume twice, stop, navigation including distinct back/cancel,
   next/previous and menu/views. Confirm visible outcome as well as ACK/state.
   Test explicit standby/wake and readiness separately. Repeating explicit
   pause/resume must not toggle state.
4. **Content and launch:** select operator-approved content; retrieve metadata,
   test qualified/bare handle preflight and mismatch rejection; launch once and
   observe. Include supported alternate editions/resume contexts where
   available. Preserve `exact_version_confirmed=False` unless stronger evidence
   is designed and independently validated; a matching title is insufficient.
5. **Connection recovery:** use an opt-in local test proxy to interrupt only the
   test connection and delay/drop replies. Verify reconnect/state recovery and
   no command replay, including lost ACK and cancellation. Do not disrupt the
   household network or change firmware/network settings to create faults.
6. **HA coexistence and lifecycle:** run built-in integration and Companion
   together; observe duplicate event effects, socket count, latency and
   recording. Reload/unload/restart with clean and uncertain receipts, plus
   backup barriers. Browser UI review is performed by the operator under the
   project policy.
7. **HTTP qualification:** catalog, collections, details and artwork against
   each applicable Terra browser interface; compare retained versions/identities
   and failure behavior. Only a separately authorized disposable collection
   scenario may exercise add-once/reconciliation. Public Store tests are a
   separate opt-in Internet suite, not hardware tests.

Firmware versions, available test content, display-chain capabilities and a
maintenance window remain inputs to the hardware phase. Skipped/unsupported
tests are recorded as such, never as passes. No Strato/Premiere/vault family
compatibility claim extends beyond the actual model/firmware tested.

## Release, rollback and completion review

Do not advance production controls until request correctness, required Device
APIs and hardware behavior have passed. Coordinate the accepted pyk release with
HA's pinned version and then declare/test a minimum supported HA release in
Companion. A locally passing fork is not a released HA-packaged dependency.

Rollback during staged development restores the previous known-good backend for
future operations only. It preserves outstanding receipts and uncertain-player
barriers; it never repeats the operation that triggered rollback. Prefer changes
that require no destructive database migration or ID rewrite. After removal,
retain the ability to install the previous compatible Companion/HA release,
subject to the same receipt compatibility checks.

Final review must show:

- Every current control/discovery/launch path calls supported pyk APIs; existing
  pyk consumers and built-in HA behavior still pass their contracts.
- Runtime imports, installation, build checks and the development harness use
  the released pyk interfaces; a clean checkout is independently buildable.
  Documentation accurately describes the released architecture.
- No loss of current functionality, identity rules, permission boundaries,
  durable receipts, replay prevention or lifecycle cleanup.
- Privacy proposals and their accepted/declined/deferred outcomes are explicit;
  library logging approval is not conflated with a functional release gate.
- Local HTTP and Store work is either complete under supported pyk interfaces or
  explicitly still open. Deferred legacy/optional features do not block TCP
  migration, and 206-command parity is not a release requirement.

The plan covers command coverage, correctness, resilience, usability,
supportability, examples, scalability, flexibility and HA integration while
prioritizing Companion's goals and pyk compatibility.

## Command inventory

Prepared 2026-11-03 at the snapshots recorded above. This working inventory is
not hardware certification. Of the 206 official names below, local pyk 1.2.0 has
50: 28 through public Device wrappers, 20 through internal Device methods, and
two as request classes only. The other 156 are missing. A private method or
request class is not automatically a supported public Device workflow. The main
plan identifies the fresh reads, routing and correctness changes still needed.

### Disposition key

| Code | Requirement / delivery category                                                                               | Hardware qualification                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M    | Required to preserve current Companion TCP behavior; phases 1–5, functionality F1–F7                          | Strato K for controls/metadata; both Terra models and Strato K for applicable discovery/system reads                                                               |
| P    | Existing pyk behavior/API to preserve; compatibility contract from phase 0                                    | Existing emulator regression coverage plus applicable owned-device tests; class presence is not device certification                                               |
| E    | Optional modern expansion; phase 7, functionality/usability before flexibility                                | Candidate for Strato K or applicable Terra system reads; capability and context must be verified before implementation/support claims                              |
| A    | Optional advanced/admin/automation/parental feature; separate feature decision and explicit hardware scenario | May need receiver/display setup or affect settings; excluded from the default hardware suite                                                                       |
| L    | Maybe someday: legacy music/disc/vault, or content-specific behavior without an established validation path   | No relevant legacy hardware reported. Some disc/menu operations may be testable with specific digital content; do not infer blanket incompatibility from the name. |
| B    | Deferred protocol/framing extension; no current Companion requirement                                         | Separate negotiation/decoder tests before explicit supported-device validation                                                                                     |

Category P takes precedence for existing pyk features even if the current owner
cannot exercise them: the migration must not remove an existing workflow.
Category M takes precedence when Companion already uses an operation. All other
categories describe proposed scheduling, not device capability flags. Paired
hold/release commands must be delivered/tested together. A command that returns
unsupported on the owned hardware is recorded as unsupported or moved to
deferred work; a test skip is not success.

Counts by disposition: M=27, P=26, E=62, A=36, L=54, B=1.

### Official requests

Manual pages and parameter names are working navigation aids, not independently
validated signatures. Review the manual and golden cases for every new
implementation. Controlled-zone response/parameter and network-setting
blank-field ambiguities remain open. Coverage counts describe request names, not
successful behavior on a particular model.

#### Automation — 2 requests

| Request       | Fields      | Pyk surface today | Disposition | Manual page |
| ------------- | ----------- | ----------------- | ----------- | ----------- |
| `PLAY_SCRIPT` | script_name | Missing           | A           | 188         |
| `SEND_EVENT`  | message     | `send_event()`    | P           | 188         |

#### Content — 1 request

| Request               | Fields           | Pyk surface today       | Disposition | Manual page |
| --------------------- | ---------------- | ----------------------- | ----------- | ----------- |
| `GET_CONTENT_DETAILS` | handle, passcode | `get_content_details()` | M           | 96          |

#### Disc — 12 requests

| Request          | Fields | Pyk surface today | Disposition | Manual page |
| ---------------- | ------ | ----------------- | ----------- | ----------- |
| `BLUE`           | None   | Missing           | L           | 134         |
| `BLUE_PRESS`     | None   | Missing           | L           | 134         |
| `BLUE_RELEASE`   | None   | Missing           | L           | 134         |
| `GREEN`          | None   | Missing           | L           | 134         |
| `GREEN_PRESS`    | None   | Missing           | L           | 134         |
| `GREEN_RELEASE`  | None   | Missing           | L           | 134         |
| `RED`            | None   | Missing           | L           | 134         |
| `RED_PRESS`      | None   | Missing           | L           | 134         |
| `RED_RELEASE`    | None   | Missing           | L           | 134         |
| `YELLOW`         | None   | Missing           | L           | 134         |
| `YELLOW_PRESS`   | None   | Missing           | L           | 134         |
| `YELLOW_RELEASE` | None   | Missing           | L           | 134         |

#### Input — 3 requests

| Request                | Fields    | Pyk surface today | Disposition | Manual page |
| ---------------------- | --------- | ----------------- | ----------- | ----------- |
| `KEYBOARD_CHARACTER`   | character | Missing           | E           | 84          |
| `KEYBOARD_LITERAL`     | character | Missing           | E           | 85          |
| `SET_USER_INPUT_ENTRY` | string    | Missing           | E           | 88          |

#### Music — 9 requests

| Request                             | Fields                                | Pyk surface today | Disposition | Manual page |
| ----------------------------------- | ------------------------------------- | ----------------- | ----------- | ----------- |
| `ASSIGN_PLAYING_MUSIC_TO_PRESET`    | tag                                   | Missing           | L           | 167         |
| `BROWSE`                            | browse_handle, passcode, lines, flags | Missing           | L           | 144         |
| `GET_MUSIC_PRESET_INFORMATION`      | tag                                   | Missing           | L           | 168         |
| `PERFORM_ACTION`                    | handle, passcode, action              | Missing           | L           | 150         |
| `PLAY_FIRST_IN_MUSIC_COLLECTION`    | collection                            | Missing           | L           | 165         |
| `PLAY_MUSIC_PRESET`                 | tag                                   | Missing           | L           | 168         |
| `PLAY_NEXT_IN_MUSIC_COLLECTION`     | collection                            | Missing           | L           | 166         |
| `PLAY_PREVIOUS_IN_MUSIC_COLLECTION` | collection                            | Missing           | L           | 166         |
| `SET_CONTROLLED_ZONE`               | target_device_id                      | Missing           | L           | 122         |

#### Navigation — 50 requests

| Request                         | Fields       | Pyk surface today | Disposition | Manual page |
| ------------------------------- | ------------ | ----------------- | ----------- | ----------- |
| `BACK`                          | None         | Missing           | M           | 68          |
| `CANCEL`                        | None         | `cancel()`        | P           | 68          |
| `CHILD_DOWN`                    | None         | Missing           | A           | 65          |
| `CHILD_DOWN_PRESS`              | None         | Missing           | A           | 65          |
| `CHILD_DOWN_RELEASE`            | None         | Missing           | A           | 65          |
| `CHILD_LEFT`                    | None         | Missing           | A           | 65          |
| `CHILD_LEFT_PRESS`              | None         | Missing           | A           | 65          |
| `CHILD_LEFT_RELEASE`            | None         | Missing           | A           | 65          |
| `CHILD_RIGHT`                   | None         | Missing           | A           | 65          |
| `CHILD_RIGHT_PRESS`             | None         | Missing           | A           | 65          |
| `CHILD_RIGHT_RELEASE`           | None         | Missing           | A           | 65          |
| `CHILD_SELECT`                  | None         | Missing           | A           | 70          |
| `CHILD_UP`                      | None         | Missing           | A           | 65          |
| `CHILD_UP_PRESS`                | None         | Missing           | A           | 65          |
| `CHILD_UP_RELEASE`              | None         | Missing           | A           | 65          |
| `DOWN`                          | None         | `down()`          | M           | 65          |
| `DOWN_PRESS`                    | None         | Missing           | E           | 65          |
| `DOWN_RELEASE`                  | None         | Missing           | E           | 65          |
| `KALEIDESCAPE_MENU_OFF`         | None         | Missing           | E           | 71          |
| `KALEIDESCAPE_MENU_ON`          | None         | Missing           | E           | 70          |
| `KALEIDESCAPE_MENU_TOGGLE`      | None         | `menu_toggle()`   | M           | 71          |
| `LEFT`                          | None         | `left()`          | M           | 65          |
| `LEFT_PRESS`                    | None         | Missing           | E           | 65          |
| `LEFT_RELEASE`                  | None         | Missing           | E           | 65          |
| `PAGE_DOWN`                     | None         | Missing           | E           | 66          |
| `PAGE_DOWN_OR_NEXT`             | None         | Missing           | E           | 139         |
| `PAGE_DOWN_OR_NEXT_PRESS`       | None         | Missing           | E           | 139         |
| `PAGE_DOWN_OR_NEXT_RELEASE`     | None         | Missing           | E           | 139         |
| `PAGE_DOWN_OR_PREVIOUS`         | None         | Missing           | E           | 139         |
| `PAGE_DOWN_OR_PREVIOUS_PRESS`   | None         | Missing           | E           | 139         |
| `PAGE_DOWN_OR_PREVIOUS_RELEASE` | None         | Missing           | E           | 139         |
| `PAGE_DOWN_PRESS`               | None         | Missing           | E           | 66          |
| `PAGE_DOWN_RELEASE`             | None         | Missing           | E           | 66          |
| `PAGE_UP`                       | None         | Missing           | E           | 66          |
| `PAGE_UP_OR_NEXT`               | None         | Missing           | E           | 139         |
| `PAGE_UP_OR_NEXT_PRESS`         | None         | Missing           | E           | 139         |
| `PAGE_UP_OR_NEXT_RELEASE`       | None         | Missing           | E           | 139         |
| `PAGE_UP_OR_PREVIOUS`           | None         | Missing           | E           | 139         |
| `PAGE_UP_OR_PREVIOUS_PRESS`     | None         | Missing           | E           | 139         |
| `PAGE_UP_OR_PREVIOUS_RELEASE`   | None         | Missing           | E           | 139         |
| `PAGE_UP_PRESS`                 | None         | Missing           | E           | 66          |
| `PAGE_UP_RELEASE`               | None         | Missing           | E           | 66          |
| `POSITION_SELECT`               | x_loc, y_loc | Missing           | E           | 69          |
| `RIGHT`                         | None         | `right()`         | M           | 65          |
| `RIGHT_PRESS`                   | None         | Missing           | E           | 65          |
| `RIGHT_RELEASE`                 | None         | Missing           | E           | 65          |
| `SELECT`                        | None         | `select()`        | M           | 67          |
| `UP`                            | None         | `up()`            | M           | 65          |
| `UP_PRESS`                      | None         | Missing           | E           | 65          |
| `UP_RELEASE`                    | None         | Missing           | E           | 65          |

#### Parental — 1 request

| Request                      | Fields                 | Pyk surface today | Disposition | Manual page |
| ---------------------------- | ---------------------- | ----------------- | ----------- | ----------- |
| `SET_PARENTAL_CONTROL_LEVEL` | rating_level, passcode | Missing           | A           | 93          |

#### Playback — 47 requests

| Request                           | Fields | Pyk surface today       | Disposition | Manual page |
| --------------------------------- | ------ | ----------------------- | ----------- | ----------- |
| `ANGLE_NEXT`                      | None   | Missing                 | L           | 132         |
| `ANGLE_PREVIOUS`                  | None   | Missing                 | L           | 132         |
| `AUDIO_NEXT`                      | None   | Missing                 | L           | 132         |
| `BLURAY_POPUP_MENU_TOGGLE`        | None   | Missing                 | L           | 136         |
| `BLURAY_SPECIAL_STOP`             | None   | Missing                 | L           | 135         |
| `CHILD_PAUSE`                     | None   | Missing                 | A           | 111         |
| `CHILD_PAUSE_OFF`                 | None   | Missing                 | A           | 111         |
| `CHILD_PAUSE_ON`                  | None   | Missing                 | A           | 111         |
| `CHILD_PLAY`                      | None   | Missing                 | A           | 111         |
| `CHILD_STOP`                      | None   | Missing                 | A           | 111         |
| `DISC_MENU`                       | None   | Missing                 | L           | 122         |
| `DISC_OR_KALEIDESCAPE_MENU`       | None   | Missing                 | L           | 138         |
| `DISC_RESUME`                     | None   | Missing                 | L           | 124         |
| `DISC_TOP_MENU`                   | None   | Missing                 | L           | 123         |
| `ENTER_CHILD_MODE`                | None   | Missing                 | A           | 193         |
| `GO_CALIBRATE_MASKING`            | None   | Missing                 | A           | 173         |
| `GO_CALIBRATE_MASKING_OVERSCAN`   | None   | Missing                 | A           | 174         |
| `INTERMISSION_OFF`                | None   | Missing                 | E           | 128         |
| `INTERMISSION_ON`                 | None   | Missing                 | E           | 128         |
| `INTERMISSION_TOGGLE`             | None   | `intermission_toggle()` | P           | 129         |
| `LEAVE_CHILD_MODE`                | None   | Missing                 | A           | 194         |
| `MUSIC_RANDOM_OFF`                | None   | Missing                 | L           | 118         |
| `MUSIC_RANDOM_ON`                 | None   | Missing                 | L           | 118         |
| `MUSIC_RANDOM_TOGGLE`             | None   | Missing                 | L           | 119         |
| `MUSIC_REPEAT_OFF`                | None   | Missing                 | L           | 120         |
| `MUSIC_REPEAT_ON`                 | None   | Missing                 | L           | 119         |
| `MUSIC_REPEAT_TOGGLE`             | None   | Missing                 | L           | 120         |
| `NEXT`                            | None   | `next()`                | M           | 109         |
| `PAUSE`                           | None   | `pause()`               | P           | 107         |
| `PAUSE_OFF`                       | None   | Missing                 | M           | 107         |
| `PAUSE_ON`                        | None   | Missing                 | M           | 107         |
| `PLAY`                            | None   | `play()`                | M           | 105         |
| `PLAY_OR_PAUSE`                   | None   | Missing                 | E           | 107         |
| `PREVIOUS`                        | None   | `previous()`            | M           | 109         |
| `REPLAY`                          | None   | `replay()`              | P           | 110         |
| `SCAN_FORWARD`                    | None   | `scan_forward()`        | P           | 110         |
| `SCAN_REVERSE`                    | None   | `scan_reverse()`        | P           | 110         |
| `SET_FAVORITE_SCENE_END`          | None   | Missing                 | A           | 130         |
| `SET_FAVORITE_SCENE_START`        | None   | Missing                 | A           | 129         |
| `SHOW_NAVIGATION_OVERLAY`         | None   | Missing                 | L           | 126         |
| `START_CHAPTER_ENTRY`             | None   | Missing                 | L           | 124         |
| `START_DISC_TITLE_ENTRY`          | None   | Missing                 | L           | 125         |
| `START_SEND_NUMBER_TO_DISC_ENTRY` | None   | Missing                 | L           | 131         |
| `STATUS_AND_SETTINGS`             | None   | `status_and_settings()` | P           | 127         |
| `STOP`                            | None   | `stop()`                | M           | 108         |
| `STOP_OR_CANCEL`                  | None   | Missing                 | E           | 137         |
| `SUBTITLES_NEXT`                  | None   | Missing                 | L           | 133         |

#### Power — 3 requests

| Request           | Fields | Pyk surface today | Disposition | Manual page |
| ----------------- | ------ | ----------------- | ----------- | ----------- |
| `ENTER_STANDBY`   | None   | `enter_standby()` | M           | 45          |
| `LEAVE_IDLE_MODE` | None   | Missing           | E           | 48          |
| `LEAVE_STANDBY`   | None   | `leave_standby()` | M           | 46          |

#### Query — 41 requests

| Request                                  | Fields | Pyk surface today                         | Disposition | Manual page |
| ---------------------------------------- | ------ | ----------------------------------------- | ----------- | ----------- |
| `GET_ACTIVE_PROTOCOL`                    | None   | Missing                                   | E           | 55          |
| `GET_AVAILABLE_DEVICES`                  | None   | `get_available_devices()`                 | P           | 49          |
| `GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER` | None   | `get_available_serial_numbers()`          | M           | 50          |
| `GET_CAMERA_ANGLE`                       | None   | Missing                                   | L           | 133         |
| `GET_CHILD_MODE_STATE`                   | None   | Missing                                   | A           | 193         |
| `GET_CINEMASCAPE_MASK`                   | None   | Internal: `_get_cinemascape_mask()`       | P           | 175         |
| `GET_CINEMASCAPE_MODE`                   | None   | Internal: `_get_cinemascape_mode()`       | P           | 186         |
| `GET_CONTENT_COLOR`                      | None   | Missing                                   | E           | 185         |
| `GET_CONTROLLED_ZONE`                    | None   | Missing                                   | L           | 121         |
| `GET_DEVICE_INFO`                        | None   | Internal: `_get_device_info()`            | M           | 58          |
| `GET_DEVICE_POWER_STATE`                 | None   | Internal: `_get_device_power_state()`     | M           | 43          |
| `GET_DEVICE_TYPE_NAME`                   | None   | Internal: `_get_device_type_name()`       | M           | 50          |
| `GET_FRIENDLY_NAME`                      | None   | Internal: `_get_friendly_name()`          | M           | 59          |
| `GET_FRIENDLY_SYSTEM_NAME`               | None   | `get_friendly_system_name()`              | P           | 61          |
| `GET_HIGHLIGHTED_SELECTION`              | None   | Internal: `_get_highlighted_selection()`  | M           | 100         |
| `GET_MOVIE_LOCATION`                     | None   | Internal: `_get_movie_location()`         | P           | 172         |
| `GET_MOVIE_MEDIA_TYPE`                   | None   | Internal: `_get_movie_media_type()`       | P           | 134         |
| `GET_MUSIC_NOW_PLAYING_STATUS`           | None   | Missing                                   | L           | 115         |
| `GET_MUSIC_PLAY_STATUS`                  | None   | Missing                                   | L           | 116         |
| `GET_MUSIC_TITLE`                        | None   | Missing                                   | L           | 117         |
| `GET_NETWORK_SETTINGS`                   | None   | Missing                                   | E           | 195         |
| `GET_NUM_ZONES`                          | None   | Internal: `_get_num_zones()`              | M           | 51          |
| `GET_PARENTAL_CONTROL_LEVEL`             | None   | Missing                                   | A           | 92          |
| `GET_PLAYING_MUSIC_INFORMATION`          | None   | Missing                                   | L           | 169         |
| `GET_PLAYING_TITLE_NAME`                 | None   | Internal: `_get_playing_title_name()`     | M           | 114         |
| `GET_PLAY_STATUS`                        | None   | Internal: `_get_play_status()`            | M           | 113         |
| `GET_PROTOCOL`                           | None   | Missing                                   | E           | 52          |
| `GET_SCALE_MODE`                         | None   | Missing                                   | E           | 187         |
| `GET_SCREEN_MASK`                        | None   | Internal: `_get_screen_mask()`            | P           | 176         |
| `GET_SCREEN_MASK2`                       | None   | Internal: `_get_screen_mask2()`           | P           | 178         |
| `GET_SYSTEM_CAPABILITIES`                | None   | Missing                                   | E           | 197         |
| `GET_SYSTEM_READINESS_STATE`             | None   | Internal: `_get_system_readiness_state()` | M           | 47          |
| `GET_SYSTEM_VERSION`                     | None   | Internal: `_get_system_version()`         | P           | 51          |
| `GET_TIME`                               | None   | Missing                                   | E           | 199         |
| `GET_UI_STATE`                           | None   | Internal: `_get_ui_state()`               | P           | 72          |
| `GET_USER_INPUT`                         | None   | Missing                                   | E           | 83          |
| `GET_USER_INPUT_PROMPT`                  | None   | Missing                                   | E           | 87          |
| `GET_VIDEO_COLOR`                        | None   | Internal: `_get_video_color()`            | P           | 183         |
| `GET_VIDEO_MODE`                         | None   | Internal: `_get_video_mode()`             | P           | 180         |
| `GET_VIDEO_MODE2`                        | None   | Missing                                   | E           | 182         |
| `GET_ZONE_CAPABILITIES`                  | None   | Class only: `GetZoneCapabilities`         | P           | 198         |

#### Session — 5 requests

| Request                  | Fields                        | Pyk surface today          | Disposition | Manual page |
| ------------------------ | ----------------------------- | -------------------------- | ----------- | ----------- |
| `DISABLE_EVENTS`         | target_device_id              | Missing                    | E           | 57          |
| `ENABLE_EVENTS`          | target_device_id              | Class only: `EnableEvents` | P           | 55          |
| `SET_PROTOCOL_SETTINGS`  | delimiter_type, character_set | Missing                    | B           | 53          |
| `SET_STATUS_CUE_PERIOD`  | period                        | Missing                    | E           | 112         |
| `SET_SUPPORTED_PROTOCOL` | version                       | Missing                    | E           | 54          |

#### System — 3 requests

| Request                | Fields                                          | Pyk surface today                         | Disposition | Manual page |
| ---------------------- | ----------------------------------------------- | ----------------------------------------- | ----------- | ----------- |
| `SEND_TO_SYSLOG`       | level, message                                  | Internal: `_send_syslog_identification()` | P           | 59          |
| `SET_FRIENDLY_NAME`    | name                                            | Missing                                   | A           | 60          |
| `SET_NETWORK_SETTINGS` | static, ip_address, subnet, gateway, dns1, dns2 | Missing                                   | A           | 196         |

#### Video — 2 requests

| Request                | Fields | Pyk surface today | Disposition | Manual page |
| ---------------------- | ------ | ----------------- | ----------- | ----------- |
| `SET_CINEMASCAPE_MODE` | mode   | Missing           | A           | 187         |
| `SET_SCREEN_MASK`      | flag   | Missing           | A           | 179         |

#### Views — 27 requests

| Request                   | Fields          | Pyk surface today        | Disposition | Manual page |
| ------------------------- | --------------- | ------------------------ | ----------- | ----------- |
| `ALPHABETIZE_COVER_ART`   | None            | Missing                  | E           | 91          |
| `BACKSPACE`               | None            | Missing                  | E           | 87          |
| `CHILD_SHUFFLE_COVER_ART` | None            | Missing                  | A           | 91          |
| `DEFAULT_LEVEL`           | None            | Missing                  | A           | 92          |
| `DETAILS`                 | None            | Missing                  | E           | 95          |
| `DISC_IN_TRAY_TOGGLE`     | None            | Missing                  | L           | 95          |
| `FILTER_LIST`             | None            | Missing                  | E           | 88          |
| `GO_MOVIES`               | None            | `go_movies()`            | P           | 74          |
| `GO_MOVIE_COLLECTION`     | collection_name | Missing                  | E           | 77          |
| `GO_MOVIE_COLLECTIONS`    | None            | `go_movie_collections()` | P           | 77          |
| `GO_MOVIE_COVERS`         | None            | `go_movie_covers()`      | M           | 76          |
| `GO_MOVIE_LIST`           | None            | `go_movie_list()`        | P           | 75          |
| `GO_MOVIE_STORE`          | None            | Missing                  | E           | 81          |
| `GO_MUSIC`                | None            | Missing                  | L           | 78          |
| `GO_MUSIC_COLLECTION`     | collection_name | Missing                  | L           | 80          |
| `GO_MUSIC_COLLECTIONS`    | None            | Missing                  | L           | 80          |
| `GO_MUSIC_COVERS`         | None            | Missing                  | L           | 79          |
| `GO_MUSIC_LIST`           | None            | Missing                  | L           | 79          |
| `GO_NOW_PLAYING`          | None            | Missing                  | E           | 81          |
| `GO_PARENTAL_CONTROL`     | None            | Missing                  | A           | 82          |
| `GO_SCREEN_SAVER`         | None            | Missing                  | E           | 101         |
| `GO_SEARCH`               | None            | Missing                  | E           | 89          |
| `GO_SYSTEM_STATUS`        | None            | Missing                  | E           | 82          |
| `GO_VAULT_SUMMARY`        | None            | Missing                  | L           | 83          |
| `SAFE_LEVEL`              | None            | Missing                  | A           | 92          |
| `SHUFFLE_COVER_ART`       | None            | Missing                  | E           | 90          |
| `STOP_SCREEN_SAVER`       | None            | Missing                  | E           | 102         |

### Extras and interfaces outside the official denominator

| Capability                                                  | Current pyk state                                           | Disposition                                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experimental PLAY_MOVIE                                     | Missing                                                     | Required for full current-functionality TCP cutover, F6. An accepted experimental Device method or supported extension is needed; preserve opt-in and edition uncertainty. |
| GET_SYSTEM_PAIRING_INFO                                     | Public get_system_pairing_info()                            | Preserve existing pyk workflow. Co-Star topology is not validated on the reported hardware.                                                                                |
| Persistent state, dispatcher, reconnect and volume feedback | Existing pyk functionality                                  | Preserve; repair lifecycle/freshness underneath the existing interfaces.                                                                                                   |
| Public routed discovery and fresh control-state reads       | Partial building blocks                                     | Required additions, F2–F4; missing capability even where individual wire names already exist.                                                                              |
| Local HTTP catalog, metadata, artwork, collection add       | Missing                                                     | Separate accepted client proposal, F9; required for the literal all-interaction target.                                                                                    |
| Public Store metadata, search and thumbnails                | Missing                                                     | Separate accepted optional client, F10; public Internet tests, not hardware tests.                                                                                         |
| Standalone validation CLI                                   | Companion harness not yet migrated to public Device methods | Replace wrapper with tooling built on Device; generic arbitrary-command CLI is optional.                                                                                   |
| RS-232 / alternative transports                             | Not implemented by pyk                                      | Deferred; no current owned-hardware requirement.                                                                                                                           |

The required migration is 27 documented names plus experimental launch, not all
206 names. Optional expansion does not replace testing the shared transport or
maintaining the existing public Device workflow.

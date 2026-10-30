# Selected-title playback design

Research date: 2026-10-30. A standalone experimental protocol client and
operator harness are implemented. HA controls, settings, discovery and handle
persistence below remain proposed. Implementation checks use a fictional
emulator; the operator subsequently reported successful selected-title playback
and STOP on one live player. No agent device connection or deployment was
performed. Library sync remains read-only; Now Playing remains observational.

## Standalone protocol proof of concept

The pure standard-library transport lives in
`custom_components/kaleidescape_companion/playback/protocol.py`. The operator
utility `dev/playback_control.py` loads that module without importing or
starting HA. No additional packages, database migration or configuration file is
needed. It never reads or updates the household database.

Set these shell variables to your test player's literal private LAN IP and
hexadecimal serial number (without spaces or a `#` prefix):

```sh
PLAYER_IP="replace-with-player-ip"
PLAYER_SERIAL="replace-with-player-serial"
```

First read identity and status. The highlighted handle is a namespace hint, not
proof of the currently playing movie:

```sh
python3 dev/playback_control.py --ipaddress "$PLAYER_IP" --serial-number "$PLAYER_SERIAL"
```

The initial operations are:

```sh
# PLAY current/highlighted content using the documented command.
python3 dev/playback_control.py --ipaddress "$PLAYER_IP" --serial-number "$PLAYER_SERIAL" --play

# STOP once; inspect the result because a screen saver can consume STOP.
python3 dev/playback_control.py --ipaddress "$PLAYER_IP" --serial-number "$PLAYER_SERIAL" --stop

# Choose an exact version's handle, then validate without sending PLAY_MOVIE.
MOVIE_HANDLE="replace-with-exact-handle"
python3 dev/playback_control.py --ipaddress "$PLAYER_IP" --serial-number "$PLAYER_SERIAL" --play "$MOVIE_HANDLE" --dry-run

# Explicitly initiate experimental title playback after inspecting the dry run.
python3 dev/playback_control.py --ipaddress "$PLAYER_IP" --serial-number "$PLAYER_SERIAL" --play "$MOVIE_HANDLE"
```

`--play` and `--stop` are mutually exclusive. With neither, the utility only
probes. `--dry-run` also works with bare `--play` or `--stop`; it makes
read-only preflight queries but sends no control. Device operations can
interrupt content and trigger theater automations. There is no automatic wake,
STOP-before-PLAY, retry, namespace fallback or background connection.

Each operation first checks that the directly connected device's serial matches
the operand and that it reports a movie zone. Connecting through a server or
another player is deliberately rejected in this proof of concept. The port is
fixed at 10000; public, loopback, link-local and hostname destinations are
rejected. Tests redirect a fictional LAN target to a loopback emulator.

For selected-title playback, use a qualified protocol handle, or a scanned
Library row's `source_handle`. A bare handle needs an observed namespace from
`GET_HIGHLIGHTED_SELECTION`; if none is available, highlight a movie on the
player first or supply the qualified handle. The client requests movie details
using the manual's two-field signature and verifies the returned handle before
launch. The dry-run JSON includes the resolved handle, movie details, bookmark
and options. Check the title/year before issuing playback.

The experimental launch profile uses `<observed-namespace>.NUL` and `158-0=1`
from the pinned third-party research. It is intended to start at the beginning;
one operator test observed playback beginning at position zero. Audio selection,
resume and behavior across other titles/devices still require validation. The
harness does not discover saved bookmarks or promise resume/format selection. It
does not try alternative field counts or option values automatically.

Results are JSON on stdout. Exit 0 means a successful probe/dry run or the
requested state was observed; exit 2 means invalid input, preflight failure or
explicit rejection; exit 3 means a possible send without confirmed outcome.
Interruption exits 130. The report distinguishes acknowledgement from state,
includes before/after snapshots when available, and always reports
`exact_version_confirmed: false`. Modes 0/1/2 mean stopped/paused/playing. A
selected-title operation needs the requested title plus a change in playback
state or a position reset; an existing title alone cannot confirm a new launch.
Even that observation cannot independently prove an exact edition.

Inspect the player after an uncertain result before running another command.
There is no cross-process locking or durable retry receipt in this operator
harness: manually running it twice sends two independent operations. Operations
on one `Player` instance are serialized. Output contains private movie/device
details; keep any saved reports under ignored private development storage.

The emulator suite covers framing/checksums, escaped values, multipart metadata,
address/sequence matching, identity mismatch, unsafe operands, dry runs,
serialization, rejection, cancellation and lost acknowledgement. Normal project
checks never connect to a device. Live validation is recorded separately below.

### Operator validation — 2026-10-30

Operator-supplied harness output demonstrated the following on one test player:

- A bare scanned movie handle resolved through the observed namespace, and the
  content-details response identified that qualified handle and movie.
- `PLAY_MOVIE` received an acknowledgement. The reported state changed from
  stopped with no active title to playing the requested title at position zero.
- A subsequent `STOP` received an acknowledgement and changed the reported state
  from playing to stopped, clearing the active title.
- Both operations returned `state_observed`; no automatic retry or wake was
  needed in this reported sequence.

This establishes a working selected-title launch/stop proof of concept for the
tested sequence. It does not establish general firmware/model compatibility,
exact-edition confirmation, saved resume, standby handling or audio-option
semantics. Model and firmware were not supplied with the report. The
`exact_version_confirmed: false` field remains intentional: title/state evidence
cannot independently distinguish editions sharing a name. No household address,
serial, title, handle, artwork URL or raw transcript is retained here.

## Findings

| Interface                                       | Finding                                                                                                                                                                                                          | Consequence                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed HA 2026.10.4 Kaleidescape integration | Power and transport actions exist; `PLAY_MEDIA` and `async_play_media` do not. Its manifest requires `pykaleidescape==1.1.6`.                                                                                    | Reuse public HA actions for ordinary controls; selected-title launch needs an extension.                                                                |
| Reviewed upstream pykaleidescape                | Public device enumeration/content-detail helpers exist, but no public movie-launch method. Device requests use the local address and its connection matches replies to that address.                             | A new request class alone does not provide serial-addressed launch. Avoid private `_send`/`_connection` access or another integration's runtime object. |
| Published protocol, revision 17                 | TCP port 10000, serial addressing, component enumeration, zone capabilities and friendly names are documented. `PLAY` uses current/highlighted content; `PERFORM_ACTION` supports music. `PLAY_MOVIE` is absent. | Discovery has a documented route; movie-by-handle launch is experimental.                                                                               |
| kaleidescape-voice                              | The author reports Strato E/Terra testing of an undocumented serial-addressed `PLAY_MOVIE`, using a qualified content handle, bookmark/options field and final empty field.                                      | Useful implementation evidence, without a vendor compatibility guarantee. Saved-bookmark discovery remains unresolved.                                  |
| Companion Library                               | Each scanned version already has `source_id`, `source_handle`, `source_group` and its own opaque `id`.                                                                                                           | Keep the current HTTP catalog scan. Select an exact version, rather than a title string or group.                                                       |

Evidence:

- [HA media player at the earlier reviewed revision](https://github.com/home-assistant/core/blob/9337c039ca181612aa14354f068ea9b42758d8d1/homeassistant/components/kaleidescape/media_player.py),
  checked against the installed 2026.10.4 source/manifest for this
  investigation.
- [Python device implementation](https://github.com/SteveEasley/pykaleidescape/blob/50df2869349667d1e68d429b9b619e32ede9879b/kaleidescape/device.py)
  and
  [connection implementation](https://github.com/SteveEasley/pykaleidescape/blob/50df2869349667d1e68d429b9b619e32ede9879b/kaleidescape/connection.py).
  This upstream review is separate from HA's installed dependency pin.
- [Vendor protocol reference](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf),
  printed pages 13, 19, 50–51, 58, 60–61, 96–100, 105–106 and 150.
- [Voice-project playback investigation](https://github.com/marcusadolfsson/kaleidescape-voice/blob/d97596bf00277089ab8fba4718a1dd52a18148fd/docs/play-by-name.md),
  [launch client](https://github.com/marcusadolfsson/kaleidescape-voice/blob/d97596bf00277089ab8fba4718a1dd52a18148fd/custom_components/kaleidescape_voice/player.py)
  and
  [system discovery](https://github.com/marcusadolfsson/kaleidescape-voice/blob/d97596bf00277089ab8fba4718a1dd52a18148fd/custom_components/kaleidescape_voice/system.py).

The voice client also supplies two cautions for our design: it falls back to a
guessed handle prefix, and its success check accepts any title or playing/paused
state. Neither behavior is sufficient for Companion's exact-version contract.
Its prefix-probe command differs from the manual's content-details signature;
validate the signature instead of copying that probe. Its older notes and newer
discovery code also differ on connecting through a server. Prefer direct-player
launch initially; validate routing separately.

The candidate message shape from that project is:

```text
#<player-serial>/<sequence>/PLAY_MOVIE:<qualified-handle>:<bookmark-and-options>::
```

This is protocol research, not a ready-to-send command. The namespace,
bookmark/options and resulting behavior must be verified for the selected
system; the public manual supplies no contract for those fields.

## Recommended integration boundary

Keep public HA media-player actions for power, play/pause, stop and chapter
navigation, with the caller's context, entity permissions and actual capability
flags. Do not create replacement entities or patch the built-in integration.

For discovery and the missing launch operation, use a small asynchronous adapter
under `playback/`. Prefer an upstream public, typed launch/addressing API if one
becomes available and matches HA's dependency version. Until then, a restricted
native `asyncio` client is preferable to depending on private client internals.
It must implement proper framing, escaping, response correlation and bounds; a
TCP read is not necessarily a complete response line. This is a limited adapter,
not a general remote/protocol API. Do not introduce a conflicting pykaleidescape
pin alongside the built-in integration.

## Discovery and native HA settings

Proposed settings, all administrator-managed through the existing options flow:

- **Enable playback controls**, off by default.
- **Control hostname**, defaulting to the configured Library hostname, or
  `my-kaleidescape.local` when blank; fixed TCP port 10000.
- **Discover players**, an explicit read-only action after opting in.
- **Default player**, a dropdown of verified players with friendly name/model.
  Save its serial number and associated HA registry identity, where available,
  rather than a label, mutable entity name or position in the discovery list.
- **Enable experimental title launch**, separately off by default until the
  target firmware/handle contract has been validated.

Enumeration uses `GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER`, followed by
`GET_DEVICE_INFO`, `GET_NUM_ZONES`, `GET_DEVICE_TYPE_NAME` and
`GET_FRIENDLY_NAME` addressed to each serial. Only components with movie zones
are player candidates. Unpowered components may be missing; retain a configured
offline default without silently selecting another player. HA's existing SSDP
discovery/registry supplies already-configured candidates and entity
association; it does not require a subnet scan or import of another
integration's device object. Co-Star/older hardware needs separate compatibility
validation.

Discovery is bounded and does not wake devices, start playback, or enable
recurring controls. A strict read-only probe should not use `Device.connect()`
unchanged: the reviewed client also sends module-identification syslog data.
Configured and discovered addresses are untrusted, subject to the same LAN
validation and pinned resolution policy as the Library connector. Prefer queries
routed through the validated seed, then independently validate any direct-player
connection and its serial identity.

The playback target is distinct from the current single-player journal tracking
mapping. Selecting it must not silently change the recorder's player/sensors.
Initially, recommend the tracked player; recording launches on other players
requires the separate multi-player recording work.

## Library identifiers and scan changes

No additional full TCP library scan is proposed. Preserve the existing raw
browser handle and source-scoped grouping. A group's formats can represent
different playable versions; choosing the highest-quality badge must not choose
a launch target implicitly.

Some source rows also share one handle across several format labels, which our
parser already consolidates. Badges alone cannot establish separately selectable
assets. Offer edition selection only where the verified interface distinguishes
them; otherwise disclose that the device chooses the playable format.

Add a read-only identity-enrichment step when controls are enabled. Resolve a
qualified playback handle using observed protocol evidence and validate it
against the chosen version using content details. A highlighted handle can
provide a candidate namespace; it is not proof of the currently playing movie.
Do not hard-code the voice project's namespace, derive one from a kOS version,
or reverse the recorder's limited handle spelling conversion as a universal
launch rule. If the mapping is ambiguous or unsupported, disable launch for that
version and expose the reason.

Once verified, store the qualified handle, source/system scope, provenance and
verification time alongside that exact Library row, through a migration. Keep
`source_handle` unchanged. Invalidate/revalidate on system changes, invalid
handles or stale identity evidence. Discovery state can stay in runtime/HA
configuration. A separate durable command-receipt table is justified for
external-write recovery; it is not another copy of the catalog. Final fields
depend on operator protocol evidence, so this investigation adds no schema.

## Launch and user interaction

1. Library details offers **Play on…** for an explicitly selected version,
   preselecting the configured default player. Initially restrict this to
   administrators, preserving existing read-only household access.
2. Resolve opaque Library/player IDs on the backend. Require controls enabled,
   current actor/entity permissions, a verified source/version/player mapping,
   current availability and an expected player-state token. Do not accept raw
   handles, destinations, commands, bookmark strings or option strings from UI.
3. Show the target player and current playback. Require confirmation before
   interrupting/restarting content. Waking a player must be explicit because
   theater automation may react to it. Do not promise resume, seeking or
   start-over behavior before independent validation.
4. Serialize commands per physical player and record an actor-bound request ID
   before an external write. Limit queue length and command/read budgets.
   Repeated IDs return their existing outcome, without resending. A timeout or
   disconnect after a possible send is **unconfirmed**, never an automatic
   retry.
5. Use one shared handler for the UI and a proposed fixed HA action
   `kaleidescape_companion.play_library_title`. Preserve HA caller context and
   all authorization checks; expose no arbitrary HA-service forwarding.
6. Distinguish requested, rejected, acknowledged, observed and unconfirmed
   outcomes. A `000` reply or an already-playing title is not success. Confirm
   fresh target-specific playback evidence against the requested version. If
   only a title string is available, report the verification limitation rather
   than claiming exact-edition success. Do not write a completed Journal entry
   from a launch; the existing observer records actual viewing.

## Implementation and acceptance sequence

1. Implement the bounded protocol/parser and discovery with fictional emulator
   tests, the opt-in/native default-player settings and a read-only identity
   report. No playback commands in discovery or sync.
2. Implement handle enrichment and its migration, with changed-system,
   unavailable-version, same-name remake and edition-ambiguity tests. Do not
   require a full catalog rescan for every launch.
3. Validate the experimental command in an explicitly authorized operator window
   on one player/version. First inspect read-only identity evidence, then test
   idle launch, busy-player confirmation, wake handling, exact edition and
   beginning/resume behavior separately. Check existing theater automations.
4. Add the guarded launch action and Library/Now Playing UI with receipt,
   authorization, stale-state, cancellation, duplicate-request and unload tests.
   Test split/coalesced frames, escaped values, malformed/oversized replies and
   accepted-but-no-effect outcomes without devices.
5. Run normal checks/build without device access. Ask the operator to review the
   real UI and perform the device matrix; expand firmware/player support only
   from observed results.

The result is a viable experimental design for selecting a Library version and
starting it on a configured player. Vendor-supported direct launch, saved resume
bookmarks and exact playback-identity confirmation remain validation gates.

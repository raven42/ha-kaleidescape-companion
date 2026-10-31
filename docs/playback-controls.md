# Selected-title playback design

Updated: 2026-10-30. Companion now consumes the
[independent API](protocol-library.md) for opt-in device discovery, basic
household controls and separately enabled experimental Library-title playback.
The built-in HA integration still supplies recording observations. Library sync
and the existing Now Playing snapshot remain read-only; the new control card is
a separate interface.

Checks use fictional peers and loopback emulators. The operator previously
reported selected-title playback and STOP on one player using the CLI. The new
HA interface, discovery and broader commands still require operator browser and
device validation; no agent device connection or deployment was performed.

## Standalone protocol proof of concept

The independent standard-library project lives in `../kaleidescape-api/`, with
undocumented operations in `kaleidescape_api.extensions`. Install it with
`python -m pip install -e '.[dev]'` from the Companion repository root. The
utility `dev/playback_control.py` delegates to its installed CLI without
importing or starting HA. No database migration or configuration file is needed.
It never reads or updates the household database. See the
[library API and extended CLI](protocol-library.md) for documented requests,
discovery, events and binary-response testing.

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

Operations are mutually exclusive. With no operation, the utility only probes.
`--dry-run` also works with bare `--play` or `--stop`; it makes read-only
preflight queries but sends no control. Device operations can interrupt content
and trigger theater automations. There is no automatic wake, STOP-before-PLAY,
retry or namespace fallback. The library supports caller-owned persistent
sessions; the playback workflow closes its session after the operation.

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

## Companion setup and use

Controls are disabled by default. Administrators configure them in Companion's
**Settings → Device discovery and controls**:

1. Enable playback controls and choose a trusted system seed hostname/private
   LAN address. Blank uses the Library host or `my-kaleidescape.local`. The
   control connection uses fixed TCP port 10000.
2. Save, then choose **Discover devices**. This read-only query is bounded to 64
   components/65 seconds and never scans the subnet or wakes a player.
3. Select a movie-capable default player and save again. Discovery choices are
   cached privately using HA storage, bound to the seed, and restored without
   network access. A known offline default is retained rather than substituted.
4. Optionally enable experimental Library-title playback separately.

Once enabled, **all active signed-in HA users** can use **Now Playing → Player
controls** and Library **Play Movie**. A command click runs identity/state
preflight and sends once, without a confirmation prompt. This can interrupt
content, power down a player and trigger theater automations. Pause/resume use
explicit state commands. There is no automatic wake or retry.

In Library, the combined movie dialog has a title/metadata/badge header, **Play
Movie** and **Choose Player**, followed by poster, synopsis and clickable
credits/collections. Version tabs appear only for multiple versions. Discovery
supplies the player picker; choosing another player affects this dialog/control
card, not the shared default or Journal recording sources. Only administrators
see Collection actions, discovery/configuration and purchase history. Library
detection/purchase dates remain available under expandable **Library details**.

The native integration **Configure** flow exposes the same settings and cached
player choices; a serial may also be entered there. Discovery stays on the
Companion Settings page. Household responses expose friendly names/opaque IDs,
not addresses, serials or another user's command receipts. Anonymous/inactive
users cannot control devices. Multiple-player recording remains separate work.

Available commands are Play selection, Pause, Resume, Stop, Previous/Next
chapter, directional navigation, Select, Back, Kaleidescape menu, Movie covers,
Power on and Standby. Controls verify direct serial identity and a movie zone
before every operation. Older hardware, Co-Star and individual command support
need operator validation; a rejected command is reported without fallback. There
is no automatic wake, polling, retry, event subscription, HA service forwarding
or generic raw-command endpoint. Existing HA entities/actions are preserved; no
replacement media player or new control service is registered.

## Library identity and launch limits

No replacement TCP library scan is needed. Launch resolves the opaque exact
Library-version ID on the backend and reads its retained `source_handle`.
Purchase-only placeholders, unavailable versions, another source or disabled
Library sync cannot launch. Control and Library hostnames must resolve to the
same pinned seed address for title playback.

The adapter admits the known numeric namespace/movie-handle spellings. Bare
browser handles obtain their namespace from a fresh `GET_HIGHLIGHTED_SELECTION`
response through the API extension; no namespace is guessed, persisted or tried
as a fallback. If no qualified highlighted handle is available, highlight a
movie on the player or use its native interface; Companion will refuse to send
an unverified launch. Live movie details must identify the same handle and movie
table, and match the cached title and known year. Missing live year when a
cached year exists is also rejected.

Fresh checks run at automatic preflight and immediately before sending. A change
to the Library row or player title/mode/runtime invalidates preflight. Naturally
advancing position does not. There is no fuzzy title fallback. Source groups and
display format badges do not select a different asset.

The experimental profile is the same extension tested by the operator: a
namespace-scoped NUL bookmark and `158-0=1` option. The device chooses a
playable format; exact-edition selection, resume, seeking, audio selection and
start-over semantics remain unverified. Responses always include
`exact_version_confirmed: false`. Acknowledgement is separate from one bounded
post-command state observation. A matching title alone cannot prove a fresh
launch; position reset or a state/title change is also needed. Slow starts can
remain acknowledged without observed confirmation. Launch never creates a
completed viewing; the existing HA observer records actual playback.

## Authorization, receipts and recovery

The authenticated WebSocket API accepts only fixed intents, opaque Library/known
player IDs, automatic preflight tokens and request UUIDs. It accepts no raw
handle, destination, bookmark, wire command or options. The backend checks
active user, dataset, current runtime/configuration, readiness, player serial
and movie capability. It checks authorization again across awaited work and
withholds responses after revocation. Accepted device writes cannot be recalled.

Preflight tokens are random, actor-bound, in-memory and expire after 60 seconds.
Up to 64 preflight tokens are retained. One read/control operation runs at a
time. Before sending, schema 18 commits a content-free `playback_controls`
receipt and the actor-bound request fingerprint on the repository worker. The
same UUID/token returns the recorded outcome without contacting the player
again. Receipts are limited to 10,000; reaching that bound refuses new writes.
They are private system records and cannot be edited, deleted or imported
through Database tools.

A possible send without acknowledgement is **unconfirmed**, never retried.
Further writes to that serial are blocked. If the UI loses its response, use
**Check command result**, which retains the same request ID/token. Do not create
a new intent to retry an uncertain command. After checking the physical player,
choose **I inspected the player…** and confirm the acknowledgement to permit new
commands. This records the reviewing administrator; it never resends anything. A
receipt left in sending state by a crash becomes uncertain on reopen. If receipt
storage fails after a possible send, reload to recover the barrier and inspect
the player before acknowledging it.

Backup, unload and shutdown block new intents, invalidate preflight tokens,
drain an accepted control, close sessions, then pause/close storage. Nothing is
replayed on startup. Locks cover this Companion runtime, not the built-in
integration, other controllers or another process. External changes between
verification and sending cannot be eliminated by this protocol.

The plain TCP interface has no integration-level network authentication or
encryption. Keep it on a trusted LAN; do not expose port 10000 to the Internet.
Companion resolves only private LAN addresses, rejects mixed public/private DNS
answers, pins connections and verifies direct player identity. HA authorization
does not protect a device from another host that can reach its TCP port.

## Packaging and validation

The standalone project stays application-independent. The integration imports
the pinned API package installed by Home Assistant. See the
[protocol library guide](protocol-library.md) for package and validation
details.

Automated tests cover opt-outs, roles, seed discovery, direct identity, live
movie checks, stale reviews, no-replay receipts, crash recovery, standby,
backup/unload behavior and UI single-click/response recovery using fictional
data. The standalone suite covers transport framing and malformed responses.
Normal builds/checks contact no devices.

Operator review remains required for real HA layout, discovery on the chosen
system and explicit commands in a suitable playback window. Begin with saved
settings, read-only discovery/status and dialog/player-picker layout, then
choose any live commands yourself; Play Movie sends without a prompt.
Firmware/model compatibility, exact editions, standby responses and interactions
with theater automation are not certified by passing emulator tests.

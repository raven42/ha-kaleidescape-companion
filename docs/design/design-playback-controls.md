# Player discovery and controls

Status: temporary patched-pyk proof of concept; offline tests pass, hardware
qualification remains. Companion uses persistent pyk `Device` connections,
public methods and routed Request classes for control transport. The
[migration plan](../plans/plan-pykaliedescape-migration.md) owns upstream
compatibility and release gates. This document owns Companion's user
permissions, player selection, title identity and command recovery behavior.

The built-in HA integration remains the playback observation source. Companion
registers no replacement media player and never forwards arbitrary HA services.

## Companion setup and use

Controls are disabled by default. Administrators configure them in Companion's
**Settings → Kaleidescape → Device discovery and controls**:

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
controls** and Library **Play**. A command click runs identity/state preflight
and sends once, without a confirmation prompt. This can interrupt content, power
down a player and trigger theater automations. Pause/resume use explicit state
commands. There is no automatic wake or retry.

In Library, the combined movie dialog has a title/metadata/badge header,
**Play** and **Choose Player**, followed by poster, synopsis and clickable
credits/collections. It opens the first quality-ranked version unless an exact
version has already been selected; version tabs appear only for multiple
versions. The header aggregates known group formats and content ratings, while
version details retain the selected version's formats. Source-labelled viewer
and critic scores are separate from content ratings. Discovery supplies the
player picker; choosing another player affects this dialog/control card, not the
shared default or Journal recording sources. Only administrators see Collection
actions, discovery/configuration and purchase history. Library
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
is no automatic wake, command retry, HA service forwarding or generic
raw-command endpoint. Enabled views read readiness on load and poll briefly
after an explicit wake. Existing HA entities/actions are preserved; no
replacement media player or new control service is registered.

## Library identity and launch limits

No replacement TCP library scan is needed. Launch resolves the opaque exact
Library-version ID on the backend and reads its retained `source_handle`.
Purchase-only placeholders, unavailable versions, another source or disabled
Library sync cannot launch. Control and Library hostnames must resolve to the
same pinned seed address for title playback.

The adapter admits the known numeric namespace/movie-handle spellings. Bare
browser handles obtain their namespace from a fresh `GET_HIGHLIGHTED_SELECTION`
response; no namespace is guessed, persisted or tried as a fallback. If no
qualified highlighted handle is available, highlight a movie on the player or
use its native interface; Companion will refuse to send an unverified launch.
Live movie details must identify the same handle and movie table, and match the
cached title and known year. Missing live year when a cached year exists is also
rejected.

Fresh checks run at automatic preflight and immediately before sending. A change
to the Library row or player title/mode/runtime invalidates preflight. Naturally
advancing position does not. There is no fuzzy title fallback. Source groups and
display format badges do not select a different asset.

The current experimental launch profile uses a namespace-scoped NUL bookmark and
`158-0=1` option. The device chooses a playable format; exact-edition selection,
resume, seeking, audio selection and start-over semantics remain unverified.
Responses always include `exact_version_confirmed: false`. Acknowledgement is
separate from one bounded post-command state observation. A matching title alone
cannot prove a fresh launch; position reset or a state/title change is also
needed. Slow starts can remain acknowledged without observed confirmation.
Launch never creates a completed viewing; the existing HA observer records
actual playback.

## Authorization, receipts and recovery

The authenticated WebSocket API accepts only fixed intents, opaque Library/known
player IDs, automatic preflight tokens and request UUIDs. It accepts no raw
handle, destination, bookmark, wire command or options. The backend checks
active user, dataset, current runtime/configuration, readiness, player serial
and movie capability. It checks authorization again across awaited work and
withholds responses after revocation. Accepted device writes cannot be recalled.

Preflight tokens are random, actor-bound, in-memory and expire after 60 seconds.
Up to 64 preflight tokens are retained. One read/control operation runs at a
time. Before sending, Companion commits a content-free `playback_controls`
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

## Power/readiness and household display

Control status returns `power_state` (`on`/`standby`), `readiness`
(`ready`/`starting`/`idle`) and `ready`, alongside playback state. It uses the
[official protocol](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
`GET_DEVICE_POWER_STATE` and `GET_SYSTEM_READINESS_STATE`. Older Premiere
players that reject the latter command use confirmed on-state plus a successful
playback read. Device/zone identity is still verified before an explicit wake.
Launch and transport preflight reject unready players; power operations and
read-only status remain available. A readiness change invalidates a preflight.

The Library action reads state on opening, offers **Check player** while state
is unknown/starting and **Power On** when standby/idle, then polls read-only
readiness for at most two minutes. Connection resets defer another read for 30
seconds. It never retries a wake or automatically launches once ready. **Play**
requires a new click. Successful acknowledged/observed play, resume and movie
launch navigate to Now Playing for the chosen player. Unknown/uncertain outcomes
preserve recovery and never trigger navigation.

The Now Playing snapshot itself only reads HA states. Both account roles get
artwork/display context with source read permission; recorder internals remain
administrator-only. The control widget now opens a portrait Remote dialog.
Choose Player and its target label are hidden for one player. Review tablet
geometry, standby/startup behavior and normal-user covers in a real browser;
automated tests do not certify device/firmware behavior.

## Migration and validation

The PoC creates lazy, persistent pyk Devices, preserving normal initialization,
state events and automatic reconnect. Connection initialization is distinct from
playback or power mutation; cached player discovery still opens no connection.
Fresh verification remains required before a write, and automatic reconnect must
never replay a user command. These capabilities require the patched pyk checkout
until an accepted compatible release is available. An incomplete pyk connection
is discarded even if its TCP socket opened before initialization failed; a later
explicit read can establish a fresh client.

**Settings → About** displays the version declared by the loaded pyk module. For
a failed status read, Companion logs one warning by default and identifies the
failed pyk stage at debug level, without device identifiers or raw exception
text. A later successful read logs recovery. The version string alone cannot
prove that a patched module with the same version number is installed.

Offline tests cover opt-outs, roles, discovery, identity mismatch, live
metadata, stale preflights, receipt deduplication, crash recovery, standby and
backup/unload. They do not certify firmware, exact editions or theater
automation. Hardware qualification targets Strato K, Terra Server Compact 30 TB
and Terra Server Prime 120 TB; firmware/topology still need recording. Server
discovery tests do not send movie commands to servers. Legacy music/vault
features remain deferred. Operator browser review and explicitly chosen device
tests are separate from ordinary checks; use the migration plan's ordered test
matrix.

# Player discovery and controls

Companion uses `LivePlayer(Device)` directly for seed discovery, fresh player
state and experimental serial-addressed `PLAY_MOVIE`. Pyk supplies the ordinary
playback, navigation and power controls. Offline tests exercise these paths.
Hardware qualification remains pending under the
[pyk compatibility plan](pyk.md).

The built-in HA integration remains the playback observation source. Companion
registers no replacement media player and never forwards arbitrary HA services.

## Companion setup and use

Controls are disabled by default. Administrators configure them in Companion's
**Settings → Playback**:

1. Enable playback controls and enter a trusted system seed hostname/private LAN
   address under **Kaleidescape Player Address**. Blank uses the **Kaleidescape
   Server Address** or `my-kaleidescape.local`. The control connection uses
   fixed TCP port 10000.
2. Save, then choose **Discover devices**. This read-only query is bounded to 64
   components/65 seconds and never scans the subnet or wakes a player.
3. Select a movie-capable default player and save again. Discovery choices are
   cached privately using HA storage, bound to the seed, and restored without
   network access. A known offline default is retained rather than substituted.
4. Optionally enable experimental Library-title playback separately.

Once enabled, **all active signed-in HA users** can use **Now Playing → Player
controls** and Library **Play**. A command click runs identity/state preflight
and sends once, without a confirmation prompt. This can interrupt content, power
down a player and trigger theater automations. The remote's Play/Pause button
sends the player's toggle command. There is no automatic wake or retry.

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

Available commands include Play selection, Pause, Resume, Stop, Previous/Next
chapter, Replay, forward/reverse scan, directional and page navigation, Select,
Back, Kaleidescape menu, Movie covers, Movie list, Collections, Search,
Intermission, Status and settings, Screensaver, Power on and Standby. While no
movie is playing, the remote replaces its transport controls with shortcuts to
Paused, Watch Soon, New and Favorites. Paused movies retain transport controls.
The shortcut is refused if playback becomes active before it is sent. The player
may fall back to the general collections view if a name is missing or the model
does not support selecting a specific collection. Controls verify direct serial
identity and a movie zone before every operation. Older hardware, Co-Star and
individual command support need operator validation; a rejected command is
reported without fallback. There is no automatic wake, command retry, HA service
forwarding or generic raw-command endpoint. Enabled views read readiness on load
and poll briefly after an explicit wake. Existing HA entities/actions are
preserved; no replacement media player or new control service is registered.

## Home Assistant player actions

Each discovered movie player is registered as a Companion device without
creating player-control button entities. Each fixed pyk and Companion control is
available as a separate `kaleidescape_companion.player_*` action; select the
player device in the action editor. For example, `player_screensaver_off`
dismisses a player’s screensaver. You can use these actions in automations or
attach them to your own button helpers. Existing Companion synchronization
buttons remain available.

Players are registered when discovered or restored from the discovery cache.
Actions reject players that are no longer in the current discovery results. They
use the same enabled-controls setting, verified identity, command receipts and
uncertainty recovery as the remote. HA system contexts and active user contexts
can run these actions; controls are rechecked before sending.

Actions requiring a value also use the player device selector:

- `kaleidescape_companion.play_movie`: supply exactly one of `title` (an exact,
  unique synced Library title) or `version_id` (an exact Library version ID).
  Library sync and experimental title playback must be enabled. Ambiguous titles
  are rejected rather than selecting an edition automatically.
- `keyboard_character`, `set_player_input`, and `open_movie_collection` accept a
  `value` appropriate to the command. Opening a named collection can interrupt
  playback, as documented by Kaleidescape.

For example, select the player device in the HA action editor or use its HA
`device_id` in YAML:

```yaml
action: kaleidescape_companion.play_movie
data:
  device_id: YOUR_PLAYER_DEVICE_ID
  title: A Fictional Film
```

The actions accept only the specified commands and arguments; they are not a raw
protocol proxy. HA automation traces can retain supplied text values. An
optional HA action response returns the recorded outcome. Actions may be
unavailable on particular player models or firmware and need hardware
validation.

## Remote control visibility

**Now Playing → Options** lets each user choose which remote controls to show
for the current display profile. Covers, List, Collections, Search, Settings,
Screensaver, Transport Controls, Intermission and Collection Shortcuts are all
shown by default. Transport Controls includes Replay and Stop; Intermission is
independent. Power and directional/navigation controls remain available. The
remaining view buttons expand to use the space when others are hidden.

## Player search input

While the Remote dialog is open, Companion reads the selected player's current
playback state, UI state and user-input prompt every two seconds. While the
screensaver is active, the search field closes and text updates are refused.
When it reports an alphanumeric search, the remote shows a text field; focusing
it opens the device's native keyboard. Enter up to 120 printable ASCII
characters and press **Send**, then **Done** to finish. Pressing Enter sends any
unsent text and finishes the search. Other prompts, including passwords, do not
appear in the remote. The entry is checked again before sending so an input
change on another controller invalidates the pending command.

Search text follows the same authorization, player identity checks and durable
receipt rules as other controls. It is retained temporarily in memory for the
preflight and is not stored in receipts. The private pyk wire-log filter omits
user-input messages, including their prompt contents. HA transport logging and
other connected controllers remain outside that filter. The complete-entry
command is documented for Strato and Alto; physical player validation remains
necessary. Search prompt matching currently uses the English word “search”.

The **Now Playing → Options** menu has a personal, display-specific **Send
search text while typing** setting. It is off by default. When enabled, edits
are coalesced briefly and sent in order; edits made during a send wait for its
result. Each sent update follows the same receipt and uncertainty rules, and an
unconfirmed send is never automatically retried. **Send** is shown when live
typing is disabled.

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

Acknowledged and observed outcomes are logged at info level without a remote
notice. An unconfirmed outcome is logged at warning level without a command
outcome notice. A possible send without acknowledgement is never retried.
Further writes to that serial are blocked, and the UI shows that player controls
are paused so an administrator can restore them. If the UI loses its response,
use **Check command result**, which retains the same request ID/token. Do not
create a new intent to retry an uncertain command. After checking the physical
player, choose **I inspected the player…** and confirm the acknowledgement to
permit new commands. This records the reviewing administrator; it never resends
anything. A receipt left in sending state by a crash becomes uncertain on
reopen. If receipt storage fails after a possible send, reload to recover the
barrier and inspect the player before acknowledging it.

Backup, unload and shutdown block new intents, invalidate preflight tokens,
drain an accepted control, close sessions, then pause/close storage. Nothing is
replayed on startup. Locks cover this Companion runtime, not the built-in
integration, other controllers or another process. External changes between
verification and sending cannot be eliminated by this protocol.

Read operations are owned tasks. Pause/stop cancels and drains discovery, status
and preflight reads, waits for an accepted write, then closes clients. Cleanup
continues across client failures. Offline lifecycle tests cover discovery
completing during shutdown and cancellation during cleanup; native HA and
hardware qualification remain pending under the [pyk compatibility](pyk.md).

The plain TCP interface has no integration-level network authentication or
encryption. Keep it on a trusted LAN; do not expose port 10000 to the Internet.
Companion resolves only private LAN addresses, rejects mixed public/private DNS
answers, pins connections and verifies direct player identity. HA authorization
does not protect a device from another host that can reach its TCP port.

## Power/readiness and household display

Control status returns `power_state` (`on`/`standby`), `readiness`
(`ready`/`starting`/`idle`) and `ready`, alongside playback state. It uses the
[official protocol](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
`GET_DEVICE_POWER_STATE` and `GET_SYSTEM_READINESS_STATE`. The current pyk
connection initialization requires both queries. Compatibility with Premiere
firmware that rejects the readiness query needs hardware qualification. Device
and zone identity are verified before an explicit wake. Launch and transport
preflight reject unready players; power operations and read-only status remain
available. A readiness change invalidates a preflight.

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

Companion opens a `LivePlayer` on demand and reuses its connection for
subsequent operations. Pyk initializes the connection and processes device
events. After a disconnect, the next explicit operation opens the connection and
verifies the player again. Cached player discovery works offline. The temporary
pyk bundle supplies request routing, outcome errors and documented commands. A
failed initialization discards the connection.

**Settings → About** displays the version declared by the loaded pyk module,
currently `1.2.0`. The vendor manifest identifies the individual patches. For a
failed status read, Companion logs one warning by default and identifies the
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
tests are separate from ordinary checks; use the pyk compatibility document's
ordered test matrix.

# Pyk ownership and compatibility

Companion currently bundles pykaleidescape from upstream `main` at
`50df2869349667d1e68d429b9b619e32ede9879b` with three changes reviewed in
[upstream issue #26](https://github.com/SteveEasley/pykaleidescape/issues/26).
It also includes the proposed user-input and navigation support described below.
The module reports upstream version `1.2.0`. The patch list and hashes identify
the exact source included in the integration.

## Scope and ownership

| Location in the integration                  | Responsibility                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vendor/kaleidescape/`                       | Pyk's connection, events, request/response types and documented Device commands, under the upstream MIT license.                                                               |
| `playback/live_player.py`                    | Standalone `LivePlayer(Device)` for discovery, fresh player observations and experimental movie launch.                                                                        |
| `kaleidescape_browser/`                      | Companion's standalone Apache-2.0 Python library for the server's movie catalog, details, artwork and collection forms. It has its own package, transport interface and tests. |
| `playback/controls.py` and `library/sync.py` | Home Assistant integration, authorization, selected player and title checks, network policy, durable receipts and readback.                                                    |

To use `LivePlayer` outside Home Assistant, copy `live_player.py` into a Python
project that has `pykaleidescape` installed. From this checkout you can also put
`custom_components/kaleidescape_companion/playback` on `PYTHONPATH`. The class
accepts pyk's connection options and inherits its documented controls. An async
caller can read a player by address.

```python
from live_player import LivePlayer


async def playback_at(host):
    player = LivePlayer(host, reconnect=False)
    try:
        await player.connect()
        return await player.read_playback_state()
    finally:
        await player.disconnect()
```

`read_identity()` reports the full normalized serial, model, address and movie
zone count. `read_playback_state()` returns an immutable snapshot with that
identity, power, readiness, zone availability, title, play status and times in
seconds. Both query the device each time. A disconnect invalidates an
observation in progress. Movie queries run only when the first movie zone is
available and the player is on and ready. Direct reads work with released pyk
1.2.0. Routed reads, discovery and movie launch use the reviewed build's
`device_id` support.

`discover_devices()` returns one identity per distinct advertised serial, with a
friendly name when the player supplies one. `prepare_movie_launch(handle)` reads
the connected player's movie capability and looks up the requested handle. Pass
`serial=...` to address another player through the seed. A bare handle takes
only the namespace from the highlighted selection. The result includes the title
and optional year for the caller to review. `send_movie_launch(prepared)`
consumes that result and sends one serial-addressed `PLAY_MOVIE`. A disconnect
or a new preparation requires a fresh lookup.

Pyk manages sockets, sequence numbers, timeouts and event-driven state.
`LivePlayer` requires a command acknowledgement and closes the connection after
an uncertain write so a late reply cannot confirm a later command. Companion
reuses one player per address and reconnects on the next explicit operation. It
checks the catalog match and records the intent before each launch. See the
[control contract](playback-controls.md).

Library sync injects its guarded HA HTTP transport into the server browser's
`LocalLibrary`. Standalone callers can use `KaleidescapeServerBrowser` with its
standard-library HTTP transport. Collection writes recheck the server form and
the caller's authority before submission. Companion records the intent and
confirms membership by readback. The public Store and TMDB clients remain
separate providers under `scrapers/`. See the [Library contract](library.md) and
the
[browser package guide](../../custom_components/kaleidescape_companion/kaleidescape_browser/README.md).

## Compatibility and upstream path

The first three proposed pyk changes have independent branches based directly on
the upstream commit above. The user-input branch builds on request routing for
protocol field escaping.

| Branch                     | Scope                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `pr/connection-robustness` | Connection cleanup, request outcome errors, callback isolation and response handling.    |
| `pr/request-routing`       | Outgoing field escaping, optional device ID and reply matching by sequence number.       |
| `pr/documented-commands`   | Documented playback and navigation methods including the existing CANCEL alias for Back. |
| `pr/user-input`            | User input events and keyboard, screensaver and navigation commands; depends on routing. |

The [development guide](README.md) describes reconstructing the vendor directory
from the pinned offline source and four runtime diffs. HA installs the manifest
dependency `pykaleidescape>=1.2.0` for compatibility with the built-in
integration. Companion selects its private copy in `playback/_pyk.py`. When the
four patches are merged and released, verify the released dependency with both
integrations, update the manifest minimum and that import, and remove the vendor
directory and its reconstruction assets. `LivePlayer` and the server browser
continue to ship with Companion.

## Test strategy and concrete hardware runs

`scripts/test --live-player-only` runs the standalone player's tests with pyk as
its only dependency. `scripts/test --browser-only` runs the independent browser
suite. Both run during `scripts/check`. The following command exercises the
packaged `LivePlayer` against a fictional TCP player.

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_pyk_adapter.py'
```

Optional checks live in `tests/hardware/`. They require explicit operator
selection of a host and, for a device, its expected serial. Player commands and
experimental launch also require their own opt-ins. Record the model, firmware,
topology, patch commit and sanitized results. Start with read-only discovery,
state and library queries, then selected-player controls and launch. Check
interrupted replies, reconnect, receipt recovery and coexistence with HA's
built-in integration before release.

HA OS logs previously exposed the serial padding difference. The adapter's
emulator tests cover it. Hardware and HA OS retesting remain pending on the
Strato K, Terra Server Compact 30 TB and Terra Server Prime 120 TB.

# Independent Kaleidescape API project

The protocol implementation is an independent Python project in the sibling
`../kaleidescape-api/` checkout. It supports Python 3.11+ with no runtime
dependencies and owns its package metadata, CLI, documentation, examples, tests
and CI. It imports neither HA nor Companion code.

Its documented API covers the current Rev 17 TCP request catalog, routing,
discovery, events, multipart details/music browsing and response framing.
Undocumented movie launch is explicitly imported from `extensions/`, outside the
official catalog. See the project's
[API reference](https://pypi.org/project/kaleidescape-api/),
[command reference](https://pypi.org/project/kaleidescape-api/),
[CLI guide](https://pypi.org/project/kaleidescape-api/) and
[security policy](https://pypi.org/project/kaleidescape-api/).

## Development and compatibility utility

From this repository root, build the API distributions in the sibling project
first. The `--find-links` option also supports development before publication:

```sh
python -m pip install --find-links ../kaleidescape-api/dist -e '.[dev]'
python ../kaleidescape-api/tools/check.py
python -m build ../kaleidescape-api
python ../kaleidescape-api/tools/check_distribution.py
kaleidescape-api --commands
```

`dev/playback_control.py` is a thin compatibility entry point to the installed
CLI. Existing IP/serial, probe, PLAY/STOP and dry-run operands remain available;
see the [operator guide](playback-controls.md). The API project and CLI do not
read the household database or register HA services. Normal tests use fictional
loopback emulators and do not contact devices.

## Companion integration boundary

Companion imports the installed API package pinned in its HA manifest and Python
project metadata. The API distribution must be available to Home Assistant
before deployment. The integration adapter exposes only fixed authenticated
household intents and owns its configuration, serial/capability checks, durable
receipts and UI. The standalone API still imports no application code and its
generic `execute()` is never exposed through HA. See
[Companion controls](playback-controls.md).

Develop and test API changes in the separate project. Update the pinned package
version and run Companion checks when adopting a release.

Current emulator coverage does not certify every request on hardware. The
[reported launch/STOP validation](playback-controls.md#operator-validation--2026-10-30)
covers one player sequence; discovery, binary/events, exact editions, music and
broader compatibility still need operator testing.

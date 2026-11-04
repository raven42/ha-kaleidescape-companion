# Migration to pykaleidescape

Status: **temporary proof of concept**, 2026-11-03. Companion now uses the
patched pykaleidescape checkout for device discovery, playback controls, title
launch, and local server browser reads/writes. Its bundled device API has been
removed. This has offline test coverage, but no hardware or HA OS validation in
the original migration. Subsequent HA OS logs exposed an identity-read bug now
included in phase 03a; a successful hardware retest is pending. This is not a
supported release migration.

## Scope and ownership

Pyk remains a **local-network Kaleidescape device library**. The patched public
`Device` workflow owns device connections, discovery, fresh state reads,
explicit controls, and experimental movie launch. Its `LocalLibrary` owns local
server browser page/form interpretation, while Companion supplies the HA-owned
HTTP transport with private-address pinning, route checks and response limits.
Companion owns configuration, authorization, durable command and collection
receipts, observation, storage, UI, and recovery. A failed command or collection
POST must never be replayed merely because pyk reconnects.

Public Kaleidescape Store scraping stays **entirely in Companion** under
`scrapers/providers/store.py` and `store_search.py`. Those clients cover public
movie metadata, anonymous search, and approved artwork routes. Companion's
provider transport applies robots rules, rate/body limits, public DNS/TLS
checks, and no-account/no-cookie scope. Store functionality is neither a pyk
requirement nor part of the device migration. TMDB is likewise a Companion
provider. No Store hooks should be added to pyk for this migration.

## Current PoC implementation

- `playback/controls.py` creates persistent, lazy pyk `Device` instances for
  verified private IPs and uses public `Device` methods and Request classes.
  Companion still validates seed/player identity and requires fresh state before
  sending a user command. Connections close on pause/unload.
- `library/sync.py` uses pyk `LocalLibrary` for catalog, collections, details,
  artwork, and add-only form handling. Companion retains its bounded HA HTTP
  session and SQLite reconciliation. Collection additions keep durable receipts
  and an explicit readback; an uncertain outcome is never automatically resent.
- The old bundled device API and its vendor/build tools are gone. Store scrapers
  remain in Companion and are included in the runtime package.
- The manifest still pins `pykaleidescape==1.1.6` to match HA 2026.10.4. That
  released package does **not** contain the capabilities used by this PoC. Tests
  load the adjacent patched pyk checkout. HA OS testing requires the operator to
  install the reviewed patched `kaleidescape` package overlay into
  `/config/deps/lib/python3.14/site-packages` before restarting HA. A normal HA
  dependency install alone will not supply this code. Do not treat the overlay
  as an upstream release or a reproducible production dependency.

HA OS discovery and status logs exposed a patched-pyk identity-read bug: the
protocol discovery list uses 12-digit serials, while `GET_DEVICE_INFO` returns
the same serial zero-padded to 16 digits. The new
`phase-03a-fresh-device-reads.patch` normalizes both to the same routed
identity, with an offline emulator regression test. The final
`08a-cmp-dev-version` branch labels the complete development build
`1.2.0.dev1+cmp` in both Python package metadata and pyk's runtime version. HA
OS validation still requires a fresh overlay from that final branch and a
restart. The existing overlay is not updated by changing this source checkout.

## Compatibility and upstream path

The patch series in the adjacent `pykaleidescape/patch/` directory adds focused
fixes and features, unit tests, optional player/server hardware tests, and
examples. Pyk's existing `Device` constructor, async methods, dispatcher, state
objects, reconnect behavior, Request subclass extension points, and ordinary
return values remain the hard compatibility contract. New public interfaces are
additive. The patched checkout reports version `1.2.0.dev1+cmp`, but the HA
shared dependency pin is 1.1.6; replacing metadata or changing the manifest
before an accepted compatible release would risk the built-in HA integration.

Before release: obtain upstream review and merge/release the needed patches;
verify built-in HA `kaleidescape` against that exact release; update the
Companion/HA dependency strategy together; remove the manual overlay; then
retest a clean install, reload, restart, backup and rollback. Upstream logging
privacy enhancements remain optional and require the pyk owner's approval.
Preserve Companion's native HA logging safeguards regardless.

The
[historical 206-request inventory](../../audit/PYK_COMMAND_INVENTORY_2026-11-03.md)
is a planning snapshot for future feature decisions, not a list of commands this
PoC claims to implement. Modern features may be expanded incrementally after
owned-hardware evidence. Legacy music, disc/vault and alternate framing remain
future possibilities, with no current hardware qualification path.

## Test strategy and concrete hardware runs

Normal checks use fictional fixtures and do not contact devices or the public
Store. Run `bash dev/dev.sh check` with the patched pyk checkout alongside this
repository. The optional tests in pyk's `tests/hardware_tests/` can be run by an
operator at the relevant patch phase with a player **or** a server; neither is
required for default CI. Record model/firmware, topology, patch commit, and
sanitized results. Start with read-only discovery/library queries, then selected
player controls and launch. Stop on identity or capability mismatch. Test
reconnect, interrupted replies, outcome uncertainty, and coexistence with HA's
built-in integration before claiming hardware support. Available owner hardware:
Strato K, Terra Compact 30 TB, and Terra Prime 120 TB; firmware is unrecorded.
No successful hardware run is claimed here.

For the Companion PoC, verify on an explicitly selected HA instance: setup,
Library catalog/details/artwork/collections, public Store metadata/search and
cover enrichment, discovery, read-only state, selected-player commands, title
launch, uncertain receipt reconciliation, options reload, and unload. Public
Store validation is separate Internet-provider qualification and stays in
Companion. A successful offline suite does not prove device or Store behavior.

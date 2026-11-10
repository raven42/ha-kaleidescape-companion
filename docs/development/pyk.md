# Pyk ownership and compatibility

Status: **temporary proof of concept**. Companion uses a privately namespaced
copy of patched pykaleidescape for device discovery, playback controls, title
launch, and local server browser reads/writes. This has offline test coverage,
but no hardware or HA OS validation of the bundled source. Earlier HA OS logs
exposed an identity-read bug now included in phase 03a; a successful hardware
retest is pending. This is not a supported release migration.

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
  sending a user command. Pause/unload closes owned clients after cancelling or
  draining in-flight reads; hardware qualification remains necessary.
- `library/sync.py` uses pyk `LocalLibrary` for catalog, collections, details,
  artwork, add forms and validated built-in removal/status-move forms. Companion
  retains its bounded HA HTTP session and SQLite reconciliation. Collection
  changes keep durable receipts and an explicit readback; an uncertain outcome
  is never automatically resent.
- Companion bundles the reviewed patched pyk source under its own namespace. The
  complete runtime diff reconstructs from a pinned offline upstream fixture,
  including collection APIs and the pre-submit callback; the normal check
  verifies all manifested bytes and the MIT license. See the
  [development guide](README.md) for independent base checks. Store scrapers
  remain in Companion and are included in the runtime package.
- The manifest requires `pykaleidescape>=1.2.0` to match the HA 2026.11.0
  baseline while allowing HA to provide a compatible newer release. The 1.2.0
  release does **not** contain the capabilities used by this PoC. Tests load the
  bundled patched pyk source. HA no longer adds `/config/deps` to its import
  path, so the former overlay cannot provide that code. The bundled package is
  not an upstream release; HA OS validation remains pending.

HA OS discovery and status logs exposed a patched-pyk identity-read bug: the
protocol discovery list uses 12-digit serials, while `GET_DEVICE_INFO` returns
the same serial zero-padded to 16 digits. The new
`phase-03a-fresh-device-reads.patch` normalizes both to the same routed
identity, with an offline emulator regression test. The final
`10a-cmp-dev-version` patch-series branch labels the complete development build
`1.2.0.dev1+cmp` in both Python package metadata and pyk's runtime version. HA
OS validation still requires deployment of the updated Companion package and a
restart. Changing this source checkout does not update HA OS.

## Compatibility and upstream path

The upstream patch series adds focused fixes and features, unit tests, optional
player/server hardware tests, and examples. The archived runtime base and full
patch in `scripts/assets/pyk-overlay/` make this project buildable and testable
without an adjacent pyk checkout. An upstream checkout is optional for
independent provenance comparison and upstream development. Pyk's existing
`Device` constructor, async methods, dispatcher, state objects, reconnect
behavior, Request subclass extension points, and ordinary return values remain
the hard compatibility contract. New public interfaces are additive. The patched
checkout reports version `1.2.0.dev1+cmp`, but the HA shared dependency pin is
1.2.0. Replacing the bundled copy with a released package requires upstream
acceptance and verification with the built-in HA integration.

The [roadmap](roadmap.md#next-delivery-gates) owns the accepted upstream,
compatibility and hardware milestones. A released replacement must preserve HA's
built-in integration as well as Companion's interfaces. Keep the runtime bundle
and its MIT notice until that separately qualified change. Upstream logging
privacy enhancements remain optional and require the pyk owner's approval;
preserve Companion's native logging safeguards regardless.

Modern capabilities may expand after hardware evidence. Legacy music, disc/vault
and alternate framing are deferred without applicable hardware and a concrete
use case. A historical command inventory is not a claim of implemented support.

## Test strategy and concrete hardware runs

Normal checks use fictional fixtures and do not contact devices or the public
Store. Run `scripts/check` with the bundled pyk source. The optional tests in
pyk's `tests/hardware_tests/` can be run by an operator at the relevant patch
phase with a player **or** a server; neither is required for default CI. Record
model/firmware, topology, patch commit, and sanitized results. Start with
read-only discovery/library queries, then selected player controls and launch.
Stop on identity or capability mismatch. Test reconnect, interrupted replies,
outcome uncertainty, and coexistence with HA's built-in integration before
claiming hardware support. Available owner hardware: Strato K, Terra Compact 30
TB, and Terra Prime 120 TB; firmware is unrecorded. No successful hardware run
is claimed here.

For the Companion PoC, verify on an explicitly selected HA instance: setup,
Library catalog/details/artwork/collections, public Store metadata/search and
cover enrichment, discovery, read-only state, selected-player commands, title
launch, uncertain receipt reconciliation, options reload, and unload. Public
Store validation is separate Internet-provider qualification and stays in
Companion. A successful offline suite does not prove device or Store behavior.

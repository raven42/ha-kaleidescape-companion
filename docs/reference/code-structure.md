# Code structure

Use this map to find the owner of a behavior before changing it. A source
checkout is enough for offline development after `scripts/setup`; neither a
neighboring pyk repository nor a household HA instance is required. The
[architecture](../development/architecture.md) explains the lifecycle and
ownership constraints behind this layout.

## Home Assistant entry points

Runtime code lives under
[`custom_components/kaleidescape_companion/`](../../custom_components/kaleidescape_companion/).
Its domain is `kaleidescape_companion`; HA's built-in `kaleidescape` integration
stays separate.

| Location                                                                                                         | What to look for                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`__init__.py`](../../custom_components/kaleidescape_companion/__init__.py)                                      | Setup, typed runtime ownership, task startup, reload/unload and cleanup                                    |
| [`config_flow.py`](../../custom_components/kaleidescape_companion/config_flow.py)                                | Single household entry and native options flow                                                             |
| [`manifest.json`](../../custom_components/kaleidescape_companion/manifest.json), `strings.json`, `translations/` | HA identity, dependency metadata and translated configuration labels                                       |
| `sensor.py`, `button.py`, `switch.py`, `services.py`                                                             | Entity registration, action admission and background-job requests                                          |
| `backup.py`, `diagnostics.py`                                                                                    | Backup coordination and bounded diagnostic projection                                                      |
| [`core/`](../../custom_components/kaleidescape_companion/core/)                                                  | Worker-owned SQLite repository, migrations, imports, settings, permissions and private data operations     |
| [`playback/`](../../custom_components/kaleidescape_companion/playback/)                                          | HA state observation, tracking/completion, manual viewing admission, recording and device-control outcomes |
| [`library/`](../../custom_components/kaleidescape_companion/library/)                                            | Local server transport/sync, identities, catalog/artwork, purchases, matching and collection queue         |
| [`calendar/`](../../custom_components/kaleidescape_companion/calendar/)                                          | Publication/export, dedicated-calendar reconciliation and uncertainty recovery                             |
| [`enrichment/`](../../custom_components/kaleidescape_companion/enrichment/)                                      | HA-owned metadata jobs, review drafts, source choices, cache and image handling                            |
| [`scrapers/`](../../custom_components/kaleidescape_companion/scrapers/)                                          | Standalone public Store/TMDB clients and parsers, independent of HA and repository code                    |
| [`ui/`](../../custom_components/kaleidescape_companion/ui/)                                                      | Authenticated HTTP/WebSocket surfaces, panel registration, preferences and blueprint management            |
| [`templates/`](../../custom_components/kaleidescape_companion/templates/)                                        | The five packaged automation blueprints and their version history                                          |
| [`vendor/`](../../custom_components/kaleidescape_companion/vendor/)                                              | The temporary privately namespaced patched pyk dependency and its notice                                   |

HA entry points stay at the integration root. SQL belongs to the repository's
single worker; frontend handlers and network tasks do not acquire independent
database connections. Durable intents and retry receipts belong to their
feature's transaction/recovery boundary. See
[Journal storage](../development/journal.md),
[data management](../development/data-management.md) and
[security](../development/security.md) before changing those contracts.

## Frontend source and packaged output

[`frontend/src/`](../../frontend/src/) contains the Lit sidebar, dashboard
cards, typed API client and feature views. Its `ui/` modules compose the panel
and shared controls; feature directories such as `library/`, `enrichment/` and
`playback/` own their respective interactions. Follow a call through
`frontend/src/core/api.ts` to the matching backend WebSocket/HTTP handler rather
than inferring authorization from a hidden control.

The runtime asset is
[`ui/assets/panel.js`](../../custom_components/kaleidescape_companion/ui/assets/panel.js).
Change source and use `scripts/build` to regenerate it. `scripts/check` verifies
a temporary build against the accepted bundle. Do not hand-edit the minified
bundle or import preview fixtures into production code.

`frontend/dev/` contains the loopback preview, fictional review pages and
packaging/verification helpers. `vite.config.mjs` owns the production build;
`vite.preview.config.mjs` owns the development proxy/server. Neither the preview
server nor Node is a dependency of installed HA runtime files.

## Tests, tools and maintained guidance

| Location                                   | Responsibility                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`tests/`](../../tests/)                   | Fictional integration/storage/lifecycle/API tests, fixtures and isolated package/deployment tests  |
| `tests/scrapers/`                          | Provider suite that runs independently of HA on its own Python matrix                              |
| [`frontend/tests/`](../../frontend/tests/) | Component, API, security and loopback proxy coverage; simulated DOM is not a real-browser review   |
| [`scripts/`](../../scripts/)               | Thin executable terminal commands shared by editor tasks and CI                                    |
| `scripts/src/`                             | Full tooling implementations, including checks, packaging, deployment and offline operator helpers |
| `scripts/config/`                          | Local HA configuration seed and fictional deployment example                                       |
| `scripts/assets/pyk-overlay/`              | Pinned upstream base, patch, hashes and license for offline pyk reconstruction                     |
| [`docs/development/`](../development/)     | Current contracts, testing/release instructions and the active roadmap                             |
| `artifacts/audits/<run-id>/`               | Ignored temporary audit output; dated evidence is archived privately                               |

A minimal orientation check from the repository root is:

```sh
scripts/setup
scripts/check-project
scripts/check-pyk --reconstruct
```

These validate project identity/links/layout and reconstruct the bundled pyk
source from repository inputs. For a full change, follow
[contribution setup](../development/README.md) and run `scripts/check`; a
focused check does not replace the complete gate. Tests and tools do not enter
the HA runtime package.

If a generated asset differs, inspect source and rebuild deliberately. If pyk
reconstruction fails, investigate the base/patch/hash mismatch rather than
changing the live HA dependency to make a check pass. The
[pyk contract](../development/pyk.md) owns compatibility and eventual bundle
removal. Code structure does not establish live hardware or provider support;
qualification remains separately recorded in the roadmap.

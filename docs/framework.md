# Kaleidescape framework status

The product name is **Kaleidescape**. `kaleidescape_companion` is an internal HA namespace needed to coexist with the built-in `kaleidescape` integration.

## Present

- Repository layout, editor settings, ignore rules, and version metadata.
- Custom integration manifest, shared constants, English setup strings, minimal config flow, setup/unload functions, and empty runtime container.
- Empty component boundaries for observation, journal, repository, migrations, API, panel, sensors, diagnostics, backups, library, artwork, and controls.
- TypeScript/Lit panel shell, local preview, TypeScript checks, reproducible dependency lockfile, and packaged ES module.
- Scaffold validation script and continuous-integration workflow.
- [Product plan](plan.md), [technical design](design.md), and [development guide](development.md).

## Deferred

No entity mapping, event listener, journal rule, SQLite schema, migration, library parser/client, network request, authentication policy, API route, sensor, HA panel registration, backup hook, or playback command is implemented. No movie data or credentials are embedded in the scaffold. Tests/fixtures have reserved locations rather than invented implementations or mock household results.

The design document remains a target specification. Code and names shown there describe future behavior unless listed above as present. Project scaffold creation does not mean Phase 1 foundations are complete.

## Publication prerequisites

Set the real project documentation/repository URLs and codeowners, choose a license, select and validate supported HA releases, run the real HA lifecycle/config-flow tests, and review the intended release contents. Preparatory HACS metadata is not a claim of catalog acceptance or a production-ready release.

# Contributing and development

The supported command wrappers work from any directory; the examples below use
the repository root. Development is supported on macOS and Linux with Bash.
Windows users need a compatible Linux environment; the `.venv/bin` commands are
not native Windows instructions. Read the [architecture](architecture.md),
[security policy](security.md) and the owning feature design before changing
behavior. The [roadmap](roadmap.md) tracks delivered/remaining product work; the
[pyk compatibility](pyk.md) defines the dependency and ownership contracts.

## Environment and checks

Requires Python 3.14.2+ with SQLite 3.35+, Node.js 22.13+ (22.x) or 24+, and
npm. Python dependencies are declared in `pyproject.toml`; frontend tooling uses
`frontend/package-lock.json`. The current development baseline is HA 2026.11.0
with pyk 1.2.0 in HA's manifest. This PoC tests its bundled patched pyk source,
whose new interfaces are not present in the released 1.2.0 package. This is not
yet a supported minimum HA version.

Both the Python distribution and private frontend package are named
`kaleidescape-companion`. The HA domain stays `kaleidescape_companion`; the
external device library remains `pykaleidescape`. Existing development
environments installed under the old editable name `kaleidescape` should remove
that distribution before rerunning setup. Do not remove `pykaleidescape` or HA's
built-in integration when updating the Companion package name.

```sh
scripts/setup
scripts/build
scripts/check
scripts/package
```

The Python tests and local HA launcher use the reviewed source at
`custom_components/kaleidescape_companion/vendor/kaleidescape`. They verify its
package files against `scripts/assets/pyk-overlay/hashes.json` before use. The
complete runtime patch in `scripts/assets/pyk-overlay/companion.patch` applies
to upstream base `50df2869349667d1e68d429b9b619e32ede9879b`. It includes the
reviewed local Device changes, collection removal/per-version reads, and the
operation-local pre-submit callback. `base.tar.gz` is an offline `git archive`
of that commit's `kaleidescape` and `LICENSE` paths; `base.json` records its
SHA-256 and origin. The patch copies the upstream MIT license into the private
runtime package. Reconstruction must match every entry in `hashes.json`,
including that license, and may not introduce undocumented Python modules. Only
runtime differences are included; upstream test configuration is outside this
bundle.

The normal `check` reconstructs from the pinned fixture without network access
or an adjacent checkout. To independently compare the fixture with an upstream
checkout's tracked commit, run:

```sh
.venv/bin/python scripts/src/check_pyk.py --reconstruct --base-checkout ../pykaleidescape
```

Working-tree changes in that checkout are ignored. When updating the bundle,
regenerate the complete runtime diff against the same recorded base (or
explicitly review a new base), update the manifest, and run both reconstruction
and the full check. Missing files and stale/incomplete patches fail
verification. `setup` installs HA's released pinned dependency separately. This
bundled source remains a PoC, with built-in Device compatibility and
upstream-release qualification still required.

Set `COMPANION_VENV` to an absolute virtual-environment path to run setup or
checks in an isolated environment; it defaults to `.venv` in this checkout.

The complete check validates workspace/runtime consistency, standalone provider
contracts, Python integration tests, project structure and documentation links,
Ruff lint/format, shell syntax, Markdown lint/format, frontend lint/format,
component/proxy tests, TypeScript and the production bundle. Tests use fictional
data and temporary storage. Some emulator/proxy tests bind loopback sockets;
checks do not contact household devices or external providers.

Focused checks, using the prepared virtual environment:

```sh
scripts/test --python-only
PYTHONPATH=custom_components/kaleidescape_companion .venv/bin/python -m unittest discover -s tests/scrapers
.venv/bin/python scripts/src/check_project.py
.venv/bin/ruff check .
.venv/bin/ruff format --check .
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run lint:markdown
npm --prefix frontend run format:docs:check
```

The direct wrappers share command definitions between the terminal, VS Code and
CI. `scripts/setup` creates `.venv`, installs `-e '.[dev,audit]'` with pip and
runs `npm ci`; it does not launch HA or deploy. `scripts/build` type-checks and
updates the tracked production panel. `scripts/check` compares a temporary build
with the accepted panel and fails on a mismatch without overwriting it. Run
Build deliberately when frontend sources change, inspect the generated diff, and
rerun Check before packaging.

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `scripts/setup`          | Prepare Python and frontend dependencies                   |
| `scripts/build`          | Type-check, compile and update packaged frontend assets    |
| `scripts/lint`           | Check Python, frontend and Markdown lint                   |
| `scripts/format`         | Apply Python, frontend and Markdown formatters             |
| `scripts/format --check` | Verify formatting without applying it                      |
| `scripts/test`           | Run provider, integration and frontend tests               |
| `scripts/check`          | Run the complete local validation gate                     |
| `scripts/package`        | Verify assets and produce the installable runtime artifact |

VS Code's Setup, Build, Lint, Format, Test, Check and Package tasks invoke these
same commands. No editor task defines additional correctness prerequisites.
Package does not run the full release gate; release publication requires Check
and the qualification work in [releasing](releasing.md). Dependency scans,
frontend preview and local HA remain separate operations. The explicitly labeled
maintainer composite runs Build, Check, Package, deploy and restart in sequence;
see [deployment](deployment.md) before selecting it.

See [testing](testing.md) for suite selection and validation limits. The
wrappers use normal `unittest` discovery and set Python's isolated-asyncio
slow-callback diagnostic threshold to 250 ms; direct `python -m unittest`
commands retain Python's default. Expected failure-injection warnings do not
imply test failure; inspect the process exit and suite summary. Logging behavior
is specified in [logging and diagnostics](logging.md).

The frontend lockfile temporarily overrides transitive minimatch 10 with 11.0.4
for
[GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
This affects development tooling, not the production bundle. ESLint,
`@eslint/config-array` and `@typescript-eslint/typescript-estree` still declare
10.x ranges; the override is a tested compatibility exception.

Remove the override only when all three dependency paths support an unaffected
minimatch release within their declared ranges. Review the published package
metadata (not only upstream's unreleased branch), regenerate the lockfile, and
confirm `npm ls minimatch --all` contains no affected or invalid resolution.
Then run fresh `scripts/dependency-audit` scans and the full `scripts/check`,
including actual ESLint, Markdown, TypeScript, security/component and production
build commands. Reassess at each tooling upgrade and before release. Do not
force npm's downgrade suggestions or remove the override solely to simplify the
tree.

Network advisory scans are deliberately separate:

```sh
scripts/dependency-audit
```

Record audit versions and assess findings for the actual release target. An old
advisory count must not be copied forward as a current assertion. Keep command
results, dependency versions, limitations and dispositions in a dated audit; see
the [audit procedure](auditing.md). An offline check does not certify dependency
safety.

## Local HA and frontend preview

Run in separate terminals:

```sh
scripts/ha  # http://127.0.0.1:8123
scripts/preview  # http://127.0.0.1:5173
```

The HA launcher creates ignored private `.ha-dev/`, links this integration and
copies `scripts/config/ha-development.yaml` only if no configuration exists. It
refuses to overwrite an unexpected component target. Complete HA onboarding, add
**Kaleidescape Companion** through Devices & services, and open
`/kaleidescape-companion`. Keep the built-in Kaleidescape integration for actual
observation. A manual journal alone needs no player connection.

The local HA launcher uses the same verified bundled source as the tests. HA OS
deployment and hardware validation of the bundled package remain pending.

The HA panel uses the signed-in session. Standalone Vite uses a memory-only
token from the development HA instance and a restricted local proxy; no wildcard
CORS or production HA HTTP exception is needed. Keep both servers on loopback
and use development credentials. The proxy is development code, never runtime
code.

For disconnected fictional review, open:

- `http://127.0.0.1:5173/review.html`
- `http://127.0.0.1:5173/review.html?library=1&companion_page=library`
- `http://127.0.0.1:5173/review.html?settings=1&companion_page=settings`
- `http://127.0.0.1:5173/review.html?collection=1&companion_page=library`

The Settings fixture includes fictional outdated, modified and missing
blueprints and a saved-credential indicator for reviewing the update and removal
workflows. Fixtures live only in page memory and reset on reload; no actual
credential is present. They do not prove durable HA behavior. Operator browser
review should cover both roles, layout widths, keyboard/focus, retries/drafts,
settings persistence and feature-specific recovery. Automated component tests
run independently; do not automate a real browser for UI review under this
project's workflow.

## Implementation conventions

Keep HA entry points at the integration root, runtime code in feature packages,
and tools in `scripts/src/` or `frontend/dev/`. Production frontend code cannot
import fixtures/development sources. `scrapers/` owns reusable pure parsers and
injected async provider clients, independent of HA/storage/tooling. SQL stays on
the repository worker. Use typed config-entry runtime data, HA configuration and
permissions, managed session helpers and native module loggers.

Use HA states for observation; do not access another integration's private
runtime objects. Preserve entity IDs and existing household data through
migration. Pyk changes must maintain Device lifecycle, method/return and event
contracts. Protocol/library changes and Companion adaptation have distinct
release gates in the roadmap and pyk compatibility contract.

Write focused regression tests for changed boundaries/behavior, especially
uncertainty, cancellation, stale state and recovery. Test privacy with fictional
sentinels at DEBUG and exception/framework boundaries. Do not check in household
exports, saved purchase HTML, secrets, raw frames or hardware addresses.

## Library performance

`scripts/src/benchmark_library.py` builds fictional catalogs and measures local
browsing and distinct-credit search without fetching artwork or contacting
hardware. Inspect `--help` for supported sizes/options. Keep CPU/database
timings separate from DOM/render/image memory and real-source sync timing. “All”
browsing remains bounded, not virtualized or unlimited. The
[Library design](library.md#performance-checks) owns current bounds.

`scripts/src/benchmark_title_matching.py` evaluates candidate matching
separately; use fictional data for shared results. Private operator exports can
be evaluated locally using the [matching guide](title-matching.md), but never
copied into tests. Record environment, size and method with benchmark claims.

## Hardware and release validation

No live test, provider lookup, device mutation, deploy or restart runs as part
of normal checks. Use a separately authorized hardware profile/runner excluded
from CI. Available hardware is Strato K, Terra Server Compact 30 TB and Terra
Server Prime 120 TB; record firmware/topology before qualification. The
[migration test strategy](pyk.md#test-strategy-and-concrete-hardware-runs)
orders read, control, fault-recovery and HA-coexistence tests and defines
sanitized evidence. Skipped cases are not passes.

Use [deployment](deployment.md) for packaging, target configuration,
configuration checks and rollback. A build does not deploy, a code upload does
not restart HA, and a successful restart command does not prove integration
health. The [roadmap](roadmap.md#release-readiness) owns release-readiness work
rather than repeating it in every feature guide.

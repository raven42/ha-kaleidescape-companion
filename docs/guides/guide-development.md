# Development and validation

Work from the repository root. Read the
[architecture](../design/design-architecture.md),
[security policy](../policies/policy-security.md) and the owning feature design
before changing behavior. The [roadmap](../plans/plan-roadmap.md) tracks
delivered/remaining product work; the
[pyk plan](../plans/plan-pykaliedescape-migration.md) tracks migration.

## Environment and checks

Requires Python 3.14.2+ with SQLite 3.35+, Node.js 22.13+ (22.x) or 24+, and
npm. Python dependencies are declared in `pyproject.toml`; frontend tooling uses
`frontend/package-lock.json`. The current development baseline is HA 2026.11.0
with pyk 1.2.0 in HA's manifest. This PoC tests its bundled patched pyk source,
whose new interfaces are not present in the released 1.2.0 package. This is not
yet a supported minimum HA version.

```sh
bash dev/dev.sh setup
bash dev/dev.sh check
```

The Python tests and local HA launcher use the reviewed source at
`custom_components/kaleidescape_companion/vendor/kaleidescape`. They verify its
package files against `dev/pyk-overlay/hashes.json` before use. The bundled
patch records the runtime portion of reviewed local commit
`bfbe789ffaf297f4aad7d1ac64328796456b4ed2` against the stated upstream base; its
base is `50df2869349667d1e68d429b9b619e32ede9879b`, and its MIT license ships
with the private package. `setup` installs HA's released pinned dependency
separately. The bundled source is for this PoC and is not a replacement for
compatibility testing with the built-in integration.

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
bash dev/dev.sh python-test
PYTHONPATH=custom_components/kaleidescape_companion .venv/bin/python -m unittest discover -s tests/scrapers
.venv/bin/python dev/check_project.py
.venv/bin/ruff check .
.venv/bin/ruff format --check .
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run lint:markdown
npm --prefix frontend run format:docs:check
```

Use `npm --prefix frontend run format:docs` to format Markdown. The source of
truth for task composition is `dev/dev.sh` and `.vscode/tasks.json`; focused
checks do not replace a required full check for an implementation change. The VS
Code **Test Python** task and CI verify the bundled source. Expected warnings
from failure-injection cases do not mean compilation failed; inspect the process
exit and test summary. Unexpected frontend console output is tested separately.
The integration-test runner keeps asyncio debug mode enabled but reports slow
callbacks after 200 ms instead of the default 100 ms, to reduce fixture and CI
scheduling noise. Direct `python -m unittest` runs use Python's default 100 ms
threshold. This adjustment does not change Home Assistant or production event
loops. Logging behavior is specified in
[logging and diagnostics](../design/design-logging.md).

The frontend lockfile temporarily overrides transitive minimatch 10 with 11.0.4
for the glob amplification advisory. ESLint and TypeScript tooling still declare
the 10.x range; the project checks exercise the override, but it is outside
those packages' declared dependency ranges. Reassess it when those tools adopt a
fixed version. This affects development tooling, not the production bundle.

Network advisory scans are deliberately separate:

```sh
bash dev/dev.sh audit
```

Record audit versions and assess findings for the actual release target. An old
advisory count must not be copied forward as a current assertion. Keep command
results, dependency versions, limitations and dispositions in a dated audit; see
the [audit index and procedure](../../audit/README.md). An offline check does
not certify dependency safety.

## Local HA and frontend preview

Run in separate terminals:

```sh
bash dev/dev.sh ha  # http://127.0.0.1:8123
bash dev/dev.sh preview  # http://127.0.0.1:5173
```

The HA launcher creates ignored private `.ha-dev/`, links this integration and
copies `dev/ha-development.yaml` only if no configuration exists. It refuses to
overwrite an unexpected component target. Complete HA onboarding, add
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

Fixtures live only in page memory and reset on reload. They do not prove durable
HA behavior. Operator browser review should cover both roles, layout widths,
keyboard/focus, retries/drafts, settings persistence and feature-specific
recovery. Automated component tests run independently; do not automate a real
browser for UI review under this project's workflow.

## Implementation conventions

Keep HA entry points at the integration root, runtime code in feature packages,
and tools in `dev/` or `frontend/dev/`. Production frontend code cannot import
fixtures/development sources. `scrapers/` owns reusable pure parsers and
injected async provider clients, independent of HA/storage/tooling. SQL stays on
the repository worker. Use typed config-entry runtime data, HA configuration and
permissions, managed session helpers and native module loggers.

Use HA states for observation; do not access another integration's private
runtime objects. Preserve entity IDs and existing household data through
migration. Pyk changes must maintain Device lifecycle, method/return and event
contracts. Protocol/library changes and Companion adaptation have distinct
release gates in the migration plan.

Write focused regression tests for changed boundaries/behavior, especially
uncertainty, cancellation, stale state and recovery. Test privacy with fictional
sentinels at DEBUG and exception/framework boundaries. Do not check in household
exports, saved purchase HTML, secrets, raw frames or hardware addresses.

## Library performance

`dev/benchmark_library.py` builds fictional catalogs and measures local browsing
and distinct-credit search without fetching artwork or contacting hardware.
Inspect `--help` for supported sizes/options. Keep CPU/database timings separate
from DOM/render/image memory and real-source sync timing. “All” browsing remains
bounded, not virtualized or unlimited. The
[Library design](../design/design-library.md#performance-checks) owns current
bounds.

`dev/benchmark_title_matching.py` evaluates candidate matching separately; use
fictional data for shared results. Private operator exports can be evaluated
locally using the [matching guide](../design/design-title-matching.md), but
never copied into tests. Record environment, size and method with benchmark
claims.

## Hardware and release validation

No live test, provider lookup, device mutation, deploy or restart runs as part
of normal checks. Use a separately authorized hardware profile/runner excluded
from CI. Available hardware is Strato K, Terra Server Compact 30 TB and Terra
Server Prime 120 TB; record firmware/topology before qualification. The
[migration test strategy](../plans/plan-pykaliedescape-migration.md#test-strategy-and-concrete-hardware-runs)
orders read, control, fault-recovery and HA-coexistence tests and defines
sanitized evidence. Skipped cases are not passes.

Use [deployment](guide-deployment.md) for packaging, target configuration,
configuration checks and rollback. A build does not deploy, a code upload does
not restart HA, and a successful restart command does not prove integration
health. The [roadmap](../plans/plan-roadmap.md#release-readiness) owns
release-readiness work rather than repeating it in every feature guide.

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
`frontend/package-lock.json`. The current development baseline is HA 2026.10.4
with pyk 1.1.6 in HA's manifest. This PoC tests against the adjacent patched pyk
checkout, whose new interfaces are not present in the released 1.1.6 package.
This is not yet a supported minimum HA version.

```sh
bash dev/dev.sh setup
bash dev/dev.sh check
```

The setup/check scripts currently assume the prepared multi-repository developer
workspace. `check` requires `../pykaleidescape` with the reviewed patch series
applied and sets `PYTHONPATH` for offline tests. `setup` alone installs the
released HA-pinned package, which lacks the PoC interfaces. A standalone
clean-checkout workflow is a migration release gate. The shared HA dependency
must remain compatible with the built-in integration.

The complete check validates workspace/runtime consistency, standalone provider
contracts, Python integration tests, project structure and documentation links,
Ruff lint/format, shell syntax, Markdown lint/format, frontend lint/format,
component/proxy tests, TypeScript and the production bundle. Tests use fictional
data and temporary storage. Some emulator/proxy tests bind loopback sockets;
checks do not contact household devices or external providers.

Focused checks, using the prepared virtual environment:

```sh
PYTHONPATH=../pykaleidescape .venv/bin/python -m unittest discover -s tests
PYTHONPATH=../pykaleidescape:custom_components/kaleidescape_companion .venv/bin/python -m unittest discover -s tests/scrapers
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
checks do not replace a required full check for an implementation change.
Expected warnings from failure-injection cases do not mean compilation failed;
inspect the process exit and test summary. Unexpected frontend console output is
tested separately. Logging behavior is specified in
[logging and diagnostics](../design/design-logging.md).

Network advisory scans are deliberately separate:

```sh
bash dev/dev.sh audit
```

Record audit versions and assess findings for the actual release target. An old
advisory count must not be copied forward as a current assertion. This
documentation cleanup did not run an audit or certify dependency safety.

## Local HA and frontend preview

Run in separate terminals:

```sh
PYTHONPATH=../pykaleidescape bash dev/dev.sh ha  # http://127.0.0.1:8123
bash dev/dev.sh preview  # http://127.0.0.1:5173
```

The HA launcher creates ignored private `.ha-dev/`, links this integration and
copies `dev/ha-development.yaml` only if no configuration exists. It refuses to
overwrite an unexpected component target. Complete HA onboarding, add
**Kaleidescape Companion** through Devices & services, and open
`/kaleidescape-companion`. Keep the built-in Kaleidescape integration for actual
observation. A manual journal alone needs no player connection.

The explicit `PYTHONPATH` above is required for the current local PoC: the HA
launcher does not add the patched source itself. Run from this repository root
with the reviewed adjacent checkout present. This local environment setting does
not install or update the separate HA OS overlay.

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

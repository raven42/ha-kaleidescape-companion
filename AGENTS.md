# Development instructions

Read [security policy](docs/policies/policy-security.md) before changing
authentication, APIs, storage, exports, networking, imports, or frontend
rendering. Its trust boundaries and hardening rules apply to all future
development. Update the policy and add regression tests when changing a
boundary; document remaining limitations honestly.

Preserve the built-in `kaleidescape` integration. This project's domain is
`kaleidescape_companion`. Use the [documentation index](docs/README.md) for
topic ownership and current implementation status. Follow
[the roadmap](docs/plans/plan-roadmap.md) and
[pyk migration plan](docs/plans/plan-pykaliedescape-migration.md) for planned
work.

Keep HA-discovered entry points at the integration root. Put runtime internals
in its `core/`, `library/`, `playback/` and `ui/` packages; add feature modules
when their behavior is implemented. Future device integration must use pyk's
public Device workflow and preserve its compatibility contract; the migration
plan governs scope, sequencing and release gates. Do not borrow the built-in
integration's private runtime or replace HA's shared pyk pin incompatibly. The
integration's `scrapers/` package owns provider parsers and client code; keep it
independent of HA, integration internals and development tools. Root `dev/` and
`frontend/dev/` contain development tools only. The production UI must not
import development code or test fixtures. Keep SQL on the repository's single
worker.

Use isolated instances and fictional data for development/testing; deployment
may target an operator-selected household instance. Keep household data and
credentials out of source, fixtures, and bundles. Device-control tests and
deployment require explicit user authorization; normal checks must not contact
devices.

Run `bash dev/dev.sh check` for relevant code changes. Keep documentation
generic about installing Python and Node; state required versions without
platform-specific package-manager instructions.

For UI testing that requires a real browser, ask the user to review the concrete
UI and report results. Provide the URL or navigation steps and a short list of
behaviors/layouts to check. Run automated component and API tests independently;
do not launch or automate a real browser for UI review. Clearly distinguish
automated test results from user browser review that is still pending.

# Development instructions

Read [docs/security.md](docs/security.md) before changing authentication, APIs,
storage, exports, networking, imports, or frontend rendering. Its trust boundaries
and hardening rules apply to all future development. Update the policy and add
regression tests when changing a boundary; document remaining limitations honestly.

Preserve the built-in `kaleidescape` integration. This project's domain is
`kaleidescape_companion`. Follow the phase order and current implementation status
in [docs/development.md](docs/development.md) and [docs/framework.md](docs/framework.md).

Use isolated instances and fictional data. Keep household data and credentials
out of source, fixtures, logs, and bundles. Device-control tests and deployment
require explicit user authorization; normal checks must not contact devices.

Run `bash scripts/dev.sh check` for relevant code changes. Keep documentation
generic about installing Python and Node; state required versions without
platform-specific package-manager instructions.

For UI testing that requires a real browser, ask the user to review the concrete
UI and report results. Provide the URL or navigation steps and a short list of
behaviors/layouts to check. Run automated component and API tests independently;
do not launch or automate a real browser for UI review. Clearly distinguish
automated test results from user browser review that is still pending.

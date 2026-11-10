# Development instructions

Follow [CONTRIBUTING.md](CONTRIBUTING.md) and the
[development guide](docs/development/README.md). Read the
[architecture](docs/development/architecture.md),
[security guide](docs/development/security.md) and owning feature document
before changing authentication, APIs, storage, imports/exports, networking or
rendering. Update the contract and relevant regression coverage when a boundary
changes. The [roadmap](docs/development/roadmap.md) owns active work;
[pyk compatibility](docs/development/pyk.md) governs the temporary runtime
bundle.

On macOS or Linux with Bash, Python 3.14.2+ and Node.js 22.13+ on 22.x or 24+:

```sh
scripts/setup
scripts/build
scripts/test
scripts/check
scripts/package
```

Setup installs `.[dev,audit]` and frontend dependencies. VS Code tasks and CI
call the same wrappers. Build intentionally updates generated assets; inspect
their diff and run Check before packaging. Check must verify the accepted bundle
without silently replacing it. Update these instructions when commands or
prerequisites change. Keep Python/Node installation guidance generic.

Preserve HA's built-in `kaleidescape` integration; this domain is
`kaleidescape_companion`. Keep SQL on the single repository worker and providers
independent of HA/storage/tooling. Runtime code must not import `scripts/`,
`frontend/dev/` or fixtures. Preserve pyk's public Device workflow and HA's
shared dependency compatibility.

Use fictional data and isolated tests. Keep credentials and household data out
of source, fixtures and packages. Normal checks must not contact devices.
Device-control tests and deployment require explicit user authorization.

For real-browser UI review, ask the user to inspect the concrete UI and provide
the URL/navigation and a short behavior/layout checklist. Run automated
component/API tests independently; do not launch or automate a real browser.
Distinguish automated results from pending operator review. Use the
[audit procedure](docs/development/auditing.md) for private dated evidence.

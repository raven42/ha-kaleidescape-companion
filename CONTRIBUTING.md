# Contributing

Read the [development guide](docs/development/README.md) for supported tools,
setup and commands. The [architecture](docs/development/architecture.md) maps
ownership, the [security guide](docs/development/security.md) defines trust
boundaries, and the [roadmap](docs/development/roadmap.md) owns active work.
Read the feature's owning document before changing its contract.

```sh
scripts/setup
scripts/build
scripts/check
scripts/package
```

Setup uses standard venv/pip and npm. Build intentionally updates the packaged
frontend; inspect that generated diff. Check verifies generated assets without
accepting a replacement. The same wrappers power VS Code tasks and CI. See
[testing](docs/development/testing.md) for focused commands and validation
limits, and [releasing](docs/development/releasing.md) for the publication gate.

Keep changes focused and add regression coverage for changed behavior and trust
boundaries. Preserve household identities, worker-owned SQL, HA lifecycle and
durable uncertainty recovery. Use fictional fixtures and isolated temporary
storage. Normal checks must not contact devices, live providers or household
databases. Device actions and deployment require explicitly selected scope.

Update maintained documentation with behavior changes. New dated audit output
belongs in ignored `artifacts/audits/<run-id>/` or a private external directory;
follow the [audit procedure](docs/development/auditing.md) and promote useful
findings into tests, the roadmap or the owning guide. Do not add credentials,
household exports, machine-specific configuration or raw audit evidence to a PR.

PR descriptions should explain the problem, resulting behavior, validation and
remaining limits. Automated checks do not establish native HA, real browser,
device, provider or backup/restore qualification; report those separately.

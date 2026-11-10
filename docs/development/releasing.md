# Preparing a release

Companion is preparing for alpha and has no supported public release yet.
`0.1.0-dev.0` is the current development version. The project license, supported
HA matrix, security-reporting channel and final distribution policy remain
explicit decisions in the [roadmap](roadmap.md#release-readiness). The bundled
pyk MIT notice licenses that dependency only.

## Build and inspect the candidate

Use a fresh checkout with only its declared prerequisites and no neighboring
repositories, globally installed project tools or household data:

```sh
scripts/setup
scripts/build
scripts/check
scripts/package
```

Check version agreement across Python project metadata, integration manifest,
runtime constants, frontend manifest and lockfile. Review the generated panel
diff from Build; Check must reproduce it. Package verifies required assets and
writes `dist/kaleidescape-companion.tar.gz`, a SHA-256 sidecar and a provenance
sidecar. Preserve these together. Inspect the runtime contents, templates,
translations, branding, vendored files and license notice, and test installation
of the actual prepared artifact.

The current distribution model keeps compiled `panel.js` and the complete
integration folder in source. The maintainer tar archive is useful for testing
and deployment; it is not automatically a HACS ZIP release. A future release
asset format must match the selected installation method. Python wheels and
sdists do not replace an installable HA custom integration.

## Complete the release gate

Run current dependency scans and assess actual runtime/development exposure.
Complete the declared native HA, migration/restore, operator-browser,
device/provider and calendar acceptance in the roadmap. Keep the current pyk
bundle until its upstream/compatibility change is independently qualified.
Remove temporary sensitive receipt diagnostics before broad alpha distribution.
Do not describe untested environments or skipped cases as supported.

Prepare accurate alpha limitations, upgrade/rollback instructions and release
notes without inventing earlier releases. Producing an artifact does not publish
it.

Optional [SSH deployment](deployment.md) consumes the exact prepared artifact;
deployment and restart remain separate maintainer operations. File rollback is
not database rollback. A successful command does not prove the integration
started or the database restored correctly.

## History cutover

The report-filtering rehearsal is separate from release validation. Preserve the
original bundle, audit files, commit ledger and mappings privately. Verify an
independent backup before removing original history. Before changing shared
refs, recheck live refs and PRs, review exact updates and rollback, and execute
only within the authorized scope. Validate a fresh remote clone afterward and
avoid merging the old ancestry back. Do not publish recovery refs or original
archive bundles.

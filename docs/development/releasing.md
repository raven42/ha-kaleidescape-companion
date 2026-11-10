# Preparing a release

Companion is preparing for alpha and has no supported public release yet.
`0.5.0-alpha` is the current alpha candidate. Original Companion code is
Apache-2.0 licensed; [NOTICE](../../NOTICE) identifies retained third-party
material, including the bundled pyk dependency under its own MIT license.
Supported HA releases, a security-reporting channel and HACS qualification
remain explicit release gates in the [roadmap](roadmap.md#release-readiness).

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
and deployment; it is not automatically a HACS ZIP release. Python wheels and
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

## Validate on GitHub

The manually started **Release candidate validation** workflow reuses the full
framework checks (including the provider Python matrix), runs the upstream
[hassfest action](https://contributors.home-assistant.io/blog/2020/04/16/hassfest/)
and [HACS integration validator](https://hacs.xyz/docs/publish/action/), then
packages and inspects the candidate. All jobs must pass before its runtime
archive, checksum and provenance are uploaded as a short-lived workflow
artifact. No repository write permission, tag creation, release publication,
deployment or PR comment is part of this workflow.

Hassfest validates integration metadata in the selected checkout. HACS checks
hosted repository/distribution readiness using its event and release-selection
rules; it is not a replacement for checking the packaged bytes from this commit.
No HACS checks are ignored. Licensing and repository metadata that remain
undecided can fail that gate and must be resolved before claiming distribution
readiness. These validators do not qualify runtime behavior or hardware.

Run the workflow on the intended candidate after it is available on GitHub and
retain the successful run URL with release evidence. Local syntax validation of
the workflow is not a hosted validator pass. Review the actual artifact and
current qualification evidence before a separately authorized alpha prerelease.

## Publish a tagged release

After every release gate is satisfied, push a tag exactly matching the candidate
version, for example `v0.5.0-alpha`. The **Publish tagged release** workflow
checks that match, runs framework checks, hassfest, HACS validation and the
runtime package inspection. It then creates the GitHub Release and attaches:

- `kaleidescape-companion.tar.gz` — the deployable Home Assistant integration;
- its SHA-256 checksum; and
- its provenance JSON.

GitHub also supplies its standard source ZIP and tarball automatically for the
same tag. Hyphenated versions such as `0.5.0-alpha` are marked prereleases. Do
not create the GitHub Release separately: pushing the verified tag is the
publication action. A failed workflow creates no release or release assets.

Optional [SSH deployment](deployment.md) consumes the exact prepared artifact;
deployment and restart remain separate maintainer operations. File rollback is
not database rollback. A successful command does not prove the integration
started or the database restored correctly.

## History cutover

The local report-history rewrite is complete; publication remains separate from
release validation. Original bundles, audit files, commit ledgers and mappings
remain private, with restore-tested local copies. Off-device backup assurance
has not been verified. Keep that recovery history and do not prune it merely
because the maintained branch has been filtered.

Before changing shared refs, recheck live refs and PRs, review exact updates and
rollback, and execute only within the authorized scope. At the local cutover,
the hosted main and Dependabot branches predated the removed reports, so no
remote history replacement was needed; the cleaned main can be published by
ordinary fast-forward if that relationship remains true. Validate a fresh remote
clone afterward and avoid merging old report-bearing ancestry back. Do not
publish recovery refs or original archive bundles.

# Security policy and hardening

This policy governs current and future development. Changes to access, storage,
networking, imports, exports, or frontend rendering must preserve these rules and
include tests for the affected boundary. This is a maintained security baseline,
not a claim of independent security certification.

## Trust boundaries

| Boundary | Policy and limitation |
| --- | --- |
| Browser → integration API | Use HA authentication and server-side authorization for every operation. Current journal access, Now Playing, and exports require an active administrator. Dataset IDs select data; they are not credentials. |
| Integration → HA | Custom integrations execute in Core's process with Core's filesystem, entity, credential, and network access. Entity selection is application behavior, not a sandbox. Other code running as HA can read this database. |
| HA users → one another | HA treats authenticated users as trusted. Our administrator checks reduce exposure of our endpoints, but HA roles are not strong isolation between hostile users. Sharing requires an explicit read/edit/export policy and server-side tests before implementation. |
| HA → devices and services | Current observation reads selected HA entity states and sends no device requests or controls. Future connectors may contact only configured destinations using explicitly supported operations. |
| Device/imported data → storage and UI | Treat metadata, notes, HTML, image references, and imported files as untrusted, including data from local devices. Validate before storing or using it, and render text without executing markup. |
| Storage → filesystem and exports | Journal contents, source identifiers, audit actors, backups, and retry responses are private household data. Keep them outside static web roots and access them through the authenticated API. |

The integration does not add its own web server, database listener, identity
system, or general-purpose HA action/SQL/file proxy. Compiled panel assets may be
public; they must contain no credentials or household records.

If containment from compromised integration code becomes a requirement, use a
separate unprivileged process/container with its own storage, restricted network
access, and a narrow message interface. A full HA administrator token or an HA
configuration-directory mount would undermine that separation. Selecting a web
framework alone does not establish isolation.

## Implemented backend protections

- WebSocket commands and HTTP downloads share an active-administrator check,
  applied before storage access and again before returning private data.
- Entry/dataset scoping is validated on every request. Schemas reject unexpected
  fields, and record validation bounds lengths, numbers, dates, and result pages.
- SQLite values use parameters. Database paths and SQL identifiers are internal;
  callers cannot supply arbitrary paths, SQL, or HA actions.
- The dedicated storage directory uses owner-only access (`0700`) and managed
  files use `0600`. Existing files are tightened when storage opens, including
  migration backups and SQLite sidecars. Managed symlinks and hard-linked files
  are rejected. These protections require filesystem permission support; they
  do not isolate code running as the same operating-system user.
- Export snapshots live in a private directory under journal storage. Only one
  HTTP export per loaded repository may be prepared or streamed at a time.
  Snapshots are size bounded, downloads have a time budget, and temporary files
  are removed on completion, failure, disconnect, and cancellation. Leftovers
  from a crashed process are removed on the next open.
  Preparation has a 30-second budget and a download has a 60-second budget;
  cleanup must wait for accepted filesystem work and can outlast cancellation.
- Database growth is capped at 256 MiB of SQLite pages. Existing larger files
  remain readable without permitting further page growth. Export snapshots are
  capped at 256 MiB. The write queue remains bounded at 128 operations and source
  observations at 256. These are resource limits, not a complete denial-of-service
  defense against an administrator or compromised HA process.
- Schema 3 records manual mutation audit metadata transactionally: authenticated
  HA user ID, operation, request/viewing IDs, revisions, and time. It stores no
  additional title, note, credential, or before/after content. Retries do not
  create duplicate audit events. Historical actors cannot be reconstructed.
- API storage errors contain safe messages. Diagnostics contain health metadata,
  not journal content, actor IDs, source addresses, credentials, or file paths.

File protection errors fail storage setup rather than silently accepting a
publicly accessible journal. Permissions are applied only to integration-owned
storage, not the entire HA configuration tree. The HA configuration directory
and its ancestors must themselves be controlled by the HA operator. Run only one
HA process against a journal directory.

## Development and frontend hardening

1. Use an isolated HA instance, development accounts, and fictional data. The
   supplied launcher and Vite configuration bind to loopback. Keep discovery and
   household credentials out of the development instance. Existing local YAML
   is retained: verify its bind address when reusing an older configuration.
2. Keep `.ha-dev/`, `.env*`, databases, exports, tokens, device snapshots, and
   private logs out of Git. Ignoring a file does not protect it on disk. The HA
   launcher uses restrictive creation permissions and a private `.ha-dev/`.
3. Production panels use HA's signed-in connection. A development API adapter
   must authenticate explicitly with development credentials. A proxy is routing,
   not authentication. Never inject a privileged bearer token into arbitrary
   proxied requests or embed it in source, URLs, bundles, or browser environment
   variables. HA user tokens are not journal-scoped credentials.
4. Vite custom environment-variable exposure is disabled. Keep explicit host
   restrictions, CORS disabled for the standalone shell, strict filesystem
   serving, and fixed ports. Any future API/WebSocket proxy needs a fixed target
   and origin checks; do not bypass them by rewriting WebSocket origins.
5. Render imported strings through Lit text bindings. Avoid `unsafeHTML`, script
   URLs, remote executable assets, and broad HTML sanitization exceptions.
   Validate image/link protocols and destinations when those features arrive.
   Serve the compiled bundle through HA in production; Vite is a development tool.

## Future connectors, controls, and sharing

- Use HA's shared HTTP client, certificate verification, bounded timeouts,
  response sizes, concurrency, and retry backoff. Restrict destinations and
  redirects to the configured device. Local-device addresses are legitimate;
  arbitrary client-supplied fetch URLs are not.
- Keep library synchronization read-only. Playback requires an explicit user
  action, a configured player, a supported operation, and server-side permission
  checks. Do not expose raw protocol or general HA service forwarding.
- Store necessary device credentials in HA config entries and redact them from
  errors, diagnostics, logs, and exports. Do not assume config-entry storage is
  encrypted or inaccessible to other HA code.
- Define household read/edit/export/control capabilities before adding sharing.
  Check relevant entity permissions as well as journal permissions. Subscriptions
  must stop releasing data when access is revoked or their entry unloads.
- Imports must validate size, schema, paths, identifiers, and content before
  applying transactional changes. A permanent-purge feature must cover sessions,
  retry responses, and audit references as well as the visible viewing.

## Operator procedures

### Install and update

Use a maintained HA release, review custom integration sources and dependency
changes, and protect HA accounts with strong authentication. Use HA's supported
secure remote-access configuration when needed. Restrict host/network access to
the devices HA needs. Stronger component-specific egress restrictions require a
separate process. Review [HA's deployment guidance](https://www.home-assistant.io/docs/configuration/securing/).
Apply security updates to the supported Python interpreter and its package
installer as well; updating this integration does not update either of them.

Install dependencies from `pyproject.toml` and `frontend/package-lock.json`.
Run `bash scripts/dev.sh check` before merging. Review dependency update PRs and
upstream advisories; use `npm --prefix frontend audit` for frontend dependencies
and `pip-audit` for the resolved Python development environment. Install the
optional audit tool with `python -m pip install -e '.[dev,audit]'`, then run
`bash scripts/dev.sh audit` or the VS Code **Audit dependencies (network)** task.
The command checks both ecosystems and exits nonzero if either scan fails.
Dependabot configuration requests weekly Python, npm, and CI-action updates when
enabled on the hosting repository. Audit results require assessment and fixes;
a successful build is not a vulnerability scan. Runtime HA dependencies remain
HA-managed; this integration currently declares no additional Python libraries.

### Known dependency findings (2026-10-25)

The installed HA 2026.10.2 environment audit identified affected `uv` 0.12.23
and Pillow 12.3.0. The development baseline is updated to HA 2026.10.4, which
pins `uv` 0.13.5, covering the advisory's minimum fix of 0.13.4. This does not
update a separately installed HA instance or a Python interpreter's own CA store.
See the [uv advisory](https://github.com/astral-sh/uv/security/advisories/GHSA-hq85-5cpj-mr62).

**Release blocker:** HA 2026.10.4 still pins Pillow 12.3.0. The audit reports
image-decoding vulnerabilities fixed in Pillow 13.0.0, including potential code
execution. This integration currently performs no image decoding, but that does
not establish that the wider HA process cannot reach the affected code. Keep
development isolated; do not declare the dependency audit clean or publish a
hardened release with this finding unresolved. Recheck a maintained HA release
that adopts the fixes, update the development baseline, and rerun audits and
compatibility checks. Do not force an incompatible Pillow version over HA's pins
or suppress the advisories to make an audit pass.
See [HA's dependency pins](https://raw.githubusercontent.com/home-assistant/core/2026.10.4/pyproject.toml),
[Pillow's security release](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html),
and the [critical decoder advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6).

### Backup, restore, retention, and capacity

Use the [documented backup/restore procedure](backend.md#export-backup-and-restore).
Treat JSON/SQLite downloads and migration backups as private, including exports
containing tombstones. SQLite exports also contain retry responses and audit
metadata. JSON format 2 is a viewing/session export and does not include the
manual audit table. Keep backups encrypted where practical and restrict access
to the backup destination; downloaded files are outside this integration's
permission and cleanup control.

The journal deliberately retains history. A visible delete is a tombstone,
not permanent erasure: content can remain in sessions, retry responses, SQLite
pages, exports, and backups. There is no automatic history, audit, or retry purge.
Monitor storage and retain only the migration backups and downloaded copies you
need. At the database cap, writes fail with `storage_error`; reads remain usable.
Before reaching capacity, archive a protected snapshot and plan retention or a
reviewed limit change. Never edit or delete live SQLite files to reclaim space.
Host backups and migration copies also need disk headroom beyond the page cap.

For complete dataset removal, stop HA, remove only the integration's dedicated
`kaleidescape_companion/` storage directory, and separately remove its backups
and downloads according to the host's storage policy. Restarting the integration
creates a new dataset. This is destructive and does not promise physical secure
erasure from SSDs, snapshots, or external backup systems.

### Suspected exposure or vulnerability

Restrict access to the affected instance, revoke exposed HA/device credentials,
and preserve a protected copy of relevant evidence. Review journal audit metadata
and HA access logs, update affected code, and restore only from trusted backups.
Do not post tokens, household records, full databases, or private diagnostics in
public issues. There is not yet a published private reporting channel or supported
release matrix; establish both before distribution. Use a private maintainer
channel agreed for this repository for reports during development. HA Core
vulnerabilities follow [HA's reporting policy](https://www.home-assistant.io/security/).

## Required review for future changes

Every change that affects a boundary above must update this document when the
model changes, and include regression tests for relevant denial, malformed input,
cross-dataset access, injection, resource limits, redaction, and cleanup behavior.
Test cancellation and access changes across awaited work for private responses.
Use synthetic data and isolated services; never run household playback or
device-control tests implicitly. The normal test/build task runs the security
regressions. Contributor and agent instructions link to this policy.

## References

- [HA trust model](https://contributors.home-assistant.io/security/how-it-works/)
- [Secure HA integrations](https://contributors.home-assistant.io/security/guides/integrations/)
- [Vite server security settings](https://vite.dev/config/server-options)
- [Vite client environment exposure](https://vite.dev/guide/env-and-mode)

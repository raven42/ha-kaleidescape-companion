# Optional maintainer deployment

This SSH helper deploys an exact prepared artifact to an operator-selected Home
Assistant instance. Contributors need no target, SSH account or running HA to
build and test. User installation is documented in
[getting started](../getting-started.md). The project is still preparing for
alpha; use a compatible HA version and a usable backup, and complete the
[release qualification](releasing.md) before claiming support.

Companion preserves HA's built-in Kaleidescape integration and shared
dependency. Its runtime package includes the privately namespaced patched pyk
source and MIT notice described in [pyk compatibility](pyk.md). Installing a
development wheel or a global dependency overlay is not part of this workflow.
Controls remain disabled until configured.

## Configure the target

1. Set up an SSH host alias named `ha-test` in your SSH client configuration. It
   supplies the address, port, and key. A different alias is also supported. Set
   `ssh_user` in deployment settings to select the login username; if omitted or
   `null`, SSH uses the username from your SSH configuration/defaults.
2. Connect manually once with that username (for example,
   `ssh -l root ha-test`), verify the server's host key, and confirm key/agent
   authentication works. Tasks require a known host key and do not prompt for a
   password or forward your SSH agent.
3. Run `scripts/deploy init` and edit the resulting `.ha-deploy.json` in the
   repository root. It is ignored by Git, created with `0600` permissions and
   never overwritten by initialization. The tracked example is
   `scripts/config/ha-deploy.example.json`. Use `--config PATH` to select
   another local file, including an existing configuration kept in an editor
   directory.

For HA OS, connect to an SSH app that exposes the HA configuration directory and
the `ha` CLI. Set `config_path` to that directory as seen by the SSH session;
verify the path in your app rather than assuming it is the OS host path:

```json
{
  "ssh_host": "ha-test",
  "ssh_user": "root",
  "config_path": "/config",
  "restart": { "type": "haos" }
}
```

For HA Container, connect to the container host. `config_path` is the host
directory mounted into the container at `/config`. The SSH user needs write
access there and permission to run Docker without an interactive privilege
prompt:

```json
{
  "ssh_host": "ha-test",
  "ssh_user": "deploy",
  "config_path": "/srv/homeassistant/config",
  "restart": { "type": "container", "container": "homeassistant" }
}
```

Replace the example usernames with the account configured on your SSH endpoint.
The same username is used for file deployment and configuration-check/restart.
An explicit `ssh_user` overrides the alias's `User` setting while retaining its
address, port, and authentication configuration. Existing settings without this
field continue to work. The deployment preview displays `username@alias` when
set.

Use an existing, absolute configuration directory containing
`configuration.yaml`, including an operator-configured alias such as `/config`.
At deployment time the script resolves that path and any linked ancestors to the
existing physical directory and prints **Resolved HA config** before writing
files. The resolved directory must not be `/` and must contain
`configuration.yaml`. The managed `custom_components`, deployment storage, and
companion destination still must not be symlinks. This supports linked
configuration aliases without changing the links themselves. Keep the
configuration directory and its ancestors under operator control. The remote
session needs a POSIX shell and standard `tar` with gzip support, `mktemp`,
`find`, `chmod`, `mv`, `mkdir`, `rm`, and `rmdir` tools. Installed code uses
`0755` directories and `0644` files; ensure the HA process can traverse the
configuration directory and read the installed component. Docker access and the
HA CLI are privileged capabilities. Keep authentication in your SSH
configuration; the deployment settings accept no tokens, passwords, or custom
shell commands.

## Package, preview, deploy and restart

```sh
scripts/build
scripts/check
scripts/package
scripts/deploy plan --artifact dist/kaleidescape-companion.tar.gz
scripts/deploy --artifact dist/kaleidescape-companion.tar.gz
scripts/restart
```

Package verifies generated assets and creates
`dist/kaleidescape-companion.tar.gz` together with `.sha256` and
`.provenance.json` sidecars. Keep the three files together. Deployment validates
and uploads the selected prepared artifact; it does not rebuild from the current
working tree. The artifact's source/build provenance describes what was prepared
and does not certify live HA compatibility. The complete Check gate remains a
release prerequisite.

The plan command shows the configured target, path, artifact digest and restart
behavior without opening SSH. Review it before an explicitly selected
deployment. Deployment replaces runtime files and leaves HA running. Restart
separately runs the HA configuration check, then restarts Core or the selected
container only if that check succeeds. Both terminal and optional maintainer VS
Code tasks use the same CLI operations. No normal setup, build, check, test or
package command deploys or restarts HA.

Updating Python code requires a full HA Core restart after installation;
reloading the entry alone does not replace already imported Python code or old
static-path registrations.

The archive contains the integration's runtime Python, supported JSON files,
`services.yaml`, five YAML automation blueprints under `templates/`, compiled
`ui/assets/panel.js` and local PNG branding. It excludes development sources
outside the integration, environments, caches, databases and repository
metadata. Symlinked or hard-linked runtime sources are rejected. The printed
digest identifies the exact uploaded archive; it is not a signature or a
compatibility guarantee.

Packaged templates and installed HA blueprints are separate files. After a code
update/restart, review **Settings → Automations** for installed/bundled versions
and **Change log**. Bundled means included with this Companion build; it is not
an Internet release check. Choose **Update** for an older file or **Review
replacement** for a modified file, read the changes and confirm. An accepted
update replaces that blueprint and reloads its dependent automations; review
local customizations first. Installing new component files alone does not update
existing blueprints. If a bundled blueprint cannot be read, install the complete
integration directory, including its `templates/` directory, and restart HA. See
[automations](automations.md).

Deployment stages files under `<HA config>/.kaleidescape-companion-deploy/`,
then replaces `<HA config>/custom_components/kaleidescape_companion/`. It
removes obsolete runtime files by replacing the component directory. It leaves
the built-in `kaleidescape` integration, other integrations, HA settings, and
`<HA config>/kaleidescape_companion/journal.sqlite3` alone.

Each existing component directory is retained under a private
`deploy.*/previous/` directory in that staging area; its location is printed.
These are code copies, not database or HA backups. There is no automatic
pruning. An interrupted deployment is not a crash-safe filesystem transaction;
if replacing the staged directory fails, the script attempts to restore the
previous component. Inspect the target and any retained files before retrying
after a disconnect or host crash. A stale `lock` directory must only be removed
after confirming no deployment is still running. Do not clear another
deployment's lock.

If configuration validation or restart fails, the uploaded code remains
installed; there is no automatic rollback. Restore previous code only with HA
stopped and after checking database-schema compatibility. Downgrading code does
not downgrade the database. Use a compatible full backup when necessary. Do not
restart or deploy concurrently through another tool, HACS, or a second task.
Remote command completion does not establish that HA and this integration
started successfully. Remote error messages remain visible; the local failure
summary reports the SSH exit status or timeout without printing the entire
remote script. Cancelling the local command stops its SSH process group, and a
timeout kills and reaps that group. Neither proves that a remote write was
undone; inspect the target state before retrying after cancellation or timeout.

The [backend guide](journal.md) lists the current database schema and table
responsibilities. Deploy the complete Python runtime and compiled frontend
together, then explicitly restart HA. Its first open upgrades an older journal
and creates a private pre-migration backup. Code supporting only earlier schemas
cannot read it; code rollback alone is insufficient. A matching database restore
must be done with HA stopped and may lose changes made since that backup.

## Review the installed integration

After restart, open **Settings → Devices & services → Add integration →
Kaleidescape Companion**, initially with tracking disabled. Open the
administrator sidebar panel at `/kaleidescape-companion` and review:

- The integration/sidebar name and the desktop/narrow-screen layout.
- On a fixture-backed test instance, create, edit, filter and delete a manual
  viewing. Manual creation needs an enabled Library version with known runtime;
  do not add fictional records to a household journal.
- JSON/SQLite downloads and record persistence after another restart.
- A regular account’s read-only history, without notes, source/session details,
  or exports.
- All 17 sensors: five history sensors plus twelve Library/storage sensors.
  Check their bounded attributes/counts after the next refresh, the initial
  discovery baseline, unchanged-scan batch retention and unavailable/unknown
  behavior when Library/status data is disabled or missing.
- With a deliberately selected player, the administrator Now Playing card:
  cover/placeholder, pause/scan/credits states, counted time, and
  unavailable/recording-health states.
- HA status information for setup or storage failures, without posting private
  data or records.
- The three HA configuration switches, three action buttons and optional
  blueprints. With a fictional receipt fixture, verify saved purchases,
  unmatched reconciliation and matching without disabling tracking.

Browser review is performed by the operator; automated checks use fictional
records and never contact the target. Enable observation only for deliberately
selected entities after the basic checks. See the
[tracking guide](journal.md#automatic-tracking).

Target configuration is local and editor-independent. `scripts/deploy init`,
`scripts/deploy plan --artifact PATH`, `scripts/deploy --artifact PATH` and
`scripts/restart` each accept `--config PATH`. Restart does not upload an
artifact; deployment does not run restart. Keep the selected archive and
sidecars immutable between review and deployment.

See
[HA OS SSH access](https://www.home-assistant.io/common-tasks/os/#installing-and-using-the-ssh-app)
and
[Docker restart behavior](https://docs.docker.com/reference/cli/docker/container/restart/).

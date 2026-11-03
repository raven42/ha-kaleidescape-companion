# Deploying to a test Home Assistant instance

These tasks deploy the current working tree from your development machine over
SSH. The GitHub repository can stay private; HA needs no GitHub credentials, Git
checkout, Node installation, or Vite server. The integration remains an early
test build. Confirm the target HA version and review the
[security findings](security.md#known-dependency-findings-2026-10-25) before a
household rollout. Take a full HA backup before the first installation.

The built archive includes the generated Kaleidescape API runtime inside the
integration. HA installs or reuses the separately packaged `pykaleidescape`
version pinned in the manifest; an offline installation needs that dependency
already available. Controls stay disabled until explicitly configured in HA.

## Configure the target

1. Set up an SSH host alias named `ha-test` in your SSH client configuration. It
   supplies the address, port, and key. A different alias is also supported. Set
   `ssh_user` in deployment settings to select the login username; if omitted or
   `null`, SSH uses the username from your SSH configuration/defaults.
2. Connect manually once with that username (for example,
   `ssh -l root ha-test`), verify the server's host key, and confirm key/agent
   authentication works. Tasks require a known host key and do not prompt for a
   password or forward your SSH agent.
3. Run **Tasks: Run Task → Initialize deployment settings** in VS Code. Edit the
   resulting `.vscode/ha-deploy.json`. It is ignored by Git, created with `0600`
   permissions, and never overwritten by the initialization task.

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

## Build and deploy

| VS Code task                                | Effect                                                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build integration package**               | Runs **Check all**, including the frontend build, then writes `dist/kaleidescape-companion.tar.gz` and prints its SHA-256. This is the default build task. |
| **Preview test HA deployment**              | Builds/checks the package and shows the configured target, path, and restart command. Makes no SSH connection.                                             |
| **Deploy to test HA**                       | Builds/checks the package, uploads runtime files over SSH, and replaces only this component. Leaves HA running.                                            |
| **Check configuration and restart test HA** | Runs the target's HA configuration check, then restarts Core or the named container only if that check succeeds. Does not deploy files.                    |
| **Build, deploy and restart test HA**       | Runs deployment followed by configuration check/restart, stopping when a step fails.                                                                       |

Use **Preview test HA deployment** first to review the selected target. Run a
deployment task explicitly when ready. None of the normal build, test, or
preview tasks deploys or restarts HA. No deployment task runs automatically on
file changes. The package includes current uncommitted runtime edits, so finish
editing before starting the task. Deployment packages the runtime again after
its dependent checks; do not edit source while the task runs.

The reorganized package requires a full HA Core restart after installation;
reloading the entry alone does not replace already imported Python code or old
static-path registrations.

The archive contains only runtime Python files, manifest/setup/translation JSON,
and the compiled `ui/assets/panel.js`, including the generated API under
`_vendor/` and the integration's `scrapers/` modules. It excludes the
development adapter source, environments, caches, databases, and repository
metadata. Symlinked or hard-linked runtime sources are rejected. The printed
digest identifies the exact uploaded archive; it is not a signature or a
compatibility guarantee.

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
remote script. After a timeout, inspect the target state before retrying.

The [backend guide](backend.md) lists the current database schema and table
responsibilities. Deploy Python code, generated libraries and the compiled
frontend together, then explicitly restart HA. Its first open upgrades an older
journal and creates a private pre-migration backup. Code supporting only earlier
schemas cannot read it; code rollback alone is insufficient. A matching database
restore must be done with HA stopped and may lose changes made since that
backup.

## Review the installed integration

After restart, open **Settings → Devices & services → Add integration →
Kaleidescape Companion**, initially with tracking disabled. Open the
administrator sidebar panel at `/kaleidescape-companion` and review:

- The integration/sidebar name and the desktop/narrow-screen layout.
- A fictional manual viewing: create, edit, filter, and confirm deletion.
- JSON/SQLite downloads and record persistence after another restart.
- A regular account’s read-only history, without notes, source/session details,
  or exports.
- All fourteen sensors: seven history sensors plus seven Library/storage
  sensors. Check their bounded attributes/counts after the next refresh, the
  initial discovery baseline, unchanged-scan batch retention and
  unavailable/unknown behavior when Library/status data is disabled or missing.
- With a deliberately selected player, the administrator Now Playing card:
  cover/placeholder, pause/scan/credits states, counted time, and
  unavailable/recording-health states.
- HA status information for setup or storage failures, without posting private
  data or records.

Browser review is performed by the operator; automated checks use fictional
records and never contact the target. Enable observation only for deliberately
selected entities after the basic checks. See the
[tracking guide](backend.md#automatic-tracking).

The same tooling is available from the terminal with
`.venv/bin/python dev/deploy.py ACTION`, where `ACTION` is `init`, `package`,
`plan`, `deploy`, or `restart`. `--config PATH` selects another local settings
file. Direct `package`, `plan`, and `deploy` commands use the existing compiled
panel and **do not** run the checks/build themselves; the VS Code task
dependencies do that. Run `bash dev/dev.sh check` first when using the CLI
directly.

See
[HA OS SSH access](https://www.home-assistant.io/common-tasks/os/#installing-and-using-the-ssh-app)
and
[Docker restart behavior](https://docs.docker.com/reference/cli/docker/container/restart/).

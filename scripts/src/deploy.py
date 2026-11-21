"""Deploy a verified prepared artifact to an explicitly configured HA over SSH."""

import argparse
import json
import os
import re
import shlex
import signal
import subprocess
import sys
import tarfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from scripts.src.package import ARTIFACT_NAME, load_artifact

ROOT = Path(__file__).resolve().parents[2]
DOMAIN = "kaleidescape_companion"
DEFAULT_CONFIG = ROOT / ".ha-deploy.json"
DEFAULT_ARTIFACT = ROOT / "dist" / ARTIFACT_NAME
EXAMPLE_CONFIG = ROOT / "scripts/config/ha-deploy.example.json"
FRONTEND_ASSET = ROOT / "custom_components" / DOMAIN / "ui/assets/panel.js"
HA_TOKEN = ROOT / ".ha-dev/ha.token"
REMOTE_FRONTEND = r"""set -eu
umask 077
fail() { echo "$1" >&2; exit 1; }
config=$(CDPATH= cd -P "$1" && pwd -P) ||
    fail "HA configuration directory does not exist"
[ "$config" != / ] && [ -f "$config/configuration.yaml" ] ||
    fail "Invalid HA configuration directory"
components="$config/custom_components"
target="$components/kaleidescape_companion"
state="$config/.kaleidescape-companion-deploy"
for path in "$components" "$target" "$target/ui" "$target/ui/assets" "$state"; do
    [ ! -L "$path" ] || fail "Refusing linked deployment path"
done
[ -f "$target/manifest.json" ] && [ -f "$target/ui/assets/panel.js" ] &&
    [ ! -L "$target/ui/assets/panel.js" ] ||
    fail "Install the complete integration before updating the frontend"
[ -d "$state" ] || mkdir -m 700 "$state"
mkdir "$state/lock" 2>/dev/null || fail "Deployment lock exists"
temp=
cleanup() {
    [ -z "$temp" ] || rm -f "$temp"
    rmdir "$state/lock"
}
trap cleanup EXIT
temp=$(mktemp "$target/ui/assets/.panel.XXXXXXXX")
cat > "$temp"
[ -s "$temp" ] || fail "Frontend bundle is empty"
chmod 644 "$temp"
mv -f "$temp" "$target/ui/assets/panel.js"
temp=
echo "Frontend installed."
"""
# Only a locally validated prepared runtime archive is sent to this script.
# All remote paths originate from the quoted positional config argument.
REMOTE_DEPLOY = r"""set -eu
umask 077
requested_config=$1
fail() { echo "$1" >&2; exit 1; }
[ -d "$requested_config" ] || fail "HA configuration directory does not exist"
config=$(CDPATH= cd -P "$requested_config" && pwd -P) ||
    fail "Could not resolve HA configuration directory"
[ "$config" != / ] || fail "Resolved HA configuration directory must not be /"
[ -f "$config/configuration.yaml" ] ||
    fail "HA configuration.yaml is missing; check config_path"
printf '%s\n' "Resolved HA config: $config"
domain=kaleidescape_companion
components="$config/custom_components"
state="$config/.kaleidescape-companion-deploy"
target="$components/$domain"
[ ! -L "$components" ] || fail "Refusing linked custom_components"
[ ! -L "$state" ] || fail "Refusing linked deployment storage"
[ ! -L "$target" ] || fail "Refusing a linked component destination"
if [ -e "$target" ]; then
    [ -d "$target" ] || fail "Component destination is not a directory"
fi
if [ ! -d "$components" ]; then mkdir -m 755 "$components"; fi
if [ ! -d "$state" ]; then mkdir -m 700 "$state"; fi
chmod 700 "$state"
lock="$state/lock"
mkdir "$lock" 2>/dev/null ||
    fail "Deployment lock exists; inspect any active deployment"
work=
moved=0
installed=0
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if [ "$moved" = 1 ] && [ "$installed" = 0 ]; then
        if [ ! -e "$target" ] && [ ! -L "$target" ]; then
            mv "$work/previous" "$target" ||
                echo "Restore previous component from $work/previous" >&2
        fi
    fi
    if [ -n "$work" ] && [ "$moved" = 0 ]; then rm -rf "$work"; fi
    rmdir "$lock" || true
    exit "$result"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
work=$(mktemp -d "$state/deploy.XXXXXXXX")
mkdir "$work/new"
tar -xzf - -C "$work/new"
new="$work/new/$domain"
[ -f "$new/manifest.json" ] && [ -f "$new/ui/assets/panel.js" ] ||
    fail "Incomplete runtime package"
find "$new" -type d -exec chmod 755 {} \;
find "$new" -type f -exec chmod 644 {} \;
if [ -d "$target" ]; then
    mv "$target" "$work/previous"
    moved=1
fi
mv "$new" "$target"
installed=1
if [ "$moved" = 1 ]; then
    rmdir "$work/new"
    echo "Previous component files: $work/previous"
else
    rm -rf "$work"
fi
echo "Installed Kaleidescape Companion at $target"
echo "HA has not been restarted. Journal storage was not changed."
"""


@dataclass(frozen=True)
class DeployConfig:
    ssh_host: str
    config_path: str
    restart_type: str
    container: str | None = None
    ssh_user: str | None = None

    def restart_command(self) -> str:
        """Use fixed commands; settings cannot supply arbitrary shell code."""
        if self.restart_type == "haos":
            return "ha core check && ha core restart"
        container = shlex.quote(self.container or "")
        return (
            f"docker exec {container} python -m homeassistant --script check_config"
            f" --config /config && docker restart --timeout 60 {container}"
        )


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate settings key: {key}")
        result[key] = value
    return result


def load_config(path: Path) -> DeployConfig:
    """Validate settings before invoking SSH or interpreting remote paths."""
    if not path.is_file():
        raise ValueError(
            "Run scripts/deploy init and edit .ha-deploy.json, or pass --config PATH"
        )
    data = json.loads(path.read_text(), object_pairs_hook=unique_object)
    required = {"ssh_host", "config_path", "restart"}
    if (
        not isinstance(data, dict)
        or not required <= data.keys()
        or not data.keys() <= required | {"ssh_user"}
    ):
        raise ValueError(
            "Settings require ssh_host, config_path, and restart; ssh_user is optional"
        )
    host, config_path, restart = data["ssh_host"], data["config_path"], data["restart"]
    user = data.get("ssh_user")
    if not isinstance(host, str) or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", host
    ):
        raise ValueError("ssh_host must be an SSH configuration host alias")
    if user is not None and (
        not isinstance(user, str)
        or not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}", user)
    ):
        raise ValueError(
            "ssh_user must be a username using letters, numbers, _, ., or -"
        )
    if (
        not isinstance(config_path, str)
        or not config_path.startswith("/")
        or config_path == "/"
        or str(PurePosixPath(config_path)) != config_path
        or ".." in PurePosixPath(config_path).parts
        or any(
            ord(character) < 32 or ord(character) == 127 for character in config_path
        )
    ):
        raise ValueError(
            "config_path must be a normalized absolute HA config directory, not /"
        )
    if not isinstance(restart, dict):
        raise ValueError("restart must specify type haos or container")
    if restart == {"type": "haos"}:
        return DeployConfig(host, config_path, "haos", ssh_user=user)
    if (
        set(restart) == {"type", "container"}
        and restart["type"] == "container"
        and isinstance(restart["container"], str)
        and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", restart["container"])
    ):
        return DeployConfig(
            host, config_path, "container", restart["container"], ssh_user=user
        )
    raise ValueError("Use restart {type: haos} or {type: container, container: NAME}")


def initialize_config(path: Path) -> None:
    """Create private local settings once; never replace an existing target."""
    if path.parent.is_symlink():
        raise ValueError("Refusing linked settings directory")
    contents = EXAMPLE_CONFIG.read_text()
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(contents)
    print(f"Edit {path} for your test instance before deploying.")


def ssh_command(config: DeployConfig, command: str) -> list[str]:
    arguments = [
        "ssh",
        "-T",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "ForwardAgent=no",
        "-o",
        "ClearAllForwardings=yes",
        "-o",
        "ConnectTimeout=10",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "ServerAliveCountMax=3",
    ]
    if config.ssh_user is not None:
        arguments.extend(["-l", config.ssh_user])
    return [*arguments, "--", config.ssh_host, command]


def deploy(config: DeployConfig, data: bytes) -> None:
    command = shlex.join(["sh", "-c", REMOTE_DEPLOY, "sh", config.config_path])
    run_ssh(ssh_command(config, command), input=data, timeout=300)


def deploy_frontend(config: DeployConfig, data: bytes) -> None:
    """Replace the installed panel bundle using the configured SSH target."""
    if not data:
        raise ValueError("Frontend bundle is empty")
    command = shlex.join(["sh", "-c", REMOTE_FRONTEND, "sh", config.config_path])
    run_ssh(ssh_command(config, command), input=data, timeout=300)


def reload_companion(config: DeployConfig, token_path: Path = HA_TOKEN) -> None:
    """Reload the unique Companion config entry via Home Assistant's API."""
    token = token_path.read_text().strip()
    if not token or any(character.isspace() for character in token):
        raise ValueError("Home Assistant API token is missing or invalid")
    # The deployment host also serves Home Assistant on its standard port.
    origin = f"http://{config.ssh_host}:8123"
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        _NoRedirect(),
    )

    def request(path: str, method: str = "GET") -> object:
        api_request = urllib.request.Request(
            origin + path,
            headers={"Authorization": f"Bearer {token}"},
            method=method,
            data=b"" if method == "POST" else None,
        )
        try:
            with opener.open(api_request, timeout=30) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise ValueError("Home Assistant API request failed") from error

    entries = request("/api/config/config_entries/entry?domain=kaleidescape_companion")
    if not isinstance(entries, list):
        raise ValueError("Home Assistant returned an invalid integration list")
    matches = [
        entry
        for entry in entries
        if isinstance(entry, dict) and entry.get("domain") == DOMAIN
    ]
    if len(matches) != 1:
        raise ValueError("Expected exactly one Kaleidescape Companion integration")
    entry_id = matches[0].get("entry_id")
    if not isinstance(entry_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", entry_id):
        raise ValueError("Home Assistant returned an invalid integration entry ID")
    result = request(f"/api/config/config_entries/entry/{entry_id}/reload", "POST")
    if not isinstance(result, dict) or result.get("require_restart") is not False:
        raise ValueError("Home Assistant could not reload Companion successfully")
    entries = request("/api/config/config_entries/entry?domain=kaleidescape_companion")
    if not isinstance(entries, list) or not any(
        isinstance(entry, dict)
        and entry.get("entry_id") == entry_id
        and entry.get("domain") == DOMAIN
        and entry.get("state") == "loaded"
        for entry in entries
    ):
        raise ValueError("Companion integration did not return to the loaded state")
    print("Companion integration reloaded. Reload the browser page.")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Keep API credentials on the configured Home Assistant host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def restart(config: DeployConfig) -> None:
    run_ssh(
        ssh_command(config, config.restart_command()),
        input=b"",
        timeout=300,
    )


def run_ssh(command: list[str], *, input: bytes, timeout: float) -> None:
    """Forward cancellation to SSH and its children without logging the script."""
    with subprocess.Popen(
        command, stdin=subprocess.PIPE, start_new_session=True
    ) as process:
        previous = {}
        interrupted = None

        def signal_group(signum):
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass

        def forward(signum, _frame):
            nonlocal interrupted
            interrupted = signum
            signal_group(signum)

        try:
            for signum in (signal.SIGINT, signal.SIGTERM):
                previous[signum] = signal.signal(signum, forward)
            process.communicate(input=input, timeout=timeout)
        except BaseException:
            # communicate() does not stop children on timeout. Stop the group,
            # close stdin and reap SSH before returning a concise CLI failure.
            signal_group(signal.SIGKILL)
            process.communicate()
            raise
        finally:
            if interrupted is not None:
                # A cancelled SSH may exit before its local children do.
                signal_group(signal.SIGKILL)
            for signum, handler in previous.items():
                signal.signal(signum, handler)
    status = -interrupted if interrupted is not None else process.returncode
    if status:
        raise subprocess.CalledProcessError(status, command)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        nargs="?",
        default="deploy",
        choices=["init", "plan", "deploy", "frontend", "restart"],
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument(
        "--artifact", type=Path, help="exact prepared tar.gz from scripts/package"
    )
    args = parser.parse_args()
    if args.action in {"plan", "deploy"} and args.artifact is None:
        args.artifact = DEFAULT_ARTIFACT
    if args.action in {"init", "restart", "frontend"} and args.artifact is not None:
        parser.error("--artifact is only used by plan/deploy")
    if args.action == "init":
        initialize_config(args.config)
        return
    if args.action in {"plan", "deploy"} and not args.artifact.is_file():
        parser.error(
            f"Prepared artifact is missing: {args.artifact}. "
            "Run scripts/package or pass --artifact PATH."
        )
    config = load_config(args.config)
    target = (
        f"{config.ssh_user}@{config.ssh_host}" if config.ssh_user else config.ssh_host
    )
    print(f"SSH target: {target}\nHA config: {config.config_path}", flush=True)
    if args.action == "frontend":
        deploy_frontend(config, FRONTEND_ASSET.read_bytes())
        try:
            reload_companion(config)
        except (OSError, ValueError) as error:
            raise ValueError(
                "Frontend uploaded but Companion reload failed. "
                "Reload the integration in Home Assistant."
            ) from error
        return
    print(f"Restart command (separate task): {config.restart_command()}", flush=True)
    if args.action == "restart":
        restart(config)
        print(
            "Restart command completed. "
            "Review HA startup and the sidebar in your browser."
        )
        return
    data, provenance = load_artifact(args.artifact)
    print(
        f"Prepared artifact: {args.artifact}\n"
        f"Version: {provenance['version']}\n"
        f"SHA-256: {provenance['artifact']['sha256']}\n"
        f"Source commit: {provenance['source']['commit'] or 'not a Git checkout'}\n"
        f"Source modified: {provenance['source']['dirty']}",
        flush=True,
    )
    if args.action == "plan":
        print("Preview only: no SSH connection, remote writes, or restart.")
        return
    deploy(config, data)


def cli() -> int:
    """Report SSH failures without dumping the embedded remote shell program."""
    status = 1
    try:
        main()
        return 0
    except subprocess.CalledProcessError as error:
        status = error.returncode if error.returncode >= 0 else 128 - error.returncode
        message = (
            f"Remote SSH command failed (exit status {error.returncode}). "
            "See the remote output above."
        )
    except subprocess.TimeoutExpired:
        message = "Remote SSH command timed out. Inspect the target before retrying."
    except KeyboardInterrupt:
        message = "Remote SSH command interrupted. Inspect the target before retrying."
        status = 130
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        EOFError,
        tarfile.TarError,
    ) as error:
        message = str(error)
    print(f"Deployment tooling failed: {message}", file=sys.stderr)
    return status


if __name__ == "__main__":
    sys.exit(cli())

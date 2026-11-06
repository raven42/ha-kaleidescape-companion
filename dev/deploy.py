"""Package runtime files and deploy to an explicitly configured test HA over SSH."""

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "kaleidescape_companion"
DEFAULT_CONFIG = ROOT / ".vscode" / "ha-deploy.json"
EXAMPLE_CONFIG = ROOT / ".vscode" / "ha-deploy.example.json"
MAX_PACKAGE_BYTES = 32 * 1024 * 1024
REQUIRED = {
    "core/settings_transfer.py",
    "core/purchase_repair.py",
    "core/sync_actions.py",
    "ui/settings_transfer.py",
    "__init__.py",
    "config_flow.py",
    "button.py",
    "switch.py",
    "services.py",
    "services.yaml",
    "library/purchase_email.py",
    "ui/automation_templates.py",
    "templates/purchase_email_parser.yaml",
    "templates/library_schedule.yaml",
    "templates/metadata_schedule.yaml",
    "templates/calendar_schedule.yaml",
    "const.py",
    "manifest.json",
    "strings.json",
    "translations/en.json",
    "ui/assets/panel.js",
    "scrapers/__init__.py",
    "scrapers/client.py",
    "scrapers/models.py",
    "scrapers/transport.py",
    "scrapers/providers/__init__.py",
    "scrapers/providers/store.py",
    "scrapers/providers/store_search.py",
    "scrapers/providers/tmdb.py",
    "enrichment/__init__.py",
    "enrichment/config.py",
    "enrichment/store.py",
    "enrichment/sync.py",
    "playback/now_playing.py",
    "calendar/entity.py",
    "calendar/maintenance.py",
    "calendar/maintenance_store.py",
    "vendor/__init__.py",
    "vendor/kaleidescape/__init__.py",
    "vendor/kaleidescape/_version.py",
    "vendor/kaleidescape/connection.py",
    "vendor/kaleidescape/const.py",
    "vendor/kaleidescape/device.py",
    "vendor/kaleidescape/dispatcher.py",
    "vendor/kaleidescape/error.py",
    "vendor/kaleidescape/library_parser.py",
    "vendor/kaleidescape/local_browser.py",
    "vendor/kaleidescape/message.py",
    "vendor/kaleidescape/py.typed",
    "vendor/kaleidescape/LICENSE",
}

# Only a locally constructed runtime archive is ever sent to this script.
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
            "Run 'Initialize deployment settings' and edit .vscode/ha-deploy.json"
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


def runtime_package(root: Path = ROOT) -> bytes:
    """Build a deterministic archive using only approved runtime file types."""
    integration = root / "custom_components" / DOMAIN
    if integration.is_symlink() or integration.parent.is_symlink():
        raise ValueError("Refusing linked integration source")
    files = {}
    size = 0
    for path in sorted(integration.rglob("*")):
        if path.is_symlink():
            raise ValueError("Refusing symlinks in integration source")
        relative = path.relative_to(integration)
        name = relative.as_posix()
        allowed = (
            path.suffix == ".py"
            or name in REQUIRED
            or (relative.parent.as_posix() == "translations" and path.suffix == ".json")
            or name in {"brand/icon.png", "brand/icon@2x.png"}
        )
        if not allowed or any(
            part.startswith(".") or part == "__pycache__" for part in relative.parts
        ):
            continue
        if not path.is_file() or path.stat().st_nlink != 1:
            raise ValueError("Runtime source must contain regular, unlinked files")
        with path.open("rb") as source:
            content = source.read(MAX_PACKAGE_BYTES - size + 1)
        size += len(content)
        if size > MAX_PACKAGE_BYTES:
            raise ValueError("Runtime package exceeds 32 MiB")
        files[name] = content
    if not REQUIRED <= files.keys() or not files.get("ui/assets/panel.js"):
        raise ValueError("Runtime files missing; build the frontend before packaging")
    manifest = json.loads(files["manifest.json"])
    if manifest.get("domain") != DOMAIN:
        raise ValueError("Runtime manifest has the wrong integration domain")
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as archive:
            for name, content in files.items():
                info = tarfile.TarInfo(f"{DOMAIN}/{name}")
                info.size = len(content)
                info.mode = 0o644
                archive.addfile(info, io.BytesIO(content))
    return buffer.getvalue()


def write_package(root: Path = ROOT) -> tuple[bytes, str, Path]:
    data = runtime_package(root)
    digest = hashlib.sha256(data).hexdigest()
    output = root / "dist"
    if output.is_symlink():
        raise ValueError("Refusing linked package output directory")
    output.mkdir(exist_ok=True)
    destination = output / "kaleidescape-companion.tar.gz"
    with tempfile.NamedTemporaryFile(dir=output, delete=False) as temporary:
        temporary.write(data)
        temporary_path = Path(temporary.name)
    try:
        temporary_path.replace(destination)
    finally:
        temporary_path.unlink(missing_ok=True)
    print(f"Package: {destination}\nSHA-256: {digest}", flush=True)
    return data, digest, destination


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
    subprocess.run(ssh_command(config, command), input=data, check=True, timeout=300)


def restart(config: DeployConfig) -> None:
    subprocess.run(
        ssh_command(config, config.restart_command()),
        input=b"",
        check=True,
        timeout=300,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action", choices=["init", "package", "plan", "deploy", "restart"]
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    if args.action == "init":
        initialize_config(args.config)
        return
    if args.action == "package":
        write_package()
        return
    config = load_config(args.config)
    target = (
        f"{config.ssh_user}@{config.ssh_host}" if config.ssh_user else config.ssh_host
    )
    print(f"SSH target: {target}\nHA config: {config.config_path}", flush=True)
    print(f"Restart command (separate task): {config.restart_command()}", flush=True)
    if args.action == "restart":
        restart(config)
        print(
            "Restart command completed. "
            "Review HA startup and the sidebar in your browser."
        )
        return
    data, _, _ = write_package()
    if args.action == "plan":
        print("Preview only: no SSH connection, remote writes, or restart.")
        return
    deploy(config, data)


def cli() -> int:
    """Report SSH failures without dumping the embedded remote shell program."""
    try:
        main()
        return 0
    except subprocess.CalledProcessError as error:
        message = (
            f"Remote SSH command failed (exit status {error.returncode}). "
            "See the remote output above."
        )
    except subprocess.TimeoutExpired:
        message = "Remote SSH command timed out. Inspect the target before retrying."
    except (OSError, ValueError) as error:
        message = str(error)
    print(f"Deployment tooling failed: {message}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(cli())

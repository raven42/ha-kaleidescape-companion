"""Create and inspect verified, deterministic Home Assistant runtime artifacts."""

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
DOMAIN = "kaleidescape_companion"
MAX_PACKAGE_BYTES = 32 * 1024 * 1024
MAX_TAR_BYTES = MAX_PACKAGE_BYTES + 10 * 1024 * 1024
MAX_METADATA_BYTES = 2 * 1024 * 1024
ARTIFACT_NAME = "kaleidescape-companion.tar.gz"
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
    "templates/maintenance_schedule.yaml",
    "const.py",
    "manifest.json",
    "LICENSE",
    "NOTICE",
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


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    """Reject ambiguous JSON in artifact metadata."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key in artifact metadata")
        result[key] = value
    return result


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_regular(path: Path, limit: int) -> bytes:
    """Bound reads and refuse links before interpreting a prepared artifact."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError("Artifact files must be regular and unlinked")
        if info.st_size > limit:
            raise ValueError("Artifact file exceeds its size limit")
        data = source.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Artifact file exceeds its size limit")
    return data


def inspect_package(data: bytes) -> dict[str, bytes]:
    """Inspect bounded tar contents before any bytes reach remote extraction."""
    if len(data) > MAX_PACKAGE_BYTES:
        raise ValueError("Runtime package exceeds 32 MiB")
    with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as compressed:
        unpacked = compressed.read(MAX_TAR_BYTES + 1)
    if len(unpacked) > MAX_TAR_BYTES:
        raise ValueError("Runtime tar exceeds its expanded size limit")
    files = {}
    total = 0
    with tarfile.open(fileobj=io.BytesIO(unpacked), mode="r:") as archive:
        for member in archive:
            relative = PurePosixPath(member.name)
            if (
                not member.isfile()
                or member.issparse()
                or member.mode != 0o644
                or member.name != relative.as_posix()
                or len(relative.parts) < 2
                or relative.parts[0] != DOMAIN
                or any(part.startswith(".") for part in relative.parts)
                or "__pycache__" in relative.parts
                or "\\" in member.name
                or any(
                    ord(character) < 32 or ord(character) == 127
                    for character in member.name
                )
            ):
                raise ValueError("Runtime package contains an unsafe member")
            name = PurePosixPath(*relative.parts[1:]).as_posix()
            allowed = (
                relative.suffix == ".py"
                or name in REQUIRED
                or (
                    relative.parent.as_posix() == f"{DOMAIN}/translations"
                    and relative.suffix == ".json"
                )
                or name in {"brand/icon.png", "brand/icon@2x.png"}
            )
            if not allowed or name in files:
                raise ValueError(
                    "Runtime package contains an unexpected or duplicate member"
                )
            total += member.size
            if member.size < 0 or total > MAX_PACKAGE_BYTES or len(files) >= 10000:
                raise ValueError("Runtime package exceeds its content limits")
            content = archive.extractfile(member).read(MAX_PACKAGE_BYTES + 1)
            if len(content) != member.size:
                raise ValueError("Runtime package member is truncated")
            files[name] = content
    if any(
        parent.as_posix() in files
        for name in files
        for parent in PurePosixPath(name).parents
    ):
        raise ValueError("Runtime package contains overlapping file paths")
    if not REQUIRED <= files.keys() or not files.get("ui/assets/panel.js"):
        raise ValueError("Runtime package is incomplete")
    manifest = json.loads(files["manifest.json"], object_pairs_hook=unique_object)
    if not isinstance(manifest, dict) or manifest.get("domain") != DOMAIN:
        raise ValueError("Runtime manifest has the wrong integration domain")
    return files


def source_inputs(root: Path) -> dict[str, str]:
    """Hash explicit code/build inputs, excluding local settings and household data."""
    runtime = runtime_package(root)
    paths = {
        root / "custom_components" / DOMAIN / name for name in inspect_package(runtime)
    }
    permitted = {
        ".py",
        ".sh",
        ".ts",
        ".tsx",
        ".js",
        ".mjs",
        ".mts",
        ".css",
        ".svg",
        ".png",
        ".jpg",
        ".webp",
        ".html",
        ".json",
        ".yaml",
        ".patch",
        ".gz",
    }
    if (root / ".git").exists():
        names = (
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(root),
                    "ls-files",
                    "-z",
                    "--cached",
                    "--others",
                    "--exclude-standard",
                    "--",
                    "frontend/src",
                    "frontend/dev",
                    "scripts",
                ],
                capture_output=True,
                check=True,
            )
            .stdout.decode()
            .split("\0")
        )
        candidates = {root / name for name in names if name}
    else:
        # Source archives lack Git metadata. Only code/build files are eligible.
        candidates = {
            path
            for directory in ("frontend/src", "frontend/dev", "scripts")
            for path in (root / directory).rglob("*")
        }
    for path in candidates:
        relative = path.relative_to(root)
        if any(
            part.startswith(".") or part in {"__pycache__", "node_modules"}
            for part in relative.parts
        ):
            continue
        wrappers = {
            "setup",
            "build",
            "lint",
            "format",
            "test",
            "check",
            "package",
            "deploy",
            "restart",
            "preview",
            "ha",
            "dependency-audit",
            "check-pyk",
            "check-project",
            "validate-database",
            "benchmark-library",
            "benchmark-title-matching",
            "import-purchase-dates",
            "purchase-history",
        }
        allowed = (
            path.suffix in permitted
            or (relative.parent == PurePosixPath("scripts") and path.name in wrappers)
            or path.name == "LICENSE"
        )
        if not allowed:
            continue
        if path.is_symlink():
            raise ValueError("Build inputs must not contain symlinks")
        if path.is_file():
            paths.add(path)
    for name in (
        "pyproject.toml",
        "frontend/package.json",
        "frontend/package-lock.json",
        "frontend/tsconfig.json",
    ):
        paths.add(root / name)
    paths.update((root / "frontend").glob("*.mjs"))
    paths.update((root / "frontend").glob("*.mts"))
    return {
        path.relative_to(root).as_posix(): sha256(read_regular(path, MAX_PACKAGE_BYTES))
        for path in sorted(paths)
    }


def input_digest(inputs: dict[str, str]) -> str:
    return sha256(json.dumps(inputs, sort_keys=True, separators=(",", ":")).encode())


def write_atomic(path: Path, data: bytes) -> None:
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(data)
        temporary_path = Path(temporary.name)
    try:
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def write_package(root: Path = ROOT, output: Path | None = None) -> Path:
    """Verify inputs, package once, and record provenance for those exact bytes."""
    from scripts.src import tasks

    before = source_inputs(root)
    tasks.verify_assets()
    tasks.verify_pyk(reconstruct=True)
    tasks.project_check()
    data = runtime_package(root)
    files = inspect_package(data)
    after = source_inputs(root)
    if before != after:
        raise ValueError(
            "Build inputs changed during package verification; rerun package"
        )
    version = json.loads(files["manifest.json"])["version"]
    if not isinstance(version, str) or not re.fullmatch(
        r"[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}", version
    ):
        raise ValueError("Runtime manifest must declare a release/development version")
    commit = None
    dirty = None
    if (root / ".git").exists():
        commit = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True,
            check=True,
            text=True,
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(root),
                    "status",
                    "--porcelain",
                    "--untracked-files=all",
                ],
                capture_output=True,
                check=True,
            ).stdout
        )
    digest = sha256(data)
    provenance = {
        "format": 1,
        "domain": DOMAIN,
        "version": version,
        "artifact": {"name": ARTIFACT_NAME, "sha256": digest, "bytes": len(data)},
        "runtime_sha256": {
            name: sha256(content) for name, content in sorted(files.items())
        },
        "source": {
            "commit": commit,
            "dirty": dirty,
            "inputs": before,
            "sha256": input_digest(before),
        },
        "build": {
            "command": "npm --prefix frontend run build:check",
            "panel_sha256": sha256(files["ui/assets/panel.js"]),
        },
        "checks": [
            "generated-assets",
            "pyk-reconstruction",
            "project-invariants",
            "runtime-package",
        ],
    }
    output = root / "dist" if output is None else output
    if output.is_symlink():
        raise ValueError("Refusing linked package output directory")
    output.mkdir(parents=True, exist_ok=True)
    destination = output / ARTIFACT_NAME
    write_atomic(destination, data)
    write_atomic(
        Path(str(destination) + ".provenance.json"),
        (json.dumps(provenance, indent=2) + "\n").encode(),
    )
    write_atomic(
        Path(str(destination) + ".sha256"), f"{digest}  {destination.name}\n".encode()
    )
    load_artifact(destination)
    print(
        f"Package: {destination}\nSHA-256: {digest}\n"
        f"Provenance: {destination}.provenance.json",
        flush=True,
    )
    return destination


def load_artifact(path: Path) -> tuple[bytes, dict]:
    """Read and validate a prepared artifact without consulting current source."""
    data = read_regular(path, MAX_PACKAGE_BYTES)
    digest = sha256(data)
    checksum = read_regular(Path(str(path) + ".sha256"), 1024).decode()
    if checksum != f"{digest}  {path.name}\n":
        raise ValueError("Artifact checksum does not match; rerun scripts/package")
    provenance = json.loads(
        read_regular(Path(str(path) + ".provenance.json"), MAX_METADATA_BYTES),
        object_pairs_hook=unique_object,
    )
    if (
        not isinstance(provenance, dict)
        or provenance.get("format") != 1
        or provenance.get("domain") != DOMAIN
    ):
        raise ValueError("Unsupported artifact provenance")
    if provenance.get("artifact") != {
        "name": path.name,
        "sha256": digest,
        "bytes": len(data),
    }:
        raise ValueError("Artifact provenance does not match prepared bytes")
    files = inspect_package(data)
    if provenance.get("runtime_sha256") != {
        name: sha256(content) for name, content in files.items()
    }:
        raise ValueError("Runtime contents do not match artifact provenance")
    manifest = json.loads(files["manifest.json"], object_pairs_hook=unique_object)
    if not isinstance(provenance.get("version"), str) or provenance[
        "version"
    ] != manifest.get("version"):
        raise ValueError("Artifact version does not match its manifest")
    source = provenance.get("source")
    if (
        not isinstance(source, dict)
        or not isinstance(source.get("inputs"), dict)
        or not source["inputs"]
    ):
        raise ValueError("Artifact source provenance is missing")
    for name, value in source["inputs"].items():
        relative = PurePosixPath(name)
        if (
            relative.is_absolute()
            or str(relative) != name
            or ".." in relative.parts
            or not isinstance(value, str)
            or not re.fullmatch(r"[0-9a-f]{64}", value)
        ):
            raise ValueError("Artifact source provenance is invalid")
    if source.get("sha256") != input_digest(source["inputs"]):
        raise ValueError("Artifact source fingerprint does not match")
    if source.get("commit") is not None and (
        not isinstance(source["commit"], str)
        or not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", source["commit"])
    ):
        raise ValueError("Artifact source commit is invalid")
    if (
        "commit" not in source
        or "dirty" not in source
        or (source["dirty"] is not None and not isinstance(source["dirty"], bool))
    ):
        raise ValueError("Artifact source state is missing or invalid")
    for name, content in files.items():
        if source["inputs"].get(f"custom_components/{DOMAIN}/{name}") != sha256(
            content
        ):
            raise ValueError("Packaged runtime differs from recorded source inputs")
    if provenance.get("build") != {
        "command": "npm --prefix frontend run build:check",
        "panel_sha256": sha256(files["ui/assets/panel.js"]),
    }:
        raise ValueError("Artifact build provenance is missing or inconsistent")
    if provenance.get("checks") != [
        "generated-assets",
        "pyk-reconstruction",
        "project-invariants",
        "runtime-package",
    ]:
        raise ValueError("Artifact verification provenance is incomplete")
    return data, provenance


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    parser.add_argument(
        "--inspect",
        type=Path,
        metavar="ARTIFACT",
        help="verify an existing prepared artifact without rebuilding",
    )
    args = parser.parse_args()
    if args.inspect is not None:
        _, provenance = load_artifact(args.inspect)
        print(json.dumps(provenance, indent=2))
    else:
        write_package(output=args.output_dir)


def cli() -> int:
    try:
        main()
        return 0
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        tarfile.TarError,
        EOFError,
    ) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
    except subprocess.CalledProcessError as error:
        print(
            f"Package verification failed (exit status {error.returncode}).",
            file=sys.stderr,
        )
        return error.returncode if error.returncode >= 0 else 128 - error.returncode
    except KeyboardInterrupt:
        return 130
    return 1


if __name__ == "__main__":
    sys.exit(cli())

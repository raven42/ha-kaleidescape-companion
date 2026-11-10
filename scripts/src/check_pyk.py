"""Verify the reviewed bundle and optionally reconstruct it offline from its base."""

import argparse
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OVERLAY = ROOT / "scripts/assets/pyk-overlay"
BUNDLE = ROOT / "custom_components/kaleidescape_companion/vendor"


def verify(root, expected):
    """Check every manifested file and reject undocumented Python modules."""
    actual = {
        name: hashlib.sha256((root / name).read_bytes()).hexdigest()
        for name in expected
    }
    package = root / "kaleidescape"
    python_files = {str(path.relative_to(root)) for path in package.rglob("*.py")}
    expected_python = {name for name in expected if name.endswith(".py")}
    if actual != expected or python_files != expected_python:
        raise ValueError("Pyk source differs from the reviewed manifest")


def archive_files(data):
    """Compare tracked base contents independently of tar/compression metadata."""
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        return {
            member.name: archive.extractfile(member).read()
            for member in archive
            if member.isfile()
        }


def reconstruct(overlay=OVERLAY, base_checkout=None):
    """Apply the complete runtime diff to a pinned, checksum-verified base fixture.

    An optional upstream checkout is read only through git archive of the exact
    base commit; its working-tree edits never participate in reconstruction.
    """
    metadata = json.loads((overlay / "base.json").read_text())
    fixture = (overlay / "base.tar.gz").read_bytes()
    if hashlib.sha256(fixture).hexdigest() != metadata["archive_sha256"]:
        raise ValueError("Pyk base fixture checksum differs from the recorded base")
    if base_checkout is not None:
        tracked = subprocess.run(
            [
                "git",
                "-C",
                str(base_checkout),
                "archive",
                metadata["commit"],
                *metadata["paths"],
            ],
            capture_output=True,
            check=True,
        ).stdout
        if archive_files(tracked) != archive_files(fixture):
            raise ValueError("Pyk fixture differs from the recorded upstream commit")
    expected = json.loads((overlay / "hashes.json").read_text())
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        with tarfile.open(fileobj=io.BytesIO(fixture)) as archive:
            archive.extractall(temporary, filter="data")
        subprocess.run(
            ["git", "apply", "--check", str((overlay / "companion.patch").resolve())],
            cwd=temporary,
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["git", "apply", str((overlay / "companion.patch").resolve())],
            cwd=temporary,
            capture_output=True,
            check=True,
        )
        verify(temporary, expected)
    return len(expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=BUNDLE)
    parser.add_argument("--reconstruct", action="store_true")
    parser.add_argument("--base-checkout", type=Path)
    args = parser.parse_args()
    if args.base_checkout and not args.reconstruct:
        parser.error("--base-checkout requires --reconstruct")
    try:
        verify(args.root, json.loads((OVERLAY / "hashes.json").read_text()))
        if args.reconstruct:
            count = reconstruct(base_checkout=args.base_checkout)
            print(f"Pyk reconstruction matches all {count} manifested runtime files")
    except (
        OSError,
        ValueError,
        tarfile.TarError,
        subprocess.CalledProcessError,
    ) as error:
        parser.exit(1, f"Pyk verification failed: {error}\nSee the development guide\n")


if __name__ == "__main__":
    main()

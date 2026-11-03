"""Synchronize the standalone API package into Companion's runtime package."""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "kaleidescape-api" / "src" / "kaleidescape_api"
TARGET = (
    ROOT
    / "custom_components"
    / "kaleidescape_companion"
    / "_vendor"
    / "kaleidescape_api"
)
EXCLUDED = {"__main__.py", "cli.py"}


def synchronize(*, check=False, source=SOURCE, target=TARGET):
    """Copy importable API modules, excluding the standalone command-line app."""
    if source.is_symlink() or not (source / "__init__.py").is_file():
        raise ValueError(f"API source package is missing or linked: {source}")
    for path in source.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Refusing symlink in API source: {path}")
    if target.is_symlink():
        raise ValueError(f"Refusing linked API vendor directory: {target}")

    expected = {
        path.relative_to(source).as_posix(): path.read_bytes()
        for path in source.rglob("*")
        if path.is_file()
        and path.name not in EXCLUDED
        and (path.suffix == ".py" or path.name == "py.typed")
    }
    actual = (
        {
            path.relative_to(target).as_posix(): path
            for path in target.rglob("*")
            if path.is_file() and (path.suffix == ".py" or path.name == "py.typed")
        }
        if target.exists()
        else {}
    )
    stale = set(expected) != set(actual) or any(
        name not in actual or actual[name].read_bytes() != content
        for name, content in expected.items()
    )
    if check:
        if stale:
            raise ValueError("Bundled API is stale; regenerate its vendor copy")
        return

    for name, path in actual.items():
        if name not in expected:
            path.unlink()
    for name, content in expected.items():
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    try:
        synchronize(check=arguments.check)
    except (OSError, ValueError) as error:
        print(f"API vendor check failed: {error}", file=sys.stderr)
        sys.exit(1)

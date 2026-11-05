"""Verify the exact reviewed development pyk package without importing it."""

import hashlib
import json
import sys
from pathlib import Path


def main():
    root = Path(sys.argv[1])
    expected = json.loads(
        (Path(__file__).parent / "pyk-overlay/hashes.json").read_text()
    )
    try:
        actual = {
            name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            for name in expected
        }
    except OSError:
        sys.exit(
            "The reviewed patched pyk source is missing; see the development guide"
        )
    package = root / "kaleidescape"
    python_files = {str(path.relative_to(root)) for path in package.rglob("*.py")}
    expected_python = {name for name in expected if name.endswith(".py")}
    if actual != expected or python_files != expected_python:
        sys.exit(
            "Pyk source differs from the reviewed patch; see the development guide"
        )


if __name__ == "__main__":
    main()

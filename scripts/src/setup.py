"""Prepare the declared Python and frontend development dependencies."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

from scripts.src import tasks


def validate_prerequisites() -> None:
    if sys.version_info < (3, 14, 2):
        raise ValueError("Python 3.14.2 or newer is required; set COMPANION_PYTHON.")
    if sqlite3.sqlite_version_info < (3, 35):
        raise ValueError("Python must provide SQLite 3.35 or newer.")
    for executable in ("node", "npm"):
        if shutil.which(executable) is None:
            raise ValueError(f"{executable} is missing; install Node.js and npm.")
    version = subprocess.check_output(["node", "--version"], text=True).strip()
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version)
    major, minor, _ = map(int, match.groups()) if match else (0, 0, 0)
    if not ((major == 22 and minor >= 13) or major >= 24):
        required = json.loads((tasks.FRONTEND / "package.json").read_text())["engines"][
            "node"
        ]
        raise ValueError(f"Node.js {required} is required; found {version}.")


def main() -> None:
    argparse.ArgumentParser(description=__doc__).parse_args()
    validate_prerequisites()
    environment = Path(os.environ.get("COMPANION_VENV", tasks.ROOT / ".venv"))
    if not environment.is_absolute():
        raise ValueError("COMPANION_VENV must be an absolute path.")
    python = environment / "bin/python"
    if not python.exists():
        tasks.run([sys.executable, "-m", "venv", environment])
    # Reject an older existing environment instead of letting pip fail obscurely.
    tasks.run(
        [
            python,
            "-c",
            "import sqlite3, sys; "
            "sys.exit(0 if sys.version_info >= (3, 14, 2) and "
            "sqlite3.sqlite_version_info >= (3, 35) else "
            "'Existing environment requires Python 3.14.2+ with SQLite 3.35+; "
            "choose a fresh COMPANION_VENV.')",
        ]
    )
    tasks.run([python, "-m", "pip", "install", "-e", ".[dev,audit]"])
    tasks.run(["npm", "--prefix", tasks.FRONTEND, "ci"])


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

"""Start the loopback-only frontend development server."""

import os
import sys

from scripts.src import tasks


def main():
    os.chdir(tasks.ROOT)
    os.execvp(
        "npm",
        ["npm", "--prefix", str(tasks.FRONTEND), "run", "dev", "--", *sys.argv[1:]],
    )


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

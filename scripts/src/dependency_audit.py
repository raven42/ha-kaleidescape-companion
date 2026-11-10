"""Run both network advisory scans and fail if either cannot complete cleanly."""

import argparse
import sys

from scripts.src import tasks


def main() -> int:
    argparse.ArgumentParser(description=__doc__).parse_args()
    failed = False
    for command in (
        [sys.executable, "-m", "pip_audit", "--skip-editable"],
        ["npm", "audit", "--prefix", tasks.FRONTEND],
    ):
        try:
            result = tasks.run(command, check=False)
        except OSError as error:
            print(f"Dependency scan could not run: {error}", file=sys.stderr)
            result = 1
        if result < 0:
            return 128 - result
        failed |= bool(result)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

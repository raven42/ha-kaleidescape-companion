"""Type-check and compile the frontend, intentionally updating packaged assets."""

import argparse

from scripts.src import tasks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Run the full check after building"
    )
    args = parser.parse_args()
    tasks.quality_checks()
    tasks.npm("build")
    if args.check:
        tasks.check_after_quality()


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

"""Apply source/documentation formatting, or verify it with --check."""

import argparse

from scripts.src import tasks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Verify without rewriting files"
    )
    args = parser.parse_args()
    tasks.format_sources(check=args.check)


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

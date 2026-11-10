"""Type-check and compile the frontend, intentionally updating packaged assets."""

import argparse

from scripts.src import tasks


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    tasks.npm("build")


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

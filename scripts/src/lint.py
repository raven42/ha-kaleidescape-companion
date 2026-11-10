"""Run Python, frontend and Markdown lint using the shared check groups."""

import argparse

from scripts.src import tasks


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    tasks.lint()


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

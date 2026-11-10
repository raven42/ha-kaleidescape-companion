"""Run the complete offline validation gate without accepting generated changes."""

import argparse

from scripts.src import tasks


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    tasks.check()


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

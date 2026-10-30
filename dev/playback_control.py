"""Compatibility entry point for the independently installed Kaleidescape API CLI."""

from kaleidescape_api.cli import main

if __name__ == "__main__":
    raise SystemExit(main())

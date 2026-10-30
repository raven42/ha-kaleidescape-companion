"""Standalone operator harness; loads only the standard-library protocol module."""

import argparse
import asyncio
import importlib.util
import json
import sys
from dataclasses import asdict
from pathlib import Path

# Importing the integration package would also import HA. Load this one pure
# module directly so the harness works without HA installed or running.
spec = importlib.util.spec_from_file_location(
    "companion_playback_protocol",
    Path(__file__).resolve().parents[1]
    / "custom_components/kaleidescape_companion/playback/protocol.py",
)
protocol = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = protocol
spec.loader.exec_module(protocol)


def arguments(argv=None):
    parser = argparse.ArgumentParser(
        description="Kaleidescape TCP playback proof of concept (no HA required)."
    )
    parser.add_argument(
        "--ipaddress", required=True, help="Direct player's private LAN IP"
    )
    parser.add_argument(
        "--serial-number", required=True, help="Player's hexadecimal serial"
    )
    operation = parser.add_mutually_exclusive_group()
    operation.add_argument(
        "--play",
        nargs="?",
        const="",
        metavar="HANDLE",
        help="PLAY current selection, or experimental PLAY_MOVIE for a handle",
    )
    operation.add_argument("--stop", action="store_true", help="Send STOP once")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate the operation without sending it",
    )
    return parser.parse_args(argv)


async def run(args):
    player = protocol.Player(args.ipaddress, args.serial_number)
    if args.stop:
        return await player.stop(dry_run=args.dry_run)
    if args.play is not None:
        return await player.play(args.play or None, dry_run=args.dry_run)
    return await player.probe()


def main(argv=None):
    args = arguments(argv)
    exit_code = 0
    try:
        result = asyncio.run(run(args))
    except protocol.Unconfirmed as error:
        result = {**error.evidence, "outcome": "unconfirmed", "message": str(error)}
        exit_code = 3
    except protocol.ProtocolError as error:
        result = {"outcome": "failed", "message": str(error)}
        exit_code = 2
    except KeyboardInterrupt:
        print(
            "Interrupted; inspect the player before repeating a playback operation.",
            file=sys.stderr,
        )
        return 130
    print(
        json.dumps(
            result,
            default=asdict,
            indent=2,
            ensure_ascii=True,
        )
    )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

"""Extract saved purchases as JSON or correct a private SQLite COPY offline."""

import argparse
import asyncio
import json
import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from custom_components.kaleidescape_companion.core.repository import JournalRepository  # noqa: E402
from custom_components.kaleidescape_companion.core.security import (  # noqa: E402
    private_directory,
    private_file,
)
from dev.purchase_history import MAX_BYTES, apply, parse_purchases  # noqa: E402
from dev.purchase_history import preview as preview_history


def read_history(history):
    if not history.is_file() or history.is_symlink():
        raise ValueError("Provide a regular saved purchase HTML file")
    with history.open("rb") as source:
        body = source.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Purchase history exceeds 8 MiB")
    return body


def export_json(history, output):
    """Create a private JSON file; leave existing outputs and parent modes alone."""
    if output.exists() or output.is_symlink():
        raise ValueError("Output already exists; choose a new JSON output path")
    records = parse_purchases(read_history(history))
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(
        output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as destination:
            json.dump(records, destination, ensure_ascii=False, indent=2)
            destination.write("\n")
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    print(
        f"Wrote {len(records)} purchase record{'' if len(records) == 1 else 's'} "
        f"to {output}"
    )


async def run(database, history, output):
    if output.exists() or output.is_symlink():
        raise ValueError("Output already exists; choose a new private copy path")
    if not database.is_file() or database.is_symlink():
        raise ValueError("Provide a regular database copy and saved purchase HTML")
    body = read_history(history)
    private_directory(output.parent)
    private_file(output, create=True)
    with closing(
        sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    ) as source:
        source.execute("PRAGMA trusted_schema=OFF")
        source.execute("PRAGMA query_only=ON")
        sources = source.execute("SELECT id FROM library_sources").fetchall()
        if len(sources) != 1:
            raise ValueError("This offline helper requires exactly one Library source")
        with closing(sqlite3.connect(output)) as destination:
            source.backup(destination)
    repository = JournalRepository(output)
    try:
        await repository.async_open()
        preview = await repository._call(
            preview_history, repository._db(), sources[0][0], body
        )
        updates = [
            {"title_id": version["id"], "purchased_on": row["purchased_on"]}
            for row in preview["rows"]
            if not row["ambiguous"]
            for version in row["versions"]
        ]
        revision = preview["revision"]
        for start in range(0, len(updates), 1000):
            result = await repository._call(
                repository._library_write,
                apply,
                sources[0][0],
                str(uuid4()),
                revision,
                updates[start : start + 1000],
                "offline-purchase-import",
            )
            revision = result["revision"]
        report = output.with_suffix(".review.json")
        private_file(report, create=True)
        report.write_text(json.dumps(preview, ensure_ascii=False, indent=2))
        print(
            f"Updated {len(updates)} explicitly matched "
            f"version{'' if len(updates) == 1 else 's'} in the output copy."
        )
        print(
            f"Unmatched names: {sum(not row['versions'] for row in preview['rows'])}; "
            f"ambiguous names: {sum(row['ambiguous'] for row in preview['rows'])}."
        )
        print(f"Corrected private copy: {output}")
        print(f"Private match review: {report}")
        print("Input database unchanged. No HA deployment or device request performed.")
    finally:
        await repository.async_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=("sqlite", "json"), default="sqlite")
    parser.add_argument(
        "--database", type=Path, help="Input database copy (SQLite mode only)"
    )
    parser.add_argument("--history", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.format == "json":
        if args.database is not None:
            parser.error("--database is only used with --format sqlite")
        export_json(args.history, args.output)
    else:
        if args.database is None:
            parser.error("--database is required with --format sqlite")
        asyncio.run(run(args.database, args.history, args.output))


if __name__ == "__main__":
    main()

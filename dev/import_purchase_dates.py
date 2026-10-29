"""Correct a private database COPY from saved invoices; never change the input."""

import argparse
import asyncio
import json
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
from dev.purchase_history import MAX_BYTES, apply  # noqa: E402
from dev.purchase_history import preview as preview_history


async def run(database, history, output):
    if output.exists() or output.is_symlink():
        raise ValueError("Output already exists; choose a new private copy path")
    if not database.is_file() or database.is_symlink() or not history.is_file():
        raise ValueError("Provide a regular database copy and saved purchase HTML")
    if history.stat().st_size > MAX_BYTES:
        raise ValueError("Purchase history exceeds 8 MiB")
    body = history.read_bytes()
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
        print(f"Updated {len(updates)} explicitly matched versions in the output copy.")
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
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--history", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    asyncio.run(run(args.database, args.history, args.output))


if __name__ == "__main__":
    main()

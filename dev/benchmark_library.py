"""Benchmark bounded Library queries using only fictional temporary data."""

import argparse
import asyncio
import json
import statistics
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from custom_components.kaleidescape_companion.core.repository import (  # noqa: E402
    JournalRepository,
)
from custom_components.kaleidescape_companion.library.store import source_id  # noqa: E402


async def run(titles: int, samples: int) -> None:
    origin = "http://fictional-library.invalid"
    source = source_id(origin)
    rows = [
        {
            "source_handle": f"fictional-{index}",
            "source_group": f"group-{index // 2}",
            "title": f"Fictional movie {index // 2:05}",
            "edition": "4K" if index % 2 == 0 else "HD",
            "formats": ["4K" if index % 2 == 0 else "HD"],
            "year": 1980 + index % 40,
            "duration_seconds": 5400 + index % 1800,
            "rating": "PG",
            "actors": [f"Fictional actor {actor}" for actor in range(15)],
            "directors": [f"Fictional director {index % 10}"],
            "genres": ["Adventure"],
            "synopsis": "Fictional metadata for isolated timing. " * 20,
        }
        for index in range(titles * 2)
    ]
    collections = {f"Example collection {group}": [] for group in range(20)}
    collections.update({"Played": [], "Paused": []})
    for index, row in enumerate(rows):
        collections[f"Example collection {index % 20}"].append(row["source_handle"])
        if index % 3 == 0:
            collections["Played"].append(row["source_handle"])
        if index % 7 == 0:
            collections["Paused"].append(row["source_handle"])
    with tempfile.TemporaryDirectory(prefix="fictional-library-benchmark-") as folder:
        repository = JournalRepository(Path(folder) / "journal.sqlite3")
        try:
            await repository.async_open()
            await repository.async_library_catalog(origin, rows, collections)
            print(
                f"Fictional catalog: {titles} name{'' if titles == 1 else 's'}, "
                f"{len(rows)} version{'' if len(rows) == 1 else 's'}; no network"
            )
            print("Entries | Median ms | Maximum ms | JSON KiB")
            for limit in (50, 250, 500, 1000):
                filters = {"grouped": True, "limit": limit}
                await repository.async_library_list(source, filters)
                timings = []
                for _ in range(samples):
                    start = time.perf_counter()
                    page = await repository.async_library_list(source, filters)
                    timings.append((time.perf_counter() - start) * 1000)
                size = len(json.dumps(page, ensure_ascii=False).encode()) / 1024
                print(
                    f"{limit:7} | {statistics.median(timings):9.2f} | "
                    f"{max(timings):10.2f} | {size:8.1f}"
                )
        finally:
            await repository.async_close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--titles", type=int, default=5000)
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()
    if not 1 <= args.titles <= 5000 or not 1 <= args.samples <= 20:
        parser.error("titles must be 1–5000 and samples 1–20")
    asyncio.run(run(args.titles, args.samples))


if __name__ == "__main__":
    main()

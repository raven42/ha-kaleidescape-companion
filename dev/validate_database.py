"""Read-only offline SQLite integrity checks; never repair or expose row values."""

import argparse
import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path

JSON_COLUMNS = {
    "library": ("data", "enrichment", "purchase_history"),
    "viewings": ("library_metadata",),
}


def validate(path: Path, *, seconds=30):
    """Return counts only. SQL remains fixed; exported copies are recommended."""
    path = path.absolute()
    if path.is_symlink() or not path.is_file():
        raise ValueError("Choose an existing regular database file")
    started = time.monotonic()
    with closing(
        sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=2)
    ) as db:
        db.execute("PRAGMA query_only=ON")
        db.set_progress_handler(lambda: time.monotonic() - started > seconds, 1000)
        integrity = db.execute("PRAGMA integrity_check(100)").fetchall()
        report = {
            "read_only": True,
            "integrity_ok": integrity == [("ok",)],
            "integrity_errors": sum(row != ("ok",) for row in integrity),
            "foreign_key_errors": sum(
                1 for _ in db.execute("PRAGMA foreign_key_check")
            ),
            "invalid_json": 0,
        }
        for table, columns in JSON_COLUMNS.items():
            known = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
            for column in columns:
                if column in known:
                    report["invalid_json"] += db.execute(
                        f"SELECT count(*) FROM {table} WHERE {column} IS NOT NULL "
                        f"AND NOT json_valid({column})"
                    ).fetchone()[0]
        report["ok"] = report["integrity_ok"] and not (
            report["foreign_key_errors"] or report["invalid_json"]
        )
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, help="Prefer a downloaded SQLite export")
    args = parser.parse_args()
    try:
        result = validate(args.database)
    except OSError, sqlite3.Error, ValueError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": (
                        "Database could not be validated; "
                        "check the file, format, or execution limit"
                    ),
                }
            )
        )
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

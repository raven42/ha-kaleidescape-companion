"""Measure reusable title/year suggestions against a read-only exported Library.

Print aggregate counts only. Optional row details go to a new private report,
never to fixtures, runtime logs or modified input/database files.
"""

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from collections import Counter
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from custom_components.kaleidescape_companion.core.importing import (  # noqa: E402
    MAX_IMPORT_BYTES,
    MAX_IMPORT_ROWS,
    decode_json,
    parse_bundle,
)
from custom_components.kaleidescape_companion.core.models import JournalError, invalid  # noqa: E402
from custom_components.kaleidescape_companion.library.purchases import (  # noqa: E402
    index as purchase_index,
)
from custom_components.kaleidescape_companion.library.purchases import (
    title_query,
)
from custom_components.kaleidescape_companion.library.title_matching import (  # noqa: E402
    TitleMatcher,
    TitleQuery,
)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load_queries(input_path, import_format):
    """Adapt supported exports or an explicit title-only manifest; never apply."""
    with input_path.open("rb") as stream:
        payload = stream.read(MAX_IMPORT_BYTES + 1)
    if not payload or len(payload) > MAX_IMPORT_BYTES:
        raise invalid("Input must contain at most 32 MiB")
    if import_format == "json":
        try:
            document = decode_json(payload.decode("utf-8-sig"))
        except (ValueError, TypeError, RecursionError, UnicodeError) as error:
            raise invalid(
                "Expected a compatible JSON export or title manifest"
            ) from error
        if isinstance(document, dict) and "titles" in document:
            rows = document["titles"]
            if (
                set(document) != {"titles"}
                or not isinstance(rows, list)
                or len(rows) > MAX_IMPORT_ROWS
            ):
                raise invalid("Expected a title-only manifest of at most 10000 rows")
            queries = []
            for row in rows:
                if (
                    not isinstance(row, dict)
                    or "title" not in row
                    or set(row)
                    - {"title", "alternate_title", "year", "source_id", "source_group"}
                ):
                    raise invalid("Invalid title evidence fields")
                queries.append(("title", TitleQuery(**row)))
            return queries
    bundle = parse_bundle(payload, import_format)
    return (
        [("viewing", TitleQuery(row["title"])) for row in bundle["viewings"]]
        + [
            (
                "library",
                TitleQuery(
                    row["title"],
                    year=row["data"].get("year"),
                    source_id=row["source_id"],
                    source_group=row["source_group"],
                ),
            )
            for row in bundle["library"]
        ]
        + [("purchase", title_query(row)) for row in bundle["purchases"]]
    )


def evaluate(database, input_path, import_format=None):
    before = {
        "database": digest(database),
        "input": digest(input_path),
    }
    import_format = import_format or (
        "sqlite"
        if input_path.suffix.lower() in {".sqlite", ".sqlite3", ".db"}
        else "json"
    )
    queries = load_queries(input_path, import_format)
    started = time.monotonic()
    with closing(
        sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    ) as db:
        db.row_factory = sqlite3.Row
        db.setconfig(sqlite3.SQLITE_DBCONFIG_DEFENSIVE, True)
        db.setconfig(sqlite3.SQLITE_DBCONFIG_TRUSTED_SCHEMA, False)
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 4 * 1024 * 1024)
        db.execute("PRAGMA query_only=ON")
        deadline = started + 30
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        db.execute("BEGIN")
        tables = dict(
            db.execute("SELECT name,type FROM pragma_table_list WHERE schema='main'")
        )
        if tables.get("library") != "table":
            raise ValueError("Expected a regular Library table")
        preferred_ids = (
            (
                link["owner"]
                for link in purchase_index(db).values()
                if not link["pending"]
            )
            if any(kind == "purchase" for kind, _ in queries)
            else ()
        )
        matcher = TitleMatcher(db, deadline, preferred_ids=preferred_ids)
        exact = {}
        titles = {}
        for row in db.execute(
            "SELECT id,source_id,source_group,title,title_search FROM library "
            "WHERE available=1 AND purchase_match_pending=0"
        ):
            exact.setdefault(row["title_search"], set()).add(
                (row["source_id"], row["source_group"])
            )
            titles[row["id"]] = row["title"]
        results = []
        for kind, query in queries:
            match = matcher.match(query)
            results.append(
                {
                    "kind": kind,
                    "title": query.title,
                    "alternate_title": query.alternate_title,
                    "year": query.year,
                    "target": match.target,
                    "matched_title": titles.get(match.target),
                    "method": match.method,
                    "detail": match.detail,
                }
            )
        baseline = sum(
            len(exact.get(query.title.casefold(), ())) == 1 for _, query in queries
        )
    after = {
        "database": digest(database),
        "input": digest(input_path),
    }
    if before != after:
        raise ValueError("Input changed during evaluation; repeat with a stable export")
    count = sum(row["target"] is not None for row in results)
    summary = {
        "record_count": len(results),
        "record_types": dict(Counter(kind for kind, _ in queries)),
        "exact_title_matches": baseline,
        "proposed_matches": count,
        "unresolved": len(results) - count,
        "match_percent": round(100 * count / len(results), 2) if results else 0,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "methods": dict(Counter(row["method"] for row in results)),
    }
    return {
        "evaluation": "fresh title suggestions; existing links ignored; no writes",
        "input_sha256": before,
        "summary": summary,
        "rows": sorted(results, key=lambda row: row["target"] is not None),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database",
        type=Path,
        required=True,
        help="Schema-16+ SQLite export (opened read-only)",
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Companion JSON/SQLite export or {titles: [...]} JSON manifest",
    )
    parser.add_argument(
        "--format",
        choices=("json", "sqlite"),
        help="Override format inferred from the input suffix",
    )
    parser.add_argument(
        "--report", type=Path, help="New private JSON report; refuses existing files"
    )
    args = parser.parse_args()
    try:
        report = evaluate(args.database, args.input, args.format)
        if args.report:
            descriptor = os.open(
                args.report, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
            )
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                    json.dump(
                        report, output, ensure_ascii=True, indent=2, allow_nan=False
                    )
                    output.write("\n")
            except BaseException:
                args.report.unlink(missing_ok=True)
                raise
        print(json.dumps(report["summary"], indent=2))
    except (OSError, sqlite3.Error, ValueError, JournalError) as error:
        # Report no private record text, SQL contents, database paths or order IDs.
        raise SystemExit(
            f"Title evaluation failed ({type(error).__name__}); "
            "check the input files and report destination"
        ) from None


if __name__ == "__main__":
    main()

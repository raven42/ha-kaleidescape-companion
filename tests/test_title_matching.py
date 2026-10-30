"""Fictional matching evidence, remake/sequel boundaries and read-only evaluation."""

import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.library.purchases import (
    purchase_record,
    title_query,
)
from custom_components.kaleidescape_companion.library.title_matching import (
    TitleMatcher,
    TitleQuery,
    store_title,
)
from dev.benchmark_title_matching import evaluate, main

SOURCE = "a" * 64


class TitleMatchingTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.db.execute(
            "CREATE TABLE library(id,source_id,source_group,title,title_search,data,"
            "purchase_history,available,purchase_match_pending)"
        )
        self.count = 0
        self.preferred = set()

    def add(
        self,
        title,
        year=2025,
        *,
        source=SOURCE,
        group=None,
        search=None,
        preferred=False,
    ):
        self.count += 1
        id = f"{self.count:064x}"
        self.db.execute(
            "INSERT INTO library VALUES (?,?,?,?,?,?,?,1,0)",
            (
                id,
                source,
                group or id,
                title,
                search or title.casefold(),
                json.dumps({"year": year}),
                "[]",
            ),
        )
        if preferred:
            self.preferred.add(id)
        return id

    def match(self, title, href=None, **extra):
        alternate, year = store_title(href)
        return TitleMatcher(self.db, preferred_ids=self.preferred).match(
            TitleQuery(
                title,
                alternate_title=alternate,
                year=year,
                **extra,
            )
        )

    def test_year_separates_remakes_and_rejects_wrong_year_exact_titles(self):
        old = self.add("The Hidden Sea", 1990)
        new = self.add("The Hidden Sea", 2025)
        self.assertEqual(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-hidden-sea-2025"
            ).target,
            new,
        )
        self.assertEqual(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-hidden-sea-1990"
            ).target,
            old,
        )
        self.assertIsNone(self.match("The Hidden Sea").target)
        self.assertIsNone(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-hidden-sea-2010"
            ).target
        )

    def test_normalized_titles_editions_articles_and_search_title_aliases(self):
        cases = [
            (
                "The Cartographer's Café",
                "Cartographer’s Cafe - 45th Anniversary Edition",
            ),
            ("The Cartographer's Café", "Cartographer’s Cafe (Complete)"),
            (
                "The Quiet Sea: Return to Shore",
                "Quiet Sea: Return to Shore - Ultimate Edition",
            ),
            (
                "The Quiet Sea: Return to Shore (Director's Cut)",
                "The Quiet Sea: Return to Shore",
            ),
            ("Shores & Stars", "Shores and Stars"),
            ("Gone in 60 Nights", "Gone In Sixty Nights"),
            ("21 Lanterns", "Twenty-One Lanterns"),
            ("Chronicles Episode IV: The Last Lantern", "Chronicles: The Last Lantern"),
            ("Chronicles II: The Two Lanterns", "Chronicles: The Two Lanterns"),
            ("The Last Lantern", "Marvel's The Last Lantern"),
        ]
        for library, purchase in cases:
            with self.subTest(title=purchase):
                self.db.execute("DELETE FROM library")
                target = self.add(library)
                self.assertEqual(self.match(purchase).target, target)
        self.db.execute("DELETE FROM library")
        target = self.add("Display title", search="Alternative catalog name")
        self.assertEqual(self.match("Alternative Catalog Name").target, target)

    def test_passive_store_slug_supplies_alias_year_and_ignores_order_hash(self):
        target = self.add("The Last Lantern")
        self.assertEqual(
            self.match(
                "A different store spelling",
                "https://store.example.invalid/movie-store/movie/the-last-lantern-2025-deadbeef?ignored=1",
            ).target,
            target,
        )
        self.assertEqual(
            store_title("/movie-store/movie/the-last-lantern-2025-extended-edition"),
            ("the last lantern", 2025),
        )
        self.assertEqual(
            store_title("/movie-store/movie/2001-a-distant-shore-1968"),
            ("2001 a distant shore", 1968),
        )
        for href in (
            "https://example.invalid/other/movie-2025",
            "/movie-store/movie/x%2Fy-2025",
            "/movie-store/movie/x%5Cy-2025",
            "/movie-store/movie/%ff-2025",
        ):
            self.assertEqual(store_title(href), ("", None))

    def test_contradictory_title_or_sequel_evidence_never_gets_assigned(self):
        self.add("The Hidden Sea")
        self.add("The Last Lantern")
        self.assertEqual(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-last-lantern-2025"
            ).method,
            "conflicting_titles",
        )
        self.add("Chronicles Episode III: The Last Shore")
        self.assertIsNone(
            self.match(
                "Chronicles Episode II: The Last Shore",
                "/movie-store/movie/chronicles-episode-ii-the-last-shore-2025",
            ).target
        )
        self.assertIsNone(
            self.match(
                "Chronicles: The Last Shore",
                "/movie-store/movie/chronicles-episode-ii-the-last-shore-2025",
            ).target
        )
        self.assertIsNone(
            self.match(
                "Chronicles Episode II: The Last Shore",
                "/movie-store/movie/chronicles-episode-iii-the-last-shore-2025",
            ).target
        )

    def test_decimal_version_slugs_do_not_change_sequel_numbers(self):
        target = self.add("Terminal 2.0")
        self.assertEqual(
            self.match("Terminal 2.0", "/movie-store/movie/terminal-20-2025").target,
            target,
        )
        self.assertIsNone(
            self.match("Terminal 2", "/movie-store/movie/terminal-20-2025").target
        )

    def test_same_year_and_multiple_sources_remain_ambiguous(self):
        target = self.add("The Hidden Sea")
        self.add("The Hidden Sea", source="b" * 64)
        self.assertIsNone(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-hidden-sea-2025"
            ).target
        )
        self.assertEqual(
            self.match(
                "The Hidden Sea",
                "/movie-store/movie/the-hidden-sea-2025",
                source_id=SOURCE,
                source_group=target,
            ).target,
            target,
        )
        self.add("Hidden Sea")
        self.assertIsNone(
            self.match(
                "The Hidden Sea",
                "/movie-store/movie/the-hidden-sea-2025",
                source_id=SOURCE,
                source_group="not-present",
            ).target
        )

    def test_group_year_fallback_and_preferred_target_are_preserved(self):
        self.add("The Hidden Sea", group="work")
        owner = self.add("The Hidden Sea", None, group="work", preferred=True)
        self.assertEqual(
            self.match(
                "The Hidden Sea", "/movie-store/movie/the-hidden-sea-2025"
            ).target,
            owner,
        )
        self.add("Missing Year", None)
        self.assertIsNone(
            self.match("Missing Year", "/movie-store/movie/missing-year-2025").target
        )

    def test_suggestions_leave_invoice_identity_and_original_fields_intact(self):
        self.add("The Hidden Sea")
        raw = {
            "title": "HIDDEN SEA - Extended Edition",
            "purchased_on": "2020-01-02",
            "purchase_price": "$1.00",
            "order_id": "FICTIONAL",
            "href": "/movie-store/movie/the-hidden-sea-2025",
        }
        record = purchase_record(raw)
        before = dict(record)
        self.assertIsNotNone(TitleMatcher(self.db).match(title_query(record)).target)
        self.assertEqual(record, before)
        self.assertEqual(purchase_record(raw)["id"], before["id"])

    def test_matching_enforces_catalog_and_time_limits(self):
        self.add("One title")
        self.add("Another title")
        with patch(
            "custom_components.kaleidescape_companion.library.title_matching.MAX_MATCH_VERSIONS",
            1,
        ):
            with self.assertRaises(JournalError):
                TitleMatcher(self.db)
        with self.assertRaises(JournalError):
            TitleMatcher(self.db, deadline=0)

    def test_readonly_benchmark_private_report_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database, purchases, report = (
                root / name
                for name in ("snapshot.sqlite", "purchases.json", "review.json")
            )
            self.add("The Hidden Sea")
            self.db.commit()
            with closing(sqlite3.connect(database)) as output:
                self.db.backup(output)
            purchases.write_text(
                json.dumps(
                    [
                        {
                            "title": "Hidden Sea - Extended Edition",
                            "purchased_on": "2020-01-02",
                            "order_id": "FICTIONAL-PRIVATE-ORDER",
                            "href": "/movie-store/movie/the-hidden-sea-2025",
                        }
                    ]
                )
            )
            before = [
                hashlib.sha256(path.read_bytes()).hexdigest()
                for path in (database, purchases)
            ]
            result = evaluate(database, purchases)
            self.assertEqual(result["summary"]["proposed_matches"], 1)
            self.assertEqual(result["summary"]["exact_title_matches"], 0)
            args = [
                "benchmark",
                "--database",
                str(database),
                "--input",
                str(purchases),
                "--report",
                str(report),
            ]
            stdout = StringIO()
            with patch("sys.argv", args), redirect_stdout(stdout):
                main()
            self.assertEqual(report.stat().st_mode & 0o777, 0o600)
            self.assertNotIn("Hidden Sea", stdout.getvalue())
            self.assertNotIn("FICTIONAL-PRIVATE-ORDER", report.read_text())
            original = report.read_bytes()
            with patch("sys.argv", args), self.assertRaises(SystemExit):
                main()
            self.assertEqual(report.read_bytes(), original)
            self.assertEqual(
                before,
                [
                    hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in (database, purchases)
                ],
            )

            purchases.write_text("{invalid JSON")
            with patch("sys.argv", args), self.assertRaises(SystemExit):
                main()
            self.assertEqual(report.read_bytes(), original)

    def test_benchmark_rejects_non_table_library_without_changing_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database, purchases = root / "snapshot.sqlite", root / "purchases.json"
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE VIEW library AS SELECT 'untrusted' title")
                db.commit()
            purchases.write_text(
                json.dumps([{"title": "Hidden Sea", "purchased_on": "2020-01-02"}])
            )
            before = database.read_bytes()
            with self.assertRaises(ValueError):
                evaluate(database, purchases)
            self.assertEqual(database.read_bytes(), before)

    def test_direct_title_queries_are_independent_of_purchase_fields(self):
        old = self.add("The Hidden Sea", 1990)
        new = self.add("The Hidden Sea", 2025)
        matcher = TitleMatcher(self.db)
        self.assertEqual(matcher.match(TitleQuery("Hidden Sea", year=2025)).target, new)
        self.assertEqual(
            matcher.match(
                TitleQuery(
                    "Alternative spelling", alternate_title="Hidden Sea", year=1990
                )
            ).target,
            old,
        )
        for data in (
            {"title": ""},
            {"title": "Movie", "year": True},
            {"title": "Movie", "year": 1700},
            {"title": "Movie", "source_id": SOURCE},
            {"title": "Movie", "source_id": SOURCE, "source_group": "bad group"},
        ):
            with self.assertRaises(JournalError):
                TitleQuery(**data)

    def test_benchmark_accepts_title_manifest_and_library_sqlite(self):
        from custom_components.kaleidescape_companion.library.store import title_id

        target = self.add("The Hidden Sea", group="work")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference, manifest, library_export = (
                root / name
                for name in ("reference.sqlite", "titles.json", "library.db")
            )
            self.db.commit()
            with closing(sqlite3.connect(reference)) as db:
                self.db.backup(db)
            manifest.write_text(
                json.dumps(
                    {
                        "titles": [
                            {"title": "Hidden Sea", "year": 2025},
                            {
                                "title": "Other spelling",
                                "alternate_title": "Hidden Sea",
                                "year": 2025,
                            },
                        ]
                    }
                )
            )
            result = evaluate(reference, manifest)
            self.assertEqual(result["summary"]["record_types"], {"title": 2})
            self.assertEqual(result["summary"]["proposed_matches"], 2)
            self.assertTrue(all(row["target"] == target for row in result["rows"]))
            with closing(sqlite3.connect(library_export)) as db:
                db.execute(
                    "CREATE TABLE library(id,source_id,source_handle,source_group,"
                    "title,data)"
                )
                db.execute(
                    "INSERT INTO library VALUES (?,?,?,?,?,?)",
                    (
                        title_id(SOURCE, "some-format"),
                        SOURCE,
                        "some-format",
                        "work",
                        "The Hidden Sea",
                        json.dumps({"year": 2025}),
                    ),
                )
                db.commit()
            result = evaluate(reference, library_export)
            self.assertEqual(result["summary"]["record_types"], {"library": 1})
            self.assertEqual(result["rows"][0]["target"], target)
            manifest.write_text(
                json.dumps(
                    {"titles": [{"title": "Hidden Sea", "unexpected": "rejected"}]}
                )
            )
            with self.assertRaises(JournalError):
                evaluate(reference, manifest)

    def test_benchmark_accepts_journal_exports_as_readonly_title_evidence(self):
        from uuid import uuid4

        self.add("The Hidden Sea")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference, journal = root / "reference.sqlite", root / "journal.json"
            self.db.commit()
            with closing(sqlite3.connect(reference)) as db:
                self.db.backup(db)
            journal.write_text(
                json.dumps(
                    {
                        "viewings": [
                            {
                                "id": str(uuid4()),
                                "title": "The Hidden Sea",
                                "started_at": "2026-01-01T12:00:00Z",
                                "notes": "PRIVATE-JOURNAL-NOTE",
                            }
                        ]
                    }
                )
            )
            result = evaluate(reference, journal)
            self.assertEqual(result["summary"]["record_types"], {"viewing": 1})
            self.assertEqual(result["summary"]["proposed_matches"], 1)
            self.assertNotIn("PRIVATE-JOURNAL-NOTE", json.dumps(result))

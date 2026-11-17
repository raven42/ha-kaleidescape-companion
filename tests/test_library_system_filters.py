"""System filter predicates use fictional source-scoped Library data."""

import json
import sqlite3
import unittest
from unittest.mock import patch

from custom_components.kaleidescape_companion.library.system_filters import groups


class SystemFilterTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE library (id TEXT, source_id TEXT, source_group TEXT,
                available INTEGER, purchase_match_pending INTEGER,
                purchase_information_unavailable INTEGER, purchased_on TEXT,
                purchase_price TEXT, retail_price TEXT, order_id TEXT, data TEXT,
                enrichment TEXT, sort_title TEXT, first_seen TEXT);
            CREATE TABLE purchase_records (library_id TEXT, purchased_on TEXT,
                purchase_price TEXT, retail_price TEXT, order_id TEXT);
            CREATE TABLE viewings (library_title_id TEXT, origin TEXT,
                manual_fields TEXT, deleted_at TEXT, started_at TEXT, ended_at TEXT,
                completed_at TEXT, duration_seconds REAL, status TEXT);
        """)
        self.movie("a", "group-a")
        self.movie("a2", "group-a")
        self.movie("b", "group-b")
        self.movie("foreign", "foreign-group", source="other")

    def movie(self, id, group, source="source"):
        self.db.execute(
            "INSERT INTO library VALUES "
            "(?,?,?,1,0,0,NULL,NULL,NULL,NULL,?,?,NULL,NULL)",
            (id, source, group, "{}", "{}"),
        )

    def selected(self, *filters, timezone="UTC"):
        return groups(self.db, "source", filters, timezone)

    def test_purchase_categories_and_grouped_editions(self):
        self.db.execute(
            "UPDATE library SET purchased_on='2020-01-01', "
            "purchase_price='$5.00', order_id='ORDER' WHERE id='a'"
        )
        self.db.execute("UPDATE library SET retail_price='$10.00' WHERE id='a2'")
        self.db.execute(
            "UPDATE library SET purchase_information_unavailable=1 WHERE id='b'"
        )
        self.assertEqual(
            self.selected("missing_purchase_information", "missing_retail_price"), set()
        )
        self.db.execute("UPDATE library SET order_id=NULL WHERE id='a'")
        self.assertEqual(self.selected("missing_purchase_information"), {"group-a"})
        self.assertEqual(self.selected("missing_retail_price"), set())
        self.db.execute("UPDATE library SET retail_price='€10.00' WHERE id='a2'")
        self.assertEqual(self.selected("currency_mismatch"), {"group-a"})

    def test_metadata_availability_edited_and_union(self):
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'",
            (
                json.dumps(
                    {
                        "unavailable": {"tmdb": True},
                        "unavailable_artwork": {"poster": True},
                        "reviewed": {"synopsis": "Edited"},
                        "manual_edit_fields": ["synopsis"],
                        "field_sources": {"synopsis": "tmdb"},
                        "tmdb": {"synopsis": "Provider"},
                    }
                ),
            ),
        )
        self.db.execute(
            "UPDATE library SET data=? WHERE id='a'",
            (json.dumps({"synopsis": "Original"}),),
        )
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='b'",
            (json.dumps({"conflicts": {"tmdb": {"reason": "ambiguous"}}}),),
        )
        with patch(
            "custom_components.kaleidescape_companion.library.system_filters.completeness",
            return_value=({"group-b"}, {"group-a"}, {"group-b"}, [], {}),
        ):
            self.assertEqual(
                self.selected("missing_metadata", "missing_artwork"),
                {"group-a", "group-b"},
            )
            self.assertEqual(self.selected("metadata_conflict"), {"group-b"})
        with patch(
            "custom_components.kaleidescape_companion.library.system_filters.source_preferences",
            return_value={},
        ):
            self.assertEqual(self.selected("metadata_edited"), {"group-a"})
        for key in ("metadata_unavailable", "artwork_unavailable", "edited"):
            self.assertEqual(self.selected(key), {"group-a"}, key)

    def test_edited_requires_manual_history_not_scraper_review(self):
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'",
            (
                json.dumps(
                    {"reviewed": {"synopsis": "Provider text", "providers": ["tmdb"]}}
                ),
            ),
        )
        self.assertEqual(self.selected("edited"), set())
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'",
            (json.dumps({"manual_edit_fields": ["synopsis"]}),),
        )
        self.assertEqual(self.selected("edited"), {"group-a"})

    def test_badges_updated_requires_additional_automatic_badges(self):
        self.db.execute(
            "UPDATE library SET data=? WHERE id='a'",
            (json.dumps({"formats": ["4K"]}),),
        )
        scraped = {
            "kaleidescape": {
                "quality_complete": True,
                "quality_variants": [
                    {"format": "4K", "video": "HDR10", "audio": "Dolby Atmos"}
                ],
            }
        }
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'", (json.dumps(scraped),)
        )
        self.assertEqual(self.selected("badges_updated"), {"group-a"})
        scraped["format_override"] = {"mode": "original"}
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'", (json.dumps(scraped),)
        )
        self.assertEqual(self.selected("badges_updated"), set())
        scraped["format_override"] = {"mode": "custom", "badges": ["4K", "HDR10"]}
        self.db.execute(
            "UPDATE library SET enrichment=? WHERE id='a'", (json.dumps(scraped),)
        )
        self.assertEqual(self.selected("badges_updated"), set())

    def test_upgraded_requires_later_higher_known_quality_over_two_days(self):
        def edition(id, format, first_seen):
            self.db.execute(
                "UPDATE library SET data=?,first_seen=? WHERE id=?",
                (json.dumps({"formats": [format]}), first_seen, id),
            )

        edition("a", "HD", "2026-11-01T10:00:00.000000+00:00")
        edition("a2", "4K", "2026-11-03T10:00:00.000000+00:00")
        self.assertEqual(self.selected("upgraded"), set())
        edition("a2", "4K", "2026-11-03T10:00:00.000001+00:00")
        self.assertEqual(self.selected("upgraded"), {"group-a"})
        edition("a2", "4K", "2026-10-28T10:00:00+00:00")
        self.assertEqual(self.selected("upgraded"), set())
        edition("a2", "HD", "2026-11-07T10:00:00+00:00")
        self.assertEqual(self.selected("upgraded"), set())
        edition("a2", "Mystery format", "2026-11-07T10:00:00+00:00")
        self.assertEqual(self.selected("upgraded"), set())
        edition("a2", "4K", "2026-11-07T10:00:00+00:00")
        self.db.execute("UPDATE library SET available=0 WHERE id='a'")
        self.assertEqual(self.selected("upgraded"), set())
        self.db.execute(
            "UPDATE library SET available=1, purchase_match_pending=1 WHERE id='a'"
        )
        self.assertEqual(self.selected("upgraded"), set())
        self.db.execute("UPDATE library SET purchase_match_pending=0 WHERE id='a'")
        self.assertEqual(self.selected("upgraded", "metadata_unavailable"), {"group-a"})

    def test_journal_links_and_split_viewings_use_local_date_and_runtime(self):
        rows = [
            # Normal overnight playback with an hour's break.
            (
                "a",
                "manual",
                "[]",
                None,
                "2026-11-15T03:30:00+00:00",
                "2026-11-15T06:30:00+00:00",
                None,
                7200,
                "completed",
            ),
            # Same UTC day but different local days; gap exceeds runtime by six hours.
            (
                "b",
                "observed",
                '["notes"]',
                None,
                "2026-11-15T01:00:00+00:00",
                "2026-11-15T12:00:00+00:00",
                None,
                7200,
                "completed",
            ),
            (
                "a",
                "observed",
                "[]",
                "deleted",
                "2026-11-15T01:00:00+00:00",
                "2026-11-15T12:00:00+00:00",
                None,
                7200,
                "completed",
            ),
        ]
        self.db.executemany("INSERT INTO viewings VALUES (?,?,?,?,?,?,?,?,?)", rows)
        self.assertEqual(self.selected("manual_viewing"), {"group-a"})
        self.assertEqual(self.selected("journal_edited"), {"group-b"})
        self.assertEqual(
            self.selected("split_viewings", timezone="America/Chicago"), {"group-b"}
        )
        self.assertEqual(self.selected("split_viewings", timezone="UTC"), set())
        # Exactly six hours beyond runtime is a split; just under is not.
        self.db.execute(
            "UPDATE viewings SET ended_at='2026-11-15T09:00:00+00:00' "
            "WHERE library_title_id='b'"
        )
        self.assertEqual(
            self.selected("split_viewings", timezone="America/Chicago"), {"group-b"}
        )
        self.db.execute(
            "UPDATE viewings SET ended_at='2026-11-15T08:59:59+00:00' "
            "WHERE library_title_id='b'"
        )
        self.assertEqual(
            self.selected("split_viewings", timezone="America/Chicago"), set()
        )
        self.db.execute(
            "UPDATE viewings SET duration_seconds=NULL WHERE library_title_id='b'"
        )
        self.assertEqual(
            self.selected("split_viewings", timezone="America/Chicago"), set()
        )


if __name__ == "__main__":
    unittest.main()

"""Read-only development validator with fictional SQLite records only."""

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from dev.validate_database import validate


class ValidationTest(unittest.TestCase):
    def test_reports_json_and_foreign_key_errors_without_modifying_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fictional.sqlite"
            with closing(sqlite3.connect(path)) as db:
                db.executescript(
                    "CREATE TABLE library(data TEXT, enrichment TEXT);"
                    "CREATE TABLE parent(id INTEGER PRIMARY KEY);"
                    "CREATE TABLE child(parent INTEGER REFERENCES parent(id));"
                    "INSERT INTO child VALUES(1);"
                )
                db.execute(
                    "INSERT INTO library VALUES(?,?)",
                    ('{"title":"Fictional"}', "invalid private value"),
                )
                db.commit()
            before = path.read_bytes()
            result = validate(path)
            self.assertTrue(result["integrity_ok"])
            self.assertEqual(result["foreign_key_errors"], 1)
            self.assertEqual(result["invalid_json"], 1)
            self.assertFalse(result["ok"])
            self.assertNotIn("Fictional", str(result))
            self.assertEqual(path.read_bytes(), before)

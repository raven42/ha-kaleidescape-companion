"""Check the installed namespace is compatible with HA component discovery."""

import unittest
from pathlib import Path

import custom_components


class EditableInstallTest(unittest.TestCase):
    """HA treats every custom_components namespace path as a directory."""

    def test_namespace_paths_can_be_scanned(self):
        paths = list(custom_components.__path__)
        self.assertTrue(paths)
        components = set()
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(Path(path).is_dir(), path)
                components.update(entry.name for entry in Path(path).iterdir())
        self.assertIn("kaleidescape_companion", components)

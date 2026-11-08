"""Conservative Store-to-local format matching using fictional editions."""

import unittest

from custom_components.kaleidescape_companion.library.formats import values


class FormatInferenceTest(unittest.TestCase):
    def test_only_matching_unambiguous_local_4k_or_8k_features_are_inferred(self):
        cache = {
            "kaleidescape": {
                "quality_complete": True,
                "quality_has_high": True,
                "quality_variants": [
                    {"format": "4K", "video": "HDR10", "audio": "Dolby Atmos"},
                    {"format": "4K", "video": "SDR", "audio": "DTS:X"},
                    {
                        "format": "4K Cinematic",
                        "video": "Dolby Vision",
                        "audio": "Dolby Atmos",
                    },
                    {"format": "HD", "video": None, "audio": "Dolby Atmos"},
                ],
            }
        }
        self.assertEqual(values({"formats": ["HD"]}, cache), ["HD"])
        hd_only = {
            "kaleidescape": {
                "quality_complete": True,
                "quality_has_high": False,
                "quality_variants": [
                    {"format": "HD", "video": None, "audio": "Dolby Atmos"}
                ],
            }
        }
        self.assertIn("Dolby Atmos", values({"formats": ["HD"]}, hd_only))
        self.assertEqual(
            values(
                {"formats": ["HD"]},
                {"kaleidescape": {**hd_only["kaleidescape"], "quality_has_high": True}},
            ),
            ["HD"],
        )
        self.assertEqual(
            values(
                {"formats": ["HD"]},
                {
                    "kaleidescape": {
                        **hd_only["kaleidescape"],
                        "quality_complete": False,
                    }
                },
            ),
            ["HD"],
        )
        self.assertEqual(values({"formats": ["4K"]}, cache), ["4K"])
        self.assertIn("Dolby Atmos", values({"formats": ["4K HDR10"]}, cache))
        self.assertNotIn("DTS:X", values({"formats": ["4K HDR10"]}, cache))
        self.assertIn("Dolby Atmos", values({"formats": ["4K Cinematic"]}, cache))
        self.assertNotIn("Dolby Atmos", values({"formats": ["8K"]}, cache))
        self.assertEqual(
            values(
                {"formats": ["4K"]}, {**cache, "format_override": {"mode": "original"}}
            ),
            ["4K"],
        )

    def test_unknown_or_incomplete_quality_is_not_a_capability(self):
        data = {"formats": ["4K"]}
        for cache in (
            {},
            {
                "kaleidescape": {
                    "quality_variants": [{"format": "4K", "audio": None, "video": None}]
                }
            },
            {"kaleidescape": {"quality_variants": "invalid"}},
        ):
            self.assertEqual(values(data, cache), ["4K"])

"""The About inventory resolves only this integration's registered sensors."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from custom_components.kaleidescape_companion.ui.about_sensors import sensor_states


class AboutSensorsTest(unittest.TestCase):
    def test_renamed_entity_and_documented_attributes(self):
        hass = MagicMock()
        hass.states.get.return_value = SimpleNamespace(
            state="2",
            attributes={
                "movies": ["Fictional"],
                "truncated": False,
                "private": "excluded",
            },
        )
        entries = [
            SimpleNamespace(
                domain="sensor",
                unique_id="dataset_movies_7_days",
                entity_id="sensor.renamed",
            ),
            SimpleNamespace(
                domain="sensor",
                unique_id="other_movies_30_days",
                entity_id="sensor.other",
            ),
        ]
        with (
            patch(
                "custom_components.kaleidescape_companion.ui.about_sensors.er.async_get"
            ),
            patch(
                "custom_components.kaleidescape_companion.ui.about_sensors.er.async_entries_for_config_entry",
                return_value=entries,
            ),
        ):
            result = sensor_states(hass, "entry", "dataset")
        self.assertEqual(result["movies_7_days"]["entity_id"], "sensor.renamed")
        self.assertEqual(
            result["movies_7_days"]["attributes"],
            {"movies": ["Fictional"], "truncated": False},
        )
        self.assertIsNone(result["movies_30_days"]["entity_id"])
        self.assertEqual(len(result), 17)

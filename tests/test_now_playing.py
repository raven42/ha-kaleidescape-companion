"""Now Playing reuses selected HA sources without opening device connections."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

import test_backend as backend_tests
from homeassistant.auth.permissions.const import POLICY_READ


class NowPlayingAPITest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call

    async def test_manual_only_and_admin_source_permissions(self):
        result = await self.call("now_playing", **self.scope)
        self.assertEqual(result["result"], {"players": []})
        sources = {
            "media_player": "media_player.example",
            "play_status": "sensor.example_status",
            "media_location": "sensor.example_location",
        }
        observer = SimpleNamespace(
            entities=sources, live_state=Mock(return_value={"title": "Fictional movie"})
        )
        with patch.object(self.entry.runtime_data, "observer", observer):
            result = await self.call("now_playing", **self.scope)
            self.assertEqual(result["result"]["players"][0]["title"], "Fictional movie")
            self.assertEqual(
                self.admin.permissions.check_entity.call_args_list,
                [call(entity, POLICY_READ) for entity in sources.values()],
            )
            for denied in sources.values():
                observer.live_state.reset_mock()
                self.admin.permissions.check_entity.side_effect = (
                    lambda entity, permission: entity != denied
                )
                result = await self.call("now_playing", **self.scope)
                self.assertEqual(result["code"], "unauthorized")
                observer.live_state.assert_not_called()

    async def test_non_admins_cannot_obtain_live_sources_or_cross_dataset(self):
        for user in (
            None,
            SimpleNamespace(is_active=True, is_admin=False),
            SimpleNamespace(is_active=False, is_admin=True),
        ):
            with patch(
                "custom_components.kaleidescape_companion.ui.websocket.get_runtime",
                side_effect=AssertionError("Unauthorized source lookup"),
            ):
                result = await self.call("now_playing", user=user, **self.scope)
            self.assertEqual(result["code"], "unauthorized")
        result = await self.call(
            "now_playing", **{**self.scope, "dataset_id": "another-dataset"}
        )
        self.assertEqual(result["code"], "not_found")

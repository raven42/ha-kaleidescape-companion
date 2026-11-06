"""Now Playing reuses selected HA sources without opening device connections."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, call, patch

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

    async def test_inactive_users_cannot_obtain_live_sources_or_cross_dataset(self):
        for user in (
            None,
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

    async def test_regular_users_get_artwork_context_without_recording_internals(self):
        from custom_components.kaleidescape_companion.playback.now_playing import (
            PUBLIC_FIELDS,
        )

        self.hass.states.async_set("media_player.example", "playing")
        user = SimpleNamespace(
            id="reader",
            is_active=True,
            is_admin=False,
            permissions=SimpleNamespace(check_entity=Mock(return_value=True)),
        )
        observer = SimpleNamespace(
            entities={"media_player": "media_player.example"},
            live_state=lambda: {
                "entity_id": "media_player.example",
                "title": "Fictional film",
                "raw_content_id": "private-handle",
                "artwork_key": "cover",
                "session": {"gap_count": 1},
                "recording_error": "private",
                "available": True,
            },
        )
        observer.async_stop = AsyncMock()
        self.entry.runtime_data.observer = observer
        response = await self.call("now_playing", user=user, **self.scope)
        result = response["result"]["players"][0]
        self.assertEqual(set(result), set(PUBLIC_FIELDS))
        self.assertEqual(result["artwork_key"], "cover")
        self.assertTrue(result["content_key"])
        self.assertNotIn("private", str(result))
        user.permissions.check_entity.return_value = False
        self.assertEqual(
            (await self.call("now_playing", user=user, **self.scope))["code"],
            "unauthorized",
        )

    async def test_selected_player_uses_registry_and_never_other_player_artwork(
        self,
    ):
        from homeassistant import bootstrap, loader
        from homeassistant.helpers import entity_registry as er

        self.hass.config_entries.async_initialize = AsyncMock()
        self.hass.config_entries.async_wait_initialized = AsyncMock()
        loader.async_setup(self.hass)
        await bootstrap.async_load_base_functionality(self.hass)
        from test_controls import CONFIG, SERIAL

        from custom_components.kaleidescape_companion.playback.controls import (
            PlaybackControls,
        )

        controls = self.entry.runtime_data.controls = PlaybackControls(
            self.hass, self.entry.runtime_data.repository, CONFIG
        )
        player_id = controls.player_id(SERIAL)
        user = SimpleNamespace(
            id="reader",
            is_active=True,
            is_admin=False,
            permissions=SimpleNamespace(check_entity=Mock(return_value=True)),
        )
        response = await self.call(
            "now_playing", user=user, **self.scope, player_id=player_id
        )
        self.assertEqual(response["result"], {"players": []})
        registered = er.async_get(self.hass).async_get_or_create(
            "media_player", "kaleidescape", SERIAL
        )
        self.hass.states.async_set(
            registered.entity_id,
            "playing",
            {
                "media_title": "Fictional Film",
                "media_duration": 7200,
                "entity_picture": f"/api/media_player_proxy/{registered.entity_id}"
                "?token=never-return",
            },
        )
        response = await self.call(
            "now_playing", user=user, **self.scope, player_id=player_id
        )
        result = response["result"]["players"][0]
        self.assertEqual(result["title"], "Fictional Film")
        self.assertTrue(result["artwork_key"])
        self.assertNotIn("never-return", str(result))
        self.assertNotIn(SERIAL, str(result))
        denied = await self.call(
            "now_playing", user=user, **self.scope, player_id="unknown-player"
        )
        self.assertFalse(denied["success"])

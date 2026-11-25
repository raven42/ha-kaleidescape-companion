"""Fictional pyk Device peers: identity, opt-ins, receipts and lifecycle gates."""

import asyncio
import json
import unittest
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import test_backend as backend
from _expected_logs import expected_log

from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.store import source_id, title_id
from custom_components.kaleidescape_companion.playback import controls as module
from custom_components.kaleidescape_companion.playback._pyk import (
    MessageError,
    RequestNotSentError,
    RequestOutcomeUnknownError,
)
from custom_components.kaleidescape_companion.playback.control_config import validate

SERIAL = "1A2B"
SEED = "10.0.0.10"
PLAYER = "10.0.0.25"
HANDLE = "26-1.0-S_aabbccdd"
CONFIG = {
    "control_enabled": True,
    "control_host": SEED,
    "control_player": SERIAL,
    "control_allow_launch": True,
    "library_enabled": True,
    "library_host": SEED,
}


class Peer:
    def __init__(self):
        self.connections = []
        self.identity_reads = []
        self.commands = []
        self.mode = 2
        self.title = "Previous film"
        self.wrong_serial = False
        self.drop = False
        self.rejected = False
        self.hold = None
        self.sent = asyncio.Event()
        self.hook = None
        self.standby = False
        self.readiness = "0"
        self.zone_power = ()
        self.metadata_title = "A Fictional Film"
        self.read_hold = None
        self.read_started = asyncio.Event()
        self.alternative_serial = None
        self.screensaver = False
        self.input_type = 1
        self.input_prompt = "Search"
        self.input_entry = ""

    def client(self, ip, **_kwargs):
        peer = self

        class Device:
            def __init__(self):
                self.is_connected = False

            async def connect(self):
                peer.connections.append(ip)
                self.is_connected = True

            async def disconnect(self):
                self.is_connected = False

            async def read_identity(self, serial=None):
                peer.identity_reads.append((ip, serial))
                chosen = serial or (
                    peer.alternative_serial if ip == "10.0.0.26" else SERIAL
                )
                if peer.wrong_serial and ip == PLAYER:
                    chosen = "FFFF"
                model = "Fictional Server" if chosen == "2C3D" else "Fictional Player"
                return SimpleNamespace(
                    serial_number=chosen.zfill(12),
                    model=model,
                    friendly_name="" if chosen == "2C3D" else "Example Cinema",
                    movie_zones=0 if chosen == "2C3D" else 1,
                    ip_address=(
                        "10.0.0.26"
                        if chosen == peer.alternative_serial
                        else SEED
                        if chosen == "2C3D"
                        else "010.000.000.025"
                    ),
                )

            async def discover_devices(self):
                return [
                    await self.read_identity(SERIAL),
                    await self.read_identity("2C3D"),
                ]

            async def read_playback_state(self):
                peer.read_started.set()
                if peer.read_hold:
                    await peer.read_hold.wait()
                if peer.hook:
                    peer.hook()
                return await peer.state(self)

            async def _get_ui_state(self):
                return SimpleNamespace(
                    field_screensaver="active" if peer.screensaver else "inactive"
                )

            async def get_user_input(self):
                return SimpleNamespace(
                    field_type=peer.input_type,
                    field_prompt=peer.input_prompt,
                    field_entry=peer.input_entry,
                )

            async def set_user_input_entry(self, value):
                await self._execute("SET_USER_INPUT_ENTRY", value)
                peer.input_entry = value

            async def prepare_movie_launch(self, handle, *, serial):
                return SimpleNamespace(
                    handle=HANDLE,
                    title=peer.metadata_title,
                    year="2025",
                    identity=await self.read_identity(serial),
                )

            async def send_movie_launch(self, prepared):
                peer.title = prepared.title
                await self._execute("PLAY_MOVIE", prepared.handle)

            async def _execute(self, command, *fields):
                peer.commands.append(
                    (
                        command,
                        fields,
                        {
                            "target_serial": peer.alternative_serial
                            if ip == "10.0.0.26"
                            else SERIAL
                        },
                    )
                )
                peer.sent.set()
                if peer.hold:
                    await peer.hold.wait()
                if peer.drop:
                    raise RequestOutcomeUnknownError("Fictional lost reply")
                if peer.rejected:
                    raise MessageError(20, command)
                if command == "LEAVE_STANDBY":
                    peer.standby = False
                if command == "PLAY_OR_PAUSE":
                    peer.mode = 2 if peer.mode == 1 else 1
                elif command != "GO_MOVIE_COLLECTION":
                    peer.mode = {"STOP": 0, "PAUSE_ON": 1, "PAUSE_OFF": 2}.get(
                        command, 2
                    )

            def __getattr__(self, name):
                commands = {
                    "play": "PLAY",
                    "pause_on": "PAUSE_ON",
                    "pause": "PAUSE",
                    "cancel": "CANCEL",
                    "backspace": "BACKSPACE",
                    "details": "DETAILS",
                    "menu_on": "MENU_ON",
                    "menu_off": "MENU_OFF",
                    "go_movies": "GO_MOVIES",
                    "pause_off": "PAUSE_OFF",
                    "play_or_pause": "PLAY_OR_PAUSE",
                    "stop": "STOP",
                    "next": "NEXT",
                    "previous": "PREVIOUS",
                    "replay": "REPLAY",
                    "scan_forward": "SCAN_FORWARD",
                    "scan_reverse": "SCAN_REVERSE",
                    "page_up": "PAGE_UP",
                    "page_down": "PAGE_DOWN",
                    "intermission_toggle": "INTERMISSION_TOGGLE",
                    "status_and_settings": "STATUS_AND_SETTINGS",
                    "up": "UP",
                    "down": "DOWN",
                    "left": "LEFT",
                    "right": "RIGHT",
                    "select": "SELECT",
                    "back": "BACK",
                    "menu_toggle": "MENU_TOGGLE",
                    "go_movie_covers": "GO_MOVIE_COVERS",
                    "go_movie_list": "GO_MOVIE_LIST",
                    "go_movie_collections": "GO_MOVIE_COLLECTIONS",
                    "go_search": "GO_SEARCH",
                    "go_movie_collection": "GO_MOVIE_COLLECTION",
                    "go_movie_store": "GO_MOVIE_STORE",
                    "stop_screen_saver": "STOP_SCREEN_SAVER",
                    "keyboard_literal": "KEYBOARD_LITERAL",
                    "send_event": "SEND_EVENT",
                    "set_volume_capabilities": "VOLUME_CAPABILITIES",
                    "set_volume_level": "VOLUME_LEVEL",
                    "set_volume_muted": "VOLUME_MUTED",
                    "go_screen_saver": "GO_SCREEN_SAVER",
                    "leave_standby": "LEAVE_STANDBY",
                    "enter_standby": "ENTER_STANDBY",
                }
                if name not in commands:
                    raise AttributeError(name)
                return lambda *args: self._execute(commands[name], *args)

        return Device()

    async def state(self, device):
        return SimpleNamespace(
            identity=await device.read_identity(),
            power="standby" if self.standby else "on",
            readiness={"0": "ready", "1": "becoming_ready", "2": "idle"}[
                self.readiness
            ],
            playing_title=self.title,
            zone_available=self.zone_power != ("0",),
            play_status={
                0: "none",
                1: "paused",
                2: "playing",
                4: "forward",
                6: "reverse",
            }[self.mode],
            duration_seconds=7200,
            position_seconds=100,
        )


class ControlsTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call

    async def configure(self, **overrides):
        config = {**CONFIG, **overrides}
        self.hass.config_entries.async_update_entry(self.entry, options=config)
        # Tests use the real ConfigEntry; the mocked manager does not perform updates.
        object.__setattr__(self.entry, "options", MappingProxyType(config))
        self.entry.runtime_data.controls = module.PlaybackControls(
            self.hass, self.entry.runtime_data.repository, config
        )
        self.peer = Peer()
        self.enterContext(patch.object(module, "LivePlayer", self.peer.client))

    async def prepare(self, operation="pause", **kwargs):
        result = await self.call(
            "control/prepare", **self.scope, operation=operation, **kwargs
        )
        self.assertTrue(result["success"], result)
        return result["result"]["token"]

    async def execute(self, token, request=None, **kwargs):
        return await self.call(
            "control/execute",
            **self.scope,
            token=token,
            request_id=request or str(uuid4()),
            **kwargs,
        )

    async def test_search_input_uses_selected_player_and_durable_control(self):
        await self.configure()
        response = await self.call("control/input_status", **self.scope)
        self.assertEqual(
            response["result"],
            {"active": True, "prompt": "Search", "entry": "", "playback_mode": 2},
        )
        token = await self.prepare("search_text", input_text="Alien: One")
        response = await self.execute(token)
        self.assertTrue(response["success"], response)
        self.assertEqual(
            self.peer.commands[-1][:2], ("SET_USER_INPUT_ENTRY", ("Alien: One",))
        )
        response = await self.call("control/input_status", **self.scope)
        self.assertEqual(response["result"]["entry"], "Alien: One")

    async def test_screensaver_hides_search_and_blocks_pending_text(self):
        await self.configure()
        token = await self.prepare("search_text", input_text="film")
        self.peer.screensaver = True
        status = await self.call("control/input_status", **self.scope)
        self.assertEqual(status["result"], {"active": False, "playback_mode": 2})
        result = await self.execute(token)
        self.assertFalse(result["success"])
        self.assertFalse(self.peer.commands)
        response = await self.call(
            "control/prepare", **self.scope, operation="search_text", input_text="film"
        )
        self.assertFalse(response["success"])
        self.peer.screensaver = False
        status = await self.call("control/input_status", **self.scope)
        self.assertTrue(status["result"]["active"])

    async def test_search_input_rejects_other_prompts_and_invalid_text(self):
        await self.configure()
        for text in ("a\nb", "é", "x" * 121):
            result = await self.call(
                "control/prepare",
                **self.scope,
                operation="search_text",
                input_text=text,
            )
            self.assertFalse(result["success"])
        token = await self.prepare("search_text", input_text="film")
        self.peer.input_entry = "Changed externally"
        result = await self.execute(token)
        self.assertFalse(result["success"])
        self.assertFalse(self.peer.commands)
        self.peer.input_entry = ""
        token = await self.prepare("search_text", input_text="film")
        self.peer.input_prompt = "Password"
        result = await self.execute(token)
        self.assertFalse(result["success"])
        self.assertFalse(self.peer.commands)
        result = await self.call("control/input_status", **self.scope)
        self.assertEqual(result["result"], {"active": False, "playback_mode": 2})

    async def test_only_obsolete_player_buttons_are_removed(self):
        from homeassistant.helpers import entity_registry as er

        from custom_components.kaleidescape_companion.playback.player_devices import (
            remove_obsolete_control_entities,
        )

        dataset = self.entry.runtime_data.dataset_id
        registry = SimpleNamespace(async_remove=Mock())
        entries = [
            SimpleNamespace(
                platform="kaleidescape_companion",
                entity_id="button.old_player",
                unique_id=f"{dataset}_1A2B_screensaver_off",
            ),
            SimpleNamespace(
                platform="kaleidescape_companion",
                entity_id="button.sync",
                unique_id=f"{dataset}_library_sync",
            ),
            SimpleNamespace(
                platform="another",
                entity_id="button.other",
                unique_id=f"{dataset}_1A2B_screensaver_off",
            ),
            SimpleNamespace(
                platform="kaleidescape_companion",
                entity_id="sensor.other",
                unique_id=f"{dataset}_1A2B_screensaver_off",
            ),
        ]
        with (
            patch.dict(self.hass.data, {er.DATA_REGISTRY: registry}),
            patch.object(er, "async_entries_for_config_entry", return_value=entries),
        ):
            remove_obsolete_control_entities(self.hass, self.entry)
        registry.async_remove.assert_called_once_with("button.old_player")

    async def builtin_devices(self, *serials):
        from homeassistant.helpers import device_registry as dr

        dr.async_setup(self.hass)
        await dr.async_load(self.hass, load_empty=True)
        builtin = backend.entry()
        object.__setattr__(builtin, "domain", "kaleidescape")
        self.hass.config_entries.async_get_entry.side_effect = lambda entry_id: (
            self.entry
            if entry_id == self.entry.entry_id
            else builtin
            if entry_id == builtin.entry_id
            else None
        )
        registry = dr.async_get(self.hass)
        return registry, [
            registry.async_get_or_create(
                config_entry_id=builtin.entry_id,
                identifiers={("kaleidescape", serial)},
                name="Fictional cinema",
            )
            for serial in serials
        ]

    async def test_ha_actions_use_builtin_devices_and_discovered_players(self):
        from custom_components.kaleidescape_companion.playback.ha_controls import (
            FIXED_ACTIONS,
        )

        await self.configure()
        await self.call("control/discover", **self.scope)
        registry, (device, second) = await self.builtin_devices("000000001a2b", "2C3E")
        from homeassistant.helpers import device_registry as dr

        await self.call("control/discover", **self.scope)
        self.assertEqual(
            dr.async_entries_for_config_entry(registry, self.entry.entry_id), []
        )
        self.assertIsNotNone(registry.async_get(device.id))
        for operation in FIXED_ACTIONS:
            with self.subTest(operation=operation):
                self.peer.mode = 0
                before = len(self.peer.commands)
                await self.hass.services.async_call(
                    "kaleidescape_companion",
                    f"player_{operation}",
                    {"device_id": device.id},
                    blocking=True,
                )
                self.assertEqual(len(self.peer.commands), before + 1)
                self.assertEqual(self.peer.commands[-1][2]["target_serial"], SERIAL)
        self.peer.alternative_serial = "2C3E"
        self.entry.runtime_data.controls.devices.append(
            {
                "serial": "2C3E",
                "name": "Second cinema",
                "model": "Fictional",
                "ipaddress": "10.0.0.26",
                "is_player": True,
            }
        )
        await self.hass.services.async_call(
            "kaleidescape_companion",
            "player_screensaver_off",
            {"device_id": second.id},
            blocking=True,
        )
        self.assertEqual(self.peer.commands[-1][2]["target_serial"], "2C3E")

    async def test_ha_service_player_selection_rejects_unmatched_and_ambiguous_devices(
        self,
    ):
        from homeassistant.exceptions import HomeAssistantError

        from custom_components.kaleidescape_companion.playback.ha_controls import (
            resolve_player,
        )

        await self.configure()
        await self.call("control/discover", **self.scope)
        registry, (device, other) = await self.builtin_devices("000000001a2b", "BEEF")
        runtime = self.entry.runtime_data
        self.assertEqual(resolve_player(self.hass, runtime, device.id), SERIAL)
        with self.assertRaises(HomeAssistantError):
            resolve_player(self.hass, runtime, other.id)
        with self.assertRaises(HomeAssistantError):
            resolve_player(self.hass, runtime, "unknown")
        impostor = registry.async_get_or_create(
            config_entry_id=self.entry.entry_id,
            identifiers={("kaleidescape", SERIAL)},
            name="Not a built-in player",
        )
        with self.assertRaises(HomeAssistantError):
            resolve_player(self.hass, runtime, impostor.id)
        old = registry.async_get_or_create(
            config_entry_id=self.entry.entry_id,
            identifiers={
                ("kaleidescape_companion", f"{runtime.dataset_id}:player:{SERIAL}")
            },
            name="Old Companion player",
        )
        with self.assertRaises(HomeAssistantError):
            resolve_player(self.hass, runtime, old.id)
        runtime.controls.devices.append({"serial": "2C3E", "is_player": True})
        ambiguous = registry.async_update_device(
            device.id,
            new_identifiers={("kaleidescape", SERIAL), ("kaleidescape", "2C3E")},
        )
        with self.assertRaises(HomeAssistantError):
            resolve_player(self.hass, runtime, ambiguous.id)

    async def test_ha_action_targets_a_builtin_device_registry_entry(self):
        await self.configure()
        await self.call("control/discover", **self.scope)
        _, (device,) = await self.builtin_devices(SERIAL)
        await self.hass.services.async_call(
            "kaleidescape_companion",
            "keyboard_character",
            {"device_id": device.id, "value": "A"},
            blocking=True,
        )
        self.assertEqual(self.peer.commands[-1][:2], ("KEYBOARD_LITERAL", ("A",)))

    async def test_cleanup_removes_only_old_companion_player_devices(self):
        from custom_components.kaleidescape_companion.playback.player_devices import (
            remove_obsolete_player_devices,
        )

        await self.configure()
        registry, (builtin,) = await self.builtin_devices(SERIAL)
        dataset = self.entry.runtime_data.dataset_id

        def add(identifier):
            return registry.async_get_or_create(
                config_entry_id=self.entry.entry_id,
                identifiers={("kaleidescape_companion", identifier)},
                name="Fictional",
            )

        old = add(f"{dataset}:player:{SERIAL}")
        parent = add(dataset)
        other = add("other-dataset:player:1A2B")
        remove_obsolete_player_devices(self.hass, self.entry)
        self.assertIsNone(registry.async_get(old.id))
        for device in (builtin, parent, other):
            self.assertIsNotNone(registry.async_get(device.id))

    async def test_migration_warns_immediately_and_adds_later_loaded_references(self):
        from homeassistant.helpers import issue_registry as ir

        from custom_components.kaleidescape_companion.playback import player_devices

        await self.configure()
        registry, _ = await self.builtin_devices(SERIAL)
        dataset = self.entry.runtime_data.dataset_id
        old = registry.async_get_or_create(
            config_entry_id=self.entry.entry_id,
            identifiers={("kaleidescape_companion", f"{dataset}:player:{SERIAL}")},
            name="Old player",
        )
        with (
            patch.object(player_devices, "async_when_setup") as when_setup,
            patch.object(
                player_devices.persistent_notification, "async_create"
            ) as notify,
            patch.object(
                player_devices.automation,
                "automations_with_device",
                return_value=["automation.movie_night"],
            ) as automations,
            patch.object(
                player_devices.script,
                "scripts_with_device",
                return_value=["script.play_movie"],
            ) as scripts,
        ):
            player_devices.remove_obsolete_player_devices(self.hass, self.entry)
            self.assertIsNone(registry.async_get(old.id))
            self.assertEqual(notify.call_count, 1)
            self.assertIn("built-in Kaleidescape", notify.call_args.args[1])
            self.assertIn("may not identify", notify.call_args.args[1])
            repair = ir.async_get(self.hass).async_get_issue(
                "kaleidescape_companion", player_devices.MIGRATION_ISSUE
            )
            self.assertTrue(repair.is_persistent)
            self.assertTrue(repair.is_fixable)
            self.assertEqual(json.loads(repair.data["device_ids"]), [old.id])
            callbacks = {
                call.args[1]: call.args[2] for call in when_setup.call_args_list
            }
            self.assertEqual(set(callbacks), {"automation", "script"})
            await callbacks["automation"](self.hass, "automation")
            await callbacks["script"](self.hass, "script")
            automations.assert_called_once_with(self.hass, old.id)
            scripts.assert_called_once_with(self.hass, old.id)
            message = notify.call_args.args[1]
            self.assertIn("automation.movie_night", message)
            self.assertIn("script.play_movie", message)
            repair = ir.async_get(self.hass).async_get_issue(
                "kaleidescape_companion", player_devices.MIGRATION_ISSUE
            )
            self.assertIn(
                "automation.movie_night", repair.translation_placeholders["references"]
            )
            self.assertIn(
                "script.play_movie", repair.translation_placeholders["references"]
            )
            self.assertNotIn(old.id, message)

    async def test_migration_repair_rechecks_and_requires_explicit_dismissal(self):
        from homeassistant.helpers import issue_registry as ir

        from custom_components.kaleidescape_companion import repairs
        from custom_components.kaleidescape_companion.playback import player_devices

        await self.configure()
        registry, _ = await self.builtin_devices(SERIAL)
        dataset = self.entry.runtime_data.dataset_id
        old = registry.async_get_or_create(
            config_entry_id=self.entry.entry_id,
            identifiers={("kaleidescape_companion", f"{dataset}:player:{SERIAL}")},
            name="Old player",
        )
        with patch.object(player_devices, "async_when_setup"):
            player_devices.remove_obsolete_player_devices(self.hass, self.entry)
        issue = ir.async_get(self.hass).async_get_issue(
            "kaleidescape_companion", player_devices.MIGRATION_ISSUE
        )
        flow = await repairs.async_create_fix_flow(
            self.hass, player_devices.MIGRATION_ISSUE, issue.data
        )
        flow.hass = self.hass
        flow.data = issue.data
        flow.handler = "kaleidescape_companion"
        menu = await flow.async_step_init()
        self.assertEqual(menu["menu_options"], ["check_again", "dismiss"])
        with (
            patch.object(
                repairs,
                "scan_migration_references",
                side_effect=[({"script.play_movie"}, True), (set(), True)],
            ) as scan,
            patch.object(repairs.persistent_notification, "async_create"),
            patch.object(repairs.persistent_notification, "async_dismiss") as dismiss,
        ):
            menu = await flow.async_step_check_again()
            scan.assert_called_with(self.hass, [old.id])
            self.assertIn(
                "script.play_movie", menu["description_placeholders"]["references"]
            )
            menu = await flow.async_step_check_again()
            self.assertIn(
                "No references found", menu["description_placeholders"]["references"]
            )
            self.assertIsNotNone(
                ir.async_get(self.hass).async_get_issue(
                    "kaleidescape_companion", player_devices.MIGRATION_ISSUE
                )
            )
            self.assertEqual((await flow.async_step_dismiss())["type"], "form")
            self.assertEqual(
                (await flow.async_step_dismiss({}))["type"], "create_entry"
            )
            dismiss.assert_called_once_with(self.hass, player_devices.MIGRATION_ISSUE)

    async def test_migration_reference_editor_links_fall_back_to_entity_ids(self):
        from homeassistant.helpers import entity_registry as er

        from custom_components.kaleidescape_companion.playback.player_devices import (
            reference_lines,
        )

        fake_registry = Mock()
        fake_registry.async_get.side_effect = lambda entity_id: (
            SimpleNamespace(unique_id="12345")
            if entity_id == "automation.movie"
            else None
        )
        with (
            patch.dict(self.hass.data, {er.DATA_REGISTRY: fake_registry}),
            patch.object(er, "async_get", return_value=fake_registry),
        ):
            lines = reference_lines(self.hass, {"automation.movie", "script.yaml_only"})
        self.assertIn("[automation.movie](/config/automation/edit/12345)", lines)
        self.assertIn("`script.yaml_only`", lines)

    async def test_migration_reference_extraction_includes_action_data(self):
        from homeassistant.helpers import config_validation as cv
        from homeassistant.helpers.script import Script

        sequence = cv.SCRIPT_SCHEMA(
            [
                {
                    "if": [],
                    "then": [
                        {
                            "action": "kaleidescape_companion.player_play",
                            "data": {"device_id": "fictional-old-device"},
                        }
                    ],
                },
            ]
        )
        found = set()
        Script._find_referenced_devices(found, sequence)
        self.assertEqual(found, {"fictional-old-device"})

    async def test_no_old_player_device_produces_no_migration_notice(self):
        from custom_components.kaleidescape_companion.playback import player_devices

        await self.configure()
        await self.builtin_devices(SERIAL)
        with patch.object(
            player_devices.persistent_notification, "async_create"
        ) as notify:
            player_devices.remove_obsolete_player_devices(self.hass, self.entry)
        notify.assert_not_called()

    async def test_play_movie_with_builtin_device_uses_companion_connection(self):
        await self.configure()
        await self.call("control/discover", **self.scope)
        _, (device,) = await self.builtin_devices(SERIAL)
        await self.entry.runtime_data.repository.async_library_catalog(
            "http://" + SEED,
            [
                {
                    "source_handle": "0-S_aabbccdd",
                    "source_group": "1",
                    "title": "A Fictional Film",
                    "year": 2025,
                }
            ],
        )
        await self.hass.services.async_call(
            "kaleidescape_companion",
            "play_movie",
            {"device_id": device.id, "title": "A Fictional Film"},
            blocking=True,
        )
        self.assertEqual(self.peer.commands[-1][:2], ("PLAY_MOVIE", (HANDLE,)))

    async def test_player_action_selectors_target_builtin_integration(self):
        from pathlib import Path

        import yaml

        from custom_components.kaleidescape_companion.playback.ha_services import (
            PLAYER_SERVICES,
        )

        path = (
            Path(__file__).resolve().parents[1]
            / "custom_components/kaleidescape_companion/services.yaml"
        )
        descriptions = yaml.safe_load(path.read_text())
        for action in PLAYER_SERVICES:
            with self.subTest(action=action):
                self.assertEqual(
                    descriptions[action]["fields"]["device_id"]["selector"]["device"][
                        "integration"
                    ],
                    "kaleidescape",
                )

    async def test_ha_parameter_actions_and_play_movie_use_guarded_path(self):
        from homeassistant.exceptions import HomeAssistantError

        from custom_components.kaleidescape_companion.playback import ha_services

        await self.configure()
        await self.call("control/discover", **self.scope)
        with patch.object(ha_services, "resolve_player", return_value=SERIAL):
            result = await self.hass.services.async_call(
                "kaleidescape_companion",
                "open_movie_collection",
                {"device_id": "fictional", "value": "A: Collection"},
                blocking=True,
                return_response=True,
            )
            self.assertEqual(result["outcome"], "acknowledged")
            self.assertEqual(
                self.peer.commands[-1][:2], ("GO_MOVIE_COLLECTION", ("A: Collection",))
            )
            await self.hass.services.async_call(
                "kaleidescape_companion",
                "keyboard_character",
                {"device_id": "fictional", "value": ":"},
                blocking=True,
            )
            self.assertEqual(self.peer.commands[-1][:2], ("KEYBOARD_LITERAL", (":",)))
            await self.hass.services.async_call(
                "kaleidescape_companion",
                "set_player_input",
                {"device_id": "fictional", "value": "A:B"},
                blocking=True,
            )
            self.assertEqual(self.peer.commands[-1][0], "SET_USER_INPUT_ENTRY")
            for removed in (
                "send_player_event",
                "report_volume_capabilities",
                "report_volume_level",
                "report_volume_muted",
            ):
                self.assertFalse(
                    self.hass.services.has_service("kaleidescape_companion", removed)
                )
            before = len(self.peer.commands)
            with self.assertRaises(HomeAssistantError):
                await self.hass.services.async_call(
                    "kaleidescape_companion",
                    "keyboard_character",
                    {"device_id": "fictional", "value": "too long"},
                    blocking=True,
                )
            self.assertEqual(len(self.peer.commands), before)
            await self.entry.runtime_data.repository.async_library_catalog(
                "http://" + SEED,
                [
                    {
                        "source_handle": "0-S_aabbccdd",
                        "source_group": "1",
                        "title": "A Fictional Film",
                        "year": 2025,
                    }
                ],
            )
            await self.hass.services.async_call(
                "kaleidescape_companion",
                "play_movie",
                {"device_id": "fictional", "title": "A Fictional Film"},
                blocking=True,
            )
            self.assertEqual(self.peer.commands[-1][:2], ("PLAY_MOVIE", (HANDLE,)))

    async def test_ha_control_rechecks_user_before_sending(self):
        from homeassistant.core import Context
        from homeassistant.exceptions import HomeAssistantError

        from custom_components.kaleidescape_companion.playback.ha_controls import (
            run_control,
        )

        await self.configure()
        await self.call("control/discover", **self.scope)
        user = SimpleNamespace(id="reader", is_active=True)

        def revoke():
            user.is_active = False

        self.peer.hook = revoke
        with patch.object(
            self.hass,
            "auth",
            SimpleNamespace(async_get_user=AsyncMock(return_value=user)),
            create=True,
        ):
            with self.assertRaises(HomeAssistantError):
                await run_control(
                    self.hass,
                    self.entry,
                    SERIAL,
                    "screensaver_off",
                    Context(user_id="reader"),
                )
        self.assertFalse(self.peer.commands)

    async def test_ha_play_movie_requires_an_unambiguous_library_version(self):
        from homeassistant.exceptions import HomeAssistantError

        from custom_components.kaleidescape_companion.playback import ha_services

        await self.configure()
        await self.call("control/discover", **self.scope)
        await self.entry.runtime_data.repository.async_library_catalog(
            "http://" + SEED,
            [
                {
                    "source_handle": "0-S_aabbccdd",
                    "source_group": "1",
                    "title": "A Fictional Film",
                },
                {
                    "source_handle": "0-S_bbccddee",
                    "source_group": "1",
                    "title": "A Fictional Film",
                },
            ],
        )
        with patch.object(ha_services, "resolve_player", return_value=SERIAL):
            with self.assertRaises(HomeAssistantError):
                await self.hass.services.async_call(
                    "kaleidescape_companion",
                    "play_movie",
                    {"device_id": "fictional", "title": "A Fictional Film"},
                    blocking=True,
                )
            self.assertFalse(self.peer.commands)
            exact = title_id(source_id("http://" + SEED), "0-S_aabbccdd")
            await self.hass.services.async_call(
                "kaleidescape_companion",
                "play_movie",
                {"device_id": "fictional", "version_id": exact},
                blocking=True,
            )
            self.assertEqual(self.peer.commands[-1][0], "PLAY_MOVIE")

    async def test_disabled_controls_are_inert_and_discovery_is_administrator_only(
        self,
    ):
        info = await self.call("control/info", **self.scope)
        self.assertFalse(info["result"]["enabled"])
        with patch.object(module, "LivePlayer") as client:
            response = await self.call("control/discover", **self.scope)
            self.assertEqual(response["code"], "control_disabled")
            for operation in ("control/discover", "control/acknowledge"):
                response = await self.call(
                    operation,
                    user=SimpleNamespace(id="reader", is_active=True, is_admin=False),
                    **self.scope,
                    **(
                        {"request_id": str(uuid4()), "confirmation": "REVIEWED"}
                        if operation.endswith("acknowledge")
                        else {}
                    ),
                )
                self.assertEqual(response["code"], "unauthorized")
            client.assert_not_called()

    async def test_household_controls_hide_inventory_and_need_no_confirmation(self):
        await self.configure()
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        await self.call("control/discover", **self.scope)
        response = await self.call("control/info", user=reader, **self.scope)
        value = response["result"]
        self.assertFalse(value["can_manage"])
        self.assertNotIn("devices", value)
        self.assertEqual(value["players"][0]["name"], "Example Cinema")
        self.assertEqual(len(value["players"]), 1)
        for private in (SERIAL, PLAYER, SEED, "actor_id", "player_serial"):
            self.assertNotIn(private, str(value))
        token = await self.prepare("stop", user=reader)
        result = await self.execute(token, user=reader)
        self.assertTrue(result["success"], result)
        self.assertEqual(result["result"]["outcome"], "state_observed")
        self.assertEqual([name for name, *_ in self.peer.commands], ["STOP"])

    async def test_additional_remote_commands_reach_the_selected_player(self):
        await self.configure()
        for operation, command in [
            ("movie_list", "GO_MOVIE_LIST"),
            ("movie_collections", "GO_MOVIE_COLLECTIONS"),
            ("search", "GO_SEARCH"),
            ("screensaver", "GO_SCREEN_SAVER"),
            ("replay", "REPLAY"),
            ("scan_forward", "SCAN_FORWARD"),
            ("scan_reverse", "SCAN_REVERSE"),
            ("page_up", "PAGE_UP"),
            ("page_down", "PAGE_DOWN"),
            ("intermission", "INTERMISSION_TOGGLE"),
            ("status_and_settings", "STATUS_AND_SETTINGS"),
        ]:
            with self.subTest(operation=operation):
                token = await self.prepare(operation)
                result = await self.execute(token)
                self.assertTrue(result["success"], result)
                self.assertEqual(self.peer.commands[-1][0], command)

    async def test_collection_shortcuts_send_fixed_names(self):
        await self.configure()
        self.peer.mode = 0
        for operation, name in (
            ("collection_paused", "Paused"),
            ("collection_watch_soon", "Watch Soon"),
            ("collection_new", "New"),
            ("collection_favorites", "Favorites"),
        ):
            with self.subTest(operation=operation):
                result = await self.execute(await self.prepare(operation))
                self.assertTrue(result["success"], result)
                self.assertEqual(
                    self.peer.commands[-1][:2], ("GO_MOVIE_COLLECTION", (name,))
                )

    async def test_collection_shortcut_does_not_interrupt_active_playback(self):
        await self.configure()
        self.peer.mode = 0
        token = await self.prepare("collection_favorites")
        self.peer.mode = 2
        result = await self.execute(token)
        self.assertFalse(result["success"])
        self.assertFalse(self.peer.commands)
        result = await self.call(
            "control/prepare", **self.scope, operation="collection_favorites"
        )
        self.assertFalse(result["success"])

    async def test_play_pause_toggle_reports_observed_state(self):
        await self.configure()
        for expected in (1, 2):
            result = await self.execute(await self.prepare("play_pause"))
            self.assertEqual(result["result"]["outcome"], "state_observed")
            self.assertEqual(self.peer.mode, expected)
            self.assertEqual(self.peer.commands[-1][0], "PLAY_OR_PAUSE")

    @expected_log(
        "custom_components.kaleidescape_companion.playback.controls",
        "Device control outcome is uncertain",
    )
    async def test_other_users_receipts_are_private_but_still_block_the_player(self):
        await self.configure()
        self.peer.drop = True
        token = await self.prepare()
        request = str(uuid4())
        await self.execute(token, request)
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        value = (await self.call("control/info", user=reader, **self.scope))["result"]
        self.assertEqual(value["pending"], [])
        self.assertEqual(value["blocked_players"], [value["default_player"]])
        self.assertNotIn(request, str(value))
        token = await self.prepare("stop", user=reader)
        response = await self.execute(token, user=reader)
        self.assertEqual(response["code"], "control_uncertain")
        self.assertEqual(len(self.peer.commands), 1)
        response = await self.call(
            "control/acknowledge",
            **self.scope,
            user=reader,
            request_id=request,
            confirmation="REVIEWED",
        )
        self.assertEqual(response["code"], "unauthorized")

    async def test_only_known_movie_player_ids_can_select_a_target(self):
        await self.configure()
        await self.call("control/discover", **self.scope)
        controls = self.entry.runtime_data.controls
        self.peer.connections.clear()
        for target in (PLAYER, SERIAL, controls.player_id("2C3D"), "f" * 64):
            response = await self.call(
                "control/prepare", **self.scope, operation="pause", player_id=target
            )
            self.assertEqual(response["code"], "invalid_request")
        self.assertEqual(self.peer.connections, [])
        token = await self.prepare(player_id=controls.player_id(SERIAL))
        self.assertTrue((await self.execute(token))["success"])

    async def test_cached_discovery_restores_without_network_and_is_seed_bound(self):
        await self.configure()
        await self.call("control/discover", **self.scope)
        self.peer.connections.clear()
        controls = module.PlaybackControls(
            self.hass, self.entry.runtime_data.repository, CONFIG
        )
        await controls.async_start()
        self.assertEqual(controls.players()[0]["name"], "Example Cinema")
        changed = module.PlaybackControls(
            self.hass,
            self.entry.runtime_data.repository,
            {**CONFIG, "control_host": "10.0.0.11"},
        )
        await changed.async_start()
        self.assertEqual(changed.devices, [])
        self.assertEqual(self.peer.connections, [])

    async def test_explicit_player_choice_is_verified_without_changing_default(self):
        await self.configure()
        controls = self.entry.runtime_data.controls
        self.peer.alternative_serial = "3E4F"
        controls.devices.append(
            {
                "serial": "3E4F",
                "name": "Den",
                "model": "Fictional player",
                "ipaddress": "10.0.0.26",
                "is_player": True,
            }
        )
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        token = await self.prepare(
            "stop", user=reader, player_id=controls.player_id("3E4F")
        )
        self.assertEqual(self.peer.connections, [SEED, "10.0.0.26"])
        self.assertTrue((await self.execute(token, user=reader))["success"])
        self.assertEqual(self.peer.commands[0][2]["target_serial"], "3E4F")
        self.assertEqual(controls.config["control_player"], SERIAL)

    async def test_inactive_household_user_is_rejected_after_preflight_await(self):
        await self.configure()
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        token = await self.prepare(user=reader)
        self.peer.hook = lambda: setattr(reader, "is_active", False)
        response = await self.execute(token, user=reader)
        self.assertEqual(response["code"], "unauthorized")
        self.assertEqual(self.peer.commands, [])

    async def test_discovery_reads_seed_only_and_keeps_servers_out_of_player_selection(
        self,
    ):
        await self.configure()
        with patch.object(module, "LivePlayer", wraps=self.peer.client) as make_player:
            result = await self.call("control/discover", **self.scope)
        self.assertIs(make_player.call_args.kwargs["reconnect"], False)
        self.assertTrue(result["success"], result)
        self.assertEqual(
            [row["is_player"] for row in result["result"]["devices"]], [True, False]
        )
        self.assertEqual(self.peer.connections, [SEED])
        self.assertEqual(self.peer.commands, [])
        self.assertEqual(
            result["result"]["default_player"],
            self.entry.runtime_data.controls.player_id(SERIAL),
        )

    async def test_status_failure_logs_safe_pyk_stage_and_recovers(self):
        await self.configure()

        async def fail_power(device):
            raise OSError("10.0.0.25 token=fictional-secret")

        logger = "custom_components.kaleidescape_companion.playback.controls"
        with patch.object(self.peer, "state", fail_power):
            with self.assertLogs(logger, level="DEBUG") as first:
                response = await self.call("control/status", **self.scope)
            self.assertEqual(response["code"], "control_unreachable")
            self.assertIn(
                "Pyk read control state failed: OSError", "\n".join(first.output)
            )
            self.assertEqual(sum("WARNING" in line for line in first.output), 1)
            with self.assertLogs(logger, level="DEBUG") as repeated:
                response = await self.call("control/status", **self.scope)
            self.assertEqual(response["code"], "control_unreachable")
            self.assertEqual(sum("WARNING" in line for line in repeated.output), 0)
        with self.assertLogs(logger, level="INFO") as recovered:
            self.assertTrue(
                (await self.call("control/status", **self.scope))["success"]
            )
        self.assertIn("Device status read recovered", "\n".join(recovered.output))
        for record in [*first.output, *repeated.output, *recovered.output]:
            self.assertNotIn("10.0.0.25", record)
            self.assertNotIn("fictional-secret", record)

    async def test_connect_failure_logs_safe_pyk_stage(self):
        await self.configure()
        device = self.peer.client(SEED)

        async def fail_connect():
            device.is_connected = True
            raise TimeoutError("10.0.0.10 token=fictional-secret")

        device.connect = fail_connect
        with (
            patch.object(module, "LivePlayer", return_value=device),
            self.assertLogs(
                "custom_components.kaleidescape_companion.playback.controls",
                level="DEBUG",
            ) as logs,
        ):
            response = await self.call("control/status", **self.scope)
        self.assertEqual(response["code"], "control_unreachable")
        output = "\n".join(logs.output)
        self.assertIn("Pyk connect failed: TimeoutError", output)
        self.assertNotIn("10.0.0.10", output)
        self.assertNotIn("fictional-secret", output)
        self.assertFalse(device.is_connected)
        self.assertEqual(self.entry.runtime_data.controls.clients, set())

    async def test_preparation_is_read_only_and_exact_retry_does_not_replay(self):
        await self.configure()
        token = await self.prepare()
        self.assertEqual(self.peer.commands, [])
        request = str(uuid4())
        first = await self.execute(token, request)
        self.assertEqual(first["result"]["outcome"], "state_observed")
        before = list(self.peer.connections)
        self.assertEqual(await self.execute(token, request), first)
        self.assertEqual(self.peer.connections, before)
        self.assertEqual([name for name, *_ in self.peer.commands], ["PAUSE_ON"])
        self.assertEqual((await self.execute("b" * 64, request))["code"], "conflict")

    async def test_fresh_identity_and_state_guard_prevent_changed_target_writes(self):
        await self.configure()
        token = await self.prepare()
        self.assertEqual(self.peer.identity_reads, [(SEED, SERIAL), (PLAYER, None)])
        self.peer.wrong_serial = True
        result = await self.execute(token)
        self.assertEqual(result["code"], "control_identity")
        self.peer.wrong_serial = False
        self.peer.title = "Changed externally"
        result = await self.execute(token)
        self.assertEqual(result["code"], "refresh_required")
        self.assertEqual(self.peer.commands, [])

    @expected_log(
        "custom_components.kaleidescape_companion.playback.controls",
        "Device control outcome is uncertain",
    )
    async def test_uncertain_receipt_survives_restart_and_requires_review(self):
        await self.configure()
        token = await self.prepare()
        self.peer.drop = True
        request = str(uuid4())
        result = await self.execute(token, request)
        self.assertEqual(result["result"]["outcome"], "unconfirmed")
        repository = self.entry.runtime_data.repository
        await repository.async_close()
        repository = JournalRepository(repository.path)
        await repository.async_open()
        self.entry.runtime_data.repository = repository
        self.entry.runtime_data.controls = module.PlaybackControls(
            self.hass, repository, CONFIG
        )
        self.addAsyncCleanup(repository.async_close)
        self.assertEqual(await self.execute(token, request), result)
        next_token = await self.prepare()
        self.assertEqual((await self.execute(next_token))["code"], "control_uncertain")
        self.assertEqual(len(self.peer.commands), 1)
        await self.call(
            "control/acknowledge",
            **self.scope,
            request_id=request,
            confirmation="REVIEWED",
        )
        self.peer.drop = False
        self.assertTrue((await self.execute(next_token))["success"])

    async def test_uncertain_outcome_is_logged_as_warning(self):
        await self.configure()
        token = await self.prepare()
        self.peer.drop = True
        with self.assertLogs(module._LOGGER, level="WARNING") as captured:
            result = await self.execute(token)
        self.assertEqual(result["result"]["outcome"], "unconfirmed")
        self.assertEqual([record.levelname for record in captured.records], ["WARNING"])
        self.assertIn("outcome is uncertain", captured.records[0].getMessage())

    @expected_log(
        "custom_components.kaleidescape_companion.playback.controls",
        "Device control was rejected",
    )
    async def test_rejection_is_recorded_without_retry_or_wake(self):
        await self.configure()
        token = await self.prepare("stop")
        self.peer.rejected = True
        response = await self.execute(token)
        self.assertEqual(response["result"]["outcome"], "rejected")
        self.assertEqual([name for name, *_ in self.peer.commands], ["STOP"])

    async def test_failed_read_after_acknowledgment_does_not_mark_command_unsent(self):
        await self.configure()
        token = await self.prepare("stop")
        original = self.peer.state

        async def read(device):
            if self.peer.commands:
                raise RequestNotSentError("Fictional read failed")
            return await original(device)

        with patch.object(self.peer, "state", read):
            response = await self.execute(token)
        self.assertEqual(response["result"]["outcome"], "acknowledged")
        self.assertTrue(response["result"]["acknowledged"])
        self.assertEqual([name for name, *_ in self.peer.commands], ["STOP"])

    async def test_standby_requires_explicit_power_action_without_automatic_wake(self):
        await self.configure()
        self.peer.standby = True
        response = await self.call("control/prepare", **self.scope, operation="pause")
        self.assertEqual(response["code"], "control_not_ready")
        self.assertEqual(self.peer.commands, [])
        token = await self.prepare("power_on")
        self.assertEqual(self.peer.commands, [])
        response = await self.execute(token)
        self.assertEqual(response["result"]["outcome"], "state_observed")
        self.assertEqual([name for name, *_ in self.peer.commands], ["LEAVE_STANDBY"])

    async def test_another_actor_cannot_reuse_a_review_or_receipt(self):
        await self.configure()
        token = await self.prepare()
        other = SimpleNamespace(is_active=True, is_admin=True, id="another-admin")
        response = await self.execute(token, user=other)
        self.assertEqual(response["code"], "refresh_required")
        request = str(uuid4())
        self.assertTrue((await self.execute(token, request))["success"])
        response = await self.execute(token, request, user=other)
        self.assertEqual(response["code"], "conflict")
        self.assertEqual(len(self.peer.commands), 1)

    async def test_crash_reservation_reopens_as_uncertain_and_is_never_replayed(self):
        await self.configure()
        repository = self.entry.runtime_data.repository
        request, token = str(uuid4()), "a" * 64
        await repository.async_control(
            "begin", request, self.admin.id, token, SERIAL, "stop"
        )
        await repository.async_close()
        repository = JournalRepository(repository.path)
        await repository.async_open()
        self.addAsyncCleanup(repository.async_close)
        self.entry.runtime_data.repository = repository
        self.entry.runtime_data.controls.repository = repository
        page = await repository.async_inspect("playback_controls")
        self.assertEqual(page["items"][0]["status"], "uncertain")
        result = await self.execute(token, request)
        self.assertEqual(result["result"]["outcome"], "unconfirmed")
        self.assertEqual(self.peer.connections, [])
        self.assertEqual(self.peer.commands, [])

    async def test_read_recovery_is_tracked_per_operation(self):
        await self.configure()
        controls = self.entry.runtime_data.controls
        logger = "custom_components.kaleidescape_companion.playback.controls"
        failure = AsyncMock(side_effect=TimeoutError("fictional private"))
        success = AsyncMock(return_value=[])
        with self.assertLogs(logger, level="DEBUG") as logs:
            for label, operation in (
                ("status", failure),
                ("discovery", success),
                ("status", failure),
                ("preflight", failure),
                ("discovery", success),
                ("status", success),
            ):
                try:
                    await controls._read(label, operation, lambda: None)
                except JournalError:
                    pass
        messages = "\n".join(logs.output)
        self.assertEqual(messages.count("Device status read failed"), 1)
        self.assertEqual(messages.count("Device preflight read failed"), 1)
        self.assertEqual(messages.count("Device status read recovered"), 1)
        self.assertNotIn("Device discovery read recovered", messages)
        self.assertNotIn("Device preflight read recovered", messages)
        self.assertNotIn("fictional private", messages)
        self.assertEqual(
            set(controls._reported_read_failure), {"status", "discovery", "preflight"}
        )

    async def test_revoked_actor_and_changed_settings_are_rechecked_across_awaits(self):
        await self.configure()
        token = await self.prepare()
        self.peer.hook = lambda: setattr(self.admin, "is_active", False)
        result = await self.execute(token)
        self.assertEqual(result["code"], "unauthorized")
        self.assertEqual(self.peer.commands, [])

    async def test_backup_prevents_new_commands_and_drains_an_accepted_write(self):
        await self.configure()
        token = await self.prepare()
        self.peer.hold = asyncio.Event()
        running = asyncio.create_task(self.execute(token))
        await self.peer.sent.wait()
        backup = asyncio.create_task(async_pre_backup(self.hass))
        await asyncio.sleep(0)
        self.assertFalse(backup.done())
        self.peer.hold.set()
        await running
        await backup
        self.assertEqual(
            (await self.call("control/status", **self.scope))["code"], "not_ready"
        )
        await async_post_backup(self.hass)
        self.assertTrue((await self.call("control/status", **self.scope))["success"])

    async def test_backup_safely_cancels_preflight_without_failing_or_sending(self):
        await self.configure()
        token = await self.prepare()
        self.peer.read_started.clear()
        self.peer.read_hold = asyncio.Event()
        running = asyncio.create_task(self.execute(token))
        await self.peer.read_started.wait()
        backup = asyncio.create_task(async_pre_backup(self.hass))
        await asyncio.sleep(0)
        self.peer.read_hold.set()
        self.assertEqual((await running)["code"], "not_ready")
        await backup
        self.assertEqual(self.peer.commands, [])
        await async_post_backup(self.hass)

    async def test_stop_drains_delayed_discovery_before_creating_client(self):
        await self.configure()
        controls = self.entry.runtime_data.controls
        entered, release = asyncio.Event(), asyncio.Event()

        async def delayed_seed():
            entered.set()
            try:
                await release.wait()
            except asyncio.CancelledError:
                # A resolver may finish after cancellation has been requested.
                await release.wait()
            return SEED

        with patch.object(controls, "_seed", delayed_seed):
            read = asyncio.create_task(controls.async_discover(lambda: None))
            await entered.wait()
            stop = asyncio.create_task(controls.async_stop())
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            self.assertFalse(stop.done())
            release.set()
            await stop
            with self.assertRaises(JournalError) as caught:
                await read
        self.assertEqual(caught.exception.code, "not_ready")
        self.assertEqual(self.peer.connections, [])
        self.assertFalse(controls.clients)
        self.assertFalse(controls.read_tasks)

    async def test_pause_cancels_and_closes_inflight_status_and_preflight(self):
        for operation in ("status", "preflight"):
            with self.subTest(operation=operation):
                await self.configure()
                controls = self.entry.runtime_data.controls
                self.peer.read_hold = asyncio.Event()
                if operation == "status":
                    read = asyncio.create_task(controls.async_status(lambda: None))
                else:
                    read = asyncio.create_task(
                        controls.async_prepare("admin", "pause", None, lambda: None)
                    )
                await self.peer.read_started.wait()
                clients = list(controls.clients)
                await controls.async_pause()
                with self.assertRaises(JournalError) as caught:
                    await read
                self.assertEqual(caught.exception.code, "not_ready")
                self.assertTrue(all(not client.is_connected for client in clients))
                self.assertFalse(controls.clients)
                self.assertFalse(controls.read_tasks)
                self.assertEqual(self.peer.commands, [])

    async def test_pause_closes_cancelled_connection_attempt(self):
        await self.configure()
        controls = self.entry.runtime_data.controls
        entered = asyncio.Event()
        clients = []

        def delayed_client(ip, **kwargs):
            client = self.peer.client(ip, **kwargs)
            clients.append(client)

            async def connect():
                client.is_connected = True
                entered.set()
                await asyncio.Future()

            client.connect = connect
            return client

        with patch.object(module, "LivePlayer", delayed_client):
            read = asyncio.create_task(controls.async_discover(lambda: None))
            await entered.wait()
            await controls.async_pause()
            with self.assertRaises(JournalError) as caught:
                await read
        self.assertEqual(caught.exception.code, "not_ready")
        self.assertTrue(clients)
        self.assertTrue(all(not client.is_connected for client in clients))
        self.assertFalse(controls.clients)

    async def test_title_launch_uses_exact_cached_version_and_verified_metadata(self):
        await self.configure()
        repository = self.entry.runtime_data.repository
        await repository.async_library_catalog(
            "http://" + SEED,
            [
                {
                    "source_handle": "0-S_aabbccdd",
                    "source_group": "1",
                    "title": "A Fictional Film",
                    "year": 2025,
                }
            ],
        )
        title = title_id(source_id("http://" + SEED), "0-S_aabbccdd")
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        token = await self.prepare("launch", title_id=title, user=reader)
        self.assertEqual(self.peer.commands, [])
        response = await self.execute(token, user=reader)
        self.assertTrue(response["success"], response)
        self.assertFalse(response["result"]["exact_version_confirmed"])
        self.assertEqual(self.peer.commands[0][0], "PLAY_MOVIE")
        self.assertEqual(self.peer.commands[0][1][0], HANDLE)

    async def test_live_title_mismatch_never_sends_a_launch(self):
        await self.configure()
        repository = self.entry.runtime_data.repository
        await repository.async_library_catalog(
            "http://" + SEED,
            [
                {
                    "source_handle": "0-S_aabbccdd",
                    "source_group": "1",
                    "title": "A Fictional Film",
                }
            ],
        )
        self.peer.metadata_title = "A Different Movie"
        title = title_id(source_id("http://" + SEED), "0-S_aabbccdd")
        response = await self.call(
            "control/prepare", **self.scope, operation="launch", title_id=title
        )
        self.assertEqual(response["code"], "control_identity")
        self.assertEqual(self.peer.commands, [])

    async def test_unknown_protocol_handles_and_mixed_dns_destinations_are_rejected(
        self,
    ):
        for value in (
            "fixture",
            "1-S_abc",
            "26-1.0-S_abcd1234\nSTOP",
            "1.0-S_abcd1234",
        ):
            with self.assertRaises(module.JournalError):
                module.playback_handle(value)
        await self.configure()
        resolver = SimpleNamespace(
            resolve=AsyncMock(return_value=[{"host": PLAYER}, {"host": "8.8.8.8"}])
        )
        with patch.dict(self.hass.data, {module.DATA_RESOLVER: resolver}):
            with self.assertRaises(ValueError):
                await self.entry.runtime_data.controls._resolve("fictional.local")

    async def test_crash_barriers_are_protected_from_database_admin_edits(self):
        await self.configure()
        page = await self.entry.runtime_data.repository.async_inspect(
            "playback_controls"
        )
        self.assertFalse(page["deletable"])
        self.assertTrue(all(not column["editable"] for column in page["schema"]))

    async def test_idle_and_starting_are_readable_but_do_not_permit_launch(self):
        await self.configure()
        for value, label in (("1", "starting"), ("2", "idle")):
            self.peer.readiness = value
            response = await self.call("control/status", **self.scope)
            self.assertEqual(response["result"]["readiness"], label)
            self.assertFalse(response["result"]["ready"])
            response = await self.call(
                "control/prepare", **self.scope, operation="play"
            )
            self.assertEqual(response["code"], "control_not_ready")
        self.assertEqual(self.peer.commands, [])

    async def test_idle_with_unavailable_movie_zone_still_offers_explicit_wake(self):
        await self.configure()
        self.peer.zone_power = ("0",)
        self.peer.readiness = "2"
        status = (await self.call("control/status", **self.scope))["result"]
        self.assertEqual(status["readiness"], "idle")
        self.assertFalse(status["ready"])
        await self.prepare("power_on")
        self.peer.readiness = "0"
        status = (await self.call("control/status", **self.scope))["result"]
        self.assertEqual(status["readiness"], "starting")
        self.assertEqual(self.peer.commands, [])


class ConfigurationTest(unittest.TestCase):
    def test_configuration_is_opt_in_and_serial_selection_is_stable(self):
        self.assertFalse(validate({}, {})["control_enabled"])
        self.assertEqual(
            validate({"control_player": "00001a2b"}, {})["control_player"], SERIAL
        )
        for values in (
            {"control_enabled": "yes"},
            {"control_host": "http://8.8.8.8"},
            {"control_player": "#1234"},
        ):
            with self.assertRaises(ValueError):
                validate(values, {})

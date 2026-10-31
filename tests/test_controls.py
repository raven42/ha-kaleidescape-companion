"""Fictional API peers: identity, opt-ins, receipts and lifecycle gates."""

import asyncio
import unittest
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import kaleidescape_api as api
import test_backend as backend

from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.store import source_id, title_id
from custom_components.kaleidescape_companion.playback import controls as module
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
        self.metadata_title = "A Fictional Film"
        self.read_hold = None
        self.read_started = asyncio.Event()
        self.alternative_serial = None

    def client(self, ip, **_kwargs):
        peer = self

        class Client:
            async def __aenter__(self):
                peer.connections.append(ip)
                return self

            async def __aexit__(self, *args):
                pass

            async def close(self):
                pass

            async def device_info(self, target=api.Address()):
                if peer.alternative_serial and (
                    ip == "10.0.0.26" or target.device == "#" + peer.alternative_serial
                ):
                    return api.DeviceInfo(
                        "11", peer.alternative_serial, "03", "10.0.0.26"
                    )
                serial = "FFFF" if peer.wrong_serial and ip == PLAYER else SERIAL
                return api.DeviceInfo("11", serial, "01", "010.000.000.025")

            async def zones(self, target):
                return api.Zones(1, 0)

            async def discover(self):
                return (
                    api.DiscoveredDevice(
                        api.Address.serial(SERIAL),
                        await self.device_info(),
                        api.Zones(1, 0),
                        "Fictional Player",
                        "Example Cinema",
                    ),
                    api.DiscoveredDevice(
                        api.Address.serial("2C3D"),
                        api.DeviceInfo("1", "2C3D", "02", SEED),
                        api.Zones(0, 0),
                        "Fictional Server",
                        "",
                    ),
                )

            async def status(self, target):
                peer.read_started.set()
                if peer.read_hold:
                    await peer.read_hold.wait()
                if peer.hook:
                    peer.hook()
                if peer.standby:
                    raise api.Rejected(api.Status.STANDBY)
                return api.PlaybackState(peer.title, peer.mode, 7200, 100)

            async def query(self, command, **kwargs):
                assert command == "GET_HIGHLIGHTED_SELECTION"
                return api.NamedResponse("HIGHLIGHTED_SELECTION", {"handle": HANDLE})

            async def content_details(self, handle, **kwargs):
                return api.ContentDetails(
                    handle,
                    "movies",
                    {
                        "Title": peer.metadata_title,
                        "Year": "2025",
                        "Content_handle": handle,
                    },
                )

            async def execute(self, command, *fields, **kwargs):
                peer.commands.append((command, fields, kwargs))
                peer.sent.set()
                if peer.hold:
                    await peer.hold.wait()
                if peer.drop:
                    raise api.CommandUncertain("Fictional lost reply")
                if peer.rejected:
                    raise api.Rejected(20, command)
                if command == "LEAVE_STANDBY":
                    peer.standby = False
                peer.mode = {"STOP": 0, "PAUSE_ON": 1, "PAUSE_OFF": 2}.get(command, 2)

            @property
            def transport(self):
                return self

            async def request(self, spec, fields, address):
                if spec.name == "PLAY_MOVIE":
                    peer.title = "A Fictional Film"
                return await self.execute(spec.name, *fields, target=address)

        return Client()


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
        client_patch = patch.object(module, "Client", self.peer.client)
        client_patch.start()
        self.addCleanup(client_patch.stop)

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

    async def test_disabled_controls_are_inert_and_discovery_is_administrator_only(
        self,
    ):
        info = await self.call("control/info", **self.scope)
        self.assertFalse(info["result"]["enabled"])
        with patch.object(module, "Client") as client:
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
        self.assertEqual(self.peer.commands[0][2]["target"].device, "#3E4F")
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
        result = await self.call("control/discover", **self.scope)
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
        self.peer.wrong_serial = True
        result = await self.execute(token)
        self.assertEqual(result["code"], "control_identity")
        self.peer.wrong_serial = False
        self.peer.title = "Changed externally"
        result = await self.execute(token)
        self.assertEqual(result["code"], "refresh_required")
        self.assertEqual(self.peer.commands, [])

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

    async def test_rejection_is_recorded_without_retry_or_wake(self):
        await self.configure()
        token = await self.prepare("stop")
        self.peer.rejected = True
        response = await self.execute(token)
        self.assertEqual(response["result"]["outcome"], "rejected")
        self.assertEqual([name for name, *_ in self.peer.commands], ["STOP"])

    async def test_standby_requires_explicit_power_action_without_automatic_wake(self):
        await self.configure()
        self.peer.standby = True
        response = await self.call("control/prepare", **self.scope, operation="pause")
        self.assertEqual(response["code"], "control_unreachable")
        self.assertEqual(self.peer.commands, [])
        token = await self.prepare("power_on")
        self.assertEqual(self.peer.commands, [])
        response = await self.execute(token)
        self.assertEqual(response["result"]["outcome"], "acknowledged")
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
            with self.assertRaises(api.ProtocolError):
                await self.entry.runtime_data.controls._resolve("fictional.local")

    async def test_crash_barriers_are_protected_from_database_admin_edits(self):
        await self.configure()
        page = await self.entry.runtime_data.repository.async_inspect(
            "playback_controls"
        )
        self.assertFalse(page["deletable"])
        self.assertTrue(all(not column["editable"] for column in page["schema"]))


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

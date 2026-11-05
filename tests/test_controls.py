"""Fictional pyk Device peers: identity, opt-ins, receipts and lifecycle gates."""

import asyncio
import unittest
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import test_backend as backend
from _expected_logs import expected_log
from kaleidescape import const as pyk_const
from kaleidescape import message as pyk
from kaleidescape.error import (
    MessageError,
    RequestNotSentError,
    RequestOutcomeUnknownError,
)

from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.core.models import JournalError
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
        self.readiness = "0"
        self.zone_power = ()
        self.metadata_title = "A Fictional Film"
        self.read_hold = None
        self.read_started = asyncio.Event()
        self.alternative_serial = None

    def client(self, ip, **_kwargs):
        peer = self

        class Device:
            def __init__(self):
                self.is_connected = False
                self.connection = SimpleNamespace(generation=1)

            async def connect(self):
                peer.connections.append(ip)
                self.is_connected = True

            async def async_close(self):
                self.is_connected = False

            async def read_identity(self, serial=None):
                chosen = serial or (
                    peer.alternative_serial if ip == "10.0.0.26" else SERIAL
                )
                if peer.wrong_serial and ip == PLAYER:
                    chosen = "FFFF"
                model = "Fictional Server" if chosen == "2C3D" else "Fictional Player"
                return SimpleNamespace(
                    serial_number=chosen.zfill(12),
                    model=model,
                    movie_zones=0 if chosen == "2C3D" else 1,
                    generation=1,
                )

            async def discover_devices(self):
                return [
                    await self.read_identity(SERIAL),
                    await self.read_identity("2C3D"),
                ]

            async def read_control_state(self):
                peer.read_started.set()
                if peer.read_hold:
                    await peer.read_hold.wait()
                if peer.hook:
                    peer.hook()
                return SimpleNamespace(
                    identity=await self.read_identity(),
                    power="standby" if peer.standby else "on",
                    readiness={"0": "ready", "1": "becoming_ready", "2": "idle"}[
                        peer.readiness
                    ],
                    playing_title=peer.title,
                )

            async def get_content_details(self, handle):
                return SimpleNamespace(
                    field_year="2025", field_title=peer.metadata_title
                )

            async def prepare_movie_launch(self, handle, *, serial):
                return SimpleNamespace(
                    handle=HANDLE,
                    title=peer.metadata_title,
                    identity=await self.read_identity(serial),
                )

            async def send_movie_launch(self, prepared, *, allow_experimental):
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
                peer.mode = {"STOP": 0, "PAUSE_ON": 1, "PAUSE_OFF": 2}.get(command, 2)

            def __getattr__(self, name):
                commands = {
                    "play": "PLAY",
                    "pause_on": "PAUSE_ON",
                    "pause_off": "PAUSE_OFF",
                    "stop": "STOP",
                    "next": "NEXT",
                    "previous": "PREVIOUS",
                    "up": "UP",
                    "down": "DOWN",
                    "left": "LEFT",
                    "right": "RIGHT",
                    "select": "SELECT",
                    "back": "BACK",
                    "menu_toggle": "MENU_TOGGLE",
                    "go_movie_covers": "GO_MOVIE_COVERS",
                    "leave_standby": "LEAVE_STANDBY",
                    "enter_standby": "ENTER_STANDBY",
                }
                if name not in commands:
                    raise AttributeError(name)
                return lambda: self._execute(commands[name])

        return Device()

    async def response(self, device, request, *, serial=None):
        if request is pyk.GetDeviceInfo:
            return SimpleNamespace(
                field_ip="10.0.0.26"
                if serial == self.alternative_serial
                else (SEED if serial == "2C3D" else "010.000.000.025")
            )
        if request is pyk.GetFriendlyName:
            return SimpleNamespace(field="Example Cinema")
        if request is pyk.GetDevicePowerState:
            return SimpleNamespace(
                field_zone=[pyk_const.DEVICE_ZONE_STATE_DISABLED]
                if self.zone_power == ("0",)
                else []
            )
        if request is pyk.GetPlayStatus:
            return SimpleNamespace(
                field_play_status={
                    0: "none",
                    1: "paused",
                    2: "playing",
                    4: "forward",
                    6: "reverse",
                }[self.mode],
                field_title_length=7200,
                field_title_location=100,
            )
        raise AssertionError(request)


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
        for name, replacement in (
            ("Device", self.peer.client),
            ("one_response", self.peer.response),
        ):
            client_patch = patch.object(module, name, replacement)
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
        with patch.object(module, "Device") as client:
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

    async def test_status_failure_logs_safe_pyk_stage_and_recovers(self):
        await self.configure()

        async def fail_power(device, request, *, serial=None):
            if request is pyk.GetDevicePowerState:
                raise OSError("10.0.0.25 token=fictional-secret")
            return await self.peer.response(device, request, serial=serial)

        logger = "custom_components.kaleidescape_companion.playback.controls"
        with patch.object(module, "one_response", fail_power):
            with self.assertLogs(logger, level="DEBUG") as first:
                response = await self.call("control/status", **self.scope)
            self.assertEqual(response["code"], "control_unreachable")
            self.assertIn(
                "Pyk read device power state failed: OSError", "\n".join(first.output)
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
            patch.object(module, "Device", return_value=device),
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
        original = self.peer.response

        async def read(device, request, *, serial=None):
            if self.peer.commands and request is pyk.GetPlayStatus:
                raise RequestNotSentError("Fictional read failed")
            return await original(device, request, serial=serial)

        with patch.object(module, "one_response", read):
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

        with patch.object(module, "Device", delayed_client):
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

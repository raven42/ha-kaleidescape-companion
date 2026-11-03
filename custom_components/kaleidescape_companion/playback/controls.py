"""Authenticated household intents; never a generic wire proxy."""

import asyncio
import hashlib
import json
import logging
import re
import secrets
import socket
import time
from contextlib import asynccontextmanager
from dataclasses import asdict

from homeassistant.helpers.aiohttp_client import DATA_RESOLVER
from homeassistant.helpers.storage import Store

from .._vendor.kaleidescape_api import (
    Address,
    Client,
    PlaybackState,
    ProtocolError,
    Rejected,
    Status,
    device_address,
)
from .._vendor.kaleidescape_api.extensions import MovieCommands
from ..const import DOMAIN
from ..core.models import JournalError, invalid
from ..core.security import async_finish_cleanup
from ..core.tasks import async_wait
from ..library.config import origin
from ..library.store import source_id
from .control_config import COMMANDS, fingerprint, host

_LOGGER = logging.getLogger(__name__)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def state_key(state):
    # Position advances naturally; title/mode/runtime changes require fresh review.
    return digest([state.title, state.mode, state.duration_seconds])


def playback_handle(value):
    """Admit known handle spellings; the API resolves a bare namespace live."""
    if not re.fullmatch(
        r"(?:[0-9]{1,3}-[0-9]{1,3}\.)?[0-9]{1,3}-S_[0-9A-Fa-f]{8}", value
    ):
        raise JournalError(
            "control_handle", "This version has no verified playback-handle mapping"
        )
    return value


def reported_address(value):
    if re.fullmatch(r"[0-9]{1,3}(?:\.[0-9]{1,3}){3}", value):
        value = ".".join(str(int(part)) for part in value.split("."))
    return device_address(value)


class PlaybackControls:
    def __init__(self, hass, repository, config):
        self.hass, self.repository, self.config = hass, repository, dict(config)
        self.fingerprint = fingerprint(config)
        self.devices = []
        self.reviews = {}
        self.lock = asyncio.Lock()
        self.task = None
        self.clients = set()
        self.paused = self.stopped = False
        self.device_store = Store(
            hass, 1, f"{DOMAIN}.control_devices", private=True, atomic_writes=True
        )

    def _seed_key(self):
        return digest(host(self.config, self.config.get("library_host", "")))

    async def async_start(self):
        """Restore administrator-discovered choices without opening a socket."""
        if not self.config.get("control_enabled", False):
            return
        cached = await self.device_store.async_load()
        if not isinstance(cached, dict) or cached.get("seed") != self._seed_key():
            return
        rows = cached.get("devices")
        if not isinstance(rows, list) or len(rows) > 64:
            return
        try:
            # Cached identities are hints: every connection still verifies them live.
            devices = []
            for row in rows:
                serial = Address.serial(row["serial"]).device[1:]
                if type(row["is_player"]) is not bool:
                    return
                devices.append(
                    {
                        "serial": serial,
                        "name": " ".join(row["name"].split())[:160],
                        "model": " ".join(row["model"].split())[:160],
                        "ipaddress": reported_address(row["ipaddress"]),
                        "is_player": row["is_player"],
                    }
                )
            self.devices = devices
        except KeyError, TypeError, AttributeError, ProtocolError:
            return

    def player_id(self, serial):
        return digest([self._seed_key(), serial]) if serial else ""

    def players(self):
        """Public target choices contain labels and opaque IDs, never addresses."""
        players = {
            row["serial"]: {
                "id": self.player_id(row["serial"]),
                "name": row["name"] or row["model"] or "Movie player",
                "model": row["model"],
            }
            for row in self.devices
            if row["is_player"]
        }
        selected = self.config.get("control_player", "")
        if selected:
            players.setdefault(
                selected,
                {"id": self.player_id(selected), "name": "Default player", "model": ""},
            )
        return list(players.values())

    def _selected_serial(self, player_id):
        selected = self.config.get("control_player", "")
        if player_id is None:
            return selected
        candidates = [row["serial"] for row in self.devices if row["is_player"]]
        if selected:
            candidates.append(selected)
        for serial in candidates:
            if self.player_id(serial) == player_id:
                return serial
        raise invalid("Choose a known movie player")

    def _ready(self, authorize):
        authorize()
        if self.paused or self.stopped:
            raise JournalError("not_ready", "Device controls are paused")
        if not self.config.get("control_enabled", False):
            raise JournalError(
                "control_disabled", "Enable playback controls in Settings"
            )

    async def async_pause(self):
        self.paused = True
        self.reviews.clear()
        if self.task and not self.task.done():

            async def drain():
                try:
                    await async_wait(self.task)
                except JournalError:
                    # Pausing can invalidate a preflight before it reserves a write.
                    # That safe cancellation must not prevent a backup/unload.
                    pass

            await async_finish_cleanup(drain())
        for client in tuple(self.clients):
            await client.close()

    async def async_stop(self):
        self.stopped = True
        await self.async_pause()

    async def async_resume(self):
        self.paused = False

    @asynccontextmanager
    async def _client(self, ip):
        client = Client(ip, timeout=3)
        self.clients.add(client)
        try:
            async with client:
                yield client
        finally:
            self.clients.discard(client)

    async def _resolve(self, hostname):
        try:
            return device_address(hostname)
        except ProtocolError:
            pass
        async with asyncio.timeout(4):
            resolver = self.hass.data.get(DATA_RESOLVER)
            if resolver:
                rows = await resolver.resolve(hostname, 10000, family=socket.AF_UNSPEC)
                addresses = [row["host"] for row in rows]
            else:
                rows = await asyncio.get_running_loop().getaddrinfo(
                    hostname, 10000, type=socket.SOCK_STREAM
                )
                addresses = [row[4][0] for row in rows]
        # Reject mixed LAN/WAN answers, then connect to one literal pinned address.
        addresses = list(dict.fromkeys(device_address(ip) for ip in addresses))
        if not addresses:
            raise JournalError(
                "control_destination", "Control hostname has no private LAN address"
            )
        return min(addresses, key=lambda ip: ":" in ip)

    async def _seed(self):
        return await self._resolve(
            host(self.config, self.config.get("library_host", ""))
        )

    async def _power(self, client, target):
        """Documented power/idle queries; no wake is implied by a read."""
        reply = await client.query("GET_DEVICE_POWER_STATE", target=target)
        value = reply.values["power_state"]
        if value not in {"0", "1"} or any(
            zone not in {"0", "1"} for zone in reply.extra_fields
        ):
            raise ProtocolError("Invalid device power state")
        if value == "0":
            return {"power_state": "standby", "readiness": "idle", "ready": False}
        try:
            idle = await client.query("GET_SYSTEM_READINESS_STATE", target=target)
            readiness = {"0": "ready", "1": "starting", "2": "idle"}.get(
                idle.values["state"]
            )
            if readiness is None:
                raise ProtocolError("Invalid system readiness")
        except Rejected as error:
            if error.status != Status.INVALID_REQUEST:
                raise
            # Premiere players lack the newer idle command. Playback is also
            # queried before treating an on-state legacy player as usable.
            readiness = "ready"
        zone_ready = not reply.extra_fields or reply.extra_fields[0] == "1"
        return {
            "power_state": "on",
            "readiness": "starting"
            if readiness == "ready" and not zone_ready
            else readiness,
            "ready": readiness == "ready" and zone_ready,
        }

    async def _state(self, client, target, operation=""):
        power = await self._power(client, target)
        if not power["ready"]:
            if operation not in {"power_on", "power_off", "status"}:
                raise JournalError(
                    "control_not_ready", "Power on and wait for readiness"
                )
            return power, PlaybackState("", -1, 0, 0)
        return power, await client.status(target)

    @asynccontextmanager
    async def _player(self, authorize, *, ip=None, serial=None):
        self._ready(authorize)
        serial = serial or self.config.get("control_player")
        if not serial:
            raise JournalError(
                "control_player", "Discover and select a default player in Settings"
            )
        target = Address.serial(serial)
        if ip is None:
            async with self._client(await self._seed()) as seed:
                self._ready(authorize)
                info = await seed.device_info(target)
                if info.serial != serial:
                    raise JournalError(
                        "control_identity", "Discovered player identity changed"
                    )
                ip = reported_address(info.ipaddress)
        self._ready(authorize)
        async with self._client(ip) as client:
            info = await client.device_info()
            if info.serial != serial or (await client.zones(target)).movie < 1:
                raise JournalError(
                    "control_identity",
                    "Direct connection does not identify the selected movie player",
                )
            self._ready(authorize)
            yield client, target, ip

    async def async_info(self):
        return {
            "enabled": bool(self.config.get("control_enabled", False)),
            "allow_launch": bool(self.config.get("control_allow_launch", False)),
            "default_player": self.config.get("control_player", ""),
            "devices": self.devices,
            "pending": await self.repository.async_control("pending"),
        }

    async def _read(self, operation, authorize, seconds=12):
        self._ready(authorize)
        if self.lock.locked():
            raise JournalError("busy", "Wait for the active device operation")
        try:
            async with self.lock, asyncio.timeout(seconds):
                result = await operation()
                self._ready(authorize)
                return result
        except (ProtocolError, OSError, TimeoutError) as error:
            raise JournalError(
                "control_unreachable", "Device query failed; no control was sent"
            ) from error

    async def async_discover(self, authorize):
        async def discover():
            async with self._client(await self._seed()) as client:
                devices = await client.discover()
            self._ready(authorize)
            self.devices = [
                {
                    "serial": row.info.serial,
                    "name": " ".join((row.name or row.model).split())[:160],
                    "model": " ".join(row.model.split())[:160],
                    "ipaddress": reported_address(row.info.ipaddress),
                    "is_player": row.is_player,
                }
                for row in devices
            ]
            await self.device_store.async_save(
                {"seed": self._seed_key(), "devices": self.devices}
            )
            self._ready(authorize)
            _LOGGER.info(
                "Device discovery completed: %s devices found", len(self.devices)
            )
            return await self.async_info()

        return await self._read(discover, authorize, 65)

    async def async_status(self, authorize, player_id=None):
        async def status():
            async with self._player(
                authorize, serial=self._selected_serial(player_id)
            ) as (client, target, _ip):
                power, state = await self._state(client, target, "status")
                return {
                    "player_id": self.player_id(target.device[1:]),
                    **power,
                    "state": asdict(state),
                }

        return await self._read(status, authorize)

    async def _movie(self, client, target, title_id, authorize):
        if not self.config.get("control_allow_launch", False) or not self.config.get(
            "library_enabled", False
        ):
            raise JournalError(
                "control_launch_disabled",
                "Enable Library and experimental title playback first",
            )
        # Titles belong to the configured catalog seed, not an arbitrary system.
        if await self._seed() != await self._resolve(
            host({"control_host": self.config.get("library_host", "")})
        ):
            raise JournalError(
                "control_source",
                "Title playback requires the control seed to match the Library host",
            )
        source = source_id(origin(self.config.get("library_host", "")))
        row = await self.repository.async_control("library_version", source, title_id)
        self._ready(authorize)
        prepared = await MovieCommands(client).prepare(
            playback_handle(row["source_handle"]), target=target
        )
        data = json.loads(row["data"])
        actual = prepared.metadata.values
        if " ".join(actual["Title"].split()).casefold() != " ".join(
            row["title"].split()
        ).casefold() or (data.get("year") and str(data["year"]) != actual.get("Year")):
            raise JournalError(
                "control_identity",
                "Live movie details do not match the selected Library entry",
            )
        return prepared, digest(row)

    async def async_prepare(
        self, actor, operation, title_id, authorize, player_id=None
    ):
        if operation not in COMMANDS and operation != "launch":
            raise invalid("Unsupported device control")
        if (operation == "launch") != bool(title_id):
            raise invalid("Only title playback takes a Library version")

        async def prepare():
            async with self._player(
                authorize, serial=self._selected_serial(player_id)
            ) as (client, target, ip):
                power, before = await self._state(client, target, operation)
                movie, library_key = (
                    await self._movie(client, target, title_id, authorize)
                    if title_id
                    else (None, None)
                )
                self.reviews = {
                    key: value
                    for key, value in self.reviews.items()
                    if value["expires"] > time.monotonic()
                }
                if len(self.reviews) >= 64:
                    raise JournalError("busy", "Too many outstanding control reviews")
                token = secrets.token_hex(32)
                self.reviews[token] = {
                    "actor": actor,
                    "operation": operation,
                    "serial": target.device[1:],
                    "ip": ip,
                    "state": digest([state_key(before), power]),
                    "title_id": title_id,
                    "library_key": library_key,
                    "expires": time.monotonic() + 60,
                }
                return {
                    "token": token,
                    "operation": operation,
                    "player_id": self.player_id(target.device[1:]),
                    "before": asdict(before),
                    "title": movie.metadata.values["Title"] if movie else None,
                    "year": movie.metadata.values.get("Year") if movie else None,
                    "exact_version_confirmed": False,
                }

        return await self._read(prepare, authorize)

    async def async_execute(self, actor, request, token, authorize):
        cached = await self.repository.async_control("lookup", request, actor, token)
        if cached is not None:
            return cached
        self._ready(authorize)
        review = self.reviews.get(token)
        if (
            not review
            or review["actor"] != actor
            or review["expires"] <= time.monotonic()
        ):
            raise JournalError(
                "refresh_required", "Control review expired; inspect the player again"
            )
        if self.lock.locked() or (self.task and not self.task.done()):
            raise JournalError("busy", "Wait for the active device operation")

        async def execute():
            async with self.lock:
                return await self._execute(actor, request, token, review, authorize)

        self.task = self.hass.async_create_background_task(
            execute(), "Kaleidescape device control"
        )
        self.task.add_done_callback(
            lambda task: task.exception() if not task.cancelled() else None
        )
        return await async_wait(self.task)

    async def _execute(self, actor, request, token, review, authorize):
        reserved = sent = False
        result = {
            "request_id": request,
            "outcome": "unconfirmed",
            "acknowledged": False,
            "exact_version_confirmed": False,
        }
        try:
            async with asyncio.timeout(12):
                async with self._player(
                    authorize, ip=review["ip"], serial=review["serial"]
                ) as (client, target, _ip):
                    power, before = await self._state(
                        client, target, review["operation"]
                    )
                    if digest([state_key(before), power]) != review["state"]:
                        raise JournalError(
                            "refresh_required", "Player changed since review"
                        )
                    movie = None
                    if review["title_id"]:
                        movie, key = await self._movie(
                            client, target, review["title_id"], authorize
                        )
                        if key != review["library_key"]:
                            raise JournalError(
                                "refresh_required",
                                "Library version changed since review",
                            )
                    self._ready(authorize)
                    cached = await self.repository.async_control(
                        "begin",
                        request,
                        actor,
                        token,
                        review["serial"],
                        review["operation"],
                    )
                    if cached is not None:
                        return cached
                    reserved = True
                    self._ready(authorize)
                    sent = True
                    if movie:
                        await MovieCommands(client).send(movie)
                    else:
                        await client.execute(
                            COMMANDS[review["operation"]], target=target
                        )
                    result.update(outcome="acknowledged", acknowledged=True)
                    # One bounded observation; acceptance cannot prove exact edition.
                    after_power, after = await self._state(client, target, "status")
                    if review["operation"] in {"power_on", "power_off"}:
                        if (
                            review["operation"] == "power_on" and after_power["ready"]
                        ) or (
                            review["operation"] == "power_off"
                            and after_power["power_state"] == "standby"
                        ):
                            result["outcome"] = "state_observed"
                    desired = {
                        "stop": 0,
                        "pause": 1,
                        "resume": 2,
                        "play": 2,
                        "launch": 2,
                    }.get(review["operation"])
                    if desired is not None and after.mode == desired:
                        if not movie or (
                            after.title == movie.metadata.values["Title"]
                            and (
                                before.title != after.title
                                or before.mode != after.mode
                                or after.position_seconds + 2 < before.position_seconds
                            )
                        ):
                            result["outcome"] = "state_observed"
        except Rejected as error:
            if not reserved:
                _LOGGER.error(
                    "Device control preflight was rejected; no control was sent"
                )
                raise JournalError(
                    "control_unreachable", "Player query was rejected"
                ) from error
            if not result["acknowledged"]:
                result.update(outcome="rejected", status=error.status)
        except JournalError:
            if not reserved:
                raise
            if not sent:
                result["outcome"] = "not_sent"
        except ProtocolError, OSError, TimeoutError:
            if not reserved:
                _LOGGER.error("Device control preflight failed; no control was sent")
                raise JournalError(
                    "control_unreachable",
                    "Device preflight failed; no control was sent",
                ) from None
        except asyncio.CancelledError:
            if sent:
                _LOGGER.error("Device control outcome is uncertain after cancellation")
            else:
                _LOGGER.debug("Device control cancelled before sending")
            raise
        finally:
            if reserved:
                self.reviews.pop(token, None)
        if reserved:
            state = "uncertain" if result["outcome"] == "unconfirmed" else "finished"
            try:
                receipt = await self.repository.async_control(
                    "finish", request, result, state
                )
            except JournalError:
                _LOGGER.error(
                    "Device control receipt could not be recorded; review is required"
                )
                raise
            if state == "uncertain":
                _LOGGER.error(
                    "Device control outcome is uncertain; automatic replay is "
                    "blocked pending review"
                )
            elif result["outcome"] in {"rejected", "not_sent"}:
                _LOGGER.error(
                    "Device control was %s; the outcome was recorded", result["outcome"]
                )
            else:
                _LOGGER.info(
                    "Device control completed with outcome %s; "
                    "the receipt was recorded",
                    result["outcome"],
                )
            return receipt
        return result

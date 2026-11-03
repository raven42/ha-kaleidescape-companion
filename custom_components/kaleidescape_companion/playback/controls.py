"""Authenticated household intents; never a generic wire proxy."""

import asyncio
import hashlib
import ipaddress
import json
import logging
import re
import secrets
import socket
import time
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass

from homeassistant.helpers.aiohttp_client import DATA_RESOLVER
from homeassistant.helpers.storage import Store
from kaleidescape import Device
from kaleidescape import const as pyk_const
from kaleidescape import message as pyk
from kaleidescape.error import (
    KaleidescapeError,
    MessageError,
    RequestNotSentError,
)

from ..const import DOMAIN
from ..core.logging import safe_exception
from ..core.models import JournalError, invalid
from ..core.security import async_finish_cleanup
from ..core.tasks import async_wait
from ..library.config import lan_address, origin
from ..library.store import source_id
from .control_config import COMMANDS, fingerprint, host
from .identity import normalize_serial

_LOGGER = logging.getLogger(__name__)


async def pyk_call(stage, action):
    """Name a fixed pyk interaction without logging its private arguments."""
    try:
        return await action()
    except Exception as error:
        if _LOGGER.isEnabledFor(logging.DEBUG):
            _LOGGER.debug("Pyk %s failed: %s", stage, safe_exception(error))
        raise


@dataclass(frozen=True)
class PlaybackState:
    """The stable state projection returned to Companion clients."""

    title: str
    mode: int
    duration_seconds: int
    position_seconds: int


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def state_key(state):
    # Position advances naturally; title/mode/runtime changes require fresh review.
    return digest([state.title, state.mode, state.duration_seconds])


def playback_handle(value):
    """Admit known handle spellings; pyk resolves a bare namespace live."""
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
    try:
        address = str(ipaddress.ip_address(value))
    except ValueError as error:
        raise ValueError("Invalid device address") from error
    if not lan_address(address):
        raise ValueError("Device address is outside the private LAN")
    return address


async def one_response(device, request, *, serial=None):
    """Use pyk's public Request path for routed reads without a second client."""
    target = (
        f"#{serial.upper().zfill(12)}" if serial is not None else pyk_const.LOCAL_CPDID
    )
    rows = await request(device_id=target).send(device.connection)
    if len(rows) != 1:
        raise KaleidescapeError("Unexpected device response count")
    return rows[0]


class PlaybackControls:
    def __init__(self, hass, repository, config):
        self.hass, self.repository, self.config = hass, repository, dict(config)
        self.fingerprint = fingerprint(config)
        self.devices = []
        self.reviews = {}
        self.lock = asyncio.Lock()
        self.task = None
        self.clients = set()
        self._devices_by_ip = {}
        self._reported_read_failure = None
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
                serial = normalize_serial(row["serial"])
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
        except KeyError, TypeError, AttributeError, ValueError:
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
            await client.async_close()
        self.clients.clear()
        self._devices_by_ip.clear()

    async def async_stop(self):
        self.stopped = True
        await self.async_pause()

    async def async_resume(self):
        self.paused = False

    @asynccontextmanager
    async def _client(self, ip):
        client = self._devices_by_ip.get(ip)
        if client is None:
            client = Device(ip, timeout=3, reconnect=True)
            self._devices_by_ip[ip] = client
            self.clients.add(client)
        initialized = False
        try:
            if not client.is_connected:
                await pyk_call("connect", client.connect)
                _LOGGER.debug("Pyk Device connection established")
            initialized = True
            yield client
        except BaseException:
            if not initialized or not client.is_connected:
                self._devices_by_ip.pop(ip, None)
                self.clients.discard(client)
                try:
                    await pyk_call(
                        "close after failed connection", lambda: client.async_close()
                    )
                except Exception:
                    # Preserve the original connection/read failure.
                    pass
            raise

    async def _resolve(self, hostname):
        try:
            return reported_address(hostname)
        except ValueError:
            pass
        try:
            async with asyncio.timeout(4):
                resolver = self.hass.data.get(DATA_RESOLVER)
                if resolver:
                    rows = await resolver.resolve(
                        hostname, 10000, family=socket.AF_UNSPEC
                    )
                    addresses = [row["host"] for row in rows]
                else:
                    rows = await asyncio.get_running_loop().getaddrinfo(
                        hostname, 10000, type=socket.SOCK_STREAM
                    )
                    addresses = [row[4][0] for row in rows]
            # Reject mixed LAN/WAN answers, then connect to one literal address.
            addresses = list(dict.fromkeys(reported_address(ip) for ip in addresses))
        except (OSError, TimeoutError, ValueError, KeyError) as error:
            if _LOGGER.isEnabledFor(logging.DEBUG):
                _LOGGER.debug(
                    "Control host resolution failed: %s", safe_exception(error)
                )
            raise
        if not addresses:
            raise JournalError(
                "control_destination", "Control hostname has no private LAN address"
            )
        return min(addresses, key=lambda ip: ":" in ip)

    async def _seed(self):
        return await self._resolve(
            host(self.config, self.config.get("library_host", ""))
        )

    async def _state(self, client, operation=""):
        """Project fresh pyk state and zone evidence into the existing UI shape."""
        snapshot = await pyk_call(
            "read control state", lambda: client.read_control_state()
        )
        reply = await pyk_call(
            "read device power state",
            lambda: one_response(client, pyk.GetDevicePowerState),
        )
        zone_ready = not reply.field_zone or (
            reply.field_zone[0] == pyk_const.DEVICE_ZONE_STATE_AVAILABLE
        )
        readiness = snapshot.readiness
        if readiness == pyk_const.SYSTEM_READINESS_STATE_BECOMING_READY:
            readiness = "starting"
        if snapshot.power == pyk_const.DEVICE_POWER_STATE_STANDBY:
            readiness = "idle"
        power = {
            "power_state": snapshot.power,
            "readiness": "starting"
            if readiness == "ready" and not zone_ready
            else readiness,
            "ready": snapshot.power == pyk_const.DEVICE_POWER_STATE_ON
            and readiness == "ready"
            and zone_ready,
        }
        if not power["ready"]:
            if operation not in {"power_on", "power_off", "status"}:
                raise JournalError(
                    "control_not_ready", "Power on and wait for readiness"
                )
            return power, PlaybackState("", -1, 0, 0)
        status = await pyk_call(
            "read play status", lambda: one_response(client, pyk.GetPlayStatus)
        )
        mode = {
            pyk_const.PLAY_STATUS_NONE: 0,
            pyk_const.PLAY_STATUS_PAUSED: 1,
            pyk_const.PLAY_STATUS_PLAYING: 2,
            pyk_const.PLAY_STATUS_FORWARD: 4,
            pyk_const.PLAY_STATUS_REVERSE: 6,
        }.get(status.field_play_status)
        if mode is None:
            raise KaleidescapeError("Unknown playback status")
        if snapshot.identity.generation != client.connection.generation:
            raise KaleidescapeError("Playback state crossed a connection change")
        return power, PlaybackState(
            snapshot.playing_title or "",
            mode,
            status.field_title_length,
            status.field_title_location,
        )

    @asynccontextmanager
    async def _player(self, authorize, *, ip=None, serial=None):
        self._ready(authorize)
        serial = serial or self.config.get("control_player")
        if not serial:
            raise JournalError(
                "control_player", "Discover and select a default player in Settings"
            )
        if ip is None:
            async with self._client(await self._seed()) as seed:
                self._ready(authorize)
                identity = await pyk_call(
                    "read routed player identity", lambda: seed.read_identity(serial)
                )
                if normalize_serial(identity.serial_number) != serial:
                    raise JournalError(
                        "control_identity", "Discovered player identity changed"
                    )
                info = await pyk_call(
                    "read routed player address",
                    lambda: one_response(seed, pyk.GetDeviceInfo, serial=serial),
                )
                ip = reported_address(info.field_ip)
        self._ready(authorize)
        async with self._client(ip) as client:
            identity = await pyk_call(
                "read direct player identity", lambda: client.read_identity()
            )
            if (
                normalize_serial(identity.serial_number) != serial
                or identity.movie_zones < 1
            ):
                raise JournalError(
                    "control_identity",
                    "Direct connection does not identify the selected movie player",
                )
            self._ready(authorize)
            yield client, serial, ip

    async def async_info(self):
        return {
            "enabled": bool(self.config.get("control_enabled", False)),
            "allow_launch": bool(self.config.get("control_allow_launch", False)),
            "default_player": self.config.get("control_player", ""),
            "devices": self.devices,
            "pending": await self.repository.async_control("pending"),
        }

    async def _read(self, label, operation, authorize, seconds=12):
        self._ready(authorize)
        if self.lock.locked():
            raise JournalError("busy", "Wait for the active device operation")
        try:
            async with self.lock, asyncio.timeout(seconds):
                result = await operation()
                self._ready(authorize)
        except (
            KaleidescapeError,
            OSError,
            TimeoutError,
            ValueError,
            AttributeError,
        ) as error:
            category = (label, type(error).__name__)
            if self._reported_read_failure != category:
                _LOGGER.warning(
                    "Device %s read failed: %s", label, safe_exception(error)
                )
            elif _LOGGER.isEnabledFor(logging.DEBUG):
                _LOGGER.debug(
                    "Device %s read remains unavailable: %s",
                    label,
                    safe_exception(error),
                )
            self._reported_read_failure = category
            raise JournalError(
                "control_unreachable", "Device query failed; no control was sent"
            ) from None
        if self._reported_read_failure is not None:
            _LOGGER.info("Device %s read recovered", label)
            self._reported_read_failure = None
        return result

    async def async_discover(self, authorize):
        async def discover():
            async with self._client(await self._seed()) as client:
                identities = await pyk_call(
                    "discover devices", lambda: client.discover_devices()
                )
                devices = []
                for identity in identities:
                    serial = normalize_serial(identity.serial_number)
                    info = await pyk_call(
                        "read discovered device address",
                        lambda: one_response(client, pyk.GetDeviceInfo, serial=serial),
                    )
                    name = ""
                    if identity.movie_zones:
                        friendly = await pyk_call(
                            "read discovered player name",
                            lambda: one_response(
                                client, pyk.GetFriendlyName, serial=serial
                            ),
                        )
                        name = friendly.field
                    devices.append(
                        {
                            "serial": serial,
                            "name": " ".join((name or identity.model).split())[:160],
                            "model": " ".join(identity.model.split())[:160],
                            "ipaddress": reported_address(info.field_ip),
                            "is_player": identity.movie_zones > 0,
                        }
                    )
            self._ready(authorize)
            self.devices = devices
            await self.device_store.async_save(
                {"seed": self._seed_key(), "devices": self.devices}
            )
            self._ready(authorize)
            _LOGGER.info(
                "Device discovery completed: %s devices found", len(self.devices)
            )
            return await self.async_info()

        return await self._read("discovery", discover, authorize, 65)

    async def async_status(self, authorize, player_id=None):
        async def status():
            async with self._player(
                authorize, serial=self._selected_serial(player_id)
            ) as (client, serial, _ip):
                power, state = await self._state(client, "status")
                return {
                    "player_id": self.player_id(serial),
                    **power,
                    "state": asdict(state),
                }

        return await self._read("status", status, authorize)

    async def _movie(self, client, serial, title_id, authorize):
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
        prepared = await pyk_call(
            "prepare movie launch",
            lambda: client.prepare_movie_launch(
                playback_handle(row["source_handle"]), serial=serial
            ),
        )
        details = await pyk_call(
            "read movie details", lambda: client.get_content_details(prepared.handle)
        )
        data = json.loads(row["data"])
        if " ".join(prepared.title.split()).casefold() != " ".join(
            row["title"].split()
        ).casefold() or (data.get("year") and str(data["year"]) != details.field_year):
            raise JournalError(
                "control_identity",
                "Live movie details do not match the selected Library entry",
            )
        return prepared, digest(row), details.field_year

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
            ) as (client, serial, ip):
                power, before = await self._state(client, operation)
                movie, library_key, year = (
                    await self._movie(client, serial, title_id, authorize)
                    if title_id
                    else (None, None, None)
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
                    "serial": serial,
                    "ip": ip,
                    "state": digest([state_key(before), power]),
                    "title_id": title_id,
                    "library_key": library_key,
                    "expires": time.monotonic() + 60,
                }
                return {
                    "token": token,
                    "operation": operation,
                    "player_id": self.player_id(serial),
                    "before": asdict(before),
                    "title": movie.title if movie else None,
                    "year": year,
                    "exact_version_confirmed": False,
                }

        return await self._read("preflight", prepare, authorize)

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
                ) as (client, serial, _ip):
                    power, before = await self._state(client, review["operation"])
                    if digest([state_key(before), power]) != review["state"]:
                        raise JournalError(
                            "refresh_required", "Player changed since review"
                        )
                    movie = None
                    if review["title_id"]:
                        movie, key, _year = await self._movie(
                            client, serial, review["title_id"], authorize
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
                        await pyk_call(
                            "send movie launch",
                            lambda: client.send_movie_launch(
                                movie, allow_experimental=True
                            ),
                        )
                    else:
                        await pyk_call(
                            "send control command",
                            lambda: getattr(client, COMMANDS[review["operation"]])(),
                        )
                    result.update(outcome="acknowledged", acknowledged=True)
                    # One bounded observation; acceptance cannot prove exact edition.
                    after_power, after = await self._state(client, "status")
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
                            after.title == movie.title
                            and (
                                before.title != after.title
                                or before.mode != after.mode
                                or after.position_seconds + 2 < before.position_seconds
                            )
                        ):
                            result["outcome"] = "state_observed"
        except MessageError as error:
            if not reserved:
                _LOGGER.error(
                    "Device control preflight was rejected; no control was sent"
                )
                raise JournalError(
                    "control_unreachable", "Player query was rejected"
                ) from None
            if not result["acknowledged"]:
                result.update(outcome="rejected", status=error.code)
        except RequestNotSentError:
            if not reserved:
                raise JournalError(
                    "control_unreachable",
                    "Device preflight failed; no control was sent",
                ) from None
            if not result["acknowledged"]:
                result["outcome"] = "not_sent"
        except JournalError:
            if not reserved:
                raise
            if not sent:
                result["outcome"] = "not_sent"
        except KaleidescapeError, OSError, TimeoutError, ValueError:
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

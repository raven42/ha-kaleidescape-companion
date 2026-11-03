"""Official command API, with typed helpers and complete catalog dispatch."""

import asyncio
from collections.abc import Iterable
from typing import Self, cast

from .codec import Address
from .commands import Command, command_spec
from .errors import ProtocolError, Rejected, RequestTimeout
from .logging import SafeLogger
from .models import (
    BrowsePage,
    ContentDetails,
    DeviceInfo,
    DiscoveredDevice,
    NamedResponse,
    PlaybackState,
    PlayStatus,
    Zones,
    decode_response,
)
from .session import EventSubscription, Reply, Transport


class Client:
    """Documented ecosystem controls over one explicitly owned TCP connection."""

    def __init__(
        self, host: str, *, timeout: float = 5, logger: SafeLogger | None = None
    ) -> None:
        self.logger = logger or SafeLogger()
        self.transport = Transport(host, timeout=timeout, logger=self.logger)

    async def connect(self) -> None:
        await self.transport.connect()

    async def close(self) -> None:
        await self.transport.close()

    async def execute(
        self, command: str | Command, *fields: str | int, target: Address = Address()
    ) -> Reply:
        """Only documented requests; schema validation happens before any write."""
        return await self.transport.request(
            command_spec(command), fields, address=target
        )

    def subscribe(
        self,
        *,
        address: Address | None = None,
        names: Iterable[str] = (),
        capacity: int = 64,
    ) -> EventSubscription:
        """Local iterator only; explicitly enable routed device events separately."""
        return self.transport.subscribe(address=address, names=names, capacity=capacity)

    async def query(
        self, command: str | Command, *fields: str | int, target: Address = Address()
    ) -> DeviceInfo | Zones | PlayStatus | NamedResponse | tuple[Address, ...]:
        """Decode an ordinary read; multipart operations have dedicated helpers."""
        spec = command_spec(command)
        if not spec.read_only or spec.multipart:
            raise ProtocolError("Use execute or the dedicated multipart helper")
        reply = await self.execute(command, *fields, target=target)
        return decode_response(reply.messages[0])

    async def device_info(self, target: Address = Address()) -> DeviceInfo:
        return cast(DeviceInfo, await self.query("GET_DEVICE_INFO", target=target))

    async def zones(self, target: Address = Address()) -> Zones:
        return cast(Zones, await self.query("GET_NUM_ZONES", target=target))

    async def play_status(self, target: Address = Address()) -> PlayStatus:
        return cast(PlayStatus, await self.query("GET_PLAY_STATUS", target=target))

    async def status(self, target: Address = Address()) -> PlaybackState:
        """Read title and play status; these separate reads are not atomic."""
        status = await self.play_status(target)
        title = cast(
            NamedResponse, await self.query("GET_PLAYING_TITLE_NAME", target=target)
        )
        return PlaybackState(
            title.values["title"],
            status.mode,
            status.duration_seconds,
            status.position_seconds,
        )

    async def content_details(
        self, handle: str, *, passcode: str = "", target: Address = Address()
    ) -> ContentDetails:
        return ContentDetails.from_reply(
            await self.execute("GET_CONTENT_DETAILS", handle, passcode, target=target)
        )

    async def browse(
        self,
        handle: str = "",
        *,
        start: int = 1,
        end: int = 100,
        search: str | None = None,
        suggest: bool = False,
        target: Address = Address(),
    ) -> BrowsePage:
        flags = []
        if search is not None:
            if not isinstance(search, str) or any(
                char in search for char in ('"', ";")
            ):
                raise ProtocolError("Browse filter cannot contain quotes or semicolons")
            flags.append(f'filter="{search}"')
        if suggest:
            flags.append("suggest")
        return BrowsePage.from_reply(
            await self.execute(
                "BROWSE", handle, "", f"{start}-{end}", ";".join(flags), target=target
            )
        )

    async def enable_events(self, target: Address) -> Reply:
        return await self.execute("ENABLE_EVENTS", str(target))

    async def disable_events(self, target: Address) -> Reply:
        return await self.execute("DISABLE_EVENTS", str(target))

    async def configure_protocol(self, *, binary: bool = False) -> Reply:
        return await self.execute(
            "SET_PROTOCOL_SETTINGS",
            "BINARY_DELIMITERS" if binary else "PRINTABLE_DELIMITERS",
            "LATIN-1",
        )

    async def play(self, target: Address = Address()) -> Reply:
        return await self.execute("PLAY", target=target)

    async def pause(
        self, target: Address = Address(), *, paused: bool | None = None
    ) -> Reply:
        return await self.execute(
            "PAUSE" if paused is None else "PAUSE_ON" if paused else "PAUSE_OFF",
            target=target,
        )

    async def stop(self, target: Address = Address()) -> Reply:
        return await self.execute("STOP", target=target)

    async def discover(self) -> tuple[DiscoveredDevice, ...]:
        """Enumerate through this seed, without changing connection destinations."""
        try:
            async with asyncio.timeout(60):
                addresses = cast(
                    tuple[Address, ...],
                    await self.query("GET_AVAILABLE_DEVICES_BY_SERIAL_NUMBER"),
                )
                result = []
                for address in dict.fromkeys(addresses):
                    info = await self.device_info(address)
                    if address != Address.serial(info.serial):
                        raise ProtocolError(
                            "Discovery returned another device identity"
                        )
                    zones = await self.zones(address)
                    model = cast(
                        NamedResponse,
                        await self.query("GET_DEVICE_TYPE_NAME", target=address),
                    )
                    name = ""
                    if zones.movie:
                        try:
                            friendly = cast(
                                NamedResponse,
                                await self.query("GET_FRIENDLY_NAME", target=address),
                            )
                            name = friendly.values["name"]
                        except Rejected as error:
                            if error.status not in (10, 12, 999):
                                raise
                    result.append(
                        DiscoveredDevice(
                            address,
                            info,
                            zones,
                            model.values["device_name"],
                            name,
                        )
                    )
                return tuple(result)
        except TimeoutError as error:
            raise RequestTimeout("System discovery deadline exceeded") from error

    async def __aenter__(self) -> Self:
        await self.connect()
        return self

    async def __aexit__(self, *args):
        await self.close()

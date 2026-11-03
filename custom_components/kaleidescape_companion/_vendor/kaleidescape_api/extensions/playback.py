"""Operator workflows combining documented transport and explicit extensions."""

import asyncio
from contextlib import asynccontextmanager
from typing import cast

from .. import (
    Address,
    Client,
    NamedResponse,
    ProtocolError,
    Rejected,
    device_address,
    serial_number,
)
from .movies import MovieCommands, content_handle

OBSERVATION_TIMEOUT = 10


class Unconfirmed(ProtocolError):
    def __init__(self, evidence):
        self.evidence = evidence
        super().__init__(
            "Command may have reached the player; outcome is unconfirmed. "
            "Inspect the player before issuing another command."
        )


class Player:
    """Direct-player harness: identity preflight and bounded state observation."""

    def __init__(self, ipaddress: str, serial: str, *, timeout: float = 5):
        self.ipaddress = device_address(ipaddress)
        self.serial = serial_number(serial)
        self.target = Address.serial(self.serial)
        self.timeout = timeout
        self.lock = asyncio.Lock()

    @asynccontextmanager
    async def _session(self):
        async with self.lock:
            async with Client(self.ipaddress, timeout=self.timeout) as client:
                yield client

    async def _identity(self, client: Client) -> dict[str, object]:
        info = await client.device_info()
        if info.serial != self.serial:
            raise ProtocolError(
                "The supplied serial does not match the directly connected player"
            )
        if (await client.zones(self.target)).movie < 1:
            raise ProtocolError("The target does not report a movie zone")
        return {"serial_number": self.serial, "ipaddress": self.ipaddress}

    async def probe(self):
        async with self._session() as client:
            result = await self._identity(client)
            result["state"] = await client.status(self.target)
            highlighted = cast(
                NamedResponse,
                await client.query("GET_HIGHLIGHTED_SELECTION", target=self.target),
            )
            result["highlighted_handle"] = highlighted.values["handle"]
            return result

    async def play(self, handle: str | None = None, *, dry_run=False):
        if handle is not None:
            content_handle(handle)
        return await self._operate("play", handle, dry_run)

    async def stop(self, *, dry_run=False):
        return await self._operate("stop", None, dry_run)

    async def _operate(self, operation, handle, dry_run):
        async with self._session() as client:
            result = await self._identity(client)
            before = await client.status(self.target)
            expected_title, prepared = None, None
            extension = MovieCommands(client)
            if handle is not None:
                prepared = await extension.prepare(handle, target=self.target)
                expected_title = prepared.metadata.values["Title"]
                result.update(
                    handle=prepared.handle,
                    movie=prepared.metadata.values,
                    bookmark=prepared.bookmark.split(";", 1)[0],
                    play_options=prepared.bookmark.partition(";")[2],
                )
            result.update(
                command="PLAY_MOVIE" if prepared else operation.upper(),
                before=before,
                exact_version_confirmed=False,
            )
            if dry_run:
                return {**result, "outcome": "dry_run"}
            try:
                if prepared:
                    await extension.send(prepared)
                else:
                    await client.execute(operation.upper(), target=self.target)
            except Rejected:
                raise
            except ProtocolError as error:
                raise Unconfirmed(result) from error
            result["acknowledged"] = True
            try:
                async with asyncio.timeout(OBSERVATION_TIMEOUT):
                    while True:
                        after = await client.status(self.target)
                        result["after"] = after
                        desired = after.mode == (0 if operation == "stop" else 2)
                        if expected_title is not None:
                            desired = (
                                desired
                                and after.title == expected_title
                                and (
                                    before.title != after.title
                                    or before.mode != after.mode
                                    or after.position_seconds + 2
                                    < before.position_seconds
                                )
                            )
                        if desired:
                            return {**result, "outcome": "state_observed"}
                        await asyncio.sleep(0.5)
            except (ProtocolError, TimeoutError) as error:
                raise Unconfirmed(result) from error

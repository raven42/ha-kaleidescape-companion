"""Undocumented PLAY_MOVIE using the official transport, without catalog injection."""

import re
from dataclasses import dataclass
from typing import cast

from .. import (
    Address,
    Client,
    CommandSpec,
    ContentDetails,
    NamedResponse,
    Parameter,
    ProtocolError,
)

PLAY_MOVIE = CommandSpec(
    "PLAY_MOVIE",
    (
        Parameter("handle"),
        Parameter("bookmark_and_options"),
        Parameter("reserved", choices=("",)),
    ),
    family="experimental",
)


def content_handle(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,256}", value):
        raise ProtocolError("Invalid movie handle; use its exact opaque identifier")
    return value


@dataclass(frozen=True)
class LaunchProfile:
    """Named, replaceable experimental settings; not a vendor-supported contract."""

    bookmark: str = "NUL"
    options: tuple[tuple[str, str], ...] = (("158-0", "1"),)

    def field(self, namespace: str) -> str:
        content_handle(namespace)
        if "." in namespace:
            raise ProtocolError("Namespace must be a single opaque token")
        content_handle(self.bookmark)
        if not isinstance(self.options, tuple) or len(self.options) > 16:
            raise ProtocolError("Too many experimental play options")
        if "." in self.bookmark and not self.bookmark.startswith(namespace + "."):
            raise ProtocolError("Bookmark belongs to another namespace")
        seen = set()
        for option in self.options:
            if (
                not isinstance(option, tuple)
                or len(option) != 2
                or not all(isinstance(item, str) for item in option)
            ):
                raise ProtocolError("Invalid experimental play option")
            key, value = option
            if key in seen:
                raise ProtocolError("Duplicate experimental play option")
            seen.add(key)
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", key) or not re.fullmatch(
                r"[A-Za-z0-9_.-]{1,64}", value
            ):
                raise ProtocolError("Invalid experimental play option")
        return (
            self.bookmark if "." in self.bookmark else namespace + "." + self.bookmark
        ) + "".join(f";{key}={value}" for key, value in self.options)


@dataclass(frozen=True)
class PreparedMovie:
    target: Address
    handle: str
    bookmark: str
    metadata: ContentDetails


class MovieCommands:
    """Explicit extension adapter on a caller-owned official client/session."""

    def __init__(self, client: Client):
        self.client = client

    async def prepare(
        self, handle: str, *, target: Address, profile: LaunchProfile = LaunchProfile()
    ) -> PreparedMovie:
        content_handle(handle)
        if target.zone is not None or not target.device.startswith("#"):
            raise ProtocolError(
                "Experimental launch requires an explicit player serial"
            )
        if "." not in handle:
            highlighted = cast(
                NamedResponse,
                await self.client.query("GET_HIGHLIGHTED_SELECTION", target=target),
            )
            candidate = highlighted.values["handle"]
            if "." not in candidate:
                raise ProtocolError(
                    "Supply a qualified handle, or highlight a movie on the player"
                )
            namespace = content_handle(candidate).split(".", 1)[0]
            handle = namespace + "." + handle
        namespace, _, suffix = handle.partition(".")
        if not namespace or not suffix:
            raise ProtocolError("Movie handle has no usable namespace")
        metadata = await self.client.content_details(handle, target=target)
        if metadata.table != "movies" or not metadata.values.get("Title"):
            raise ProtocolError("Details do not identify a playable movie")
        return PreparedMovie(target, handle, profile.field(namespace), metadata)

    async def play(self, handle: str, *, target: Address, profile=LaunchProfile()):
        """Verify the handle, send once, return acknowledgement (not playback proof)."""
        prepared = await self.prepare(handle, target=target, profile=profile)
        return await self.send(prepared), prepared.metadata

    async def send(self, prepared: PreparedMovie):
        """Send a reviewed preparation; acknowledgement is not observation."""
        if (
            not prepared.target.device.startswith("#")
            or prepared.target.zone is not None
            or prepared.metadata.handle != prepared.handle
            or prepared.metadata.table != "movies"
        ):
            raise ProtocolError("Invalid prepared movie launch")
        content_handle(prepared.handle)
        return await self.client.transport.request(
            PLAY_MOVIE,
            (prepared.handle, prepared.bookmark, ""),
            address=prepared.target,
        )

"""Shared authorization and private-file primitives; see docs/security.md."""

import asyncio
import os
import stat
from collections.abc import Coroutine
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from homeassistant.auth.models import User


def is_active_admin(user: User | None) -> bool:
    """Keep HTTP and WebSocket authorization consistent, including after awaits."""
    return user is not None and user.is_active and user.is_admin


def is_active_user(user: User | None) -> bool:
    """Permit household viewing only for an authenticated, active HA user."""
    return user is not None and user.is_active


def _owned(info: os.stat_result) -> None:
    if info.st_uid != os.getuid():
        raise PermissionError("Journal storage must be owned by the HA user")


def private_directory(path: Path) -> None:
    """Create/tighten an owned directory without following its final symlink."""
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        _owned(os.fstat(descriptor))
        os.fchmod(descriptor, 0o700)
    finally:
        os.close(descriptor)


def private_file(path: Path, *, create: bool = False) -> None:
    """Reject linked/special files before using an integration-owned pathname."""
    try:
        info = path.lstat()
    except FileNotFoundError:
        if not create:
            return
    else:
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise PermissionError("Journal storage requires unlinked regular files")
        _owned(info)
    flags = os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK
    if create:
        flags |= os.O_CREAT
    descriptor = os.open(path, flags, 0o600)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise PermissionError("Journal storage requires unlinked regular files")
        _owned(info)
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)


async def async_finish_cleanup[T](operation: Coroutine[Any, Any, T]) -> T:
    """Finish private resource cleanup even if its caller is cancelled again."""
    task = asyncio.create_task(operation)
    interrupted = False
    while True:
        try:
            result = await asyncio.shield(task)
            break
        except asyncio.CancelledError:
            if task.cancelled():
                raise
            interrupted = True
    if interrupted:
        raise asyncio.CancelledError
    return result

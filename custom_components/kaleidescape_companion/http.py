"""Authenticated, bounded, admin-only streaming journal exports."""

import asyncio
from http import HTTPStatus
from pathlib import Path

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.core import HomeAssistant
from homeassistant.helpers.http import HomeAssistantView

from .const import DOMAIN
from .journal import JournalError
from .runtime import KaleidescapeRuntime, get_runtime
from .security import async_finish_cleanup, is_active_admin

EXPORT_DOWNLOAD_SECONDS = 60


class JournalExportView(HomeAssistantView):
    """Resolve scope for every request; never retain an unloaded repository."""

    url = f"/api/{DOMAIN}/{{entry_id}}/{{dataset_id}}/export"
    name = f"api:{DOMAIN}:export"
    requires_auth = True

    async def get(
        self, request: web.Request, entry_id: str, dataset_id: str
    ) -> web.StreamResponse:
        """Hold the export slot until the snapshot is removed, even on failure."""
        if not is_active_admin(request.get("hass_user")):
            raise web.HTTPForbidden
        hass = request.app[KEY_HASS]
        streaming = asyncio.Event()
        try:
            runtime = get_runtime(hass, entry_id, dataset_id)
            export_format = request.query.get("format", "json")
            async with asyncio.timeout(EXPORT_DOWNLOAD_SECONDS):
                snapshot = runtime.repository.async_export_snapshot(export_format)
                async with snapshot as path:
                    if not runtime.ready:
                        raise JournalError("not_ready", "Journal integration unloaded")
                    return await self._stream(
                        hass, request, path, export_format, streaming, runtime
                    )
        except TimeoutError:
            if streaming.is_set():
                raise ConnectionResetError("Journal export timed out") from None
            return self.json(
                {"code": "export_timeout", "message": "Journal export timed out"},
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
        except OSError:
            # Executor/file errors may contain paths; never put them in the API.
            if streaming.is_set():
                if request.transport is not None:
                    request.transport.close()
                raise ConnectionResetError("Journal export failed") from None
            return self.json(
                {"code": "storage_error", "message": "Journal export failed"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
        except JournalError as error:
            code = {
                "invalid_request": HTTPStatus.BAD_REQUEST,
                "not_found": HTTPStatus.NOT_FOUND,
                "not_ready": HTTPStatus.SERVICE_UNAVAILABLE,
                "busy": HTTPStatus.SERVICE_UNAVAILABLE,
                "export_too_large": HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                "export_timeout": HTTPStatus.SERVICE_UNAVAILABLE,
            }.get(error.code, HTTPStatus.INTERNAL_SERVER_ERROR)
            response = self.json({"code": error.code, "message": str(error)}, code)
            if error.code == "busy":
                response.headers["Retry-After"] = "5"
            return response

    @staticmethod
    async def _stream(
        hass: HomeAssistant,
        request: web.Request,
        path: Path,
        export_format: str,
        streaming: asyncio.Event,
        runtime: KaleidescapeRuntime,
    ) -> web.StreamResponse:
        """Check access across awaited work and never cache private downloads."""
        if not is_active_admin(request.get("hass_user")):
            raise web.HTTPForbidden
        file = None
        opening = asyncio.ensure_future(hass.async_add_executor_job(path.open, "rb"))
        try:
            try:
                file = await asyncio.shield(opening)
            except asyncio.CancelledError:
                # The open still runs in the executor; close before unlinking.
                async def close_when_opened() -> None:
                    opened = await opening
                    await hass.async_add_executor_job(opened.close)

                await async_finish_cleanup(close_when_opened())
                raise
            if not is_active_admin(request.get("hass_user")):
                raise web.HTTPForbidden
            if not runtime.ready:
                raise JournalError("not_ready", "Journal integration unloaded")
            response = web.StreamResponse(
                headers={
                    "Content-Type": "application/json"
                    if export_format == "json"
                    else "application/vnd.sqlite3",
                    "Content-Disposition": (
                        f'attachment; filename="kaleidescape-journal.{export_format}"'
                    ),
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                }
            )
            streaming.set()
            await response.prepare(request)

            async def read_chunk() -> bytes:
                return await hass.async_add_executor_job(file.read, 65536)

            while chunk := await async_finish_cleanup(read_chunk()):
                if not runtime.ready or not is_active_admin(request.get("hass_user")):
                    raise ConnectionResetError("Journal export access removed")
                await response.write(chunk)
            await response.write_eof()
            return response
        except asyncio.CancelledError, ConnectionResetError:
            # Once headers are sent, a timeout must close the partial transfer.
            if streaming.is_set() and request.transport is not None:
                request.transport.close()
            raise
        finally:
            if file is not None:

                async def close_file() -> None:
                    await hass.async_add_executor_job(file.close)

                await async_finish_cleanup(close_file())

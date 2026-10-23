"""Authenticated, admin-only streaming journal exports."""

import asyncio
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.helpers.http import HomeAssistantView

from .const import DOMAIN
from .journal import JournalError
from .runtime import get_runtime


class JournalExportView(HomeAssistantView):
    """Resolve scope for every request; never retain an unloaded repository."""

    url = f"/api/{DOMAIN}/{{entry_id}}/{{dataset_id}}/export"
    name = f"api:{DOMAIN}:export"
    requires_auth = True

    async def get(
        self, request: web.Request, entry_id: str, dataset_id: str
    ) -> web.StreamResponse:
        """Stream a worker-created snapshot and always remove its temporary file."""
        user = request.get("hass_user")
        if user is None or not user.is_active or not user.is_admin:
            raise web.HTTPForbidden
        hass = request.app[KEY_HASS]
        path = None
        file = None
        try:
            repository = get_runtime(hass, entry_id, dataset_id).repository
            export_format = request.query.get("format", "json")
            task = asyncio.create_task(repository.async_export(export_format))
            try:
                path = await asyncio.shield(task)
            except asyncio.CancelledError:
                # The worker still finishes after a client disconnects.
                path = await task
                raise
            response = web.StreamResponse(
                headers={
                    "Content-Type": "application/json"
                    if export_format == "json"
                    else "application/vnd.sqlite3",
                    "Content-Disposition": (
                        f'attachment; filename="kaleidescape-journal.{export_format}"'
                    ),
                    "Cache-Control": "no-store",
                }
            )
            opening = hass.async_add_executor_job(path.open, "rb")
            try:
                file = await asyncio.shield(opening)
            except asyncio.CancelledError:
                file = await opening
                raise
            await response.prepare(request)
            while chunk := await hass.async_add_executor_job(file.read, 65536):
                await response.write(chunk)
            await response.write_eof()
            return response
        except JournalError as error:
            code = {
                "invalid_request": HTTPStatus.BAD_REQUEST,
                "not_found": HTTPStatus.NOT_FOUND,
                "not_ready": HTTPStatus.SERVICE_UNAVAILABLE,
                "busy": HTTPStatus.SERVICE_UNAVAILABLE,
            }.get(error.code, HTTPStatus.INTERNAL_SERVER_ERROR)
            return self.json({"code": error.code, "message": str(error)}, code)
        finally:
            if file is not None:
                await hass.async_add_executor_job(file.close)
            if path is not None:
                await hass.async_add_executor_job(path.unlink)

"""Administrator-only bounded offline purchase-history preview upload."""

import asyncio

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.helpers.http import HomeAssistantView

from .const import DOMAIN
from .journal import JournalError, invalid
from .purchases import MAX_BYTES
from .runtime import get_library, get_runtime
from .security import async_finish_cleanup, is_active_admin


class PurchasePreviewView(HomeAssistantView):
    url = f"/api/{DOMAIN}/{{entry_id}}/{{dataset_id}}/library/purchases/preview"
    name = f"api:{DOMAIN}:purchase_preview"
    requires_auth = True

    async def post(self, request, entry_id, dataset_id):
        user = request.get("hass_user")
        if not is_active_admin(user):
            raise web.HTTPForbidden
        try:
            if request.query:
                raise invalid("Purchase preview accepts no query options")
            hass = request.app[KEY_HASS]
            runtime = get_runtime(hass, entry_id, dataset_id)
            library = get_library(hass, entry_id, runtime)

            def authorize():
                if request.get("hass_user") is not user or not is_active_admin(user):
                    raise web.HTTPForbidden
                if (
                    not runtime.ready
                    or get_library(hass, entry_id, runtime) is not library
                ):
                    raise JournalError("not_ready", "Library integration reloaded")

            if (
                request.content_length is not None
                and request.content_length > MAX_BYTES
            ):
                raise JournalError(
                    "purchase_too_large", "Purchase history exceeds 8 MiB"
                )
            async with runtime.repository.async_import_slot():
                async with asyncio.timeout(30):
                    parts, length = [], 0
                    async for chunk in request.content.iter_chunked(65536):
                        length += len(chunk)
                        if length > MAX_BYTES:
                            raise JournalError(
                                "purchase_too_large", "Purchase history exceeds 8 MiB"
                            )
                        parts.append(chunk)
                    authorize()
                    result = await async_finish_cleanup(
                        runtime.repository.async_purchase_preview(
                            library.source, b"".join(parts)
                        )
                    )
                    authorize()
                    return self.json(result, headers={"Cache-Control": "no-store"})
        except TimeoutError:
            return self.json(
                {"code": "not_ready", "message": "Purchase preview timed out"}, 503
            )
        except JournalError as error:
            status = {
                "invalid_request": 400,
                "purchase_too_large": 413,
                "not_found": 404,
                "library_disabled": 404,
                "busy": 503,
                "not_ready": 503,
            }.get(error.code, 500)
            return self.json(
                {"code": error.code, "message": str(error)},
                status,
                headers={"Cache-Control": "no-store"},
            )

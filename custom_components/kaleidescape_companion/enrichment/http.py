"""Admin-only ephemeral image previews bound to one reviewed scrape and actor."""

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.helpers.http import HomeAssistantView

from ..const import DOMAIN
from ..core.models import JournalError
from ..core.runtime import get_library, get_runtime
from ..core.security import is_active_admin


class MetadataImageView(HomeAssistantView):
    url = (
        f"/api/{DOMAIN}/{{entry_id}}/{{dataset_id}}/metadata/review/"
        "{plan_id}/image/{choice}"
    )
    name = f"api:{DOMAIN}:metadata_review_image"
    requires_auth = True

    async def get(self, request, entry_id, dataset_id, plan_id, choice):
        actor = request.get("hass_user")
        if not is_active_admin(actor):
            raise web.HTTPForbidden
        if request.query:
            raise web.HTTPBadRequest
        try:
            hass = request.app[KEY_HASS]
            runtime = get_runtime(hass, entry_id, dataset_id)
            library = get_library(hass, entry_id, runtime)
            if runtime.enrichment is None:
                raise web.HTTPNotFound
            manager = runtime.enrichment.title_reviews()
            body = await manager.image(actor, plan_id, choice)
            if request.get("hass_user") is not actor or not is_active_admin(actor):
                raise web.HTTPForbidden
            if (
                get_runtime(hass, entry_id, dataset_id) is not runtime
                or get_library(hass, entry_id, runtime) is not library
            ):
                raise web.HTTPNotFound
            return web.Response(
                body=body,
                content_type="image/jpeg",
                headers={
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except JournalError as error:
            if error.code == "unauthorized":
                raise web.HTTPForbidden from None
            if error.code in {"not_found", "not_ready", "library_disabled"}:
                raise web.HTTPNotFound from None
            raise web.HTTPServiceUnavailable from None

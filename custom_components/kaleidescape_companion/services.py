"""Home Assistant actions for purchases and synchronization."""

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .core.models import JournalError
from .core.runtime import loaded_runtimes
from .core.sync_actions import calendar_full_sync, library_sync

SERVICE = "import_purchase_email"
METADATA_SERVICE = "refresh_metadata"
LIBRARY_SERVICE = "library_sync"
CALENDAR_SERVICE = "calendar_full_sync"


def async_register_services(hass: HomeAssistant) -> None:
    """Register Companion actions for the loaded household entry."""

    async def import_email(call: ServiceCall):
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if not user or not user.is_active or not user.is_admin:
                raise HomeAssistantError(
                    "An administrator is required to import purchases"
                )
        runtimes = loaded_runtimes(hass)
        if len(runtimes) != 1:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        try:
            result = await runtimes[0][1].repository.async_purchase_email(
                call.data["invoice"],
                actor_id=call.context.user_id,
                allow_partial=call.return_response
                and call.data.get("allow_partial", False),
            )
        except JournalError as error:
            raise HomeAssistantError(str(error)) from None
        if result["status"] == "needs_review" and not call.return_response:
            if any(issue["reason"] == "conflict" for issue in result["issues"]):
                raise HomeAssistantError(
                    "Some purchases were saved; conflicting values require a "
                    "response variable for review"
                )
            from homeassistant.components import persistent_notification

            persistent_notification.async_create(
                hass,
                "Some purchases need review. Open Kaleidescape Companion → "
                "Database → Reconcile purchases.",
                "Kaleidescape Companion purchases need review",
            )
        return result if call.return_response else None

    async def request_sync(call: ServiceCall, operation):
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if not user or not user.is_active or not user.is_admin:
                raise HomeAssistantError(
                    "An administrator is required to request synchronization"
                )
        runtimes = loaded_runtimes(hass)
        if len(runtimes) != 1:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        entry_id, runtime = runtimes[0]
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or getattr(entry, "runtime_data", None) is not runtime:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        try:
            operation(entry)
        except (JournalError, ValueError) as error:
            raise HomeAssistantError(
                "The synchronization request could not be started"
            ) from error

    async def sync_library(call: ServiceCall):
        await request_sync(call, library_sync)

    async def sync_calendar(call: ServiceCall):
        await request_sync(call, calendar_full_sync)

    for name, handler in (
        (LIBRARY_SERVICE, sync_library),
        (CALENDAR_SERVICE, sync_calendar),
    ):
        hass.services.async_register(DOMAIN, name, handler, schema=vol.Schema({}))

    async def refresh_metadata(call: ServiceCall):
        actor = None
        if call.context.user_id:
            actor = await hass.auth.async_get_user(call.context.user_id)
            if not actor or not actor.is_active or not actor.is_admin:
                raise HomeAssistantError(
                    "An administrator is required to refresh metadata"
                )
        runtimes = loaded_runtimes(hass)
        if len(runtimes) != 1 or runtimes[0][1].enrichment is None:
            raise HomeAssistantError(
                "Enable a metadata provider and library sync first"
            )
        try:
            runtimes[0][1].enrichment.request_sync(
                actor,
                force=True,
                providers=tuple(call.data["providers"]) or None,
                only_missing=call.data["only_missing"],
            )
        except JournalError as error:
            raise HomeAssistantError(str(error)) from None

    from .enrichment.store import PROVIDERS

    hass.services.async_register(
        DOMAIN,
        METADATA_SERVICE,
        refresh_metadata,
        schema=vol.Schema(
            {
                vol.Optional("providers", default=[]): vol.All(
                    [vol.In(PROVIDERS)], vol.Length(max=len(PROVIDERS))
                ),
                vol.Optional("only_missing", default=False): bool,
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE,
        import_email,
        schema=vol.Schema(
            {
                vol.Required("invoice"): vol.Any(dict, str),
                vol.Optional("allow_partial", default=False): bool,
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )

"""Home Assistant actions for purchases and synchronization."""

import json
import logging

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
CLEANUP_SERVICE = "database_cleanup"
_LOGGER = logging.getLogger(__name__)


def _metadata_options(values):
    """Accept both spellings without silently choosing conflicting options."""
    if (
        "only_missing" in values
        and "missing_only" in values
        and values["only_missing"] != values["missing_only"]
    ):
        raise vol.Invalid("only_missing and missing_only must agree")
    return {
        "providers": values["providers"],
        "only_missing": values.get("only_missing", values.get("missing_only", False)),
    }


def _receipt_log_payload(payload):
    """Keep diagnostic logs bounded even for rejected, untrusted action input."""
    try:
        rendered = json.dumps(payload, ensure_ascii=True)
    except TypeError, ValueError, RecursionError:
        return "<unserializable receipt>"
    return (
        rendered if len(rendered) <= 4 * 1024 * 1024 else "<receipt exceeds log limit>"
    )


def _receipt_log_html(payload):
    """Decode the bounded HTML part for the requested receipt diagnostics."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError, TypeError, RecursionError:
            return None
    if not isinstance(payload, dict) or "html_part" not in payload:
        return None
    from .library.receipt_parser import _html_part

    return _html_part(payload["html_part"])


def _purchase_review_message(result):
    """Choose recovery from bounded outcomes without exposing receipt contents."""
    reasons = {issue["reason"] for issue in result["issues"]}
    if result.get("extracted_records") == []:
        cause = (
            "The receipt HTML part was unavailable."
            if "html_part_unavailable" in reasons
            else "The receipt HTML could not be parsed safely."
            if "html_items_unavailable" in reasons
            else "No usable purchase items were found in the receipt HTML."
        )
        return (
            f"Nothing was imported. {cause} Check imap.fetch and imap.fetch_part "
            "in the automation trace and verify the fetched HTML part."
        )
    saved = sum(result.get(key, 0) for key in ("imported_count", "updated_count"))
    pending = result.get("pending_count", 0)
    messages = [
        "Purchases were saved; some need review."
        if saved + pending
        else "No new purchases were saved; some need review."
    ]
    if pending or "unmatched" in reasons:
        messages.append(
            "Open Kaleidescape Companion → Database → Reconcile purchases "
            "to link saved unmatched purchases."
        )
    if reasons - {"unmatched"}:
        if saved + result.get("unchanged_count", 0):
            messages.append(
                "For linked purchases, open Kaleidescape Companion → Library → "
                "movie details → Purchase details in Advanced mode to inspect "
                "and repair incomplete or inconsistent fields."
            )
        else:
            messages.append(
                "Inspect the saved purchase records in Kaleidescape Companion → "
                "Database and the action result in the automation trace before "
                "repairing fields or retrying."
            )
    return " ".join(messages)


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
        entry_id, runtime = runtimes[0]
        try:
            result = await runtime.repository.async_purchase_email(
                call.data["invoice"],
                actor_id=call.context.user_id,
                allow_partial=call.return_response
                and call.data.get("allow_partial", False),
                timezone=getattr(getattr(hass, "config", None), "time_zone", "UTC")
                or "UTC",
            )
        except JournalError as error:
            _LOGGER.warning(
                "Purchase receipt import rejected: %s; receipt=%s; decoded_html=%s",
                error,
                _receipt_log_payload(call.data["invoice"]),
                _receipt_log_payload(_receipt_log_html(call.data["invoice"])),
            )
            raise HomeAssistantError(str(error)) from None
        except Exception:
            _LOGGER.exception(
                "Unexpected purchase receipt import failure; "
                "receipt=%s; decoded_html=%s",
                _receipt_log_payload(call.data["invoice"]),
                _receipt_log_payload(_receipt_log_html(call.data["invoice"])),
            )
            raise HomeAssistantError(
                "Purchase receipt import failed; check the Home Assistant logs"
            ) from None
        # Accepted writes may already have committed; do not disclose their
        # private result after the actor or runtime changes while awaiting them.
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if not user or not user.is_active or not user.is_admin:
                raise HomeAssistantError(
                    "Access changed while importing; purchases may have been saved"
                )
        current = loaded_runtimes(hass)
        if (
            len(current) != 1
            or current[0][0] != entry_id
            or current[0][1] is not runtime
        ):
            raise HomeAssistantError(
                "Companion changed while importing; purchases may have been saved"
            )
        if result["status"] == "needs_review":
            _LOGGER.warning(
                "Purchase receipt needs review: imported=%s, updated=%s, "
                "unchanged=%s, pending=%s; issues=%s; receipt=%s; "
                "result=%s; decoded_html=%s",
                result.get("imported_count", 0),
                result.get("updated_count", 0),
                result.get("unchanged_count", 0),
                result.get("pending_count", 0),
                json.dumps(result.get("issues", []), ensure_ascii=True),
                _receipt_log_payload(call.data["invoice"]),
                _receipt_log_payload(result),
                _receipt_log_payload(_receipt_log_html(call.data["invoice"])),
            )
        elif _LOGGER.isEnabledFor(logging.DEBUG):
            _LOGGER.debug(
                "Purchase receipt processed: receipt=%s; result=%s; decoded_html=%s",
                _receipt_log_payload(call.data["invoice"]),
                _receipt_log_payload(result),
                _receipt_log_payload(_receipt_log_html(call.data["invoice"])),
            )
        if result["status"] == "needs_review" and not call.return_response:
            if any(
                issue["reason"] in {"conflict", "possible_duplicate"}
                for issue in result["issues"]
            ):
                raise HomeAssistantError(
                    "Some purchases may have been saved; conflicts or possible "
                    "duplicates require a response variable for review"
                )
            from homeassistant.components import persistent_notification

            persistent_notification.async_create(
                hass,
                _purchase_review_message(result),
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

    async def database_cleanup(call: ServiceCall):
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if not user or not user.is_active or not user.is_admin:
                raise HomeAssistantError(
                    "An administrator is required for database cleanup"
                )
        runtimes = loaded_runtimes(hass)
        if len(runtimes) != 1:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        entry_id, runtime = runtimes[0]
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or getattr(entry, "runtime_data", None) is not runtime:
            raise HomeAssistantError("Kaleidescape Companion is not ready")
        try:
            result = await runtime.repository.async_database_cleanup(call.data)
        except JournalError as error:
            raise HomeAssistantError(str(error)) from None
        _LOGGER.info(
            "Database cleanup removed finalized operation histories: %s",
            result["removed"],
        )

    hass.services.async_register(
        DOMAIN,
        CLEANUP_SERVICE,
        database_cleanup,
        schema=vol.Schema(
            {
                vol.Optional(key, default=0): vol.All(int, vol.Range(min=0, max=3650))
                for key in ("calendar", "collections", "playback")
            }
        ),
    )

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
        schema=vol.All(
            vol.Schema(
                {
                    vol.Optional("providers", default=[]): vol.All(
                        [vol.In(PROVIDERS)], vol.Length(max=len(PROVIDERS))
                    ),
                    vol.Optional("only_missing"): bool,
                    vol.Optional("missing_only"): bool,
                }
            ),
            _metadata_options,
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

"""Home Assistant buttons for requesting Companion synchronization."""

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.const import EntityCategory
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo

from .const import DOMAIN, NAME
from .core.models import JournalError
from .core.sync_actions import calendar_full_sync, library_sync

DESCRIPTIONS = (
    ButtonEntityDescription(
        key="library_sync",
        translation_key="library_sync",
        icon="mdi:sync",
        entity_category=EntityCategory.CONFIG,
    ),
    ButtonEntityDescription(
        key="calendar_full_sync",
        translation_key="calendar_full_sync",
        icon="mdi:calendar-sync",
        entity_category=EntityCategory.CONFIG,
    ),
    ButtonEntityDescription(
        key="refresh_metadata",
        translation_key="refresh_metadata",
        icon="mdi:database-refresh",
        entity_category=EntityCategory.CONFIG,
    ),
)


async def async_setup_entry(hass, entry, async_add_entities):
    """Expose buttons even when their respective services are disabled."""
    async_add_entities(
        [CompanionButton(entry, description) for description in DESCRIPTIONS]
    )


class CompanionButton(ButtonEntity):
    """Request a background operation using the entry's current runtime."""

    _attr_has_entity_name = True

    def __init__(self, entry, description):
        self.entry = entry
        self.entity_description = description
        dataset = entry.runtime_data.dataset_id
        self._attr_unique_id = f"{dataset}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, dataset)},
            name=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def available(self):
        runtime = self.entry.runtime_data
        if not runtime.ready:
            return False
        if self.entity_description.key == "calendar_full_sync":
            return bool(runtime.calendar and runtime.calendar.maintenance.enabled)
        return bool(
            (self.entry.options or self.entry.data).get("library_enabled")
            and (
                runtime.library
                if self.entity_description.key == "library_sync"
                else runtime.enrichment
            )
        )

    async def async_press(self):
        if not self.available:
            raise HomeAssistantError(
                "Enable the required feature in Companion settings first"
            )
        try:
            runtime = self.entry.runtime_data
            if self.entity_description.key == "library_sync":
                library_sync(self.entry)
            elif self.entity_description.key == "refresh_metadata":
                runtime.enrichment.request_sync(force=True)
            else:
                calendar_full_sync(self.entry)
        except (JournalError, ValueError) as error:
            raise HomeAssistantError(
                "The synchronization request could not be started"
            ) from error

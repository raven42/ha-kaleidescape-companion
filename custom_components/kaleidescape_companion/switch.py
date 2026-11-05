"""Home Assistant switches for Companion configuration options."""

from homeassistant.components.switch import SwitchEntity, SwitchEntityDescription
from homeassistant.const import EntityCategory
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo

from .const import DOMAIN, NAME
from .core.settings import entity_ids, validate

DESCRIPTIONS = tuple(
    SwitchEntityDescription(
        key=key, translation_key=key, icon=icon, entity_category=EntityCategory.CONFIG
    )
    for key, icon in (
        ("calendar_enabled", "mdi:calendar-check"),
        ("tracking_enabled", "mdi:movie-play"),
        ("library_enabled", "mdi:database-sync"),
    )
)


async def async_setup_entry(hass, entry, async_add_entities):
    """Expose persistent settings as configuration switches."""
    async_add_entities(
        [CompanionSwitch(entry, description) for description in DESCRIPTIONS]
    )


class CompanionSwitch(SwitchEntity):
    """Validate and reload exactly as the integration's options flow does."""

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
        return self.entry.runtime_data.ready

    @property
    def is_on(self):
        return bool(
            (self.entry.options or self.entry.data).get(
                self.entity_description.key, False
            )
        )

    async def async_turn_on(self, **kwargs):
        await self._set(True)

    async def async_turn_off(self, **kwargs):
        await self._set(False)

    async def _set(self, enabled):
        if not self.available:
            raise HomeAssistantError("Companion is not ready")
        config = dict(self.entry.options or self.entry.data)
        key = self.entity_description.key
        if bool(config.get(key, False)) == enabled:
            return
        values = {
            "tracking_enabled": config.get("tracking_enabled", False),
            key: enabled,
        }
        values.update(
            {
                role: entity
                for role, entity in entity_ids(self.hass, config).items()
                if entity
            }
        )
        try:
            updated = validate(self.hass, values, config)
        except ValueError as error:
            raise HomeAssistantError(
                "Check the required Companion settings before enabling this switch"
            ) from error
        self.entry.runtime_data.preserve_panel_on_reload = True
        self.hass.config_entries.async_update_entry(self.entry, options=updated)
        self.async_write_ha_state()
        self.hass.async_create_task(
            self.hass.config_entries.async_reload(self.entry.entry_id)
        )

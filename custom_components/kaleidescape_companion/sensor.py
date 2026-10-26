"""Read-only household watch-history sensors backed by one shared local query."""

import logging
from datetime import timedelta

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription
from homeassistant.const import MAX_LENGTH_STATE_STATE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
    UpdateFailed,
)

from .const import DOMAIN, NAME
from .journal import JournalError
from .repository import JournalRepository
from .runtime import KaleidescapeConfigEntry

_LOGGER = logging.getLogger(__name__)
DESCRIPTIONS = tuple(
    SensorEntityDescription(key=key, translation_key=key, icon=icon)
    for key, icon in (
        ("last_watched_movie", "mdi:movie-check"),
        ("movies_7_days", "mdi:movie-open"),
        ("movies_30_days", "mdi:movie-open"),
        ("completed_7_days", "mdi:counter"),
        ("completed_30_days", "mdi:counter"),
        ("completed_365_days", "mdi:counter"),
        ("partial_movies", "mdi:movie-play-outline"),
    )
)


class HistoryCoordinator(DataUpdateCoordinator[dict]):
    """Refresh rolling windows even when no new playback event occurs."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: KaleidescapeConfigEntry,
        repository: JournalRepository,
    ):
        super().__init__(
            hass,
            _LOGGER,
            name=f"{NAME} history",
            config_entry=entry,
            update_interval=timedelta(seconds=30),
            always_update=False,
        )
        self.repository = repository

    async def _async_update_data(self) -> dict:
        try:
            return await self.repository.async_history_summary()
        except JournalError as error:
            raise UpdateFailed("Journal history is unavailable") from error


async def async_setup_entry(
    hass: HomeAssistant,
    entry: KaleidescapeConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = entry.runtime_data
    coordinator = HistoryCoordinator(hass, entry, runtime.repository)
    await coordinator.async_config_entry_first_refresh()
    async_add_entities(
        [
            HistorySensor(coordinator, description, runtime.dataset_id)
            for description in DESCRIPTIONS
        ]
    )


class HistorySensor(CoordinatorEntity[HistoryCoordinator], SensorEntity):
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: HistoryCoordinator,
        description: SensorEntityDescription,
        dataset_id: str,
    ):
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{dataset_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, dataset_id)},
            name=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )
        if description.key != "last_watched_movie":
            self._attr_suggested_display_precision = 0

    @property
    def native_value(self) -> str | int | None:
        key = self.entity_description.key
        data = self.coordinator.data
        if key == "last_watched_movie":
            title = data[key]
            return title[:MAX_LENGTH_STATE_STATE] if title is not None else None
        if key == "partial_movies":
            return data["partial_count"]
        if key.startswith("movies_"):
            return data[key.replace("movies_", "completed_")]
        return data[key]

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.data
        key = self.entity_description.key
        if key == "last_watched_movie":
            return {"movie": data[key], "watched_at": data["last_watched_at"]}
        if key in {"movies_7_days", "movies_30_days", "partial_movies"}:
            return {"movies": list(data[key]), "truncated": data[f"{key}_truncated"]}
        return {}

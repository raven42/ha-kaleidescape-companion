"""Read-only household history and cached-library sensors on shared coordinators."""

import logging
from datetime import datetime, timedelta

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    MAX_LENGTH_STATE_STATE,
    EntityCategory,
    UnitOfInformation,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
    UpdateFailed,
)

from .const import DOMAIN, NAME
from .core.models import JournalError
from .core.repository import JournalRepository
from .core.runtime import KaleidescapeConfigEntry
from .library.config import origin
from .library.store import source_id

_LOGGER = logging.getLogger(__name__)
HISTORY_DESCRIPTIONS = tuple(
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


LIBRARY_DESCRIPTIONS = (
    SensorEntityDescription(
        key="last_scrape_date",
        translation_key="last_scrape_date",
        device_class=SensorDeviceClass.TIMESTAMP,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    *(
        SensorEntityDescription(
            key=key,
            translation_key=key,
            icon=icon,
            suggested_display_precision=0,
            entity_category=EntityCategory.DIAGNOSTIC,
            state_class=(
                SensorStateClass.TOTAL_INCREASING
                if key == "scraper_failures"
                else SensorStateClass.MEASUREMENT
            ),
        )
        for key, icon in (
            ("scraper_failures", "mdi:alert-circle-outline"),
            ("scraper_conflicts", "mdi:movie-search-outline"),
            ("missing_artwork", "mdi:image-off-outline"),
        )
    ),
    SensorEntityDescription(
        key="total_movies",
        translation_key="total_movies",
        icon="mdi:movie-open",
        suggested_display_precision=0,
    ),
    SensorEntityDescription(
        key="database_size",
        translation_key="database_size",
        icon="mdi:database",
        device_class=SensorDeviceClass.DATA_SIZE,
        native_unit_of_measurement=UnitOfInformation.MEBIBYTES,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SensorEntityDescription(
        key="last_library_sync",
        translation_key="last_library_sync",
        device_class=SensorDeviceClass.TIMESTAMP,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SensorEntityDescription(
        key="artwork_cache_size",
        translation_key="artwork_cache_size",
        icon="mdi:image-multiple",
        device_class=SensorDeviceClass.DATA_SIZE,
        native_unit_of_measurement=UnitOfInformation.MEBIBYTES,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SensorEntityDescription(
        key="unwatched_movies",
        translation_key="unwatched_movies",
        icon="mdi:movie-open-outline",
        suggested_display_precision=0,
    ),
    SensorEntityDescription(
        key="watched_movies",
        translation_key="watched_movies",
        icon="mdi:movie-check",
        suggested_display_precision=0,
    ),
    SensorEntityDescription(
        key="recently_added",
        translation_key="recently_added",
        icon="mdi:movie-plus",
        suggested_display_precision=0,
    ),
)
SIZE_SENSORS = {"database_size", "artwork_cache_size"}


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


class LibraryCoordinator(DataUpdateCoordinator[dict]):
    """Refresh cached counts independently of rolling viewing history or network I/O."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: KaleidescapeConfigEntry,
        repository: JournalRepository,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=f"{NAME} library",
            config_entry=entry,
            update_interval=timedelta(seconds=30),
            always_update=False,
        )
        self.entry = entry
        self.repository = repository

    @property
    def source(self) -> str | None:
        config = self.entry.options or self.entry.data
        return (
            source_id(origin(config.get("library_host", "")))
            if config.get("library_enabled", False)
            else None
        )

    async def _async_update_data(self) -> dict:
        try:
            source = self.source
            data = await self.repository.async_library_summary(source)
            if source != self.source:
                raise UpdateFailed("Library settings changed during refresh")
            data["source"] = source  # Internal scope guard; never an entity attribute.
            for key in ("last_library_sync", "last_scrape_date"):
                stamp = data[key]
                parsed = datetime.fromisoformat(stamp) if stamp else None
                if parsed is not None and parsed.utcoffset() is None:
                    raise ValueError("Stored sync time must have a timezone")
                data[key] = parsed
            return data
        except (JournalError, ValueError) as error:
            raise UpdateFailed("Library summary is unavailable") from error


async def async_setup_entry(
    hass: HomeAssistant,
    entry: KaleidescapeConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = entry.runtime_data
    history = HistoryCoordinator(hass, entry, runtime.repository)
    library = LibraryCoordinator(hass, entry, runtime.repository)
    await history.async_config_entry_first_refresh()
    await library.async_config_entry_first_refresh()
    async_add_entities(
        [
            *[
                HistorySensor(history, description, runtime.dataset_id)
                for description in HISTORY_DESCRIPTIONS
            ],
            *[
                LibrarySensor(library, description, runtime.dataset_id)
                for description in LIBRARY_DESCRIPTIONS
            ],
        ]
    )


class CompanionSensor(CoordinatorEntity, SensorEntity):
    """Keep device identity shared and existing history unique IDs unchanged."""

    _attr_has_entity_name = True

    def __init__(self, coordinator, description, dataset_id):
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{dataset_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, dataset_id)},
            name=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )


class HistorySensor(CompanionSensor):
    def __init__(self, coordinator, description, dataset_id):
        super().__init__(coordinator, description, dataset_id)
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


class LibrarySensor(CompanionSensor):
    @property
    def available(self) -> bool:
        if not super().available:
            return False
        if self.entity_description.key in SIZE_SENSORS:
            return True
        return (
            self.coordinator.source is not None
            and self.coordinator.data["source"] == self.coordinator.source
        )

    @property
    def native_value(self) -> int | float | datetime | None:
        if not self.available:
            return None
        key = self.entity_description.key
        data = self.coordinator.data
        if key in SIZE_SENSORS:
            field = (
                "database_bytes" if key == "database_size" else "artwork_cache_bytes"
            )
            return data[field] / (1024 * 1024)
        return data[key]

    @property
    def extra_state_attributes(self) -> dict:
        if not self.available:
            return {}
        data = self.coordinator.data
        key = self.entity_description.key
        if key in {"missing_artwork", "scraper_conflicts"}:
            return {
                "movies": list(data[f"{key}_movies"]),
                "truncated": data[f"{key}_truncated"],
            }
        if key == "recently_added":
            return {
                "movies": list(data["recently_added_movies"]),
                "truncated": data["recently_added_truncated"],
                "added_at": data["recently_added_at"],
            }
        if self.entity_description.key in {"watched_movies", "unwatched_movies"}:
            return {
                "unknown_movies": data["unknown_movies"],
                "collections_synced_at": data["collections_synced_at"],
            }
        return {}

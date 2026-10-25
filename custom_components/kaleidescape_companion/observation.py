"""In-process HA entity observation with ordered, bounded playback buffering."""

import asyncio
import logging
from collections import deque
from collections.abc import Callable
from datetime import UTC, datetime

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event

from .journal import JournalError, seconds, text
from .repository import JournalRepository
from .settings import entity_ids
from .tracker import Observation, PlaybackTracker

_LOGGER = logging.getLogger(__name__)
MAX_OBSERVATIONS = 256


class PlaybackObserver:
    """Observe selected states only; no HA service calls or device connections."""

    def __init__(
        self,
        hass: HomeAssistant,
        repository: JournalRepository,
        config: dict,
        *,
        clock: Callable[[], tuple[str, float]] | None = None,
    ) -> None:
        self.hass = hass
        self.repository = repository
        self.config = config
        self.tracker = PlaybackTracker(config["player_id"])
        self.entities: dict[str, str | None] = {}
        self._states = {}
        self._queue: deque[Observation] = deque()
        self._outbox: deque[dict] = deque()
        self._task: asyncio.Task | None = None
        self._timer = None
        self._unsubscribe = None
        self._registry_unsubscribe = None
        self._paused = True
        self._accepting = True
        self.last_error: str | None = None
        self.overflow_count = 0
        self._clock = clock or (
            lambda: (
                datetime.now(UTC).isoformat(timespec="microseconds"),
                self.hass.loop.time(),
            )
        )

    async def async_start(self) -> None:
        """Subscribe before reconciliation, preserving updates arriving during IO."""
        self._bind()
        self._registry_unsubscribe = self.hass.bus.async_listen(
            er.EVENT_ENTITY_REGISTRY_UPDATED, self._registry_changed
        )
        self._enqueue(self._capture())
        recovered = await self.repository.async_open_session(self.config["player_id"])
        if recovered:
            self.tracker.restore(recovered)
        self._paused = False
        self._kick()
        self._schedule_tick()
        await self.async_flush()

    @callback
    def _bind(self) -> None:
        if self._unsubscribe:
            self._unsubscribe()
        self.entities = entity_ids(self.hass, self.config)
        self._states = {
            role: self.hass.states.get(entity) if entity else None
            for role, entity in self.entities.items()
        }
        self._unsubscribe = async_track_state_change_event(
            self.hass,
            [entity for entity in self.entities.values() if entity],
            self._state_changed,
        )

    @callback
    def _registry_changed(self, _event) -> None:
        if self._accepting and entity_ids(self.hass, self.config) != self.entities:
            self._bind()
            current = self._capture()
            self._enqueue(self.tracker.gap(current))
            self._enqueue(current)

    @callback
    def _state_changed(self, event) -> None:
        for role, entity in self.entities.items():
            if entity == event.data["entity_id"]:
                self._states[role] = event.data["new_state"]
        self._enqueue(self._capture())

    def _capture(self) -> Observation:
        player = self._states.get("media_player")
        status = self._states.get("play_status")
        location = self._states.get("media_location")
        available = all(
            state is not None and state.state not in ("unknown", "unavailable")
            for state in (player, status, location)
        )
        attributes = player.attributes if player else {}

        def attribute(name: str, maximum: int):
            try:
                return text(attributes.get(name), maximum)
            except JournalError:
                return None

        try:
            duration = seconds(attributes.get("media_duration"))
        except JournalError:
            duration = None
        play_status = status.state if status else "unknown"
        if player and player.state in ("off", "standby", "idle"):
            play_status = "stopped"
        at, monotonic = self._clock()
        return Observation(
            at=at,
            monotonic=monotonic,
            content_id=attribute("media_content_id", 255),
            title=attribute("media_title", 500),
            duration=duration,
            play_status=play_status,
            location=location.state if location else "unknown",
            available=available,
        )

    @callback
    def _enqueue(self, observation: Observation) -> None:
        if not self._accepting:
            return
        if len(self._queue) >= MAX_OBSERVATIONS:
            self._queue.clear()
            self._queue.append(self.tracker.gap(observation))
            self.overflow_count += 1
            _LOGGER.warning(
                "Playback observation buffer overflow; a timing gap was recorded"
            )
        self._queue.append(observation)
        self._kick()

    @callback
    def _kick(self) -> None:
        if not self._paused and self._task is None:
            self._task = self.hass.async_create_background_task(
                self._drain(), "kaleidescape.playback", eager_start=False
            )

    async def _drain(self) -> None:
        try:
            while self._outbox or (self._queue and not self._paused):
                if self._outbox:
                    try:
                        await self.repository.async_save_session(
                            self._outbox[0],
                            self.config.get("minimum_seconds", 300),
                            self.config.get("resume_hours", 24),
                        )
                    except JournalError as error:
                        if self.last_error != error.code:
                            _LOGGER.error(
                                "Playback persistence suspended: %s", error.code
                            )
                        self.last_error = error.code
                        return
                    self._outbox.popleft()
                    self.last_error = None
                else:
                    self._outbox.extend(self.tracker.apply(self._queue.popleft()))
        finally:
            self._task = None

    def _schedule_tick(self) -> None:
        if self._accepting:
            self._timer = self.hass.loop.call_later(0.5, self._tick)

    @callback
    def _tick(self) -> None:
        if self._accepting and not self._paused:
            self._enqueue(self._capture())
        self._schedule_tick()

    async def async_flush(self) -> None:
        """Drain available work, surfacing persistence failures to lifecycle callers."""
        self._kick()
        if self._task:
            await asyncio.shield(self._task)
        if self._outbox:
            raise JournalError(
                self.last_error or "not_ready", "Playback checkpoint is not durable"
            )

    async def async_pause(self) -> None:
        """Finish an accepted checkpoint, then buffer source edges during backup."""
        self._paused = True
        if self._task:
            await asyncio.shield(self._task)
        if self._outbox:
            raise JournalError(
                self.last_error or "not_ready", "Playback checkpoint is not durable"
            )

    async def async_resume(self) -> None:
        self._paused = False
        self._enqueue(self._capture())
        await self.async_flush()

    async def async_stop(self, close_reason: str | None = None) -> None:
        """Unsubscribe first, drain captured edges, then checkpoint without downtime."""
        if not self._accepting:
            return
        self._accepting = False
        final_observation = self._capture()
        if self._timer:
            self._timer.cancel()
        if self._unsubscribe:
            self._unsubscribe()
        if self._registry_unsubscribe:
            self._registry_unsubscribe()
        self._paused = False
        await self.async_flush()
        self._outbox.extend(self.tracker.finish(final_observation, close_reason))
        await self.async_flush()

    def live_state(self) -> dict:
        """Return read-only source state and recording health, without proxy tokens."""
        current = self._capture()
        return {
            "player_id": self.config["player_id"],
            "entity_id": self.entities.get("media_player"),
            "title": current.title,
            "raw_content_id": current.content_id,
            "duration_seconds": current.duration,
            "play_status": current.play_status,
            "location": current.location,
            "available": current.available,
            "recording_error": self.last_error,
            "overflow_count": self.overflow_count,
            "buffered_observations": len(self._queue),
        }

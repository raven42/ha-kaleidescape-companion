"""Deterministic playback timing; no HA, IO, wall-clock duration arithmetic."""

from dataclasses import asdict, dataclass, replace
from uuid import uuid4

SETTLE_SECONDS = 0.5
STOP_GRACE_SECONDS = 2.0
CHECKPOINT_SECONDS = 30.0
RULE_VERSION = 1


@dataclass(frozen=True, slots=True)
class Observation:
    """A combined source snapshot captured at an event's receipt time."""

    at: str
    monotonic: float
    content_id: str | None = None
    title: str | None = None
    duration: float | None = None
    play_status: str = "unknown"
    location: str = "unknown"
    available: bool = False
    gap: bool = False


@dataclass(slots=True)
class Session:
    """Absolute cumulative timing checkpoint, safe to retry after a timeout."""

    id: str
    player_id: str
    raw_content_id: str
    title: str
    duration_seconds: float | None
    started_at: str
    last_observed_at: str
    boot_id: str
    watched_seconds: float = 0
    credits_seen: bool = False
    credits_confirmed: bool = False
    credits_at: str | None = None
    credits_watched_seconds: float = 0
    closed_at: str | None = None
    end_reason: str | None = None
    revision: int = 0
    gap_count: int = 0

    def snapshot(self) -> dict:
        """Detach a queued checkpoint from future in-memory changes."""
        return asdict(self)


class PlaybackTracker:
    """Count only observed, stable main-content playback for one player."""

    def __init__(self, player_id: str) -> None:
        self.player_id = player_id
        self.session: Session | None = None
        self._previous: Observation | None = None
        self._counting = False
        self._candidate: str | None = None
        self._candidate_since = 0.0
        self._stop: Observation | None = None
        self._checkpoint = 0.0
        self._established = False
        self.boot_id = str(uuid4())

    def _emit(self, observation: Observation) -> dict:
        assert self.session is not None
        self.session.last_observed_at = observation.at
        self.session.revision += 1
        self._checkpoint = observation.monotonic
        return self.session.snapshot()

    def restore(self, session: dict) -> None:
        """Retain an open session across reload without counting missing time."""
        self.session = Session(
            **{key: session[key] for key in Session.__dataclass_fields__}
        )
        self.session.gap_count += 1
        self.session.boot_id = self.boot_id
        self._counting = False
        self._previous = None
        self._candidate = None
        self._established = False

    def apply(self, observation: Observation) -> list[dict]:
        """Process every edge in order; ticks also settle identities and stops."""
        previous = self._previous
        if previous is not None and observation.monotonic < previous.monotonic:
            return []
        emitted = []
        if self.session and self._counting and previous and not observation.gap:
            self.session.watched_seconds += observation.monotonic - previous.monotonic
        self._previous = observation
        dirty = bool(self.session and previous is None)
        if self.session:
            identity_changed = bool(
                observation.content_id
                and observation.content_id != self.session.raw_content_id
            )
            if identity_changed:
                self.session.closed_at = observation.at
                self.session.end_reason = "identity_changed"
                emitted.append(self._emit(observation))
                self.session = None
                self._counting = False
                self._stop = None
                self._candidate = None
                self._established = False
            else:
                has_identity = observation.content_id == self.session.raw_content_id
                interrupted = (
                    observation.gap or not observation.available or not has_identity
                )
                if interrupted and (
                    observation.gap
                    or previous is None
                    or (
                        previous.available
                        and previous.content_id == self.session.raw_content_id
                    )
                ):
                    self.session.gap_count += 1
                    dirty = True
                if interrupted:
                    self._established = False
                    self._candidate = None
                # A restored session must establish content again before credits count.
                if (
                    has_identity
                    and observation.available
                    and observation.location == "content"
                ):
                    if self._candidate != observation.content_id:
                        self._candidate = observation.content_id
                        self._candidate_since = observation.monotonic
                    if observation.monotonic - self._candidate_since >= SETTLE_SECONDS:
                        self._established = True
                if (
                    has_identity
                    and observation.available
                    and observation.location == "credits"
                    and self._established
                    and observation.title == self.session.title
                ):
                    confirmed = observation.play_status == "playing"
                    credit_edge = (
                        previous is None
                        or previous.location != "credits"
                        or previous.play_status != observation.play_status
                    )
                    if not self.session.credits_seen or (confirmed and credit_edge):
                        self.session.credits_seen = True
                        self.session.credits_confirmed |= confirmed
                        self.session.credits_at = observation.at
                        if confirmed:
                            self.session.credits_watched_seconds = (
                                self.session.watched_seconds
                            )
                        dirty = True
                stopping = observation.available and (
                    observation.location == "none"
                    or observation.play_status == "stopped"
                )
                if stopping:
                    if self._stop is None:
                        self._stop = observation
                        dirty = True
                    elif (
                        observation.monotonic - self._stop.monotonic
                        >= STOP_GRACE_SECONDS
                    ):
                        self.session.closed_at = self._stop.at
                        self.session.end_reason = "stopped"
                        emitted.append(self._emit(observation))
                        self.session = None
                        self._candidate = None
                        self._counting = False
                        return emitted
                else:
                    if self._stop:
                        dirty = True
                    self._stop = None
                counting = bool(
                    has_identity
                    and observation.available
                    and self._established
                    and observation.play_status == "playing"
                    and observation.location == "content"
                    and not observation.gap
                )
                dirty |= counting != self._counting
                self._counting = counting
                if self.session and (
                    dirty
                    or observation.monotonic - self._checkpoint >= CHECKPOINT_SECONDS
                ):
                    emitted.append(self._emit(observation))
        if self.session is None:
            self._counting = False
            usable = bool(
                observation.available
                and observation.content_id
                and observation.title
                and observation.play_status == "playing"
                and observation.location == "content"
                and not observation.gap
            )
            if not usable:
                self._candidate = None
            elif self._candidate != observation.content_id:
                self._candidate = observation.content_id
                self._candidate_since = observation.monotonic
            elif observation.monotonic - self._candidate_since >= SETTLE_SECONDS:
                self.session = Session(
                    id=str(uuid4()),
                    player_id=self.player_id,
                    raw_content_id=observation.content_id,
                    title=observation.title,
                    duration_seconds=observation.duration,
                    started_at=observation.at,
                    last_observed_at=observation.at,
                    boot_id=self.boot_id,
                )
                self._counting = True
                self._established = True
                emitted.append(self._emit(observation))
        return emitted

    def finish(
        self, observation: Observation, close_reason: str | None = None
    ) -> list[dict]:
        """Checkpoint at shutdown while keeping the session recoverable."""
        output = self.apply(observation)
        if self.session:
            if close_reason:
                self.session.closed_at = observation.at
                self.session.end_reason = close_reason
            output.append(self._emit(observation))
            if close_reason:
                self.session = None
        self._counting = False
        return output

    def gap(self, observation: Observation) -> Observation:
        """Explicitly stop counting lost queue intervals rather than inventing them."""
        return replace(observation, available=False, gap=True)

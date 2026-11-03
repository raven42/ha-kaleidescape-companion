"""Injected HTTP transport with a shared, cancellation-aware rate limiter."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from .models import ProviderError

Fetch = Callable[[str, dict[str, str]], Awaitable[bytes]]
_LOGGER = logging.getLogger(__name__)


@dataclass
class RequestBudget:
    """Share one monotonic rate budget across clients with different lifetimes."""

    interval: float
    next_request: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class Transport:
    """The caller owns TLS, destination checks, timeouts and HTTP error handling."""

    def __init__(
        self,
        fetch: Fetch,
        requests_per_second: float = 2,
        *,
        budget: RequestBudget | None = None,
    ):
        if (
            type(requests_per_second) not in (int, float)
            or not 0.1 <= requests_per_second <= 10
        ):
            raise ValueError("requests_per_second must be between 0.1 and 10")
        self.fetch = fetch
        self.budget = budget or RequestBudget(1 / requests_per_second)

    def defer(self, interval: float) -> None:
        """Honor stricter provider policy before the next request."""
        if interval > self.budget.interval:
            _LOGGER.debug("Metadata provider rate limit tightened")
        self.budget.interval = max(self.budget.interval, interval)
        self.budget.next_request = max(
            self.budget.next_request,
            asyncio.get_running_loop().time() + self.budget.interval,
        )

    async def get(self, url: str, headers: dict[str, str] | None = None) -> bytes:
        async with self.budget.lock:
            loop = asyncio.get_running_loop()
            await asyncio.sleep(max(0, self.budget.next_request - loop.time()))
            self.budget.next_request = loop.time() + self.budget.interval
            body = await self.fetch(url, headers or {})
        if not isinstance(body, bytes) or len(body) > 4 * 1024 * 1024:
            raise ProviderError("provider_response_too_large")
        return body

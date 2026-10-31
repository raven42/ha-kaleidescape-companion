"""Injected HTTP transport with a shared, cancellation-aware rate limiter."""

import asyncio
from collections.abc import Awaitable, Callable

from .models import ProviderError

Fetch = Callable[[str, dict[str, str]], Awaitable[bytes]]


class Transport:
    """The caller owns TLS, destination checks, timeouts and HTTP error handling."""

    def __init__(self, fetch: Fetch, requests_per_second: float = 2):
        if (
            type(requests_per_second) not in (int, float)
            or not 0.1 <= requests_per_second <= 10
        ):
            raise ValueError("requests_per_second must be between 0.1 and 10")
        self.fetch = fetch
        self.interval = 1 / requests_per_second
        self.lock = asyncio.Lock()
        self.next_request = 0.0

    def defer(self, interval: float) -> None:
        """Honor stricter provider policy before the next request."""
        self.interval = max(self.interval, interval)
        self.next_request = max(
            self.next_request, asyncio.get_running_loop().time() + self.interval
        )

    async def get(self, url: str, headers: dict[str, str] | None = None) -> bytes:
        async with self.lock:
            loop = asyncio.get_running_loop()
            await asyncio.sleep(max(0, self.next_request - loop.time()))
            self.next_request = loop.time() + self.interval
            body = await self.fetch(url, headers or {})
        if not isinstance(body, bytes) or len(body) > 4 * 1024 * 1024:
            raise ProviderError("provider_response_too_large")
        return body

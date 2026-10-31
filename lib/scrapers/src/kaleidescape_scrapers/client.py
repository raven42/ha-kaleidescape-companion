"""One metadata API; provider adapters own their request and parsing contracts."""

from collections.abc import Mapping
from typing import Protocol

from .models import Metadata, MovieQuery, ProviderError
from .providers.store import StoreProvider
from .providers.tmdb import TMDBProvider
from .transport import Fetch, Transport


class MetadataProvider(Protocol):
    """Implement this interface to add another provider behind the common API."""

    async def metadata(self, movie: MovieQuery) -> Metadata:
        """Return bounded metadata for this exact movie, or raise ProviderError."""
        ...


class Providers:
    """Shared transport plus named adapters, independent of scheduling/persistence.

    The injected fetch must enforce TLS, destinations, timeout/body limits and
    redirect refusal. Additional adapters should use this instance's transport
    to share its rate budget. Construct a new client per sync pass so provider
    policy (including robots.txt) is refreshed.
    """

    def __init__(
        self,
        fetch: Fetch,
        *,
        requests_per_second: float = 2,
        tmdb_credential: str = "",
        adapters: Mapping[str, MetadataProvider] | None = None,
    ):
        self.transport = Transport(fetch, requests_per_second)
        self.adapters: dict[str, MetadataProvider] = {
            "kaleidescape": StoreProvider(self.transport),
            "tmdb": TMDBProvider(self.transport, tmdb_credential),
            **(adapters or {}),
        }

    async def metadata(self, provider: str, movie: MovieQuery) -> Metadata:
        """Fetch metadata using the same movie identity contract for every adapter."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        return await adapter.metadata(movie)

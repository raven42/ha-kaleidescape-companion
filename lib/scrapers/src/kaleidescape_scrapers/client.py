"""One metadata API; provider adapters own their request and parsing contracts."""

from collections.abc import Mapping
from typing import Protocol

from .models import Metadata, MovieQuery, ProviderError
from .providers.store import StoreProvider
from .providers.tmdb import TMDBProvider
from .transport import Fetch, RequestBudget, Transport


class MetadataProvider(Protocol):
    """Implement this interface to add another provider behind the common API."""

    async def metadata(self, movie: MovieQuery) -> Metadata:
        """Return bounded metadata for this exact movie, or raise ProviderError."""
        ...


class ArtworkProvider(MetadataProvider, Protocol):
    """Optional adapter capability; returns a bounded raster or no artwork."""

    async def artwork(self, metadata: Metadata) -> bytes | None: ...


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
        budget: RequestBudget | None = None,
    ):
        self.transport = Transport(fetch, requests_per_second, budget=budget)
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

    async def artwork(self, provider: str, metadata: Metadata) -> bytes | None:
        """Fetch optional provider artwork; never accept an arbitrary image URL."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        fetch_artwork = getattr(adapter, "artwork", None)
        return await fetch_artwork(metadata) if fetch_artwork else None

    async def images(self, provider: str, metadata: Metadata) -> list[dict]:
        """Optional bounded gallery; paths remain provider-owned, not arbitrary URLs."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        gallery = getattr(adapter, "images", None)
        return await gallery(metadata) if gallery else []

    async def image(self, provider: str, choice: dict, *, thumbnail=False) -> bytes:
        adapter = self.adapters.get(provider)
        fetch_image = getattr(adapter, "image", None)
        if not fetch_image:
            raise ProviderError("provider_artwork_unavailable")
        return await fetch_image(choice, thumbnail=thumbnail)

"""One metadata API; provider adapters own their request and parsing contracts."""

import logging
from collections.abc import Mapping
from typing import Protocol

from .models import Metadata, MovieQuery, ProviderError
from .providers.store import StoreProvider
from .providers.tmdb import TMDBProvider
from .transport import Fetch, RequestBudget, Transport

_LOGGER = logging.getLogger(__name__)


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
        self._tmdb_credential = tmdb_credential
        self._extra_adapters = dict(adapters or {})
        self.refresh_adapters()

    def refresh_adapters(self) -> None:
        """Refresh provider policy while retaining the shared transport budget."""
        self.adapters: dict[str, MetadataProvider] = {
            "kaleidescape": StoreProvider(self.transport),
            "tmdb": TMDBProvider(self.transport, self._tmdb_credential),
            **self._extra_adapters,
        }

    async def metadata(self, provider: str, movie: MovieQuery) -> Metadata:
        """Fetch metadata using the same movie identity contract for every adapter."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            _LOGGER.debug("Metadata request rejected: provider is unavailable")
            raise ProviderError("unknown_provider")
        return await adapter.metadata(movie)

    async def search(
        self, provider: str, query: str, year: int | None = None
    ) -> list[Metadata]:
        """Return bounded detailed candidates; the Store may return up to 15."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        if (
            not isinstance(query, str)
            or not query.strip()
            or len(query) > 200
            or "\x00" in query
        ):
            raise ProviderError("invalid_provider_search")
        if year is not None and (type(year) is not int or not 1800 <= year <= 2200):
            raise ProviderError("invalid_provider_search")
        search = getattr(adapter, "search", None)
        if not search:
            raise ProviderError("provider_search_unavailable")
        return await search(query.strip(), year)

    async def resolve(self, provider: str, reference: dict) -> Metadata:
        """Revisit an application-approved provider identity without title searching."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        if not isinstance(reference, dict):
            raise ProviderError("provider_identity_mismatch")
        resolve = getattr(adapter, "resolve", None)
        if not resolve:
            raise ProviderError("provider_search_unavailable")
        return await resolve(reference)

    async def artwork(self, provider: str, metadata: Metadata) -> bytes | None:
        """Fetch optional provider artwork; never accept an arbitrary image URL."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        fetch_artwork = getattr(adapter, "artwork", None)
        return await fetch_artwork(metadata) if fetch_artwork else None

    async def poster(self, provider: str, metadata: Metadata) -> bytes | None:
        """Optional portrait artwork from verified metadata, without URL input."""
        adapter = self.adapters.get(provider)
        if adapter is None:
            raise ProviderError("unknown_provider")
        fetch_poster = getattr(adapter, "poster", None)
        return await fetch_poster(metadata) if fetch_poster else None

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

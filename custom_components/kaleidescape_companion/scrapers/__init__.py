"""Reusable, transport-injected movie metadata API and provider adapters."""

from .client import ArtworkProvider, MetadataProvider, Providers
from .models import Metadata, MovieQuery, ProviderError

__all__ = [
    "ArtworkProvider",
    "Metadata",
    "MetadataProvider",
    "MovieQuery",
    "ProviderError",
    "Providers",
]

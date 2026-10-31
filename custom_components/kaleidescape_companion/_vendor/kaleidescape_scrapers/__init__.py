"""Reusable, transport-injected movie metadata API and provider adapters."""

from .client import MetadataProvider, Providers
from .models import Metadata, MovieQuery, ProviderError

__all__ = ["Metadata", "MetadataProvider", "MovieQuery", "ProviderError", "Providers"]

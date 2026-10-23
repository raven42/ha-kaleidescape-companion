"""Runtime container for future Kaleidescape components."""

from dataclasses import dataclass


@dataclass(slots=True)
class KaleidescapeRuntime:
    """Own resources for one configuration entry as components are implemented."""

"""Select the private pyk build until HA can install the reviewed release."""

import logging

from ..vendor import kaleidescape
from ..vendor.kaleidescape import Device, const, error, message
from ..vendor.kaleidescape.error import (
    KaleidescapeError,
    MessageError,
    RequestNotSentError,
    RequestOutcomeUnknownError,
)

__all__ = [
    "Device",
    "KaleidescapeError",
    "MessageError",
    "RequestNotSentError",
    "RequestOutcomeUnknownError",
    "const",
    "error",
    "kaleidescape",
    "message",
]


class _UserInputLogFilter(logging.Filter):
    """Keep text-entry wire messages out of private pyk protocol logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        text = record.getMessage().casefold().replace("_", "")
        return "userinput" not in text and "keyboardliteral" not in text


# Pyk's diagnostic wire logs and dispatcher logs otherwise include prompt contents.
for _name in ("connection", "message", "dispatcher"):
    _logger = logging.getLogger(f"{kaleidescape.__name__}.{_name}")
    if not any(isinstance(item, _UserInputLogFilter) for item in _logger.filters):
        _logger.addFilter(_UserInputLogFilter())

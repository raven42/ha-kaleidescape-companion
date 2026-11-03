"""Validate identifiers used by Companion's player selection and HA registry."""

import re


def normalize_serial(value: str) -> str:
    """Normalize a bounded hexadecimal serial without relying on a transport."""
    if not isinstance(value, str) or not re.fullmatch(r"[0-9A-Fa-f]{1,16}", value):
        raise ValueError("Invalid player serial")
    serial = value.upper().lstrip("0")
    if not serial:
        raise ValueError("Invalid player serial")
    return serial

"""Opt-in catalog settings and configured-origin validation, without networking."""

import ipaddress
import re
from urllib.parse import urlsplit

DEFAULT_HOST = "my-kaleidescape.local"
DEFAULTS = {
    "library_enabled": False,
    "library_host": "",
    "library_interval_hours": 6,
    "library_sync_collections": True,
    "library_allow_collection_add": False,
    "library_sync_details": True,
    "library_sync_artwork": False,
    "library_artwork_cache_mb": 512,
}
BOOLEANS = {key for key, value in DEFAULTS.items() if type(value) is bool}


def collection_names(value) -> list[str]:
    """Migrate old newline preferences and accept bounded custom names."""
    if isinstance(value, str):
        if len(value) > 51_400:
            raise ValueError("invalid_library_collections")
        value = value.splitlines()
    if not isinstance(value, list) or len(value) > 200:
        raise ValueError("invalid_library_collections")
    names = []
    for name in value:
        if (
            not isinstance(name, str)
            or len(name) > 256
            or any(ord(char) < 32 for char in name)
        ):
            raise ValueError("invalid_library_collections")
        name = " ".join(name.split())
        if name and name.casefold() not in {item.casefold() for item in names}:
            names.append(name)
    return names


def excluded_collections(value) -> set[str]:
    """Names are display preferences, never fetch routes or control operations."""
    return {name.casefold() for name in collection_names(value)}


def origin(value: str) -> str:
    """Accept a hostname/IP or HTTP(S) origin, never credentials or a path."""
    if (
        not isinstance(value, str)
        or len(value) > 255
        or any(c.isspace() for c in value)
    ):
        raise ValueError("invalid_library_host")
    value = value or DEFAULT_HOST
    try:
        url = urlsplit(value if "://" in value else f"http://{value}")
        host, port = url.hostname, url.port
        if (
            url.scheme not in {"http", "https"}
            or not host
            or url.username is not None
            or url.password is not None
            or url.path not in {"", "/"}
            or url.query
            or url.fragment
            or "%" in host
            or "\\" in value
            or port not in {None, 80, 443}
        ):
            raise ValueError
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            if not re.fullmatch(
                r"[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?", host
            ):
                raise ValueError
        else:
            if not lan_address(str(address)):
                raise ValueError
        host = f"[{host}]" if ":" in host else host.lower().rstrip(".")
        default_port = 443 if url.scheme == "https" else 80
        return f"{url.scheme}://{host}" + (
            f":{port}" if port and port != default_port else ""
        )
    except ValueError as error:
        raise ValueError("invalid_library_host") from error


def lan_address(value: str) -> bool:
    """Permit LAN destinations; exclude loopback, metadata/link-local, and WAN."""
    address = ipaddress.ip_address(value)
    networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7")
    return any(
        address in ipaddress.ip_network(network)
        for network in networks
        if address.version == ipaddress.ip_network(network).version
    )


def validate(values: dict, previous: dict) -> dict:
    """Keep disabled libraries inert and validate limits before enabling IO."""
    config = {
        key: values.get(key, previous.get(key, default))
        for key, default in DEFAULTS.items()
    }
    for key in BOOLEANS:
        if type(config[key]) is not bool:
            raise ValueError("invalid_library_options")
    for key, minimum, maximum in (
        ("library_interval_hours", 1, 168),
        ("library_artwork_cache_mb", 32, 4096),
    ):
        value = config[key]
        if (
            type(value) not in {int, float}
            or not minimum <= value <= maximum
            or value != int(value)
        ):
            raise ValueError("invalid_library_options")
        config[key] = int(value)
    origin(config["library_host"])
    return config

"""Fixed additional anonymous routes used only by administrator match reviews."""

import re
from urllib.parse import parse_qsl

from .._vendor.kaleidescape_scrapers.providers.store import movie_path
from .._vendor.kaleidescape_scrapers.providers.store_search import cover_url


def store_request(parsed, headers, review):
    if parsed.path == "/robots.txt":
        return not parsed.query and not headers
    if parsed.path.startswith("/movie-store/movie/"):
        return not parsed.query and not headers and bool(movie_path(parsed.path))
    if not review:
        return False
    pairs = parse_qsl(parsed.query, keep_blank_values=True)
    params = dict(pairs)
    if (
        len(params) != len(pairs)
        or not params.get("text")
        or len(params["text"]) > 200
        or "\x00" in params["text"]
    ):
        return False
    if parsed.path == "/movie-store/search":
        return set(params) == {"text"} and not headers
    return (
        parsed.path == "/movie-store/rest/packages/search"
        and set(params) == {"text", "country_code", "display_limit"}
        and params["country_code"] == "US"
        and params["display_limit"] == "15"
        and set(headers)
        == {"X-Kaleidescape-Application-Id", "X-Kaleidescape-Application-Version"}
        and headers["X-Kaleidescape-Application-Id"] == "store.js"
        and bool(
            re.fullmatch(
                r"[0-9]{4}\.[0-9]{1,2}-[0-9]{1,10}",
                headers["X-Kaleidescape-Application-Version"],
            )
        )
    )


def store_image(url):
    return bool(cover_url(url))

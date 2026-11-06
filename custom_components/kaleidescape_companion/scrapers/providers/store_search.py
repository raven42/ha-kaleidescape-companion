"""Anonymous, bounded store search; ignore account, prices and related-person groups."""

import asyncio
import json
import re
from urllib.parse import urlencode, urlsplit

from ..models import ProviderError, label

HOST = "https://www.kaleidescape.com"


class SearchResults(list):
    """Keep the bounded-search limit visible to automatic matching."""

    def __init__(self, values, *, truncated):
        super().__init__(values)
        self.truncated = truncated


def cover_url(value):
    if not isinstance(value, str) or len(value) > 300:
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    return (
        value
        if (
            parsed.scheme == "https"
            and re.fullmatch(r"images0[1-8]\.kaleidescape\.com", parsed.netloc)
            and re.fullmatch(
                r"/transformed/covers/(?:132x189s|264x378s)/[0-9]{1,10}/[0-9]{1,12}\.jpg",
                parsed.path,
            )
            and not parsed.query
            and not parsed.fragment
        )
        else None
    )


def packages(body):
    try:
        data = json.loads(body)
    except (ValueError, RecursionError) as error:
        raise ProviderError("store_format_changed") from error
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        raise ProviderError("store_format_changed")
    result, seen = [], set()
    for group in data["groups"][:30]:
        if not isinstance(group, dict) or group.get("algorithm_id") != 7:
            continue
        if not isinstance(group.get("packages"), list):
            raise ProviderError("store_format_changed")
        for item in group["packages"][:30]:
            if not isinstance(item, dict) or item.get("is_television") is not False:
                continue
            slug = item.get("movie_edition_uri_name")
            if (
                not isinstance(slug, str)
                or len(slug) > 900
                or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug)
                or slug in seen
            ):
                continue
            seen.add(slug)
            images = item.get("image_uris")
            result.append(
                {
                    "href": "/movie-store/movie/" + slug,
                    "poster_url": cover_url(images.get("small_2x"))
                    if isinstance(images, dict)
                    else None,
                }
            )
            if len(result) == 8:
                return result
    return result


async def search(provider, query, year):
    from .store import movie_data, parse

    route = "/movie-store/search?" + urlencode({"text": query})
    await provider.permitted(route)
    page = await provider.transport.get(HOST + route)
    # The public application version is required by the store's own search API.
    version = re.search(
        rb'data-store_version="([0-9]{4}\.[0-9]{1,2}-[0-9]{1,10})"', page
    )
    if not version:
        raise ProviderError("store_format_changed")
    headers = {
        "X-Kaleidescape-Application-Id": "store.js",
        "X-Kaleidescape-Application-Version": version[1].decode("ascii"),
    }
    route = "/movie-store/rest/packages/search?" + urlencode(
        {"text": query, "country_code": "US", "display_limit": 15}
    )
    await provider.permitted(route)
    body = await provider.transport.get(HOST + route, headers)
    results = []
    candidates = await asyncio.to_thread(packages, body)
    for candidate in candidates:
        path = candidate["href"]
        await provider.permitted(path)
        page = await provider.transport.get(HOST + path)
        try:
            text = page.decode("utf-8")
        except UnicodeError as error:
            raise ProviderError("store_format_changed") from error
        movie = await asyncio.to_thread(movie_data, text, path)
        if type(movie.get("release_year")) is not int or not label(movie.get("title")):
            continue
        if year is not None and movie["release_year"] != year:
            continue
        metadata = await asyncio.to_thread(
            parse, text, path, movie["title"], movie["release_year"]
        )
        results.append({**metadata, "poster_url": candidate["poster_url"]})
    return SearchResults(results, truncated=len(candidates) >= 8)

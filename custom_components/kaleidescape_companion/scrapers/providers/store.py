"""Experimental public store bootstrap parser; never execute scripts or follow links."""

import asyncio
import json
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from ..models import (
    Metadata,
    MovieQuery,
    ProviderError,
    genre_names,
    label,
    names,
    same_movie,
    score,
)
from ..transport import Transport

HOST = "https://www.kaleidescape.com"
ROLES = {"actors": {52}, "directors": {51}, "writers": {53, 54, 75}, "producers": {50}}


def movie_path(href):
    """Accept only a fixed public movie route without credentials or query."""
    if not isinstance(href, str) or len(href) > 1024:
        raise ProviderError("invalid_store_link")
    parsed = urlsplit(href)
    if (
        (parsed.netloc and not parsed.scheme)
        or parsed.scheme not in ("", "https")
        or parsed.netloc not in ("", "www.kaleidescape.com")
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(r"/movie-store/movie/[a-z0-9]+(?:-[a-z0-9]+)*", parsed.path)
    ):
        raise ProviderError("invalid_store_link")
    return parsed.path


class _Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.active = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        self.active = tag == "script" and not dict(attrs).get("src")

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

    def handle_data(self, value):
        if self.active:
            self.parts.append(value)


def movie_data(page, href):
    if not isinstance(page, str) or len(page.encode()) > 4 * 1024 * 1024:
        raise ProviderError("store_response_too_large")
    path = movie_path(href)
    parser = _Scripts()
    parser.feed(page)
    found = []
    for script in parser.parts:
        match = re.search(r"window\.preloadedAjaxData\s*=\s*", script)
        if not match:
            continue
        try:
            data = json.JSONDecoder().raw_decode(script[match.end() :])[0]
        except (ValueError, RecursionError) as error:
            raise ProviderError("store_format_changed") from error
        if not isinstance(data, dict):
            continue
        slug = path.rsplit("/", 1)[1]
        edition = data.get("/movie-store/rest/movie/edition/" + slug)
        movie = data.get("/movie-store/rest/movie/edition/id/" + str(edition))
        if isinstance(movie, dict) and movie.get("uri_name") == slug:
            found.append(movie)
    if len(found) != 1:
        raise ProviderError("store_format_changed")
    return found[0]


def retail_price(movie):
    """Accept an unambiguous public base price, never a sale or rental price."""
    packages = movie.get("packages")
    if not isinstance(packages, list) or len(packages) > 100:
        return None
    values = set()
    currencies = {"USD": "$", "GBP": "£", "EUR": "€", "CAD": "CA$"}
    for package in packages:
        if not isinstance(package, dict) or package.get("est_base_price") is None:
            continue
        value = package["est_base_price"]
        if not isinstance(value, dict):
            return None
        currency = currencies.get(value.get("currency_code"))
        dollars, cents = value.get("dollars"), value.get("cents")
        if (
            currency is None
            or type(dollars) is not int
            or not 0 <= dollars <= 999999999
            or type(cents) is not int
            or not 0 <= cents <= 99
            or value.get("is_negative") is not False
        ):
            return None
        values.add(f"{currency}{dollars}.{cents:02d}")
    return next(iter(values)) if len(values) == 1 else None


def parse(page, href, title, year):
    path = movie_path(href)
    movie = movie_data(page, href)
    if not same_movie(
        title, year, [{"title": movie.get("title"), "year": movie.get("release_year")}]
    ):
        raise ProviderError("provider_identity_mismatch")
    people = movie.get("persons", [])
    if not isinstance(people, list):
        raise ProviderError("store_format_changed")
    credits = {
        role: names(
            [
                " ".join(
                    [label(person.get("given_name")), label(person.get("family_name"))]
                )
                for person in people[:2000]
                if isinstance(person, dict) and person.get("role_id") in ids
            ]
        )
        for role, ids in ROLES.items()
    }
    companies = movie.get("production_companies", [])
    studios = (
        names(
            [
                item.get("name") if isinstance(item, dict) else item
                for item in companies[:200]
            ]
        )
        if isinstance(companies, list)
        else []
    )
    tomato = movie.get("rotten_tomatoes_movie") or {}
    if not isinstance(tomato, dict):
        tomato = {}
    return {
        "provider": "kaleidescape",
        "retail_price": retail_price(movie),
        "provider_id": label(str(movie.get("movie_edition_id", "")), 100),
        "url": HOST + path,
        "title": label(movie.get("title")),
        "year": year,
        "genres": genre_names(
            [
                item.get("name") if isinstance(item, dict) else item
                for item in movie.get("genres", [])
            ]
        )
        if isinstance(movie.get("genres"), list)
        else [],
        **credits,
        "studios": studios,
        "distributor": label(movie.get("licensor_name")),
        "critic_score": score(tomato.get("critic_score"), 100),
        "audience_score": score(tomato.get("audience_score"), 100),
    }


# Network policy for this provider stays beside its parser. No DOM/JS execution.
def _robots(body: bytes) -> RobotFileParser:
    if len(body) > 65536:
        raise ProviderError("store_robots_too_large")
    try:
        lines = body.decode("utf-8").splitlines()
    except UnicodeError as error:
        raise ProviderError("store_robots_invalid") from error
    if len(lines) > 2000:
        raise ProviderError("store_robots_too_large")
    robots = RobotFileParser()
    robots.parse(lines)
    return robots


class StoreProvider:
    """Read public, robots-permitted movie JSON from one validated store route."""

    def __init__(self, transport: Transport):
        self.transport = transport
        self.robots: RobotFileParser | None = None
        self.policy_lock = asyncio.Lock()

    async def permitted(self, path):
        async with self.policy_lock:
            if self.robots is None:
                body = await self.transport.get(HOST + "/robots.txt")
                robots = await asyncio.to_thread(_robots, body)
                delay = robots.crawl_delay("KaleidescapeCompanion")
                rate = robots.request_rate("KaleidescapeCompanion")
                if rate and (rate.requests <= 0 or rate.seconds <= 0):
                    raise ProviderError("store_robots_invalid")
                self.transport.defer(
                    max(delay or 0, rate.seconds / rate.requests if rate else 0)
                )
                self.robots = robots
        if not self.robots.can_fetch("KaleidescapeCompanion", HOST + path):
            raise ProviderError("store_robots_denied")

    async def metadata(self, movie: MovieQuery) -> Metadata:
        path = movie_path(movie.href)
        await self.permitted(path)
        page = await self.transport.get(HOST + path)
        try:
            return await asyncio.to_thread(
                parse, page.decode("utf-8"), movie.href, movie.title, movie.year
            )
        except UnicodeError as error:
            raise ProviderError("store_format_changed") from error

    async def search(self, query, year=None):
        from .store_search import search

        return await search(self, query, year)

    async def resolve(self, reference):
        result = await self.metadata(
            MovieQuery(
                reference.get("title"), reference.get("year"), reference.get("url", "")
            )
        )
        if result["provider_id"] != reference.get("provider_id"):
            raise ProviderError("provider_identity_mismatch")
        return result

    async def image(self, choice, *, thumbnail=False):
        from .store_search import cover_url

        url = cover_url(choice.get("path"))
        if not thumbnail or not url or choice.get("kind") != "poster":
            raise ProviderError("provider_artwork_unavailable")
        # Preview-only cover routes have no login and receive no credentials.
        return await self.transport.get(url)

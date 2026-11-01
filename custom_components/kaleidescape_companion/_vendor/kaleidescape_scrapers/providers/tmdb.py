"""Official TMDB v3 movie search/details projections, independent of HTTP clients."""

import asyncio
import json
import re
from urllib.parse import urlencode

from ..models import (
    Metadata,
    MovieQuery,
    ProviderError,
    label,
    names,
    same_movie,
    score,
)
from ..transport import Transport

HOST = "https://api.themoviedb.org"


def backdrop_path(value):
    """Accept a single raster filename, never a URL, directory or query."""
    return (
        value
        if isinstance(value, str) and re.fullmatch(r"/[A-Za-z0-9]{1,128}\.jpg", value)
        else None
    )


def match(data, title, year):
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ProviderError("tmdb_format_changed")
    candidates = []
    for item in data["results"][:20]:
        if not isinstance(item, dict):
            continue
        date = item.get("release_date", "")
        candidates.append(
            {
                **item,
                "year": int(date[:4])
                if isinstance(date, str) and date[:4].isdigit()
                else None,
            }
        )
    exact = same_movie(title, year, candidates)
    ids = {
        item["id"] for item in exact if type(item.get("id")) is int and item["id"] > 0
    }
    if len(ids) != 1:
        raise ProviderError("tmdb_ambiguous" if ids else "tmdb_not_found")
    return ids.pop()


def parse(data, movie_id, title, year):
    if not isinstance(data, dict) or data.get("id") != movie_id:
        raise ProviderError("provider_identity_mismatch")
    date = data.get("release_date", "")
    actual_year = (
        int(date[:4]) if isinstance(date, str) and date[:4].isdigit() else None
    )
    if not same_movie(title, year, [{**data, "year": actual_year}]):
        raise ProviderError("provider_identity_mismatch")
    credits = data.get("credits", {})
    if not isinstance(credits, dict):
        raise ProviderError("tmdb_format_changed")
    cast, crew = credits.get("cast", []), credits.get("crew", [])
    if not isinstance(cast, list) or not isinstance(crew, list):
        raise ProviderError("tmdb_format_changed")

    def people(items, jobs=None):
        return names(
            [
                p.get("name")
                for p in items[:2000]
                if isinstance(p, dict) and (jobs is None or p.get("job") in jobs)
            ]
        )

    companies = data.get("production_companies", [])
    return {
        "provider": "tmdb",
        "provider_id": str(movie_id),
        "url": f"https://www.themoviedb.org/movie/{movie_id}",
        "title": label(data.get("title")),
        "year": actual_year,
        "actors": people(
            sorted(
                [person for person in cast[:2000] if isinstance(person, dict)],
                key=lambda person: (
                    person["order"]
                    if type(person.get("order")) is int and person["order"] >= 0
                    else 100000
                ),
            )
        ),
        "directors": people(crew, {"Director"}),
        "writers": people(
            crew, {"Writer", "Screenplay", "Story", "Novel", "Characters"}
        ),
        "producers": people(crew, {"Producer", "Executive Producer", "Co-Producer"}),
        "studios": names(
            [p.get("name") for p in companies[:200] if isinstance(p, dict)]
        )
        if isinstance(companies, list)
        else [],
        "audience_rating": score(data.get("vote_average"), 10),
        "audience_votes": data.get("vote_count")
        if type(data.get("vote_count")) is int and data["vote_count"] >= 0
        else None,
        "backdrop_path": backdrop_path(data.get("backdrop_path")),
        "poster_path": backdrop_path(data.get("poster_path")),
        "synopsis": label(data.get("overview"), 10000),
        "genres": names(
            [
                item.get("name")
                for item in data.get("genres", [])
                if isinstance(item, dict)
            ]
        )
        if isinstance(data.get("genres", []), list)
        else [],
    }


class TMDBProvider:
    """Official v3 search/details API with conservative title/year identity."""

    def __init__(self, transport: Transport, credential: str = ""):
        self.transport, self.credential = transport, credential

    async def artwork(self, metadata: Metadata) -> bytes | None:
        """A bounded w780 backdrop using the shared limiter and no credentials."""
        path = backdrop_path(metadata.get("backdrop_path"))
        if not path:
            return None
        if metadata.get("provider") != "tmdb":
            raise ProviderError("provider_identity_mismatch")
        return await self.transport.get("https://image.tmdb.org/t/p/w780" + path)

    async def poster(self, metadata: Metadata) -> bytes | None:
        path = backdrop_path(metadata.get("poster_path"))
        if not path:
            return None
        if metadata.get("provider") != "tmdb":
            raise ProviderError("provider_identity_mismatch")
        return await self.image({"kind": "poster", "path": path})

    async def images(self, metadata: Metadata) -> list[dict]:
        movie_id = metadata.get("provider_id", "")
        if metadata.get("provider") != "tmdb" or not re.fullmatch(
            r"[1-9][0-9]{0,9}", movie_id
        ):
            raise ProviderError("provider_identity_mismatch")
        data = await self._get(
            f"/3/movie/{movie_id}/images", {"include_image_language": "en,null"}
        )
        if not isinstance(data, dict) or str(data.get("id")) != movie_id:
            raise ProviderError("provider_identity_mismatch")
        result = []
        for field, kind in (("posters", "poster"), ("backdrops", "backdrop")):
            items = data.get(field, [])
            if not isinstance(items, list):
                raise ProviderError("tmdb_format_changed")
            seen = set()
            for item in items[:500]:
                if (
                    not isinstance(item, dict)
                    or not (path := backdrop_path(item.get("file_path")))
                    or path in seen
                ):
                    continue
                seen.add(path)
                result.append(
                    {
                        "kind": kind,
                        "path": path,
                        "width": item.get("width")
                        if type(item.get("width")) is int
                        else None,
                        "height": item.get("height")
                        if type(item.get("height")) is int
                        else None,
                    }
                )
                if len(seen) == 100:
                    break
        return result

    async def image(self, choice: dict, *, thumbnail=False) -> bytes:
        path = backdrop_path(choice.get("path"))
        kind = choice.get("kind")
        if not path or kind not in ("poster", "backdrop"):
            raise ProviderError("provider_artwork_unavailable")
        size = "w300" if thumbnail else "w500" if kind == "poster" else "w780"
        return await self.transport.get(f"https://image.tmdb.org/t/p/{size}" + path)

    async def _get(self, path: str, params: dict) -> dict:
        if not self.credential:
            raise ProviderError("tmdb_key_required")
        headers = {"Authorization": "Bearer " + self.credential}
        params = dict(params)
        # API v3 keys use a query parameter; API Read Access Tokens use Bearer.
        if len(self.credential) == 32 and all(
            char in "0123456789abcdef" for char in self.credential.lower()
        ):
            params["api_key"] = self.credential
            headers = {}
        body = await self.transport.get(HOST + path + "?" + urlencode(params), headers)
        try:
            return await asyncio.to_thread(json.loads, body)
        except (ValueError, RecursionError) as error:
            raise ProviderError("tmdb_format_changed") from error

    async def metadata(self, movie: MovieQuery) -> Metadata:
        search = await self._get(
            "/3/search/movie",
            {
                "query": movie.title,
                "primary_release_year": movie.year,
                "language": "en-US",
                "include_adult": "false",
                "page": 1,
            },
        )
        movie_id = match(search, movie.title, movie.year)
        data = await self._get(
            f"/3/movie/{movie_id}",
            {"append_to_response": "credits", "language": "en-US"},
        )
        return parse(data, movie_id, movie.title, movie.year)

    async def resolve(self, reference: dict) -> Metadata:
        movie_id = reference.get("provider_id", "")
        if not isinstance(movie_id, str) or not re.fullmatch(
            r"[1-9][0-9]{0,9}", movie_id
        ):
            raise ProviderError("provider_identity_mismatch")
        movie = MovieQuery(reference.get("title"), reference.get("year"))
        data = await self._get(
            f"/3/movie/{movie_id}",
            {"append_to_response": "credits", "language": "en-US"},
        )
        return parse(data, int(movie_id), movie.title, movie.year)

    async def search(self, query: str, year: int | None = None) -> list[Metadata]:
        params = {
            "query": query,
            "language": "en-US",
            "include_adult": "false",
            "page": 1,
        }
        if year is not None:
            params["primary_release_year"] = year
        data = await self._get("/3/search/movie", params)
        if not isinstance(data, dict) or not isinstance(data.get("results"), list):
            raise ProviderError("tmdb_format_changed")
        results, seen = [], set()
        for item in data["results"][:20]:
            if not isinstance(item, dict):
                continue
            movie_id, date = item.get("id"), item.get("release_date", "")
            if (
                type(movie_id) is not int
                or not 0 < movie_id < 10**10
                or movie_id in seen
                or not isinstance(date, str)
                or not date[:4].isdigit()
                or not label(item.get("title"))
            ):
                continue
            seen.add(movie_id)
            results.append(
                await self.resolve(
                    {
                        "provider_id": str(movie_id),
                        "title": item["title"],
                        "year": int(date[:4]),
                    }
                )
            )
            if len(results) == 8:
                break
        return results

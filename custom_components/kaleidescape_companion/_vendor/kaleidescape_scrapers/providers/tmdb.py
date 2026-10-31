"""Official TMDB v3 movie search/details projections, independent of HTTP clients."""

import asyncio
import json
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
        "actors": people(cast),
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
    }


class TMDBProvider:
    """Official v3 search/details API with conservative title/year identity."""

    def __init__(self, transport: Transport, credential: str = ""):
        self.transport, self.credential = transport, credential

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

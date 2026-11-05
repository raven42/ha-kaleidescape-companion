"""Small, bounded provider projections; no account, ownership or payment data."""

import unicodedata
from dataclasses import dataclass
from typing import TypedDict


class ProviderError(ValueError):
    """An owned error code, safe to report without provider bodies or credentials."""


@dataclass(frozen=True)
class MovieQuery:
    """Existing identity, never a request to fuzzy-match or replace a library row."""

    title: str
    year: int
    href: str = ""

    def __post_init__(self):
        if (
            not isinstance(self.title, str)
            or not self.title.strip()
            or len(self.title) > 1000
            or type(self.year) is not int
            or not 1800 <= self.year <= 2200
        ):
            raise ProviderError("provider_identity_mismatch")


class Metadata(TypedDict, total=False):
    """Display-only fields; provider scores retain their original scale."""

    provider: str
    retail_price: str | None
    provider_id: str
    url: str
    title: str
    year: int
    actors: list[str]
    directors: list[str]
    writers: list[str]
    producers: list[str]
    studios: list[str]
    distributor: str
    critic_score: float | None
    audience_score: float | None
    audience_rating: float | None
    audience_votes: int | None
    backdrop_path: str | None
    poster_path: str | None
    poster_url: str | None
    synopsis: str
    genres: list[str]


def label(value, maximum=1000):
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:maximum]


def names(values):
    if not isinstance(values, list):
        return []
    return list(dict.fromkeys(value for item in values[:500] if (value := label(item))))


def genre_name(value):
    """Use one label for the common science-fiction synonyms."""
    if isinstance(value, str) and value.strip().casefold() in {
        "sci-fi",
        "sci fi",
        "science fiction",
    }:
        return "Science Fiction"
    return value


def genre_names(values):
    return list(dict.fromkeys(genre_name(value) for value in names(values)))


def normalized(value):
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", label(value)).casefold()
        if char.isalnum()
    )


def same_movie(title, year, candidates):
    """Conservative automatic identity: matching year and normalized title only."""
    if type(year) is not int or not 1800 <= year <= 2200:
        return []
    key = normalized(title)
    return [
        item
        for item in candidates
        if item.get("year") == year
        and key
        and key
        in {normalized(item.get("title")), normalized(item.get("original_title"))}
    ]


def score(value, maximum):
    if type(value) in (int, float) and 0 <= value <= maximum:
        return float(value)
    return None

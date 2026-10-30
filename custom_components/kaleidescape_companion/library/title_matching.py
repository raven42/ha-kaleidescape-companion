"""Reusable Library title/year suggestions for validated import adapters.

These are review suggestions, never identity replacements or device requests.
Keep remakes, sources, contradictory hints and unknown years distinguishable.
"""

import html
import re
import time
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from urllib.parse import unquote, urlsplit

from ..core.models import invalid, text

MAX_MATCH_VERSIONS = 20_000
# Only an explicitly separated edition suffix is removed. A subtitle such as
# "The Final Cut" is not a license for arbitrary substring matching.
EDITION = re.compile(
    r"(?:\s+[-–—]\s+|\s*\()(?:[^()]{0,100}\b(?:edition|version|cut)|complete)\)?$",
    re.I,
)
NUMBERS = dict(
    zip(
        (
            "zero one two three four five six seven eight nine ten eleven twelve "
            "thirteen fourteen fifteen sixteen seventeen eighteen nineteen"
        ).split(),
        map(str, range(20)),
        strict=True,
    )
) | dict(
    zip(
        "twenty thirty forty fifty sixty seventy eighty ninety".split(),
        map(str, range(20, 100, 10)),
        strict=True,
    )
)
ROMANS = {
    "i": "1",
    "ii": "2",
    "iii": "3",
    "iv": "4",
    "v": "5",
    "vi": "6",
    "vii": "7",
    "viii": "8",
    "ix": "9",
    "x": "10",
}
ROMAN_PATTERN = "(?:" + "|".join(sorted(ROMANS, key=len, reverse=True)) + ")"
YEAR = re.compile(r"(?:^|-)((?:18|19|20|21)\d{2})(?=-|$)")


def title_key(value):
    """Normalize typography, accents and written numbers, without fuzzy edits."""
    value = "".join(
        char
        for char in unicodedata.normalize("NFKD", html.unescape(value).casefold())
        if not unicodedata.combining(char)
    )
    value = re.sub(r"['’‘`ʼ]", "", value).replace("&", " and ")
    # Store slugs omit decimal dots in version names ("2.0" becomes "20").
    value = re.sub(r"(?<=\d)\.(?=\d)", "", value)
    words = re.findall(r"\w+", value)
    result = []
    index = 0
    while index < len(words):
        word = NUMBERS.get(words[index], words[index])
        if (
            word.isdecimal()
            and 20 <= int(word) <= 90
            and int(word) % 10 == 0
            and index + 1 < len(words)
        ):
            unit = NUMBERS.get(words[index + 1], "")
            if unit.isdecimal() and 1 <= int(unit) <= 9:
                word = str(int(word) + int(unit))
                index += 1
        result.append(word)
        index += 1
    return " ".join(result)


def aliases(value):
    """Preserve strict keys alongside a bounded, structural browsing-title alias."""
    base = EDITION.sub("", value.strip())
    # Numbered franchise subtitles may be marketed without the episode/ordinal.
    # Numeric evidence is checked separately so two explicitly different numbers
    # cannot collapse into a suggestion for the wrong sequel.
    simplified = re.sub(
        rf"\bepisode\s+(?:{ROMAN_PATTERN}|\d+)\b\s*:?", " ", base, flags=re.I
    )
    simplified = re.sub(rf"\s+{ROMAN_PATTERN}\s*:\s*", ": ", simplified, flags=re.I)
    simplified = re.sub(
        r"^(?:marvel(?:'s|s')|disney's|pixar's)\s+", "", simplified, flags=re.I
    )
    keys = {title_key(value), title_key(base), title_key(simplified)}
    keys |= {
        " ".join(word for word in key.split() if word not in {"a", "an", "the"})
        for key in keys
    }
    return keys - {""}


def numbers(value):
    base = EDITION.sub("", value.strip())
    base = re.sub(
        rf"\bepisode\s+({ROMAN_PATTERN})\b",
        lambda match: "episode " + ROMANS.get(match[1].casefold(), match[1]),
        base,
        flags=re.I,
    )
    base = re.sub(
        rf"\b({ROMAN_PATTERN})(?=\s*:)",
        lambda match: ROMANS.get(match[1].casefold(), match[1]),
        base,
        flags=re.I,
    )
    return tuple(word for word in title_key(base).split() if word.isdecimal())


def store_title(href):
    """Infer a title/year from the known movie path; never resolve or fetch it."""
    if not href:
        return "", None
    try:
        path = unquote(urlsplit(href).path, errors="strict")
    except ValueError, UnicodeError:
        return "", None
    match = re.fullmatch(r"/?movie-store/movie/([^/\\]{1,2000})/?", path)
    if not match:
        return "", None
    slug = match[1]
    years = list(YEAR.finditer(slug))
    if not years or years[-1].start() == 0:
        return slug.replace("-", " "), None
    year = years[-1]
    return slug[: year.start()].replace("-", " "), int(year[1])


@dataclass(frozen=True)
class TitleQuery:
    """Validated title evidence shared by import adapters."""

    title: str
    alternate_title: str = ""
    year: int | None = None
    source_id: str | None = None
    source_group: str | None = None

    def __post_init__(self):
        text(self.title, 500)
        text(self.alternate_title, 2000, empty=True)
        if self.year is not None and (
            type(self.year) is not int or not 1800 <= self.year <= 9999
        ):
            raise invalid("Expected a release year from 1800 to 9999")
        if (self.source_id is None) != (self.source_group is None):
            raise invalid("A title scope requires both source and group")
        if self.source_id is not None:
            if not re.fullmatch(r"[a-f0-9]{64}", text(self.source_id, 64)):
                raise invalid("Invalid title source")
            group = text(self.source_group, 256)
            if any(char.isspace() or ord(char) < 32 for char in group):
                raise invalid("Invalid title group")


@dataclass
class _Movie:
    id: str
    title: str
    preferred: bool
    years: set[int] = field(default_factory=set)
    numbers: set[tuple[str, ...]] = field(default_factory=set)


@dataclass(frozen=True)
class TitleMatch:
    target: str | None
    method: str
    detail: str
    year: int | None = None


class TitleMatcher:
    """Build once per review on the repository worker; bound time and row count."""

    def __init__(self, db, deadline=None, *, preferred_ids=()):
        self.deadline = deadline if deadline is not None else time.monotonic() + 30
        preferred_ids = set(preferred_ids)
        self.movies = {}
        self.keys = defaultdict(set)
        rows = db.execute(
            "SELECT id,source_id,source_group,title,title_search,"
            "json_extract(data,'$.year') year "
            "FROM library WHERE available=1 AND purchase_match_pending=0 LIMIT ?",
            (MAX_MATCH_VERSIONS + 1,),
        )
        for count, row in enumerate(rows, 1):
            self.check_time()
            if count > MAX_MATCH_VERSIONS:
                raise invalid("Title matching is limited to 20000 cached versions")
            group = (row["source_id"], row["source_group"])
            preferred = row["id"] in preferred_ids
            movie = self.movies.setdefault(
                group, _Movie(row["id"], row["title"], preferred)
            )
            if (preferred and not movie.preferred) or (
                movie.preferred == preferred and row["id"] < movie.id
            ):
                movie.id, movie.title, movie.preferred = (
                    row["id"],
                    row["title"],
                    preferred,
                )
            if type(row["year"]) is int:
                movie.years.add(row["year"])
            movie.numbers.add(numbers(row["title"]))
            for value in (row["title"], row["title_search"]):
                for key in aliases(value):
                    self.keys[key].add(group)

    def check_time(self):
        if time.monotonic() > self.deadline:
            raise invalid("Title matching exceeded its time budget")

    def candidates(self, value, scope):
        matches = set()
        for key in aliases(value):
            matches.update(self.keys.get(key, ()))
        return matches if scope is None else matches & {scope}

    def match(self, query: TitleQuery) -> TitleMatch:
        """Match format-independent evidence; the caller owns parsing and approval."""
        self.check_time()
        hint, year = query.alternate_title, query.year
        scope = (query.source_id, query.source_group) if query.source_id else None
        primary = self.candidates(query.title, scope)
        linked = self.candidates(hint, scope) if hint else set()
        if primary and linked and not primary & linked:
            return TitleMatch(
                None,
                "conflicting_titles",
                "Title and alternate title identify different movies",
                year,
            )
        candidates = primary & linked if primary and linked else primary | linked
        numeric_hints = [
            set(value) for value in (numbers(query.title), numbers(hint)) if value
        ]
        if len(numeric_hints) == 2 and numeric_hints[0] != numeric_hints[1]:
            return TitleMatch(
                None,
                "conflicting_numbers",
                "Title and alternate-title sequel numbers disagree",
                year,
            )
        for wanted in numeric_hints:
            candidates = {
                key
                for key in candidates
                if any(
                    not value or set(value) == wanted
                    for value in self.movies[key].numbers
                )
            }
        if year is not None:
            known = candidates
            candidates = {key for key in candidates if year in self.movies[key].years}
            if known and not candidates:
                return TitleMatch(
                    None,
                    "year_unverified",
                    "Release year differs or is missing in Library; choose an entry",
                    year,
                )
        if len(candidates) != 1:
            return TitleMatch(
                None,
                "ambiguous" if candidates else "no_match",
                "No unique title/year match; choose a Library entry",
                year,
            )
        movie = self.movies[next(iter(candidates))]
        method = (
            ("title_and_year" if primary else "alternate_title_and_year")
            if year is not None
            else "normalized_title"
        )
        detail = (
            "Review normalized title and release year"
            if year is not None
            else "Review normalized title"
        )
        display_year = year or (
            next(iter(movie.years)) if len(movie.years) == 1 else "year unknown"
        )
        return TitleMatch(
            movie.id, method, f"{detail}: {movie.title} · {display_year}", year
        )

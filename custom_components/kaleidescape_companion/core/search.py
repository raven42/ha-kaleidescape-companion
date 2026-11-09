"""Bounded, literal-or-fuzzy text matching; never interprets patterns or SQL."""

import json
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache


def normalized(value):
    folded = value.casefold()
    if folded.isascii():
        return " ".join(re.findall(r"\w+", folded))
    return " ".join(
        re.findall(
            r"\w+",
            "".join(
                char
                for char in unicodedata.normalize("NFKD", folded)
                if not unicodedata.combining(char)
            ),
        )
    )


def close_word(left, right):
    """Small edit distance including adjacent swaps, bounded to 100 characters."""
    allowance = min(2, max(1, (len(left) + 3) // 4))
    if (
        len(left) < 3
        or max(len(left), len(right)) > 100
        or abs(len(left) - len(right)) > allowance
    ):
        return False
    previous = list(range(len(right) + 1))
    older = previous
    for i, a in enumerate(left, 1):
        # Distances outside this narrow band already exceed the allowed edits.
        current = [allowance + 1] * (len(right) + 1)
        current[0] = i
        for j in range(max(1, i - allowance), min(len(right), i + allowance) + 1):
            b = right[j - 1]
            value = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a != b))
            if i > 1 and j > 1 and a == right[j - 2] and left[i - 2] == b:
                value = min(value, older[j - 2] + 1)
            current[j] = value
        if min(current) > allowance:
            return False
        older, previous = previous, current
    return previous[-1] <= allowance


def score(query, name, near=close_word):
    """Rank normalized exact prefixes/strings above fuzzy all-word matches."""
    if not query:
        return 1
    if query in name:
        return 4 if name.startswith(query) else 3
    tokens = query.split()
    if len(tokens) > 12:
        return 0
    words = name.split()
    return int(
        all(
            any(
                token in word
                or (max(len(token), len(word)) <= 100 and near(token, word))
                for word in words
            )
            for token in tokens
        )
    )


def quoted(query):
    return (
        len(query.strip()) >= 2
        and query.strip().startswith('"')
        and query.strip().endswith('"')
    )


def phrase(query):
    query = query.strip()
    try:
        return json.loads(query).strip()
    except ValueError, TypeError:
        return query[1:-1].strip()


def matches(value, query, fuzzy=False):
    return Matcher(query, fuzzy)(value)


class Matcher:
    """Prepare one literal/fuzzy query, reusing repeated person/word comparisons.

    SQLite can visit a credit repeatedly across versions, count/page queries and
    facets. Keep bounded results only for the duration of that request.
    """

    def __init__(self, query, fuzzy=False, *, cached=False):
        raw = str(query or "")
        self.query = raw.casefold()
        self.rank_query = normalized(phrase(raw) if quoted(raw) else raw)
        self.needle = normalized(self.query) if fuzzy else ""
        self.pattern = None
        self.empty_phrase = False
        if quoted(raw):
            needle = phrase(raw).casefold()
            self.empty_phrase = not needle
            self.pattern = re.compile(
                r"(?<!\w)"
                + r"\s+".join(re.escape(word) for word in needle.split())
                + r"(?!\w)"
            )
        self.near = lru_cache(maxsize=4096)(close_word) if cached else close_word

    def __call__(self, value):
        return self._test(str(value or ""))

    def _test(self, value):
        folded = value.casefold()
        if self.pattern is not None:
            return not self.empty_phrase and bool(self.pattern.search(folded))
        if self.query in folded:
            return True
        return bool(self.needle and score(self.needle, normalized(value), self.near))

    def relevance(self, value, *, matched=False):
        """Grade an existing match without changing which values match."""
        value = str(value or "")
        if not matched and not self(value):
            return 0
        needle, name = self.rank_query, normalized(value)
        if not needle:
            return 100
        if name == needle:
            return 1000
        if f" {needle} " in f" {name} ":
            return 900
        if any(word.startswith(needle) for word in name.split()):
            return 800
        if needle in name:
            return 500
        # The matcher already bounded fuzzy terms to twelve short words. Grade
        # the weakest token so one strong word cannot hide a poor match.
        tokens, words = needle.split(), name.split()
        if len(tokens) > 12 or not words:
            return 100
        similarities = []
        for token in tokens:
            candidates = [
                word for word in words if token in word or self.near(token, word)
            ]
            if not candidates:
                return 100
            similarities.append(
                max(
                    1.0 if token in word else SequenceMatcher(None, token, word).ratio()
                    for word in candidates
                )
            )
        return 600 + int(min(similarities) * 190)

    def library_relevance(self, value, role, position=0, *, matched=False):
        """Combine match quality, credit type and billing for an existing match."""
        value = str(value or "")
        if not matched and not self(value):
            return 0
        match = self.relevance(value, matched=True)
        # Keep close typos above incidental substrings and below word prefixes;
        # field and billing adjustments can still change their final order.
        quality = {1000: 1000, 900: 930, 800: 900, 500: 480}.get(match)
        if quality is None:
            quality = 430 + match * 49 // 100 if 600 <= match <= 790 else match
        roles = {
            "title": 180,
            "actors": 120,
            "directors": 60,
            "writers": 20,
            "producers": 20,
            "studios": 0,
        }
        billing = min(position, 100) * 2 if role == "actors" else 0
        return max(1, quality + roles[role] - billing)

    def clear(self):
        if hasattr(self.near, "cache_clear"):
            self.near.cache_clear()

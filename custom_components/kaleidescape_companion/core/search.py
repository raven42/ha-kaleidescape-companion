"""Bounded, literal-or-fuzzy text matching; never interprets patterns or SQL."""

import json
import re
import unicodedata
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

    def clear(self):
        if hasattr(self.near, "cache_clear"):
            self.near.cache_clear()

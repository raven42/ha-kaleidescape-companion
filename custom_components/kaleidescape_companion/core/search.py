"""Bounded, literal-or-fuzzy text matching; never interprets patterns or SQL."""

import re
import unicodedata


def normalized(value):
    return " ".join(
        re.findall(
            r"\w+",
            "".join(
                char
                for char in unicodedata.normalize("NFKD", value.casefold())
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


def score(query, name):
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
            any(token in word or close_word(token, word) for word in words)
            for token in tokens
        )
    )


def matches(value, query, fuzzy=False):
    value, query = str(value or ""), str(query or "")
    if query.casefold() in value.casefold():
        return True
    if not fuzzy:
        return False
    needle = normalized(query)
    return bool(needle and score(needle, normalized(value)))

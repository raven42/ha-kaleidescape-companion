"""Positive format facets shared by cached SQL filtering and format suggestions."""

import json
import re

# Keep canonical labels aligned with the UI badges. Retain source labels too so
# unfamiliar formats remain filterable without guessing their capabilities.
PATTERNS = (
    ("HD", r"\bhd\b|\b1080p\b"),
    ("SD", r"\bsd\b|\b(?:480|576)[pi]\b"),
    ("SDR", r"\bsdr\b"),
    ("HDR10", r"\bhdr10\b"),
    ("Dolby Vision", r"\bdolby\s*vision\b"),
    ("Dolby Atmos", r"\bdolby\s*atmos\b"),
)
COMPILED = [(label, re.compile(pattern, re.I)) for label, pattern in PATTERNS]


def labels(encoded):
    """Return JSON for json_each; no code or paths are evaluated from metadata."""
    data = json.loads(encoded)
    source = data.get("formats") or [data.get("edition", "")]
    source = [value for value in source if value and value.casefold() != "multiple"]
    found = set(source)
    for value in source:
        if re.search(r"\b4k\b", value, re.I):
            found.add(
                "4K Cinematic" if re.search(r"\bcinematic\b", value, re.I) else "4K"
            )
    for label, pattern in COMPILED:
        if any(pattern.search(value) for value in source):
            found.add(label)
    return json.dumps(sorted(found, key=str.casefold))


def quality(encoded):
    known = set(json.loads(labels(encoded)))
    return next(
        (
            rank
            for rank, label in ((4, "4K Cinematic"), (3, "4K"), (2, "HD"), (1, "SD"))
            if label in known
        ),
        0,
    )

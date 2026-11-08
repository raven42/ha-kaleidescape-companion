"""Positive format facets shared by cached SQL filtering and format suggestions."""

import json
import re

# Keep canonical labels aligned with the UI badges. Retain source labels too so
# unfamiliar formats remain filterable without guessing their capabilities.
PATTERNS = (
    ("8K", r"\b8k\b"),
    ("HD Cinematic", r"\bhd\s+cinematic\b"),
    ("HD", r"\bhd\b(?!\s+cinematic)|\b1080p\b"),
    ("SD", r"\bsd\b|\b(?:480|576)[pi]\b"),
    ("SDR", r"\bsdr\b"),
    ("HDR10", r"\bhdr10\b"),
    ("Dolby Vision", r"\bdolby\s*vision\b"),
    ("Dolby Atmos", r"\bdolby\s*atmos\b"),
    ("DTS:X", r"\bdts\s*[:\-]\s*x\b"),
)
COMPILED = [(label, re.compile(pattern, re.I)) for label, pattern in PATTERNS]
CANONICAL = {label for label, _ in PATTERNS} | {"4K", "4K Cinematic"}
FEATURES = {"SDR", "HDR10", "Dolby Vision", "Dolby Atmos", "DTS:X"}


def values(data, enrichment=None):
    """Combine scanned formats with only unambiguous compatible Store facts."""
    data = json.loads(data) if isinstance(data, str) else dict(data)
    enrichment = (
        json.loads(enrichment) if isinstance(enrichment, str) else enrichment or {}
    )
    source = data.get("formats") or [data.get("edition", "")]
    source = [
        value
        for value in source
        if isinstance(value, str) and value and value.casefold() != "multiple"
    ]
    override = enrichment.get("format_override", {})
    if isinstance(override, dict) and override.get("mode") == "custom":
        badges = override.get("badges")
        if isinstance(badges, list) and all(
            isinstance(value, str) and value in CANONICAL for value in badges
        ):
            # Unknown source labels remain visible; only known badges are editable.
            unknown = [
                item
                for item in source
                if not re.search(r"\b4k\b", item, re.I)
                and not any(pattern.search(item) for _, pattern in COMPILED)
            ]
            return list(dict.fromkeys([*badges, *unknown]))
    if enrichment.get("source_only") or (
        isinstance(override, dict) and override.get("mode") == "original"
    ):
        return source
    store = enrichment.get("kaleidescape", {})
    if not isinstance(store, dict) or store.get("quality_complete") is not True:
        return source
    variants = store.get("quality_variants", []) if isinstance(store, dict) else []
    if not isinstance(variants, list) or len(variants) > 100:
        return source
    result = list(source)
    for original in source:
        if re.search(r"\b8k\b", original, re.I):
            resolution = "8K"
        elif re.search(r"\b4k\b", original, re.I):
            resolution = (
                "4K Cinematic" if re.search(r"\bcinematic\b", original, re.I) else "4K"
            )
        elif re.search(r"\bhd\b|\b1080p\b", original, re.I):
            resolution = (
                "HD Cinematic" if re.search(r"\bcinematic\b", original, re.I) else "HD"
            )
        elif re.search(r"\bsd\b|\b(?:480|576)[pi]\b", original, re.I):
            resolution = "SD"
        else:
            continue
        if resolution in {"HD", "HD Cinematic", "SD"} and (
            store.get("quality_has_high") is not False
            or any(
                isinstance(item, dict)
                and isinstance(item.get("format"), str)
                and item.get("format") in {"4K", "4K Cinematic", "8K"}
                for item in variants
            )
        ):
            continue  # A higher Store edition does not establish lower-quality audio.
        candidates = [
            item
            for item in variants
            if isinstance(item, dict) and item.get("format") == resolution
        ]
        for video in ("HDR10", "Dolby Vision", "SDR"):
            if re.search(re.escape(video), original, re.I):
                candidates = [item for item in candidates if item.get("video") == video]
                break
        if not candidates:
            continue
        common = FEATURES.intersection(
            *(
                {
                    value
                    for value in (item.get("video"), item.get("audio"))
                    if isinstance(value, str) and value in FEATURES
                }
                for item in candidates
            )
        )
        result.extend(sorted(common - set(result)))
    return list(dict.fromkeys(result))


def labels(encoded, enrichment=None):
    """Return JSON for json_each; no code or paths are evaluated from metadata."""
    source = values(encoded, enrichment)
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
            for rank, label in (
                (6, "8K"),
                (5, "4K Cinematic"),
                (4, "4K"),
                (3, "HD Cinematic"),
                (2, "HD"),
                (1, "SD"),
            )
            if label in known
        ),
        0,
    )


def facet_labels(encoded, enrichment=None):
    """List individual known badges, retaining only wholly unknown source labels."""
    values = json.loads(labels(encoded, enrichment))
    canonical = CANONICAL
    result = [
        value
        for value in values
        if value in canonical
        or not (
            re.search(r"\b4k\b", value, re.I)
            or any(pattern.search(value) for _, pattern in COMPILED)
        )
    ]
    return json.dumps(result)

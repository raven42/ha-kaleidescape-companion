"""Small title-only projections suitable for Home Assistant entity attributes."""

import json
from itertools import islice

MAX_SENSOR_MOVIES = 50
MAX_SENSOR_LIST_BYTES = 8192


def sensor_titles(rows) -> list[str]:
    """Keep exact counts elsewhere; bound both list length and encoded content."""
    titles = []
    size = 2  # Brackets, plus the default JSON separator between titles.
    for row in islice(rows, MAX_SENSOR_MOVIES):
        title = row["title"]
        size += len(json.dumps(title, ensure_ascii=False).encode()) + (
            2 if titles else 0
        )
        if size > MAX_SENSOR_LIST_BYTES:
            break
        titles.append(title)
    return titles

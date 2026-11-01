"""Expiring administrator candidate lists with opaque browser selections."""

import json

from ..core.models import JournalError, invalid
from ..core.search import matches, phrase, quoted


async def search(manager, actor, title, provider, query):
    manager.ready(actor)
    if not manager.enabled(provider):
        raise JournalError(
            "metadata_disabled", "Enable and configure this provider first"
        )
    if (
        not isinstance(query, str)
        or not query.strip()
        or len(query) > 200
        or "\x00" in query
    ):
        raise invalid("Enter a title search of at most 200 characters")
    target = await manager.parent.repository.async_enrichment(
        "review_target", manager.parent.source, title
    )
    async with manager.worker(actor, title) as client:
        rows = await client.providers.search(
            provider, phrase(query) if quoted(query) else query
        )
    if len(json.dumps(rows).encode()) > 512 * 1024 or len(rows) > 8:
        raise JournalError(
            "metadata_limit", "Search results are too large; refine the title"
        )
    if quoted(query):
        rows = [row for row in rows if matches(row.get("title"), query)]
    candidates = {f"match-{index}": row for index, row in enumerate(rows)}
    artwork = bool(manager.parent.config.get("library_sync_artwork"))
    images = {}
    for key, row in candidates.items():
        if provider == "tmdb" and row.get("poster_path"):
            images[key] = {"kind": "poster", "path": row["poster_path"]}
        elif provider == "kaleidescape" and row.get("poster_url"):
            images[key] = {"kind": "poster", "path": row["poster_url"]}
    token = manager.remember(
        actor, target, provider, kind="matches", candidates=candidates, images=images
    )
    return {
        "search_id": token,
        "title": target["title"],
        "query": query,
        "candidates": [
            {
                "id": key,
                "title": row["title"],
                "year": row["year"],
                "directors": row.get("directors", [])[:5],
                "actors": row.get("actors", [])[:5],
                "genres": row.get("genres", [])[:8],
                "has_artwork": artwork and key in images,
            }
            for key, row in candidates.items()
        ],
    }


def selected(manager, actor, title, provider, search_id, choice):
    plan = manager.plan(actor, search_id)
    if (
        plan.get("kind") != "matches"
        or plan["target"]["id"] != title
        or plan["provider"] != provider
        or choice not in plan["candidates"]
    ):
        raise invalid("Select a match from this title's search results")
    return plan["target"], plan["candidates"][choice]

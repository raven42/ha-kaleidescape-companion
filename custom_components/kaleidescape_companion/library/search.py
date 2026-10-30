"""Bounded local title completion, including partial words and small misspellings."""

from time import monotonic

from ..core.models import invalid
from ..core.search import matches, normalized, score
from .browse import (
    FAVORITE_SQL,
    PURCHASE_SQL,
    RECENT_SQL,
    STATUS_SQL,
    bounded_page,
    group_metadata,
    hidden_names,
    memberships_for,
    public_title,
)


def search(db, source, query, excluded, fuzzy=True):
    if not isinstance(query, str) or len(query) > 100 or "\x00" in query:
        raise invalid("Title search is limited to 100 characters")
    if type(fuzzy) is not bool:
        raise invalid("Invalid fuzzy search option")
    raw = query
    query = normalized(query)
    if fuzzy and len(query.split()) > 12:
        raise invalid("Title search is limited to twelve words")
    # Score names only; load the ten full display records after ranking.
    rows = db.execute(
        "SELECT id,title FROM library_titles WHERE source_id=? AND available=1 "
        "ORDER BY title_search,id LIMIT 10001",
        (source,),
    ).fetchall()
    ranked = []
    deadline = monotonic() + 1
    truncated = len(rows) > 10000
    for row in rows[:10000]:
        if monotonic() > deadline:
            truncated = True
            break
        ranked.append(
            (
                score(query, normalized(row["title"]))
                if fuzzy and (query or not raw.strip())
                else int(bool(raw.strip()) and matches(row["title"], raw)),
                row["title"].casefold(),
                row["id"],
            )
        )
    ranked.sort(key=lambda item: (-item[0], item[1], item[2]))
    keys = [row[2] for row in ranked if row[0]][:10]
    hidden = hidden_names(db, source, excluded)
    members = memberships_for(db, source, keys, hidden, by_id=True)
    found = {}
    for key in keys:
        row = db.execute(
            f"SELECT t.*,({STATUS_SQL}) watched_status,({FAVORITE_SQL}) "
            f"is_favorite,({RECENT_SQL}) is_recently_added,"
            f"{PURCHASE_SQL} effective_purchased_on FROM library_titles t "
            f"JOIN library_sources s ON s.id=t.source_id WHERE t.id=? AND "
            f"t.source_id=?",
            (key, source),
        ).fetchone()
        shared = group_metadata(db, source, [row["source_group"]])
        found[key] = public_title(
            row, members.get(key, []), shared.get(row["source_group"])
        )
    return bounded_page(
        {
            "items": [found[key] for key in keys],
            "has_more": truncated or sum(bool(row[0]) for row in ranked) > 10,
        }
    )

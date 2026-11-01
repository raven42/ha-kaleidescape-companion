"""Bounded, household-safe month reads and compact viewing/movie details."""

from datetime import datetime, timedelta

from ..playback.metadata import snapshot
from .journal_store import PUBLIC_FIELDS, get_viewing, library_group, public_viewing
from .models import JournalError, identifier, invalid, status, text, timestamp

MOVIE_FIELDS = (
    "title",
    "rating",
    "actors",
    "directors",
    "genres",
    "duration_seconds",
    "year",
    "edition",
    "formats",
    "artwork_key",
)


def month(
    db,
    start,
    end,
    query="",
    viewing_status=None,
    fuzzy=False,
    source=None,
    title_id=None,
):
    start, end = timestamp(start), timestamp(end)
    span = datetime.fromisoformat(end) - datetime.fromisoformat(start)
    if not timedelta(0) < span <= timedelta(days=32):
        raise invalid("Choose a calendar range of at most 32 days")
    # Observations may omit a zero fractional part; keep midnight bounds inclusive.
    start = datetime.fromisoformat(start).isoformat()
    end = datetime.fromisoformat(end).isoformat()
    query = text(query, 500, empty=True).casefold()
    if viewing_status is not None:
        status(viewing_status)
    if type(fuzzy) is not bool:
        raise invalid("Invalid fuzzy search option")
    predicates = [
        "v.deleted_at IS NULL",
        "((v.started_at>=? AND v.started_at<?) OR (v.status='completed' "
        "AND v.ended_at>v.started_at AND v.ended_at>=? AND v.ended_at<?))",
    ]
    values = [source, start, end, start, end]
    if query:
        predicates.append("companion_matches(v.title,?,?)")
        values.extend((query, fuzzy))
    if viewing_status:
        predicates.append("v.status=?")
        values.append(viewing_status)
    if title_id is not None:
        if source is None:
            raise JournalError("library_disabled", "Enable Library to filter by movie")
        group = library_group(db, source, title_id)
        predicates.append(
            "v.library_title_id IN (SELECT id FROM library WHERE source_id=? "
            "AND source_group=? AND purchase_match_pending=0)"
        )
        values.extend((source, group))
    columns = ",".join(f"v.{key}" for key in sorted(PUBLIC_FIELDS))
    rows = db.execute(
        f"SELECT {columns},t.id library_title_id,"
        "companion_artwork(t.artwork_key,t.enrichment,'artwork') artwork_key "
        "FROM viewings v "
        "LEFT JOIN library t ON t.id=v.library_title_id AND t.source_id=? "
        "AND t.available=1 AND t.purchase_match_pending=0 "
        f"WHERE {' AND '.join(predicates)} ORDER BY v.started_at,v.id LIMIT 1001",
        values,
    ).fetchall()
    if len(rows) > 1000:
        raise JournalError(
            "calendar_limit",
            "More than 1000 viewings in this month; narrow the search or status filter",
        )
    return {
        "items": [
            {
                **public_viewing(row),
                "library_title_id": row["library_title_id"],
                "artwork_key": row["artwork_key"],
            }
            for row in rows
        ],
        "revision": db.execute("SELECT revision FROM schema_metadata").fetchone()[0],
    }


def details(db, viewing_id, source=None):
    viewing = get_viewing(db, identifier(viewing_id))
    row = (
        db.execute(
            "SELECT t.* FROM library t JOIN viewings v ON v.library_title_id=t.id "
            "WHERE v.id=? AND t.source_id=? AND t.available=1 "
            "AND t.purchase_match_pending=0",
            (viewing_id, source),
        ).fetchone()
        if source is not None
        else None
    )
    movie = None
    if row is not None:
        metadata = snapshot(db, row)
        movie = {key: metadata.get(key) for key in MOVIE_FIELDS}
    return {"viewing": public_viewing(viewing), "movie": movie}

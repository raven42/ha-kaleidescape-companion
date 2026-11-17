"""Link existing cached artwork between editions of the same source group."""

import json
from collections import defaultdict

from ..enrichment.selection import image
from ..enrichment.selection import read as source_preferences


def reconcile(db, *, source=None, target_ids=None, apply=False, bump_sources=True):
    """Return affected editions; only fill missing, unambiguous image references.

    Call inside the caller's transaction when applying; the caller owns the
    dataset revision. Never copy bytes or use an edition from another source.
    """
    if target_ids is not None and not target_ids:
        return 0
    params = []
    where = "purchase_match_pending=0"
    if source is not None:
        where += " AND source_id=?"
        params.append(source)
    if target_ids is not None:
        where += (
            " AND source_group IN (SELECT source_group FROM library "
            "WHERE id IN (SELECT value FROM json_each(?)))"
        )
        params.append(json.dumps(list(target_ids)))
    rows = db.execute(
        "SELECT id,source_id,source_group,artwork_key,enrichment FROM library "
        "WHERE " + where + " ORDER BY source_id,source_group,id",
        params,
    ).fetchall()
    cached = {row[0] for row in db.execute("SELECT cache_key FROM library_artwork")}
    if not cached:
        return 0
    preferences = source_preferences(db)
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["source_id"], row["source_group"])].append(
            (row, json.loads(row["enrichment"]))
        )
    targets = set(target_ids) if target_ids is not None else None
    changes = []
    for (source_id, _), versions in grouped.items():
        if len(versions) < 2:
            continue
        unavailable = {
            kind
            for _, value in versions
            for kind, flagged in value.get("unavailable_artwork", {}).items()
            if flagged is True
        }
        images = {"poster": set(), "backdrop": set()}
        for row, value in versions:
            if value.get("source_only"):
                continue
            for kind in images:
                key = image(
                    row["artwork_key"] if kind == "poster" else None,
                    value,
                    preferences,
                    "artwork" if kind == "poster" else "backdrop",
                )
                if key in cached:
                    images[kind].add(key)
        for row, value in versions:
            if (targets is not None and row["id"] not in targets) or value.get(
                "source_only"
            ):
                continue
            reviewed = value.get("reviewed", {})
            tmdb = value.get("tmdb", {})
            artwork = row["artwork_key"]
            modified = False
            if (
                "poster" not in unavailable
                and len(images["poster"]) == 1
                and not artwork
                and not reviewed.get("poster_key")
                and not tmdb.get("poster_key")
            ):
                artwork = next(iter(images["poster"]))
                modified = True
            if (
                "backdrop" not in unavailable
                and len(images["backdrop"]) == 1
                and not reviewed.get("backdrop_removed")
                and not reviewed.get("backdrop_key")
                and not tmdb.get("backdrop_key")
            ):
                # A reviewed key preserves the donor's selected image even when
                # the receiver has no provider metadata or a different mapping.
                value.setdefault("reviewed", {})["backdrop_key"] = next(
                    iter(images["backdrop"])
                )
                modified = True
            if modified:
                changes.append((artwork, json.dumps(value), row["id"], source_id))
    if apply and changes:
        db.executemany(
            "UPDATE library SET artwork_key=?,enrichment=? WHERE id=?",
            [(artwork, value, id) for artwork, value, id, _ in changes],
        )
        if bump_sources:
            db.executemany(
                "UPDATE library_sources SET revision=revision+1 WHERE id=?",
                [(source_id,) for source_id in sorted({row[3] for row in changes})],
            )
    return len(changes)

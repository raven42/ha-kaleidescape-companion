"""Schema 16: consolidate legacy invoice rows without losing unmatched history."""

import hashlib
import json


def consolidate(db):
    columns = (
        "id",
        "title",
        "purchased_on",
        "purchase_price",
        "retail_price",
        "order_id",
        "href",
        "imported_at",
    )
    purchases = db.execute(
        "SELECT * FROM library_purchases ORDER BY purchased_on,id"
    ).fetchall()
    for purchase in purchases:
        target = None
        if purchase["source_id"]:
            target = db.execute(
                "SELECT id FROM library WHERE source_id=? AND source_group=? "
                "ORDER BY id LIMIT 1",
                (purchase["source_id"], purchase["source_group"]),
            ).fetchone()
        if target is None:
            matches = db.execute(
                "SELECT min(id) id FROM library WHERE available=1 AND title_search=? "
                "GROUP BY source_id,source_group LIMIT 2",
                (purchase["title_search"],),
            ).fetchall()
            target = matches[0] if len(matches) == 1 else None
        if target is None:
            # Only upgrades can create pending entries. New imports must match a
            # scanned entry. These unavailable rows preserve previously unlinked
            # orders until reviewed against the real Library, without a side table.
            source = hashlib.sha256(
                b"kaleidescape_companion:pending-purchases"
            ).hexdigest()
            handle = "purchase-" + purchase["id"]
            target_id = hashlib.sha256(f"{source}:{handle}".encode()).hexdigest()
            db.execute(
                "INSERT OR IGNORE INTO library_sources(id,origin,first_seen) "
                "VALUES (?,?,?)",
                (source, "offline:pending-purchases", purchase["imported_at"]),
            )
            db.execute(
                "INSERT INTO "
                "library(id,source_id,source_handle,source_group,title,title_search,"
                "base_hash,data,first_seen,last_seen,available,purchase_match_pending) "
                "VALUES (?,?,?,?,?,?,'','{}',?,?,0,1)",
                (
                    target_id,
                    source,
                    handle,
                    handle,
                    purchase["title"],
                    purchase["title_search"],
                    purchase["imported_at"],
                    purchase["imported_at"],
                ),
            )
        else:
            target_id = target["id"]
        row = db.execute(
            "SELECT purchase_history FROM library WHERE id=?", (target_id,)
        ).fetchone()
        records = json.loads(row[0])
        records.append({key: purchase[key] for key in columns})
        first = records[0]
        db.execute(
            "UPDATE library SET "
            "purchase_history=?,purchase_price=?,retail_price=?,order_id=?,href=?,"
            "purchased_on=coalesce(purchased_on,?),"
            "purchase_imported_at=coalesce(purchase_imported_at,?) WHERE id=?",
            (
                json.dumps(records),
                first["purchase_price"],
                first["retail_price"],
                first["order_id"],
                first["href"],
                first["purchased_on"],
                purchase["imported_at"],
                target_id,
            ),
        )
    db.execute("DROP TABLE library_purchases")
    for row in db.execute(
        "SELECT owner,value FROM settings WHERE key='database'"
    ).fetchall():
        value = json.loads(row["value"])
        before = json.dumps(value)
        if value.get("table") in {"library_titles", "library_purchases"}:
            value["table"] = "library"
        sorts = value.get("sorts", {})
        title_sort = sorts.pop("library_titles", None)
        purchase_sort = sorts.pop("library_purchases", None)
        if title_sort or purchase_sort:
            selected = dict(title_sort or purchase_sort)
            if selected["sort"] == "imported_at":
                selected["sort"] = "purchase_imported_at"
            sorts.setdefault("library", selected)
        if json.dumps(value) != before:
            db.execute(
                "UPDATE settings SET value=?,revision=revision+1 WHERE "
                "owner=? AND key='database'",
                (json.dumps(value), row["owner"]),
            )
            db.execute(
                "UPDATE schema_metadata SET settings_revision=settings_revision+1"
            )
    if purchases:
        db.execute("UPDATE library_sources SET revision=revision+1")
        db.execute("UPDATE schema_metadata SET revision=revision+1")

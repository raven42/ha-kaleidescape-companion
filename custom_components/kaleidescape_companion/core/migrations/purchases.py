"""Move embedded invoices into the purchase ledger without duplicating them."""

import json
from datetime import UTC, datetime

from ..models import timestamp


def move_history(db):
    cursor = db.execute(
        "SELECT id,purchase_history,purchase_match_pending,purchase_price,"
        "retail_price,order_id,href,purchased_on,purchase_imported_at FROM library "
        "WHERE purchase_history!='[]'"
    )
    columns = [item[0] for item in cursor.description]
    for raw in cursor.fetchall():
        row = dict(zip(columns, raw, strict=True))
        records = json.loads(row["purchase_history"])
        if not isinstance(records, list) or not records:
            raise ValueError("Invalid embedded purchase history")
        first = records[0]
        for field in ("purchase_price", "retail_price", "order_id", "href"):
            if row[field] is not None and row[field] != first.get(field):
                raise ValueError("Purchase summary differs from embedded history")
        for item in records:
            existing = db.execute(
                "SELECT title,purchased_on,purchase_price,retail_price,order_id,href,"
                "library_id FROM purchase_records WHERE id=?",
                (item["id"],),
            ).fetchone()
            owner = None if row["purchase_match_pending"] else row["id"]
            fields = (
                "title",
                "purchased_on",
                "purchase_price",
                "retail_price",
                "order_id",
                "href",
            )
            if existing:
                if tuple(existing[:6]) != tuple(item.get(field) for field in fields):
                    raise ValueError("Conflicting duplicate purchase history")
                if existing[6] and owner and existing[6] != owner:
                    raise ValueError("Duplicate purchase has multiple Library owners")
                if owner and not existing[6]:
                    db.execute(
                        "UPDATE purchase_records SET library_id=?,issue=NULL "
                        "WHERE id=?",
                        (owner, item["id"]),
                    )
                continue
            db.execute(
                "INSERT INTO purchase_records "
                "(id,title,purchased_on,purchase_price,retail_price,order_id,href,"
                "imported_at,library_id,issue) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    item["id"],
                    item["title"],
                    item["purchased_on"],
                    item.get("purchase_price"),
                    item.get("retail_price"),
                    item.get("order_id"),
                    item.get("href"),
                    timestamp(
                        item.get("imported_at")
                        or row["purchase_imported_at"]
                        or datetime.now(UTC).isoformat()
                    ),
                    owner,
                    "unmatched" if row["purchase_match_pending"] else None,
                ),
            )
        db.execute(
            "UPDATE library SET purchase_price=NULL,retail_price=NULL,order_id=NULL,"
            "href=NULL,purchased_on=? WHERE id=?",
            (
                None
                if row["purchased_on"] == first.get("purchased_on")
                else row["purchased_on"],
                row["id"],
            ),
        )
    db.execute(
        "DELETE FROM library WHERE purchase_match_pending=1 "
        "AND NOT EXISTS (SELECT 1 FROM library_memberships WHERE title_id=library.id) "
        "AND NOT EXISTS (SELECT 1 FROM viewings WHERE library_title_id=library.id) "
        "AND NOT EXISTS (SELECT 1 FROM library_collection_intents "
        "WHERE title_id=library.id)"
    )
    db.execute("ALTER TABLE library DROP COLUMN purchase_history")

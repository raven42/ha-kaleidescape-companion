"""Convert bounded purchase-email payloads into existing invoice records."""

import json

from ..core.models import invalid
from .purchases import money, price_cents, purchase_record

MAX_BYTES = 1024 * 1024
MAX_MOVIES = 1000


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise invalid("Purchase email contains duplicate JSON keys")
        result[key] = value
    return result


def _shares(value, count):
    parsed = price_cents(value)
    if parsed is None:
        return [None] * count
    currency, cents = parsed
    amount, remainder = divmod(cents, count)
    return [money(currency, amount + (index < remainder)) for index in range(count)]


def normalize(payload):
    """Expand movie sets, allocating each set's price evenly in integer cents."""
    try:
        if isinstance(payload, str):
            if len(payload.encode("utf-8")) > MAX_BYTES:
                raise invalid("Purchase email exceeds 1 MiB")
            payload = json.loads(payload, object_pairs_hook=_object)
        elif len(json.dumps(payload, allow_nan=False).encode()) > MAX_BYTES:
            raise invalid("Purchase email exceeds 1 MiB")
    except (ValueError, TypeError, UnicodeError, RecursionError) as error:
        raise invalid("Expected a valid purchase email JSON object") from error
    if not isinstance(payload, dict) or payload.get("source") != "kaleidescape":
        raise invalid("Expected a Kaleidescape purchase email")
    if payload.get("prices_reconciled", True) is not True:
        raise invalid("Purchase email prices are not reconciled")
    items = payload.get("purchases")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_MOVIES:
        raise invalid("Purchase email requires 1–1000 purchases")
    records, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise invalid("Expected a purchase record")
        date = item.get("purchased_on", payload.get("purchased_on"))
        order = item.get("order_id", payload.get("order_id"))
        if (
            payload.get("purchased_on") is not None and date != payload["purchased_on"]
        ) or (payload.get("order_id") is not None and order != payload["order_id"]):
            raise invalid("Purchase date or order differs from its email")
        members = item.get("included_titles")
        if members is None:
            members = [{"title": item.get("title"), "href": item.get("href")}]
        if (
            not isinstance(members, list)
            or not members
            or len(records) + len(members) > MAX_MOVIES
        ):
            raise invalid("Purchase email supports up to 1000 included movies")
        if any(not isinstance(member, dict) for member in members):
            raise invalid("Expected included movie records")
        # Stable ordering makes allocations independent of the email's list order.
        validated = [
            purchase_record(
                {
                    "title": member.get("title"),
                    "href": member.get("href"),
                    "purchased_on": date,
                    "order_id": order,
                }
            )
            for member in members
        ]
        validated.sort(key=lambda row: row["id"])
        paid = _shares(item.get("purchase_price"), len(validated))
        retail = _shares(item.get("retail_price"), len(validated))
        for index, record in enumerate(validated):
            if record["id"] in seen:
                raise invalid("Duplicate purchase identity in email")
            seen.add(record["id"])
            records.append(
                {**record, "purchase_price": paid[index], "retail_price": retail[index]}
            )
    return records

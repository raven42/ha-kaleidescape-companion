"""Bounded structured event storage. Called only by the repository worker."""

import json
import re
import secrets
from datetime import UTC, datetime

from kaleidescape_api.log_messages import ALIAS, describe, source_location
from kaleidescape_api.logging import (  # public independent API
    Level,
    Resource,
    SafeLogger,
    Subsystem,
)

from .models import invalid

SOURCE_PACKAGES = ("custom_components.kaleidescape_companion", "kaleidescape_api")

MAX_BYTES = 5 * 1024 * 1024
BANNER = (
    "Privacy: account, credential, network and other identifying details are not "
    "included in this export. Resources use private keyed aliases. Movie metadata "
    "may be present only when Log database values was explicitly enabled."
)


def initialize(db):
    with db:
        db.execute(
            "INSERT OR IGNORE INTO log_state VALUES (1,?, 'INFO',0,0)",
            (secrets.token_hex(32),),
        )
    row = db.execute("SELECT * FROM log_state").fetchone()
    return SafeLogger(
        key=bytes.fromhex(row["alias_key"]),
        level=Level(row["level"]),
        source_packages=SOURCE_PACKAGES,
    )


def append(db, rows):
    if not rows:
        return
    with db:
        db.executemany(
            "INSERT INTO operation_logs(timestamp,level,logger,body,bytes) "
            "VALUES (?,?,?,?,?)",
            [
                (
                    r["timestamp"],
                    r["level"],
                    r["logger"],
                    body := json.dumps(r, ensure_ascii=True, separators=(",", ":")),
                    len(body.encode()),
                )
                for r in rows
            ],
        )
        total = db.execute(
            "SELECT COALESCE(SUM(bytes),0) FROM operation_logs"
        ).fetchone()[0]
        if total > MAX_BYTES:
            # Prefix sum selects just enough oldest rows, not the entire log book.
            cutoff = db.execute(
                "SELECT id FROM (SELECT id,SUM(bytes) OVER (ORDER BY id) "
                "AS freed FROM operation_logs) WHERE freed>=? LIMIT 1",
                (total - MAX_BYTES,),
            ).fetchone()[0]
            db.execute("DELETE FROM operation_logs WHERE id<=?", (cutoff,))


def settings(db):
    row = db.execute("SELECT level,log_values,hidden_through FROM log_state").fetchone()
    return {"level": row[0], "log_values": bool(row[1]), "hidden_through": row[2]}


def configure(db, patch):
    if not isinstance(patch, dict) or set(patch) - {"level", "log_values"}:
        raise invalid("Unknown logging options")
    current = settings(db)
    level = patch.get("level", current["level"])
    values = patch.get("log_values", current["log_values"])
    if level not in [v.value for v in Level] or type(values) is not bool:
        raise invalid("Invalid logging options")
    with db:
        db.execute("UPDATE log_state SET level=?,log_values=?", (level, values))
    return settings(db)


def query(db, filters):
    if not isinstance(filters, dict) or set(filters) - {
        "before",
        "through",
        "level",
        "logger",
        "hidden",
        "limit",
        "reference",
    }:
        raise invalid("Unknown log filters")
    for key in ("before", "through"):
        if filters.get(key) is not None and (
            type(filters[key]) is not int or not 0 <= filters[key] <= 2**63 - 1
        ):
            raise invalid("Invalid log cursor")
    limit = filters.get("limit", 100)
    if type(limit) is not int or not 1 <= limit <= 500:
        raise invalid("Choose up to 500 log rows")
    level, logger = filters.get("level", ""), filters.get("logger", "")
    if type(level) is not str or (level and level not in [v.value for v in Level]):
        raise invalid("Invalid log level")
    if type(logger) is not str or (
        logger and logger not in [v.value for v in Subsystem]
    ):
        raise invalid("Invalid subsystem")
    if type(filters.get("hidden", False)) is not bool:
        raise invalid("Invalid hidden option")
    config = settings(db)
    sql, args = ["id>?"], [0 if filters.get("hidden") else config["hidden_through"]]
    reference = filters.get("reference", "")
    if (
        type(reference) is not str
        or len(reference) > 64
        or (reference and not ALIAS.fullmatch(reference))
    ):
        raise invalid("Enter a logged resource or trace alias")
    if reference:
        sql.append(
            "("
            + " OR ".join(
                f"json_extract(body,'$.{key}')=?"
                for key in ("resource", "related", "actor", "target", "trace")
            )
            + ")"
        )
        args.extend([reference] * 5)
    for key, sign in (("before", "<"), ("through", "<=")):
        if filters.get(key) is not None:
            sql.append(f"id{sign}?")
            args.append(filters[key])
    for key, value in (("level", level), ("logger", logger)):
        if value:
            sql.append(f"{key}=?")
            args.append(value)
    rows = db.execute(
        "SELECT id,body FROM operation_logs WHERE "
        + " AND ".join(sql)
        + " ORDER BY id DESC LIMIT ?",
        (*args, limit + 1),
    ).fetchall()
    info = db.execute(
        "SELECT COUNT(*),COALESCE(SUM(bytes),0),COALESCE(MAX(id),0) FROM operation_logs"
    ).fetchone()
    items = [{"id": r[0], **json.loads(r[1])} for r in rows[:limit]]
    for item in items:
        # Old rows retain their original fields/IDs; supply a readable fallback.
        item.setdefault("message", describe(item))
    return {
        "items": items,
        "before": items[-1]["id"] if len(rows) > limit else None,
        "through": info[2],
        "retained": info[0],
        "bytes": info[1],
        "limit_bytes": MAX_BYTES,
        "config": config,
        "banner": BANNER,
        "loggers": [v.value for v in Subsystem],
    }


def clear(db, through):
    if type(through) is not int or not 0 <= through <= 2**63 - 1:
        raise invalid("Invalid log clear cursor")
    with db:
        db.execute(
            "UPDATE log_state SET hidden_through=MAX(hidden_through,MIN(?,"
            "(SELECT COALESCE(MAX(id),0) FROM operation_logs)))",
            (through,),
        )
    return settings(db)


# Only explicitly supplied movie metadata may enter this path. No notes, paths,
# raw errors, configuration, request/response bodies or arbitrary field dumps.
SENSITIVE = re.compile(
    r"https?://\S+|[\w.+-]+@[\w.-]+|(?:\d{1,3}\.){3}\d{1,3}|"
    r"[\w.-]+\.(?:local|lan|internal)\b|(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9:]+|"
    r"(?:bearer|token|password|secret|api[_ -]?key|username|account|address)"
    r"\s*[:=]?\s*\S+|"
    r"[a-zA-Z0-9_/-]{24,}|(?:\+?\d[ ().-]*){7,}|[/\\]\S+|"
    r"\d+\s+[^,;]{1,50}\s(?:Street|Road|Avenue|Lane|Drive|St|Rd|Ave|Ln|Dr)\b",
    re.IGNORECASE,
)


def private_text(value, limit):
    # Suppress the entire field if any sensitive pattern is present. Replacing
    # only a matched prefix could expose part of an address or credential.
    return "[private]" if SENSITIVE.search(value) else value[:limit]


MOVIE_FIELDS = frozenset(
    {
        "title",
        "actors",
        "directors",
        "writers",
        "producers",
        "studios",
        "genres",
        "rating",
        "formats",
    }
)


def movie_values(logger, identity, metadata):
    """Permit only explicit movie fields, never an arbitrary record dump."""
    if not isinstance(metadata, dict) or logger.level not in {Level.DEBUG, Level.INFO}:
        return None
    values = {}
    for key in sorted(MOVIE_FIELDS & metadata.keys()):
        value = metadata[key]
        if type(value) is str:
            values[key] = private_text(value, 500)
        elif isinstance(value, list) and all(type(v) is str for v in value):
            values[key] = [private_text(v, 200) for v in value[:30]]
    # Hard cap independent of field count; omit optional values rather than
    # making a diagnostic operation or functional write fail.
    if not values or len(json.dumps(values).encode()) > 8192:
        return None
    file, line = source_location(SOURCE_PACKAGES, 1)
    return {
        "file": file,
        "line": line,
        "message": (
            "Movie metadata was logged with the administrator value opt-in enabled."
        ),
        "timestamp": datetime.now(UTC).isoformat(),
        "level": "INFO",
        "logger": "database",
        "operation": "update",
        "outcome": "changed",
        "resource": logger.alias(Resource.MOVIE, identity),
        "values": values,
    }


def movie_value(logger, identity, value):
    return movie_values(logger, identity, {"title": value})

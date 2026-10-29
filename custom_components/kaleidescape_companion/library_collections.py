"""Bounded add-only form parsing and private durable request receipts."""

import hashlib
import json
import re
from datetime import UTC, datetime

from .journal import JournalError, identifier, invalid
from .library_config import excluded_collections
from .library_parser import Tree, clean
from .library_store import changed

RESERVED = {"all", "new", "played", "paused", "scenes", "trash", "deleted"}
MAX_RECEIPTS = 10000


def member_hash(handles):
    return hashlib.sha256(json.dumps(sorted(set(handles))).encode()).hexdigest()


def parameters(request, source, title, collection, revision, actor):
    request = identifier(request)
    if not isinstance(title, str) or not re.fullmatch(r"[a-f0-9]{64}", title):
        raise invalid("Invalid Library version")
    if (
        not isinstance(collection, str)
        or not collection
        or len(collection) > 256
        or collection != " ".join(collection.split())
    ):
        raise invalid("Invalid collection")
    if collection.casefold() in RESERVED or any(ord(char) < 32 for char in collection):
        raise invalid("This collection cannot be edited here")
    if type(revision) is not int or revision < 0:
        raise invalid("Invalid source revision")
    fingerprint = hashlib.sha256(
        json.dumps(
            ["collection_add", source, title, collection, revision, actor],
            sort_keys=True,
        ).encode()
    ).hexdigest()
    return request, fingerprint


def form_targets(page, handle=None):
    """Accept only the observed fixed form; never evaluate JavaScript."""
    root = Tree(page).root
    form = root.find(id="main", tag="form")
    if (
        form is None
        or form.attrs.get("method", "").lower() != "post"
        or form.attrs.get("enctype", "").lower() != "multipart/form-data"
        or form.attrs.get("action", "") not in {"", "/movies", "movies"}
    ):
        raise JournalError("collection_form", "Collection add form was not recognized")
    button = form.find(id="add_to_collection", tag="button")
    field = form.find(id="add_to_collection_select_dropdown_value", tag="input")
    dropdown = form.find(id="add_to_collection_select_dropdown")
    if (
        button is None
        or button.attrs.get("onclick", "").strip()
        != "submit_parent_form_once( event, 'Add-To-Collection' );"
        or field is None
        or field.attrs.get("name") != "add_to_collection_select"
        or dropdown is None
    ):
        raise JournalError("collection_form", "Collection add form was not recognized")
    if handle is not None:
        controls = [
            node
            for node in form.nodes()
            if node.tag == "input"
            and node.attrs.get("name") == "check-" + handle
            and node.attrs.get("type", "").lower() == "checkbox"
            and "disabled" not in node.attrs
        ]
        if not controls or any(
            node.attrs.get("value", "on") != "on" for node in controls
        ):
            raise JournalError("collection_form", "Selected version cannot be added")
    targets = {}
    for node in dropdown.nodes():
        if (
            node.tag == "li"
            and "dropdown_option" in node.attrs.get("class", "").split()
        ):
            label = clean(node.text(), 256)
            if label and label.casefold() not in RESERVED:
                value = node.find(tag="input")
                if value is None or "disabled" in node.attrs:
                    continue
                raw = value.attrs.get("value", "")
                if not raw:
                    continue
                if label in targets:
                    raise JournalError("collection_form", "Duplicate collection choice")
                # Values may be internal IDs; never substitute a displayed label.
                if len(raw) > 512 or any(ord(char) < 32 for char in raw):
                    raise JournalError(
                        "collection_form", "Collection value was rejected"
                    )
                targets[label] = raw
    if len(targets) > 200:
        raise JournalError("collection_form", "Collection choices exceeded their limit")
    return targets


def snapshot(db, source, title=None, excluded=""):
    if title is not None and (
        not isinstance(title, str) or not re.fullmatch(r"[a-f0-9]{64}", title)
    ):
        raise invalid("Invalid Library version")
    info = db.execute(
        "SELECT revision FROM library_sources WHERE id=?", (source,)
    ).fetchone()
    if info is None:
        raise JournalError("not_ready", "Sync the Library first")
    hidden = excluded_collections(excluded)
    names = [
        row[0]
        for row in db.execute(
            "SELECT name FROM library_collections WHERE source_id=? "
            "AND available=1 ORDER BY name",
            (source,),
        )
        if row[0].casefold() not in hidden | RESERVED
    ]
    version = None
    if title is not None:
        version = db.execute(
            "SELECT source_handle,source_group,title FROM library_titles "
            "WHERE source_id=? AND id=? AND available=1",
            (source, title),
        ).fetchone()
        if version is None:
            raise JournalError("not_found", "Library version is unavailable")
        version = dict(version)
    pending = [
        dict(row)
        for row in db.execute(
            "SELECT i.request_id,i.title_id,i.collection,t.title "
            "FROM library_collection_intents i LEFT JOIN library_titles t "
            "ON t.id=i.title_id WHERE i.source_id=? AND i.status='uncertain' "
            "ORDER BY i.created_at",
            (source,),
        )
    ]
    return {
        "revision": info[0],
        "collections": names,
        "version": version,
        "pending": pending,
    }


def lookup(db, request, fingerprint):
    cached = db.execute(
        "SELECT fingerprint,response FROM requests WHERE request_id=?", (request,)
    ).fetchone()
    if cached is None:
        return None
    if cached["fingerprint"] != fingerprint:
        raise JournalError(
            "conflict", "Request UUID belongs to different data or actor"
        )
    return json.loads(cached["response"])


def intent(db, source, request):
    identifier(request)
    row = db.execute(
        "SELECT i.*,t.source_handle FROM library_collection_intents i "
        "LEFT JOIN library_titles t ON t.id=i.title_id "
        "WHERE i.request_id=? AND i.source_id=?",
        (request, source),
    ).fetchone()
    if row is None:
        raise JournalError("not_found", "Collection request was not found")
    return dict(row)


def begin(
    db, source, request, fingerprint, title, collection, revision, expected, actor
):
    with db:
        if lookup(db, request, fingerprint) is not None:
            raise JournalError("conflict", "Collection request already exists")
        state = snapshot(db, source, title)
        if state["revision"] != revision:
            raise JournalError(
                "refresh_required", "Library changed; refresh title details"
            )
        if state["pending"]:
            raise JournalError(
                "collection_uncertain", "Resolve the previous collection request"
            )
        if collection not in state["collections"]:
            raise invalid("Unknown or protected collection")
        if (
            db.execute("SELECT count(*) FROM library_collection_intents").fetchone()[0]
            >= MAX_RECEIPTS
        ):
            raise JournalError(
                "collection_limit", "Collection request history reached its limit"
            )
        stamp = datetime.now(UTC).isoformat()
        result = {"status": "uncertain", "request_id": request}
        db.execute(
            "INSERT INTO requests VALUES (?,?,?)",
            (request, fingerprint, json.dumps(result)),
        )
        db.execute(
            "INSERT INTO library_collection_intents "
            "VALUES (?,?,?,?,?,'uncertain',?,NULL,?,?)",
            (request, source, title, collection, expected, actor, stamp, stamp),
        )
        db.execute("UPDATE schema_metadata SET revision=revision+1")
    return result


def finish(db, source, request, members=None, acknowledge=None):
    with db:
        row = intent(db, source, request)
        if row["status"] != "uncertain":
            return {"status": row["status"], "request_id": request}
        status = "uncertain"
        if members is not None:
            handles = {item["source_handle"] for item in members}
            if (
                member_hash(handles) == row["expected_members_hash"]
                and row["source_handle"] in handles
            ):
                # A complete read, including every member, must map to this cache.
                ids = []
                for handle in handles:
                    version = db.execute(
                        "SELECT id FROM library_titles "
                        "WHERE source_id=? AND source_handle=? AND available=1",
                        (source, handle),
                    ).fetchone()
                    if version is None:
                        raise JournalError(
                            "library_changed",
                            "Sync the Library before checking this add",
                        )
                    ids.append(version[0])
                db.execute(
                    "DELETE FROM library_memberships "
                    "WHERE source_id=? AND collection=?",
                    (source, row["collection"]),
                )
                for title in ids:
                    db.execute(
                        "INSERT INTO library_memberships VALUES (?,?,?)",
                        (source, title, row["collection"]),
                    )
                db.execute(
                    "UPDATE library_collections SET last_seen=? "
                    "WHERE source_id=? AND name=?",
                    (datetime.now(UTC).isoformat(), source, row["collection"]),
                )
                changed(db, source)
                status = "confirmed"
        if acknowledge is not None:
            status = "abandoned"
        if status != "uncertain":
            db.execute(
                "UPDATE library_collection_intents SET status=?,title_id=NULL,"
                "collection=NULL,expected_members_hash=NULL,acknowledged_by=?,"
                "updated_at=? WHERE request_id=?",
                (status, acknowledge, datetime.now(UTC).isoformat(), request),
            )
            db.execute("UPDATE schema_metadata SET revision=revision+1")
        result = {"status": status, "request_id": request}
        db.execute(
            "UPDATE requests SET response=? WHERE request_id=?",
            (json.dumps(result), request),
        )
    return result

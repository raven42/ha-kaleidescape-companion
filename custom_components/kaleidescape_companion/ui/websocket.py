"""Household journal reads and administrator management through HA authentication."""

from typing import Any

import probatio as p
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from ..const import DOMAIN
from ..core.journal_store import public_viewing
from ..core.models import JournalError
from ..core.runtime import get_library, get_runtime, loaded_runtimes
from ..core.security import is_active_admin, is_active_user
from ..library.config import origin
from .preferences import public_defaults
from .settings import fingerprint, options_request

USER_OPERATIONS = frozenset(
    {
        "info",
        "journal/list",
        "journal/get",
        "journal/calendar",
        "journal/calendar/get",
        "library/info",
        "library/list",
        "library/versions",
        "library/suggest",
        "library/search",
        "library/viewing",
        "library/viewings",
        "ui/preferences/get",
        "ui/preferences/update",
    }
)


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register once; every invocation resolves the current loaded runtime."""
    scoped = {p.Required("entry_id"): str, p.Required("dataset_id"): str}
    mutations = {**scoped, p.Required("request_id"): str}
    schemas = {
        "info": {},
        "journal/create": {**mutations, p.Required("data"): dict},
        "journal/get": {**scoped, p.Required("viewing_id"): str},
        "journal/calendar": {
            **scoped,
            p.Required("start"): str,
            p.Required("end"): str,
            p.Optional("query", default=""): str,
            p.Optional("status"): str,
            p.Optional("fuzzy", default=False): bool,
            p.Optional("title_id"): str,
        },
        "journal/calendar/get": {**scoped, p.Required("viewing_id"): str},
        "journal/sessions": {**scoped, p.Required("viewing_id"): str},
        "journal/metadata/preview": scoped,
        "journal/metadata/repair": {
            **mutations,
            p.Required("token"): str,
            p.Required("confirmation"): str,
        },
        "now_playing": scoped,
        "library/info": scoped,
        "library/list": {**scoped, p.Optional("filters", default={}): dict},
        "library/sync": scoped,
        "library/collections/targets": {
            **scoped,
            p.Required("title_id"): str,
            p.Required("revision"): int,
        },
        "library/collections/add": {
            **mutations,
            p.Required("title_id"): str,
            p.Required("collection"): str,
            p.Required("revision"): int,
        },
        "library/collections/check": mutations,
        "library/collections/acknowledge": {
            **mutations,
            p.Required("confirmation"): str,
        },
        "library/versions": {
            **scoped,
            p.Required("title_id"): str,
            p.Optional("offset", default=0): int,
            p.Optional("revision"): int,
        },
        "library/viewing": {**scoped, p.Required("viewing_id"): str},
        "library/purchases/summary": scoped,
        "library/viewings": {
            **scoped,
            p.Required("title_id"): str,
            p.Optional("query", default=""): str,
            p.Optional("status"): str,
            p.Optional("limit", default=25): int,
            p.Optional("cursor"): str,
            p.Optional("sort", default="completed_at"): str,
            p.Optional("descending", default=True): bool,
            p.Optional("fuzzy", default=False): bool,
        },
        "library/suggest": {
            **scoped,
            p.Required("field"): str,
            p.Optional("query", default=""): str,
            p.Optional("fuzzy", default=False): bool,
        },
        "library/search": {
            **scoped,
            p.Optional("query", default=""): str,
            p.Optional("fuzzy", default=True): bool,
        },
        "ui/preferences/get": {**scoped, p.Optional("area", default="library"): str},
        "ui/shared/get": scoped,
        "ui/preferences/update": {
            **mutations,
            p.Optional("area", default="library"): str,
            p.Required("revision"): int,
            p.Required("patch"): dict,
        },
        "ui/shared/update": {
            **mutations,
            p.Required("revision"): int,
            p.Required("patch"): dict,
        },
        "settings/start": scoped,
        "calendar/status": scoped,
        "calendar/sync": {
            **mutations,
            p.Required("fingerprint"): str,
            p.Required("confirmation"): str,
        },
        "calendar/cancel": {**scoped, p.Required("job_id"): str},
        "settings/submit": {
            **scoped,
            p.Required("flow_id"): str,
            p.Required("data"): dict,
        },
        "settings/cancel": {**scoped, p.Required("flow_id"): str},
        "database/import": {
            **mutations,
            p.Required("plan_id"): str,
            p.Required("revision"): int,
            p.Required("selected"): [str],
        },
        "database/mutate": {**mutations, p.Required("data"): dict},
        "database/import/search": {
            **scoped,
            p.Required("plan_id"): str,
            p.Required("revision"): int,
            p.Required("purchase_key"): str,
            p.Required("query"): str,
        },
        "database/import/match": {
            **scoped,
            p.Required("plan_id"): str,
            p.Required("revision"): int,
            p.Required("purchase_key"): str,
            p.Required("title_id"): p.Any(str, None),
        },
        "database/validate_query": {
            **scoped,
            p.Required("table"): str,
            p.Required("query"): str,
        },
        "database/inspect": {
            **scoped,
            p.Required("table"): str,
            p.Optional("offset", default=0): int,
            p.Optional("revision"): int,
            p.Optional("limit", default=25): int,
            p.Optional("query", default=""): str,
            p.Optional("sort"): str,
            p.Optional("descending", default=False): bool,
        },
        "database/purge": {
            **mutations,
            p.Required("expected_revision"): int,
            p.Required("viewing_ids"): [str],
            p.Required("all"): bool,
            p.Required("confirmation"): str,
        },
        "database/update": {
            **mutations,
            p.Required("viewing_id"): str,
            p.Required("expected_revision"): int,
            p.Required("patch"): dict,
        },
        "journal/list": {
            **scoped,
            p.Optional("query"): str,
            p.Optional("status"): str,
            p.Optional("limit"): int,
            p.Optional("cursor"): str,
            p.Optional("sort"): str,
            p.Optional("descending"): bool,
            p.Optional("fuzzy"): bool,
        },
        "journal/update": {
            **mutations,
            p.Required("viewing_id"): str,
            p.Required("expected_revision"): int,
            p.Required("patch"): dict,
        },
        "journal/delete": {
            **mutations,
            p.Required("viewing_id"): str,
            p.Required("expected_revision"): int,
        },
    }
    for operation, properties in schemas.items():
        command = f"{DOMAIN}/{operation}"
        websocket_api.async_register_command(
            hass,
            command,
            websocket_api.async_response(async_handle),
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
                {p.Required("type"): command, **properties}
            ),
        )


async def async_handle(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Reject unauthorized calls before reading private metadata or storage."""
    user = connection.user
    operation = msg["type"].removeprefix(f"{DOMAIN}/")
    admin = is_active_admin(user)
    if not is_active_user(user) or (operation not in USER_OPERATIONS and not admin):
        connection.send_error(
            msg["id"], "unauthorized", "Access to this journal operation is denied"
        )
        return
    try:
        if operation == "info":
            entries = []
            for entry_id, runtime in loaded_runtimes(hass):
                metadata = await runtime.repository.async_info()
                if not runtime.ready:
                    continue
                if not admin:
                    metadata = {
                        key: metadata[key]
                        for key in ("dataset_id", "revision", "viewing_count")
                    }
                entry = hass.config_entries.async_get_entry(entry_id)
                library_enabled = bool(
                    runtime.library is not None
                    and entry is not None
                    and (entry.options or entry.data).get("library_enabled", False)
                )
                entries.append(
                    {
                        "entry_id": entry_id,
                        **metadata,
                        "api_version": 1,
                        "library_enabled": library_enabled,
                        "ui_defaults": public_defaults(
                            dict(entry.options or entry.data) if entry else {}
                        ),
                        "permissions": {
                            "read": True,
                            "edit": admin,
                            "export": admin,
                        },
                        **(
                            {
                                "tracking_enabled": runtime.observer is not None,
                                "features": {
                                    "manual_journal": True,
                                    "automatic_tracking": True,
                                    "now_playing": True,
                                    "settings": True,
                                    "database_maintenance": True,
                                    "import": True,
                                    "library": True,
                                },
                            }
                            if admin
                            else {}
                        ),
                    }
                )
            result = {"entries": entries}
        else:
            runtime = get_runtime(hass, msg["entry_id"], msg["dataset_id"])
            repository = runtime.repository
            match operation:
                case (
                    "library/info"
                    | "library/list"
                    | "library/sync"
                    | "library/versions"
                    | "library/suggest"
                    | "library/search"
                    | "library/viewing"
                    | "library/viewings"
                    | "library/purchases/summary"
                    | "library/collections/targets"
                    | "library/collections/add"
                    | "library/collections/check"
                    | "library/collections/acknowledge"
                ):
                    library = get_library(hass, msg["entry_id"], runtime)
                    entry = hass.config_entries.async_get_entry(msg["entry_id"])
                    excluded = await repository.async_hidden_collections()
                    if operation.startswith("library/collections/"):
                        config_key = fingerprint(entry)
                        adding = operation in {
                            "library/collections/add",
                            "library/collections/targets",
                        }

                        def authorize():
                            if not is_active_admin(user):
                                raise JournalError(
                                    "unauthorized", "Administrator access changed"
                                )
                            current = get_runtime(
                                hass, msg["entry_id"], msg["dataset_id"]
                            )
                            if (
                                current is not runtime
                                or get_library(hass, msg["entry_id"], current)
                                is not library
                            ):
                                raise JournalError("not_ready", "Library reloaded")
                            config = hass.config_entries.async_get_entry(
                                msg["entry_id"]
                            )
                            if fingerprint(config) != config_key:
                                raise JournalError(
                                    "not_ready", "Library settings changed"
                                )
                            config = dict(config.options or config.data)
                            if origin(config.get("library_host", "")) != library.origin:
                                raise JournalError(
                                    "not_ready", "Library origin changed"
                                )
                            if adding and not (
                                config.get("library_allow_collection_add", False)
                                and config.get("library_sync_collections", True)
                            ):
                                raise JournalError(
                                    "collection_disabled",
                                    "Enable collection additions and collection sync "
                                    "in Settings",
                                )

                        authorize()
                        if operation == "library/collections/targets":
                            result = await library.async_collection_targets(
                                msg["title_id"], msg["revision"], excluded, authorize
                            )
                        elif operation == "library/collections/add":
                            result = await library.async_collection_add(
                                msg["request_id"],
                                msg["title_id"],
                                msg["collection"],
                                msg["revision"],
                                user.id,
                                excluded,
                                authorize,
                            )
                        else:
                            acknowledge = None
                            if operation.endswith("/acknowledge"):
                                if msg["confirmation"] != "ACKNOWLEDGE":
                                    raise JournalError(
                                        "invalid_request",
                                        "Acknowledgment does not match",
                                    )
                                acknowledge = user.id
                            result = await library.async_collection_check(
                                msg["request_id"], authorize, acknowledge
                            )
                        authorize()
                    elif operation == "library/sync":
                        library.request_sync()
                        result = {"accepted": True}
                    elif operation == "library/info":
                        metadata = await repository.async_library_info(
                            library.source, excluded
                        )
                        result = (
                            {
                                **metadata,
                                **library.status(),
                                "collection_add_enabled": bool(
                                    (entry.options or entry.data).get(
                                        "library_allow_collection_add", False
                                    )
                                    and (entry.options or entry.data).get(
                                        "library_sync_collections", True
                                    )
                                ),
                                "pending_adds": (
                                    await repository.async_collection_snapshot(
                                        library.source
                                    )
                                )["pending"],
                            }
                            if admin
                            else {
                                key: metadata[key]
                                for key in (
                                    "title_count",
                                    "group_count",
                                    "name_count",
                                    "preferences_key",
                                    "collection_count",
                                    "revision",
                                    "last_synced_at",
                                    "collections_synced_at",
                                )
                            }
                        )
                    elif operation == "library/purchases/summary":
                        result = await repository.async_purchase_totals(library.source)
                    elif operation == "library/viewing":
                        result = await repository.async_viewing_library(
                            library.source, msg["viewing_id"]
                        )
                    elif operation == "library/viewings":
                        result = await repository.async_list(
                            query=msg["query"],
                            viewing_status=msg.get("status"),
                            limit=msg["limit"],
                            cursor=msg.get("cursor"),
                            sort=msg["sort"],
                            descending=msg["descending"],
                            fuzzy=msg["fuzzy"],
                            library_scope=(library.source, msg["title_id"]),
                        )
                        if not admin:
                            result["items"] = [
                                public_viewing(row) for row in result["items"]
                            ]
                    elif operation == "library/search":
                        result = await repository.async_library_search(
                            library.source, msg["query"], excluded, msg["fuzzy"]
                        )
                    elif operation == "library/suggest":
                        result = await repository.async_library_suggest(
                            library.source, msg["field"], msg["query"], msg["fuzzy"]
                        )
                    elif operation == "library/versions":
                        result = await repository.async_library_versions(
                            library.source,
                            msg["title_id"],
                            msg["offset"],
                            msg.get("revision"),
                            excluded,
                            admin=admin,
                        )
                    else:
                        result = await repository.async_library_list(
                            library.source, msg["filters"], excluded
                        )
                case "ui/preferences/get" | "ui/shared/get":
                    result = await repository.async_ui_preferences(
                        user.id,
                        operation.startswith("ui/shared/"),
                        msg.get("area", "library"),
                    )
                case "ui/preferences/update" | "ui/shared/update":
                    result = await repository.async_ui_preferences_update(
                        user.id,
                        operation.startswith("ui/shared/"),
                        msg["request_id"],
                        msg["revision"],
                        msg["patch"],
                        msg.get("area", "library"),
                    )
                case "journal/create":
                    library = get_library(hass, msg["entry_id"], runtime)
                    result = await repository.async_create_from_library(
                        msg["request_id"], library.source, msg["data"], actor_id=user.id
                    )
                case "journal/metadata/preview" | "journal/metadata/repair":
                    library = get_library(hass, msg["entry_id"], runtime)
                    if operation == "journal/metadata/preview":
                        result = await repository.async_metadata_preview(library.source)
                    else:
                        if msg["confirmation"] != "REPAIR METADATA":
                            raise JournalError(
                                "invalid_request", "Confirm the metadata repair"
                            )
                        result = await repository.async_metadata_repair(
                            library.source, msg["request_id"], user.id, msg["token"]
                        )
                case "calendar/status" | "calendar/sync" | "calendar/cancel":
                    if runtime.calendar is None:
                        raise JournalError(
                            "not_ready", "Calendar publisher is not loaded"
                        )
                    history = runtime.calendar.history
                    if operation == "calendar/status":
                        result = await history.status()
                    elif operation == "calendar/sync":
                        if msg["confirmation"] != "EXPORT JOURNAL":
                            raise JournalError(
                                "invalid_request", "Confirm the calendar export"
                            )

                        def authorized():
                            return (
                                is_active_admin(user)
                                and runtime.ready
                                and getattr(
                                    hass.config_entries.async_get_entry(
                                        msg["entry_id"]
                                    ),
                                    "runtime_data",
                                    None,
                                )
                                is runtime
                            )

                        result = await history.start(
                            msg["request_id"], user.id, msg["fingerprint"], authorized
                        )
                    else:
                        await history.cancel(msg["job_id"])
                        result = await history.status()
                case "settings/start" | "settings/submit" | "settings/cancel":
                    result = await options_request(
                        hass,
                        hass.config_entries.async_get_entry(msg["entry_id"]),
                        user.id,
                        operation,
                        msg,
                    )
                case "database/mutate":
                    result = await repository.async_database_mutate(
                        msg["request_id"], msg["data"], user.id
                    )
                case "database/validate_query":
                    result = await repository.async_database_validate_query(
                        msg["table"], msg["query"]
                    )
                case "database/inspect":
                    result = await repository.async_inspect(
                        msg["table"],
                        msg["offset"],
                        msg.get("revision"),
                        limit=msg["limit"],
                        query=msg["query"],
                        sort=msg.get("sort"),
                        descending=msg["descending"],
                    )
                case (
                    "database/import"
                    | "database/import/search"
                    | "database/import/match"
                ):
                    entry = hass.config_entries.async_get_entry(msg["entry_id"])
                    if runtime.observer is not None or (
                        entry.options or entry.data
                    ).get("tracking_enabled"):
                        raise JournalError(
                            "tracking_enabled", "Disable recording before importing"
                        )
                    if operation == "database/import/search":
                        result = await repository.async_import_match_search(
                            msg["plan_id"],
                            msg["revision"],
                            msg["purchase_key"],
                            msg["query"],
                            user.id,
                        )
                    elif operation == "database/import/match":
                        result = await repository.async_import_match(
                            msg["plan_id"],
                            msg["revision"],
                            msg["purchase_key"],
                            msg["title_id"],
                            user.id,
                        )
                    else:
                        result = await repository.async_import_apply(
                            msg["request_id"],
                            msg["plan_id"],
                            msg["revision"],
                            msg["selected"],
                            actor_id=user.id,
                        )
                case "database/purge":
                    entry = hass.config_entries.async_get_entry(msg["entry_id"])
                    if runtime.observer is not None or (
                        entry.options or entry.data
                    ).get("tracking_enabled"):
                        raise JournalError(
                            "tracking_enabled",
                            "Disable automatic tracking before purging",
                        )
                    result = await repository.async_purge(
                        msg["request_id"],
                        msg["expected_revision"],
                        msg["viewing_ids"],
                        msg["all"],
                        msg["confirmation"],
                        actor_id=user.id,
                    )
                case "journal/calendar" | "journal/calendar/get":
                    entry = hass.config_entries.async_get_entry(msg["entry_id"])
                    enabled = entry is not None and (entry.options or entry.data).get(
                        "library_enabled", False
                    )
                    library = (
                        get_library(hass, msg["entry_id"], runtime) if enabled else None
                    )
                    source = library.source if library else None
                    if operation.endswith("/get"):
                        result = await repository.async_calendar_details(
                            msg["viewing_id"], source
                        )
                    else:
                        result = await repository.async_calendar_month(
                            msg["start"],
                            msg["end"],
                            msg["query"],
                            msg.get("status"),
                            msg["fuzzy"],
                            source,
                            msg.get("title_id"),
                        )
                case "journal/get":
                    result = await repository.async_get(msg["viewing_id"])
                    if not admin:
                        result = public_viewing(result)
                case "journal/sessions":
                    result = await repository.async_sessions(msg["viewing_id"])
                case "now_playing":
                    if runtime.observer and any(
                        not user.permissions.check_entity(entity_id, POLICY_READ)
                        for entity_id in runtime.observer.entities.values()
                        if entity_id
                    ):
                        raise JournalError(
                            "unauthorized", "Source entity access denied"
                        )
                    result = {
                        "players": [runtime.observer.live_state()]
                        if runtime.observer
                        else []
                    }
                case "journal/list":
                    result = await repository.async_list(
                        query=msg.get("query", ""),
                        viewing_status=msg.get("status"),
                        limit=msg.get("limit", 50),
                        cursor=msg.get("cursor"),
                        sort=msg.get("sort", "completed_at"),
                        descending=msg.get("descending", True),
                        fuzzy=msg.get("fuzzy", False),
                    )
                    if not admin:
                        result["items"] = [
                            public_viewing(row) for row in result["items"]
                        ]
                case "journal/update" | "database/update":
                    result = await repository.async_update(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                        msg["patch"],
                        actor_id=user.id,
                        include_deleted=operation == "database/update",
                    )
                case "journal/delete":
                    result = await repository.async_delete(
                        msg["request_id"],
                        msg["viewing_id"],
                        msg["expected_revision"],
                        actor_id=user.id,
                    )
                case _:
                    raise JournalError("invalid_request", "Unknown journal command")
        # Accepted writes still commit; do not disclose private results if access
        # changed while the worker was running.
        if not is_active_user(user) or is_active_admin(user) != admin:
            connection.send_error(
                msg["id"], "unauthorized", "Journal access changed during the request"
            )
            return
        if operation not in {"info", "settings/submit"} and not runtime.ready:
            raise JournalError("not_ready", "Journal integration unloaded")
        if (
            operation.startswith("database/import")
            and get_runtime(hass, msg["entry_id"], msg["dataset_id"]) is not runtime
        ):
            raise JournalError("not_ready", "Journal integration reloaded")
        if (
            operation.startswith(("library/", "journal/metadata/"))
            or operation == "journal/create"
        ) and get_library(hass, msg["entry_id"], runtime) is not library:
            raise JournalError("not_ready", "Library integration reloaded")
        if operation.startswith("journal/calendar") and library is not None:
            if get_library(hass, msg["entry_id"], runtime) is not library:
                raise JournalError("not_ready", "Library integration reloaded")
        connection.send_result(msg["id"], result)
    except JournalError as error:
        connection.send_error(msg["id"], error.code, str(error))

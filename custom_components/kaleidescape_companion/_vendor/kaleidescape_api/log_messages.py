"""Static diagnostic explanations and bounded exception classification.

Never format exception messages/arguments, URLs, identifiers or traceback text.
"""

import re
import sqlite3
import sys
from enum import StrEnum


class Reason(StrEnum):
    PROVIDER_IMAGE_HEADER = "provider_image_header"
    PROVIDER_IMAGE_INVALID = "provider_image_invalid"
    PROVIDER_IMAGE_NORMALIZED = "provider_image_normalized"
    DASHBOARD_PREFLIGHT = "dashboard_preflight"
    DASHBOARD_READY = "dashboard_ready"
    DASHBOARD_LOVELACE = "dashboard_lovelace"
    DASHBOARD_LIBRARY = "dashboard_library"
    DASHBOARD_CONTROLS_DISABLED = "dashboard_controls_disabled"
    DASHBOARD_CONTROLS_RUNTIME = "dashboard_controls_runtime"
    DASHBOARD_CONTROL_HOST = "dashboard_control_host"
    DASHBOARD_DEFAULT_PLAYER = "dashboard_default_player"
    DASHBOARD_SOURCE = "dashboard_source"
    DASHBOARD_JOURNAL = "dashboard_journal"

    PROVIDER_DESTINATION = "provider_destination"
    PROVIDER_CONTENT_TYPE = "provider_content_type"
    PROVIDER_ENCODING = "provider_encoding"
    PROVIDER_RESPONSE_TOO_LARGE = "provider_response_too_large"
    PROVIDER_HTTP_ERROR = "provider_http_error"
    PROVIDER_ACCESS_DENIED = "provider_access_denied"
    PROVIDER_RATE_LIMITED = "provider_rate_limited"
    PROVIDER_ARTWORK_UNAVAILABLE = "provider_artwork_unavailable"
    PROVIDER_DISABLED = "provider_disabled"
    METADATA_APPLY = "metadata_apply"
    METADATA_IMAGE = "metadata_image"
    METADATA_COMMIT = "metadata_commit"
    METADATA_SAVED = "metadata_saved"
    METADATA_CANCELLED = "metadata_cancelled"
    PENDING_WRITE = "pending_write"
    WRITE_UNCONFIRMED = "write_unconfirmed"
    WRITE_VERIFIED = "write_verified"
    NOT_VISIBLE = "not_visible"
    AMBIGUOUS = "ambiguous"
    SNAPSHOT_CHANGED = "snapshot_changed"
    REMOTE_CHANGED = "remote_changed"
    READ_INCOMPLETE = "read_incomplete"
    REQUEST_ACCEPTED = "request_accepted"
    ACKNOWLEDGED = "acknowledged"
    SCHEMA_MISMATCH = "schema_mismatch"
    PAUSED = "paused"
    USER_ACTION = "user_action"
    JOURNAL_WRITE = "journal_write"
    JOURNAL_SAVED = "journal_saved"
    JOURNAL_QUEUED = "journal_queued"
    REQUEST_REPLAYED = "request_replayed"
    RECONCILE_READ = "reconcile_read"
    LINK_FOUND = "link_found"
    MATCH_FOUND = "match_found"
    NO_LINK = "no_link"
    CONTENT_CHANGED = "content_changed"
    CONTENT_MATCHED = "content_matched"
    UPDATE_UNSUPPORTED = "update_unsupported"
    CLEANUP_DEFERRED = "cleanup_deferred"
    CLEANUP_READY = "cleanup_ready"
    PREFLIGHT_READ = "preflight_read"
    READ_BACK = "read_back"
    APPLY_WRITE = "apply_write"
    LINK_SAVED = "link_saved"


class Trigger(StrEnum):
    USER_REQUEST = "user_request"
    JOURNAL_CHANGED = "journal_changed"
    OBSERVATION = "observation"
    SCHEDULED = "scheduled"
    STARTUP = "startup"
    MANUAL_SYNC = "manual_sync"
    RECOVERY = "recovery"
    LIBRARY_SYNC = "library_sync"
    DEVICE_EVENT = "device_event"


class Stage(StrEnum):
    VALIDATION = "validation"
    READ = "read"
    PREFLIGHT = "preflight"
    WRITE = "write"
    VERIFICATION = "verification"
    RECEIPT = "receipt"
    RECONCILE = "reconcile"
    UNCONFIRMED = "unconfirmed"


REASONS = {
    "provider_image_header": (
        "The image endpoint returned a content type outside the supported "
        "raster/binary allowlist. The response was rejected before "
        "caching."
    ),
    "provider_image_invalid": (
        "The image response did not have a supported JPEG, PNG or WebP "
        "signature. The response was rejected before caching."
    ),
    "provider_image_normalized": (
        "The image response used a generic or mismatched raster MIME "
        "type. Using the verified JPEG, PNG or WebP signature for storage "
        "and delivery."
    ),
    "dashboard_preflight": (
        "Checking saved dashboard prerequisites without starting device "
        "or provider requests."
    ),
    "dashboard_ready": (
        "Saved dashboard prerequisites passed. Preparing the test guide."
    ),
    "dashboard_lovelace": (
        "Test dashboard prerequisite failed: HA Lovelace dashboards are not loaded."
    ),
    "dashboard_library": (
        "Test dashboard prerequisite failed: Library is disabled, "
        "unavailable, or has no successful nonempty cached catalog."
    ),
    "dashboard_controls_disabled": (
        "Test dashboard prerequisite failed: playback controls are "
        "disabled in the saved configuration."
    ),
    "dashboard_controls_runtime": (
        "Test dashboard prerequisite failed: the playback control runtime "
        "is not loaded."
    ),
    "dashboard_control_host": (
        "Test dashboard prerequisite failed: the control hostname "
        "configuration is invalid. Blank hostnames are supported through "
        "the normal default."
    ),
    "dashboard_default_player": (
        "Test dashboard prerequisite failed: no default player is saved."
    ),
    "dashboard_source": (
        "Test dashboard prerequisite failed: no existing HA media-player "
        "source matches the configured observation/default player."
    ),
    "dashboard_journal": (
        "Test dashboard prerequisite failed: the Journal contains no non- "
        "deleted viewing."
    ),
    "provider_destination": (
        "The provider request destination or path failed the network "
        "allowlist checks. No request was sent to that destination."
    ),
    "provider_content_type": (
        "The provider returned an unsupported content type or the image "
        "bytes did not match that type."
    ),
    "provider_encoding": (
        "The provider returned compressed content despite requesting an "
        "uncompressed response."
    ),
    "provider_response_too_large": (
        "The provider response exceeded the download size limit."
    ),
    "provider_http_error": (
        "The provider returned an unsuccessful HTTP response. Check the "
        "preceding HTTP status event."
    ),
    "provider_access_denied": (
        "The provider denied access. Check the scraper credentials and permissions."
    ),
    "provider_rate_limited": (
        "The provider rate limit was reached. Wait before trying again."
    ),
    "provider_artwork_unavailable": (
        "The selected image is no longer available from this provider."
    ),
    "provider_disabled": "The required provider or artwork feature is disabled.",
    "metadata_apply": (
        "Applying the reviewed metadata and selected images; downloading "
        "selected images before the database write."
    ),
    "metadata_image": (
        "Downloading a selected review image. Image identities are private aliases."
    ),
    "metadata_commit": (
        "Selected images were retrieved. Submitting the reviewed change "
        "to the database worker."
    ),
    "metadata_saved": (
        "The reviewed metadata and image references committed successfully."
    ),
    "metadata_cancelled": (
        "The review was closed. Cancelled its outstanding provider work "
        "and removed the preview; an accepted database write may still "
        "finish."
    ),
    "user_action": "An authenticated user requested this operation.",
    "journal_write": "Writing a journal change to the database.",
    "journal_saved": "The journal change committed to the database.",
    "journal_queued": (
        "The journal changed. Full Sync will reconcile its linked calendar event "
        "on the next pass."
    ),
    "request_replayed": "This request already committed; returning its stored result.",
    "reconcile_read": "Reading calendar events to compare them with the journal.",
    "link_found": "Located the prior calendar event using the saved viewing link.",
    "match_found": (
        "Located a calendar event by matching its title and time interval; "
        "adopt its link."
    ),
    "no_link": (
        "No prior linked or matching event was found in the maintained window. "
        "A new calendar event is needed."
    ),
    "content_changed": "The linked event differs from the journal; reconcile it.",
    "content_matched": "The calendar event already matches; no remote write is needed.",
    "update_unsupported": (
        "The provider does not support editing events in place. Create and verify "
        "a replacement, then quarantine the prior event for guarded cleanup."
    ),
    "cleanup_deferred": (
        "Unmatched or replaced events are awaiting cleanup. Deletion requires two "
        "unchanged scans at least ten minutes apart; journal or event changes "
        "restart that grace period."
    ),
    "cleanup_ready": (
        "The cleanup grace period passed; recheck the event before deletion."
    ),
    "preflight_read": (
        "Locate the prior event and check it is unchanged before modifying it."
    ),
    "read_back": "Read back the requested change to verify the provider applied it.",
    "apply_write": "Apply the requested change to the selected calendar event.",
    "link_saved": "Saved the relationship between the viewing and calendar event.",
    "pending_write": (
        "An earlier write is unconfirmed. Further writes are blocked until it"
        " is inspected and acknowledged."
    ),
    "write_unconfirmed": (
        "The request may have reached the provider. Its result is "
        "unconfirmed; it will not be retried automatically."
    ),
    "write_verified": "The requested change was read back and verified.",
    "not_visible": (
        "The requested change is not visible in the provider response yet. "
        "Verification reads do not repeat the write."
    ),
    "ambiguous": (
        "More than one matching result was returned. A unique result is "
        "required to confirm the write."
    ),
    "snapshot_changed": (
        "The local records changed during synchronization. The pass stopped "
        "before further writes."
    ),
    "remote_changed": (
        "The remote record changed after it was read. It was not overwritten."
    ),
    "read_incomplete": (
        "The remote results could not be read completely. Cleanup must wait "
        "for a complete read."
    ),
    "request_accepted": (
        "The background request was accepted. Completion will be reported separately."
    ),
    "acknowledged": (
        "The administrator acknowledged the unconfirmed write after review. "
        "This does not confirm that the write succeeded."
    ),
    "schema_mismatch": (
        "The input fields do not match the expected API contract. Check the "
        "adapter and provider compatibility."
    ),
    "paused": (
        "The operation is paused because its configuration, availability or "
        "access changed."
    ),
}
FAILURES = {
    "timeout": "The operation exceeded its time limit.",
    "connection": "The connection could not be established or was interrupted.",
    "rejected": "The destination rejected the request.",
    "validation": "The input or returned data failed validation.",
    "cancelled": "The operation was cancelled.",
    "provider": (
        "The provider raised an unclassified error. Its original text is "
        "withheld for privacy."
    ),
    "unknown": (
        "The failure could not be classified safely; its original text is "
        "withheld for privacy."
    ),
    "unsupported": "The destination does not implement this operation.",
    "missing_field": (
        "A required field is missing. Check the API adapter's input mapping "
        "and the returned data schema."
    ),
    "invalid_type": (
        "A value or function argument has an unexpected type. Check the API contract."
    ),
    "missing_attribute": (
        "An expected API attribute or method is unavailable. Check "
        "provider/version compatibility."
    ),
    "authorization": "Access was denied or authentication is no longer valid.",
    "rate_limit": (
        "The destination is rate limiting requests. Wait before requesting "
        "another pass."
    ),
    "storage": "Local storage could not complete the operation.",
    "conflict": (
        "The resource changed or conflicted with an existing operation. "
        "Refresh before retrying."
    ),
}
SUBSYSTEMS = {
    "api.transport": "Protocol connection",
    "api.protocol": "Device protocol",
    **{
        name: name.capitalize()
        for name in (
            "database",
            "calendar",
            "library",
            "artwork",
            "metadata",
            "playback",
            "observer",
            "settings",
            "import",
            "export",
            "backup",
            "application",
        )
    },
}
OPERATIONS = {
    "connect",
    "disconnect",
    "request",
    "read",
    "write",
    "sync",
    "scan",
    "scrape",
    "discover",
    "control",
    "create",
    "update",
    "delete",
    "import",
    "export",
    "configure",
    "acknowledge",
    "verify",
    "record",
    "clear",
    "pause",
    "resume",
}
OUTCOMES = {
    "started",
    "succeeded",
    "failed",
    "uncertain",
    "rejected",
    "retry",
    "skipped",
    "changed",
    "unavailable",
    "overflow",
    "mismatch",
    "accepted",
}

TRIGGERS = {
    "user_request": "a user request",
    "journal_changed": "a journal change",
    "observation": "observed playback",
    "scheduled": "a scheduled pass",
    "startup": "startup",
    "manual_sync": "a manual sync request",
    "recovery": "recovery of an earlier attempt",
    "library_sync": "a library scan",
    "device_event": "unsolicited device activity",
}
ALIAS = re.compile(r"[a-z_]+-[0-9a-f]{24}")


def describe(row):
    """Human-readable text from positive codes and safe measurements only."""
    subsystem = SUBSYSTEMS.get(row.get("logger"), "Operation")
    operation = (
        row.get("operation") if row.get("operation") in OPERATIONS else "operation"
    )
    outcome = row.get("outcome") if row.get("outcome") in OUTCOMES else "recorded"
    message = f"{subsystem}: {operation} {outcome}."
    # Only logger-created keyed aliases may enter readable messages.
    for key, label in (
        ("actor", "User"),
        ("resource", "Resource"),
        ("related", "Linked record"),
    ):
        value = row.get(key)
        if key == "related" and value == row.get("resource"):
            continue
        if isinstance(value, str) and ALIAS.fullmatch(value):
            message += f" {label}: {value}."
    trigger = TRIGGERS.get(row.get("trigger"))
    if trigger:
        message += f" Triggered by {trigger}."
    reason = REASONS.get(row.get("reason"))
    if reason:
        message += " " + reason
    failure = FAILURES.get(row.get("failure"))
    if failure:
        message += " " + failure
    check = row.get("check")
    if check in {
        "identity",
        "interval",
        "content",
        "bounds",
        "capability",
        "configuration",
        "revision",
    }:
        message += f" Check: {check}."
    if outcome == "mismatch":
        changed = [
            name
            for key, name in (
                ("title_match", "title"),
                ("interval_match", "time interval"),
                ("description_match", "description"),
            )
            if row.get(key) is False
        ]
        if changed:
            message += " Different: " + ", ".join(changed) + "."
    for key, label in (
        ("status", "Response code"),
        ("count", "Count"),
        ("attempt", "Attempt"),
        ("elapsed_ms", "Elapsed milliseconds"),
        ("revision", "Record revision"),
    ):
        value = row.get(key)
        if type(value) is int and 0 <= value <= 10**12:
            message += f" {label}: {value}."
    stage = row.get("stage")
    if stage in {s.value for s in Stage}:
        message += f" Stage: {stage}."
    return message


def classify(error):
    """Classify a bounded cause chain by types/status only; never stringify it."""
    result, status, seen = "provider", None, set()
    for _ in range(5):
        if not isinstance(error, BaseException) or id(error) in seen:
            break
        seen.add(id(error))
        try:
            code = getattr(error, "status", None)
            if type(code) is int and 100 <= code <= 599:
                status = code
        except Exception:
            pass
        for kind, label in (
            (TimeoutError, "timeout"),
            (PermissionError, "authorization"),
            (NotImplementedError, "unsupported"),
            (KeyError, "missing_field"),
            (TypeError, "invalid_type"),
            (AttributeError, "missing_attribute"),
            (sqlite3.Error, "storage"),
            (ConnectionError, "connection"),
            (OSError, "connection"),
            (ValueError, "validation"),
        ):
            if isinstance(error, kind):
                result = label
                break
        error = error.__cause__ or error.__context__
    if status in (401, 403):
        result = "authorization"
    elif status == 429:
        result = "rate_limit"
    elif status == 409:
        result = "conflict"
    return result, status


MODULE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*")


def source_location(packages, stacklevel):
    """Only package-relative code locations, never the machine's absolute path."""
    frame = None
    try:
        frame = sys._getframe(stacklevel + 1)
        module = frame.f_globals.get("__name__", "")
        if (
            not isinstance(module, str)
            or len(module) > 256
            or not MODULE.fullmatch(module)
            or not any(module == p or module.startswith(p + ".") for p in packages)
        ):
            return "external", frame.f_lineno
        suffix = (
            "/__init__.py"
            if frame.f_code.co_filename.endswith("__init__.py")
            else ".py"
        )
        return module.replace(".", "/") + suffix, frame.f_lineno
    except ValueError:
        return "external", 0
    finally:
        del frame

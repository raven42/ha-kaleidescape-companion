"""Install and inspect Companion's fixed HA automation blueprints."""

import hashlib
import json
import logging
import os
import re
import stat
from dataclasses import asdict, is_dataclass
from pathlib import Path

from homeassistant.components import persistent_notification
from homeassistant.components.blueprint.errors import FileAlreadyExists
from homeassistant.components.blueprint.models import Blueprint
from homeassistant.components.blueprint.schemas import BLUEPRINT_SCHEMA
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import yaml as yaml_util

from ..core.logging import safe_exception
from ..core.models import JournalError
from ..core.security import async_finish_cleanup

_LOGGER = logging.getLogger(__name__)
TEMPLATES = {
    "purchase_email": "purchase_email_parser.yaml",
    "library_schedule": "library_schedule.yaml",
    "metadata_schedule": "metadata_schedule.yaml",
    "calendar_schedule": "calendar_schedule.yaml",
}
LABELS = {
    "purchase_email": "Purchase receipt email",
    "library_schedule": "Schedule library sync",
    "metadata_schedule": "Schedule metadata refresh",
    "calendar_schedule": "Schedule calendar full sync",
}
# Fingerprints of previously shipped, unmodified blueprints. When changing a
# packaged blueprint, retain its old current fingerprint here for update checks.
KNOWN_OLDER = {
    "purchase_email": frozenset(
        {
            "87fdfb8b207b6871dc3dddba8286af3d4b7c403942b13b5464fd8bf49d5c9979",
            "925bc82fe753e27278c10cd7ec6ba26d5d7e8a38d276717c0ee40e4b5b5bc037",
            "b2f6345aea2b34759dfe4407ae4a00ef6e7ec521139426be21acae84cecff96a",
            "1334182ffcd69152fea57679a9a110d685fbeeaeccab0094e8a8c242409a8304",
            "d7608b1806576d6c738dab89d300ac4e9cd98c7dfdd09e08a005e1ba38d95a0c",
            "c923ea9718cbffcbbf938bc2b209add004b72b9a710604a032cefbf9c7762695",
            "51b8ee74d1f4441987affbbb553265255f364755d9e1977e696fd7246bc884a8",
            "81ec1523ea41bd2f3820bc915d64d8a5aeeab8df36865008b41507496ff0db2c",
        }
    ),
    "library_schedule": frozenset(
        {
            "1d098ae0ff0d3edf33614888b04b68a1a048c07349ae61c72e16a2fc6744c3c8",
            "b969ccc911818b258967091a0ac5c5af4887b87082ce38ce52db32a07b29679b",
        }
    ),
    "metadata_schedule": frozenset(
        {
            "76caadfeef0dc7d53c6666e1ed97566845f1a052bcbaeb322f9f6b34c36c26f3",
            "3645c24b5cdf03ea5c6261e93eee3038c7177bf4c392b1b4d4f9783b9c4204f7",
        }
    ),
    "calendar_schedule": frozenset(
        {
            "56d85434f1e894a7d016c63ea73ec6e3c16f808fa04ad3d9ec8534791c0f9b3d",
            "a47ec1470428fe8da251a59e5c04230f1c0899a2221150e27f7e93cf6b6ae5e0",
        }
    ),
}
# These fingerprints also make future template changes visible to tests.
CURRENT = {
    "purchase_email": (
        "95c87fe455c812fb0fa439cae5e1aa7d98a11343086aac4b1b059016b7b94707"
    ),
    "library_schedule": (
        "46dc751ba272241dcc67768b0fe4ba8ed994088696339e0d27ab5f203e91a43b"
    ),
    "metadata_schedule": (
        "fc6df261c7171aaa8d64105fd8468c50d06d92a9161376ff5632fb5555e8c858"
    ),
    "calendar_schedule": (
        "89a676ecf055c1df749be97e673b1d79e06e5a9058f8359b0b3f57c12ac48bfd"
    ),
}
MAX_TEMPLATE_BYTES = 128 * 1024
NOTICE_ID = "kaleidescape_companion_blueprints_outdated"
LATEST_VERSION = {kind: 8 if kind == "purchase_email" else 1 for kind in TEMPLATES}


def read_template(kind):
    """Only read packaged, named templates; callers cannot select a path."""
    path = Path(__file__).resolve().parent.parent / "templates" / TEMPLATES[kind]
    content = path.read_text(encoding="utf-8")
    if len(content.encode()) > MAX_TEMPLATE_BYTES:
        raise ValueError("Automation template is too large")
    return {"path": f"kaleidescape_companion/{TEMPLATES[kind]}", "yaml": content}


def _canonical(value):
    # !input objects have a stable semantic identity, independent of YAML format.
    if is_dataclass(value) and value.__class__.__module__.startswith("annotatedyaml"):
        return {"__ha_yaml_tag__": type(value).__name__, **asdict(value)}
    if isinstance(value, dict):
        return {str(key): _canonical(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_canonical(item) for item in value]
    return value


def blueprint(content):
    """Use the same schema as HA's blueprint/save endpoint."""
    return Blueprint(
        yaml_util.parse_yaml(content),
        expected_domain="automation",
        schema=BLUEPRINT_SCHEMA,
    )


def fingerprint(content):
    """Hash normalized blueprint data, ignoring YAML formatting and comments."""
    data = _canonical(blueprint(content).data)
    return hashlib.sha256(
        json.dumps(
            data, sort_keys=True, ensure_ascii=True, separators=(",", ":")
        ).encode()
    ).hexdigest()


def declared_version(content):
    """Read the optional visible version without trusting it as update evidence."""
    description = blueprint(content).data["blueprint"].get("description", "")
    match = re.search(r"\bBlueprint version:\s*(\d{1,6})\b", str(description))
    return int(match[1]) if match else None


def _safe_file(root, filename):
    """Read only an ordinary, bounded file beneath the fixed HA blueprint path."""
    directory = root
    for part in ("blueprints", "automation", "kaleidescape_companion"):
        directory = directory / part
        try:
            info = directory.lstat()
        except FileNotFoundError:
            return None
        if not stat.S_ISDIR(info.st_mode):
            raise ValueError("Blueprint directory is not a regular directory")
    path = directory / filename
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
    except FileNotFoundError:
        return None
    try:
        info = os.fstat(fd)
        if (
            not stat.S_ISREG(info.st_mode)
            or info.st_nlink != 1
            or info.st_size > MAX_TEMPLATE_BYTES
        ):
            raise ValueError("Blueprint file is not an ordinary bounded file")
        with os.fdopen(fd, "rb") as stream:
            fd = -1
            body = stream.read(MAX_TEMPLATE_BYTES + 1)
        if len(body) > MAX_TEMPLATE_BYTES:
            raise ValueError("Blueprint file is too large")
        return body.decode("utf-8")
    finally:
        if fd >= 0:
            os.close(fd)


def scan(root):
    """Compare installed files with known versions without trusting their content."""
    result = {}
    for kind, filename in TEMPLATES.items():
        digest = None
        version = None
        try:
            installed = _safe_file(root, filename)
            if installed is None:
                state = "missing"
            else:
                digest = fingerprint(installed)
                version = declared_version(installed)
                state = (
                    "current"
                    if digest == CURRENT[kind]
                    else "outdated"
                    if digest in KNOWN_OLDER[kind]
                    else "modified"
                )
        except (
            OSError,
            ValueError,
            TypeError,
            UnicodeError,
            RecursionError,
            HomeAssistantError,
        ):
            state = "unavailable"
        result[kind] = {
            "status": state,
            "label": LABELS[kind],
            "revision": digest,
            "installed_version": version,
            "latest_version": LATEST_VERSION[kind],
        }
    return result


def _manager(hass):
    return hass.data.get("blueprint", {}).get("automation")


def _notice(hass, result, *, startup=False):
    outdated = [
        item["label"] for item in result.values() if item["status"] == "outdated"
    ]
    if outdated:
        if startup:
            _LOGGER.warning(
                "Companion automation blueprints are out of date: %s",
                ", ".join(outdated),
            )
        persistent_notification.async_create(
            hass,
            "Updates are available for:\n\n"
            + "\n".join(f"- {label}" for label in outdated)
            + "\n\nOpen Kaleidescape Companion Settings → Home Assistant → "
            "Optional automations "
            "to review and update them.",
            "Kaleidescape Companion blueprints need an update",
            NOTICE_ID,
        )
    elif all(item["status"] != "unavailable" for item in result.values()):
        persistent_notification.async_dismiss(hass, NOTICE_ID)


async def async_status(hass, *, notify=True):
    """Read status from disk, independently of HA's blueprint cache."""
    if _manager(hass) is None:
        return {
            kind: {
                "status": "unavailable",
                "label": LABELS[kind],
                "revision": None,
                "installed_version": None,
                "latest_version": LATEST_VERSION[kind],
            }
            for kind in TEMPLATES
        }
    result = await hass.async_add_executor_job(scan, Path(hass.config.config_dir))
    if notify:
        _notice(hass, result)
    return result


def _updated_notice(hass, kind, *, confirmed):
    message = (
        f"{LABELS[kind]} was updated. Home Assistant reloaded its automations; "
        "review them before relying on the updated behavior."
        if confirmed
        else f"{LABELS[kind]} may have been updated, but the reload was not "
        "confirmed. Inspect the blueprint and its automations."
    )
    persistent_notification.async_create(
        hass,
        message,
        "Companion blueprint updated"
        if confirmed
        else "Companion blueprint update uncertain",
        f"{NOTICE_ID}_{kind}_updated",
    )


async def async_update(hass, kind, revision, authorized):
    """Replace one explicitly reviewed blueprint and notify after HA processes it."""
    manager = _manager(hass)
    if manager is None:
        raise JournalError("not_ready", "Home Assistant automations are unavailable")
    before = await async_status(hass, notify=False)
    item = before[kind]
    if item["status"] not in {"outdated", "modified"} or item["revision"] != revision:
        raise JournalError("conflict", "Blueprint changed; check its status again")
    content = await hass.async_add_executor_job(read_template, kind)
    packaged = await hass.async_add_executor_job(blueprint, content["yaml"])
    if await hass.async_add_executor_job(fingerprint, content["yaml"]) != CURRENT[kind]:
        raise JournalError("not_ready", "Packaged blueprint version is inconsistent")
    latest = await async_status(hass, notify=False)
    if latest[kind]["revision"] != revision or latest[kind]["status"] not in {
        "outdated",
        "modified",
    }:
        raise JournalError("conflict", "Blueprint changed; check its status again")
    if not authorized():
        raise JournalError("unauthorized", "Administrator access changed")

    # Do not abandon an accepted HA write or its notification on disconnect.
    async def commit():
        try:
            await manager.async_add_blueprint(
                packaged, content["path"], allow_override=True
            )
        except Exception as error:
            after = await async_status(hass, notify=False)
            if after[kind]["status"] in {"current", "unavailable"}:
                _updated_notice(hass, kind, confirmed=False)
            raise JournalError(
                "storage_error", "Blueprint update could not be confirmed"
            ) from error
        _updated_notice(hass, kind, confirmed=True)
        return await async_status(hass)

    return await async_finish_cleanup(commit())


async def async_install_missing(hass):
    """Install missing packaged blueprints via HA, never replacing existing files."""
    manager = _manager(hass)
    if manager is None:
        return
    try:
        # Let HA populate its own defaults before creating our subdirectory.
        try:
            await manager.async_populate()
        except FileExistsError:
            # HA may be populating its own defaults at the same time.
            pass
        before = await async_status(hass, notify=False)
        for kind, item in before.items():
            if item["status"] != "missing":
                continue
            content = await hass.async_add_executor_job(read_template, kind)
            packaged = await hass.async_add_executor_job(blueprint, content["yaml"])
            try:
                await manager.async_add_blueprint(packaged, content["path"])
            except FileAlreadyExists:
                pass  # Another HA user or task installed it first.
        result = await async_status(hass, notify=False)
        _notice(hass, result, startup=True)
    except Exception as error:
        _LOGGER.warning(
            "Companion blueprint setup could not finish: %s", safe_exception(error)
        )

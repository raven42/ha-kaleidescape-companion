"""Validate source layout, public metadata and documentation without starting HA."""

import ast
import importlib.util
import json
import re
import sys
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "kaleidescape_companion"
NAME = "Kaleidescape Companion"
INTEGRATION = ROOT / "custom_components" / DOMAIN


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    """Reject duplicate JSON keys rather than silently accepting the last value."""
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path: Path) -> dict:
    """Read project metadata with duplicate-key detection."""
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def read_constants(path: Path) -> dict:
    """Read literal module metadata without importing HA or executing source."""
    values = {}
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    values[target.id] = node.value.value
    return values


def validate_runtime_imports() -> None:
    """Catch stale module paths after feature moves without importing HA or devices."""
    prefix = f"custom_components.{DOMAIN}"
    for path in INTEGRATION.rglob("*.py"):
        module = ".".join(path.relative_to(ROOT).with_suffix("").parts)
        package = module.rsplit(".", 1)[0]
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if not isinstance(node, ast.ImportFrom) or node.module is None:
                continue
            target = (
                importlib.util.resolve_name("." * node.level + node.module, package)
                if node.level
                else node.module
            )
            if target.startswith(prefix + "."):
                location = ROOT.joinpath(*target.split("."))
                if (
                    not location.with_suffix(".py").is_file()
                    and not (location / "__init__.py").is_file()
                ):
                    raise ValueError(
                        f"Unresolved import in {path.relative_to(ROOT)}: {target}"
                    )


def validate() -> None:
    """Check syntax, metadata, identity, local links, and packaged panel presence."""
    for directory in (ROOT / "custom_components", ROOT / "dev"):
        for path in directory.rglob("*.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    validate_runtime_imports()

    # Guard the contributor/security guides against accidental cross-file edits;
    # valid links alone cannot detect one guide replacing another's contents.
    for relative, heading in {
        "docs/policies/policy-security.md": "# Security policy and hardening",
        "docs/design/design-user-interface.md": "# Household journal and management UI",
    }.items():
        if (ROOT / relative).read_text(encoding="utf-8").splitlines()[0] != heading:
            raise ValueError(f"Unexpected documentation title: {relative}")

    manifest = read_json(INTEGRATION / "manifest.json")
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    frontend = read_json(ROOT / "frontend" / "package.json")
    hacs = read_json(ROOT / "hacs.json")
    strings = read_json(INTEGRATION / "strings.json")
    translation = read_json(INTEGRATION / "translations" / "en.json")

    if (
        manifest["domain"] != DOMAIN
        or (ROOT / "custom_components/kaleidescape").exists()
    ):
        raise ValueError("The custom integration must not shadow built-in kaleidescape")
    if (
        manifest["name"] != NAME
        or hacs["name"] != NAME
        or strings["title"] != NAME
        or strings["config"]["step"]["user"]["title"] != NAME
    ):
        raise ValueError(f"Display/project names must be {NAME}")
    if (
        manifest.get("requirements", []) != ["pykaleidescape==1.2.0"]
        or project.get("dependencies", []) != manifest["requirements"]
    ):
        raise ValueError("Runtime dependency must match HA's pykaleidescape pin")
    if project["name"] != "kaleidescape" or frontend["name"] != "kaleidescape":
        raise ValueError("Package names must be kaleidescape")

    constants = read_constants(INTEGRATION / "const.py")
    if constants.get("DOMAIN") != DOMAIN or constants.get("NAME") != NAME:
        raise ValueError("Framework constants must match the manifest")
    if (
        len(
            {
                manifest["version"],
                project["version"],
                frontend["version"],
                constants.get("VERSION"),
            }
        )
        != 1
    ):
        raise ValueError("Project, integration, and frontend versions must match")
    if strings != translation:
        raise ValueError("English setup translation must match strings.json")

    schema = read_constants(INTEGRATION / "core/migrations/__init__.py")[
        "SCHEMA_VERSION"
    ]
    backend_guide = (ROOT / "docs/design/design-journal.md").read_text(encoding="utf-8")
    if f"SQLite schema is `{schema}`" not in backend_guide:
        raise ValueError("Backend guide must document the current SQLite schema")

    lock = read_json(ROOT / "frontend" / "package-lock.json")
    if lock["name"] != frontend["name"] or lock["version"] != frontend["version"]:
        raise ValueError("Frontend lockfile must match package metadata")
    if lock["packages"][""]["dependencies"] != frontend["dependencies"]:
        raise ValueError("Frontend lockfile dependencies are stale")
    if lock["packages"][""]["devDependencies"] != frontend["devDependencies"]:
        raise ValueError("Frontend lockfile development dependencies are stale")
    if lock["packages"][""]["engines"] != frontend["engines"]:
        raise ValueError("Frontend lockfile engine requirements are stale")

    markdown_files = [ROOT / "README.md", ROOT / "CHANGELOG.md", ROOT / "SECURITY.md"]
    markdown_files.extend(
        [ROOT / "AGENTS.md", ROOT / ".github/pull_request_template.md"]
    )
    markdown_files.extend((ROOT / "docs").rglob("*.md"))
    markdown_files.append(ROOT / "tests" / "README.md")
    for path in markdown_files:
        text = path.read_text(encoding="utf-8")
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            target = target.strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            resolved = path.parent / unquote(parsed.path)
            if not resolved.exists():
                raise ValueError(
                    f"Broken local link in {path.relative_to(ROOT)}: {target}"
                )

    bundle = INTEGRATION / "ui" / "assets" / "panel.js"
    if not bundle.is_file() or bundle.stat().st_size == 0:
        raise ValueError(
            "Packaged panel missing; run npm ci && npm run build in frontend"
        )
    print("Project checks passed: syntax, imports, metadata, identity, links, bundle")


if __name__ == "__main__":
    try:
        validate()
    except (OSError, ValueError, KeyError, SyntaxError) as error:
        print(f"Project check failed: {error}", file=sys.stderr)
        sys.exit(1)

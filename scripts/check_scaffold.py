"""Check scaffold syntax and metadata without importing Home Assistant."""

import ast
import json
import re
import sys
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "kaleidescape_companion"
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


def validate() -> None:
    """Check syntax, metadata, identity, local links, and packaged panel presence."""
    for directory in (ROOT / "custom_components", ROOT / "scripts"):
        for path in directory.rglob("*.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

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
    if manifest["name"] != "Kaleidescape" or hacs["name"] != "Kaleidescape":
        raise ValueError("Display/project names must be Kaleidescape")
    if project["name"] != "kaleidescape" or frontend["name"] != "kaleidescape":
        raise ValueError("Package names must be kaleidescape")

    constants: dict[str, object] = {}
    tree = ast.parse((INTEGRATION / "const.py").read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    constants[target.id] = node.value.value
    if constants.get("DOMAIN") != DOMAIN or constants.get("NAME") != "Kaleidescape":
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

    lock = read_json(ROOT / "frontend" / "package-lock.json")
    if lock["name"] != frontend["name"] or lock["version"] != frontend["version"]:
        raise ValueError("Frontend lockfile must match package metadata")
    if lock["packages"][""]["dependencies"] != frontend["dependencies"]:
        raise ValueError("Frontend lockfile dependencies are stale")
    if lock["packages"][""]["devDependencies"] != frontend["devDependencies"]:
        raise ValueError("Frontend lockfile development dependencies are stale")

    markdown_files = [ROOT / "README.md", ROOT / "CHANGELOG.md"]
    markdown_files.extend((ROOT / "docs").glob("*.md"))
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

    bundle = INTEGRATION / "frontend" / "panel.js"
    if not bundle.is_file() or bundle.stat().st_size == 0:
        raise ValueError(
            "Packaged panel missing; run npm ci && npm run build in frontend"
        )
    print("Scaffold checks passed: syntax, metadata, identity, links, bundle")


if __name__ == "__main__":
    try:
        validate()
    except (OSError, ValueError, KeyError, SyntaxError) as error:
        print(f"Scaffold check failed: {error}", file=sys.stderr)
        sys.exit(1)

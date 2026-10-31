"""Synchronize a generated runtime package."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lib/scrapers/src/kaleidescape_scrapers"
TARGET = ROOT / "custom_components/kaleidescape_companion/_vendor/kaleidescape_scrapers"
# The scraper package has no excluded runtime modules.
EXCLUDED = set()


def synchronize(*, check=False, source=SOURCE, target=TARGET, excluded=EXCLUDED):
    if not (source / "__init__.py").is_file():
        raise ValueError("Source package is missing")
    expected = {
        path.relative_to(source).as_posix(): path.read_bytes()
        for path in source.rglob("*.py")
        if path.relative_to(source).as_posix() not in excluded
    }
    actual = {p.relative_to(target).as_posix(): p for p in target.rglob("*.py")}
    stale = set(expected) != set(actual) or any(
        name not in actual or actual[name].read_bytes() != content
        for name, content in expected.items()
    )
    if check:
        if stale:
            raise ValueError("Bundled library is stale; regenerate its vendor copy")
        return
    for name, path in actual.items():
        if name not in expected:
            path.unlink()
    for name, content in expected.items():
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

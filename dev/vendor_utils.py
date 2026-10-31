"""Synchronize a generated runtime package."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lib/scrapers/src/kaleidescape_scrapers"
TARGET = ROOT / "custom_components/kaleidescape_companion/_vendor/kaleidescape_scrapers"
# The scraper package has no excluded runtime modules.
EXCLUDED = set()


def synchronize(*, check=False):
    if not (SOURCE / "__init__.py").is_file():
        raise ValueError("Source package is missing")
    expected = {
        path.relative_to(SOURCE).as_posix(): path.read_bytes()
        for path in SOURCE.rglob("*.py")
        if path.relative_to(SOURCE).as_posix() not in EXCLUDED
    }
    actual = {p.relative_to(TARGET).as_posix(): p for p in TARGET.rglob("*.py")}
    stale = set(expected) != set(actual) or any(
        name not in actual or actual[name].read_bytes() != content
        for name, content in expected.items()
    )
    if check:
        if stale:
            raise ValueError("Bundled API is stale; run python dev/vendor_api.py")
        return
    for name, path in actual.items():
        if name not in expected:
            path.unlink()
    for name, content in expected.items():
        destination = TARGET / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

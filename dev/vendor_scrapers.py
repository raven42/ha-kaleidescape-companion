"""Generate/check the runtime copy of the independent metadata provider library."""

import argparse
from pathlib import Path

if __package__:
    from .vendor_utils import synchronize
else:
    from vendor_utils import synchronize

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lib/scrapers/src/kaleidescape_scrapers"
TARGET = ROOT / "custom_components/kaleidescape_companion/_vendor/kaleidescape_scrapers"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    synchronize(
        check=parser.parse_args().check, source=SOURCE, target=TARGET, excluded=set()
    )

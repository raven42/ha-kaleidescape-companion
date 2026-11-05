"""The development overlay gate rejects incomplete or modified sources."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PykOverlayTest(unittest.TestCase):
    def test_gate_accepts_reviewed_files_and_rejects_mutations(self):
        source = Path(__import__("kaleidescape").__file__).resolve().parent.parent
        expected = json.loads((ROOT / "dev/pyk-overlay/hashes.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            dest = Path(directory)
            for name in expected:
                target = dest / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source / name, target)

            def check():
                return subprocess.run(
                    [sys.executable, str(ROOT / "dev/check_pyk.py"), str(dest)],
                    capture_output=True,
                    check=False,
                ).returncode

            self.assertEqual(check(), 0)
            extra = dest / "kaleidescape/extra.py"
            extra.write_text("# unexpected\n")
            self.assertNotEqual(check(), 0)
            extra.unlink()
            (dest / "kaleidescape/device.py").write_text("# modified\n")
            self.assertNotEqual(check(), 0)
            (dest / "kaleidescape/device.py").unlink()
            self.assertNotEqual(check(), 0)

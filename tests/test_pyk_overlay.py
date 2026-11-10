"""The development overlay gate rejects incomplete or modified sources."""

import hashlib
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

from scripts.src import check_pyk, deploy

ROOT = Path(__file__).resolve().parents[1]


class PykOverlayTest(unittest.TestCase):
    def test_gate_accepts_reviewed_files_and_rejects_mutations(self):
        source = ROOT / "custom_components/kaleidescape_companion/vendor"
        expected = json.loads(
            (ROOT / "scripts/assets/pyk-overlay/hashes.json").read_text()
        )
        with tempfile.TemporaryDirectory() as directory:
            dest = Path(directory)
            for name in expected:
                target = dest / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source / name, target)

            def check():
                return subprocess.run(
                    [sys.executable, str(ROOT / "scripts/src/check_pyk.py"), str(dest)],
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

    def test_offline_reconstruction_and_stale_patch_rejection(self):
        self.assertEqual(check_pyk.reconstruct(), 12)
        with tempfile.TemporaryDirectory() as directory:
            overlay = Path(directory) / "overlay"
            shutil.copytree(check_pyk.OVERLAY, overlay)
            patch = overlay / "companion.patch"
            original = patch.read_text()
            # Still applies, but no longer reproduces the reviewed runtime bytes.
            patch.write_text(original.replace("pre_submit()", "pre_submit_changed()"))
            with self.assertRaisesRegex(ValueError, "differs"):
                check_pyk.reconstruct(overlay)
            # Reproduce the original missing-API provenance defect.
            chunks = original.split("diff --git ")
            patch.write_text(
                "".join(
                    "diff --git " + chunk
                    for chunk in chunks[1:]
                    if not chunk.startswith("a/kaleidescape/library_parser.py ")
                )
            )
            with self.assertRaises(FileNotFoundError):
                check_pyk.reconstruct(overlay)
            patch.write_text(original)
            (overlay / "base.tar.gz").write_bytes(b"invalid base")
            with self.assertRaisesRegex(ValueError, "base fixture checksum"):
                check_pyk.reconstruct(overlay)

    def test_supported_deployment_archive_contains_exact_manifest_and_license(self):
        expected = json.loads((check_pyk.OVERLAY / "hashes.json").read_text())
        with tarfile.open(fileobj=io.BytesIO(deploy.runtime_package())) as archive:
            names = set(archive.getnames())
            for name, digest in expected.items():
                content = archive.extractfile(f"{deploy.DOMAIN}/vendor/{name}").read()
                self.assertEqual(hashlib.sha256(content).hexdigest(), digest, name)
            self.assertFalse(any("pyk-overlay" in name for name in names))
            self.assertEqual(
                {
                    name
                    for name in names
                    if name.startswith(f"{deploy.DOMAIN}/vendor/kaleidescape/")
                    and name.endswith(".py")
                },
                {
                    f"{deploy.DOMAIN}/vendor/{name}"
                    for name in expected
                    if name.endswith(".py")
                },
            )

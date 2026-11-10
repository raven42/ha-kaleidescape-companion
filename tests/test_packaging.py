"""Prepared artifact integrity and source isolation, using fictional files only."""

import gzip
import io
import json
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.src import deploy, package, tasks


class PreparedArtifactTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "custom_components" / package.DOMAIN
        for name in package.REQUIRED:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fictional runtime")
        (self.source / "manifest.json").write_text(
            json.dumps({"domain": package.DOMAIN, "version": "0.1.0-dev.0"})
        )
        for name in (
            "pyproject.toml",
            "frontend/package.json",
            "frontend/package-lock.json",
            "frontend/tsconfig.json",
            "frontend/src/ui/panel.ts",
            "scripts/src/tool.py",
        ):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fictional build input")

    def prepare(self):
        with (
            patch.object(tasks, "verify_assets") as assets,
            patch.object(tasks, "verify_pyk") as pyk,
            patch.object(tasks, "project_check") as project,
            patch("sys.stdout", new_callable=io.StringIO),
        ):
            artifact = package.write_package(self.root)
        assets.assert_called_once_with()
        pyk.assert_called_once_with(reconstruct=True)
        project.assert_called_once_with()
        return artifact

    def test_preparation_verifies_once_and_records_exact_runtime_and_build_inputs(self):
        artifact = self.prepare()
        data, provenance = package.load_artifact(artifact)
        self.assertEqual(data, package.runtime_package(self.root))
        self.assertEqual(provenance["version"], "0.1.0-dev.0")
        self.assertIn("frontend/src/ui/panel.ts", provenance["source"]["inputs"])
        self.assertEqual(
            provenance["runtime_sha256"]["ui/assets/panel.js"],
            provenance["build"]["panel_sha256"],
        )
        self.assertEqual(self.prepare().read_bytes(), data)

    def test_failed_asset_verification_produces_no_artifact(self):
        with (
            patch.object(tasks, "verify_assets", side_effect=ValueError("stale asset")),
            patch.object(tasks, "verify_pyk") as pyk,
        ):
            with self.assertRaisesRegex(ValueError, "stale asset"):
                package.write_package(self.root)
        pyk.assert_not_called()
        self.assertFalse((self.root / "dist").exists())

    def test_concurrent_source_edit_is_rejected_before_writing(self):
        with (
            patch.object(
                tasks,
                "verify_assets",
                side_effect=lambda: (self.source / "const.py").write_text(
                    "changed during build"
                ),
            ),
            patch.object(tasks, "verify_pyk"),
            patch.object(tasks, "project_check"),
        ):
            with self.assertRaisesRegex(ValueError, "inputs changed"):
                package.write_package(self.root)
        self.assertFalse((self.root / "dist").exists())

    def test_private_nonbuild_files_are_not_read_for_provenance(self):
        private_paths = [
            self.source / "household.sqlite3",
            self.root / "scripts/household.db",
            self.root / "frontend/dev/private.log",
        ]
        for path in private_paths:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("private sentinel must not be read")
        original = package.read_regular

        def guarded(path, limit):
            self.assertNotIn(path, private_paths)
            return original(path, limit)

        with patch.object(package, "read_regular", side_effect=guarded):
            inputs = package.source_inputs(self.root)
        self.assertFalse(
            any(
                path.relative_to(self.root).as_posix() in inputs
                for path in private_paths
            )
        )

    def test_corrupted_bytes_and_inconsistent_provenance_are_rejected(self):
        artifact = self.prepare()
        original = artifact.read_bytes()
        artifact.write_bytes(original + b"corruption")
        with self.assertRaisesRegex(ValueError, "checksum"):
            package.load_artifact(artifact)
        artifact.write_bytes(original)
        sidecar = Path(str(artifact) + ".provenance.json")
        provenance = json.loads(sidecar.read_text())
        for field, value in [
            ("build", {}),
            ("runtime_sha256", {}),
            ("source", {}),
            ("version", "different"),
        ]:
            with self.subTest(field=field):
                sidecar.write_text(json.dumps({**provenance, field: value}))
                with self.assertRaises(ValueError):
                    package.load_artifact(artifact)

    def test_missing_sidecars_and_linked_artifacts_are_rejected(self):
        artifact = self.prepare()
        alias = artifact.parent / "alias.tar.gz"
        alias.symlink_to(artifact)
        with self.assertRaises(OSError):
            package.load_artifact(alias)
        alias.unlink()
        os.link(artifact, alias)
        with self.assertRaisesRegex(ValueError, "unlinked"):
            package.load_artifact(artifact)
        alias.unlink()
        Path(str(artifact) + ".sha256").unlink()
        with self.assertRaises(OSError):
            package.load_artifact(artifact)

    def test_malicious_members_and_oversized_expansion_are_refused(self):
        for name, kind in [
            ("../outside.py", tarfile.REGTYPE),
            (f"{package.DOMAIN}/../outside.py", tarfile.REGTYPE),
            (f"{package.DOMAIN}/link.py", tarfile.SYMTYPE),
            (f"{package.DOMAIN}/private.db", tarfile.REGTYPE),
        ]:
            with self.subTest(name=name):
                buffer = io.BytesIO()
                with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
                    member = tarfile.TarInfo(name)
                    member.mode = 0o644
                    member.type = kind
                    member.linkname = "/outside"
                    archive.addfile(member, io.BytesIO())
                with self.assertRaises(ValueError):
                    package.inspect_package(buffer.getvalue())
        with patch.object(package, "MAX_TAR_BYTES", 100):
            with self.assertRaisesRegex(ValueError, "expanded size"):
                package.inspect_package(gzip.compress(b"0" * 101))

    def test_deployment_sends_prepared_bytes_after_source_changes_without_rebuilding(
        self,
    ):
        artifact = self.prepare()
        expected = artifact.read_bytes()
        (self.source / "ui/assets/panel.js").write_text("new unbuilt source")
        config = deploy.DeployConfig("fictional-ha", "/config", "haos")
        for action in ("plan", "deploy"):
            with (
                self.subTest(action=action),
                patch("sys.argv", ["deploy", action, "--artifact", str(artifact)]),
                patch.object(deploy, "load_config", return_value=config),
                patch.object(deploy, "deploy") as send,
                patch.object(tasks, "verify_assets") as rebuild,
                patch("sys.stdout", new_callable=io.StringIO),
            ):
                deploy.main()
            rebuild.assert_not_called()
            if action == "deploy":
                send.assert_called_once_with(config, expected)
            else:
                send.assert_not_called()

    def test_missing_artifact_cannot_connect(self):
        with (
            patch("sys.argv", ["deploy"]),
            patch.object(deploy, "load_config") as config,
            patch.object(deploy, "deploy") as send,
            patch("sys.stderr", new_callable=io.StringIO),
        ):
            with self.assertRaises(SystemExit):
                deploy.main()
        config.assert_not_called()
        send.assert_not_called()

    def test_package_cli_preserves_failed_tool_status(self):
        for status, expected in ((7, 7), (-15, 143)):
            with (
                self.subTest(status=status),
                patch.object(
                    package,
                    "main",
                    side_effect=subprocess.CalledProcessError(
                        status, ["fictional-check"]
                    ),
                ),
                patch("sys.stderr", new_callable=io.StringIO),
            ):
                self.assertEqual(package.cli(), expected)

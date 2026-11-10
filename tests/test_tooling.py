"""Keep local tooling independent of caller cwd, devices and editor state."""

import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.src import dependency_audit, ha, setup, tasks


class ToolingTest(unittest.TestCase):
    def test_wrappers_resolve_checkout_from_an_unrelated_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [str(tasks.ROOT / "scripts/check-pyk"), "--help"],
                cwd=directory,
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--reconstruct", result.stdout)

    def test_missing_environment_fails_before_running_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [str(tasks.ROOT / "scripts/check")],
                cwd=directory,
                env={**os.environ, "COMPANION_VENV": str(Path(directory) / "missing")},
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 2)
        self.assertIn("Run scripts/setup", result.stderr)

    def test_dependency_audit_runs_both_scans_after_failure(self):
        for first in (1, FileNotFoundError("fictional missing scanner")):
            with self.subTest(first=first):
                with patch.object(sys, "argv", ["dependency-audit"]):
                    with patch.object(tasks, "run", side_effect=[first, 0]) as run:
                        self.assertEqual(dependency_audit.main(), 1)
                self.assertEqual(run.call_count, 2)
                self.assertIn("pip_audit", run.call_args_list[0].args[0])
                self.assertEqual(run.call_args_list[1].args[0][:2], ["npm", "audit"])

    def test_setup_rejects_unsupported_python_before_installing(self):
        with patch.object(sys, "version_info", (3, 13, 9)):
            with patch.object(tasks, "run") as run:
                with self.assertRaisesRegex(ValueError, "Python 3.14.2"):
                    setup.validate_prerequisites()
                run.assert_not_called()

    def test_setup_checks_node_release_lines(self):
        for version, accepted in (
            ("v22.12.0", False),
            ("v22.13.0", True),
            ("v23.9.0", False),
            ("v24.0.0", True),
            ("v25.0.0", True),
            ("v24.0.0-rc.1", False),
        ):
            with self.subTest(version=version):
                with patch.object(setup.shutil, "which", return_value="fictional"):
                    with patch.object(
                        setup.subprocess, "check_output", return_value=version
                    ):
                        if accepted:
                            setup.validate_prerequisites()
                        else:
                            with self.assertRaisesRegex(ValueError, "Node.js"):
                                setup.validate_prerequisites()

    def test_ha_launcher_preserves_existing_configuration_and_refuses_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / ".ha-dev"
            config.mkdir()
            settings = config / "configuration.yaml"
            settings.write_text("existing fictional configuration\n")
            with patch.object(tasks, "ROOT", root):
                self.assertEqual(ha.prepare_configuration(), config)
                self.assertEqual(
                    settings.read_text(), "existing fictional configuration\n"
                )
                self.assertEqual(ha.prepare_configuration(), config)
                settings.unlink()
                destination = root / "unrelated.yaml"
                destination.write_text("do not change\n")
                settings.symlink_to(destination)
                with self.assertRaisesRegex(
                    ValueError, "linked development configuration"
                ):
                    ha.prepare_configuration()
            self.assertEqual(destination.read_text(), "do not change\n")

    def test_runner_forwards_termination_and_stops_after_graceful_child_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "child-ready"
            child = (
                "import pathlib, signal, sys, time; "
                "signal.signal(signal.SIGTERM, lambda *_: sys.exit(0)); "
                f"pathlib.Path({str(marker)!r}).write_text('ready'); "
                "time.sleep(30)"
            )
            runner = (
                "from scripts.src import tasks; import sys; "
                "sys.exit(tasks.cli(lambda: tasks.run("
                f"[sys.executable, '-c', {child!r}])))"
            )
            process = subprocess.Popen(
                [sys.executable, "-c", runner],
                cwd=tasks.ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                deadline = time.monotonic() + 5
                while (
                    not marker.exists()
                    and process.poll() is None
                    and time.monotonic() < deadline
                ):
                    time.sleep(0.01)
                self.assertTrue(marker.exists(), "Runner did not start its child")
                process.send_signal(signal.SIGTERM)
                process.communicate(timeout=5)
                self.assertEqual(process.returncode, 128 + signal.SIGTERM)
            finally:
                if process.poll() is None:
                    process.kill()
                process.communicate()

    def test_runner_terminates_descendants_of_a_tool(self):
        with tempfile.TemporaryDirectory() as directory:
            ready = Path(directory) / "grandchild-ready"
            stopped = Path(directory) / "grandchild-stopped"
            grandchild = (
                "import pathlib, signal, sys, time; "
                "signal.signal(signal.SIGTERM, lambda *_: "
                f"(pathlib.Path({str(stopped)!r}).write_text('stopped'), "
                "sys.exit(0))); "
                f"pathlib.Path({str(ready)!r}).write_text('ready'); "
                "time.sleep(30)"
            )
            child = (
                "import subprocess, sys; "
                f"subprocess.run([sys.executable, '-c', {grandchild!r}])"
            )
            runner = (
                "from scripts.src import tasks; import sys; "
                "sys.exit(tasks.cli(lambda: tasks.run("
                f"[sys.executable, '-c', {child!r}])))"
            )
            process = subprocess.Popen(
                [sys.executable, "-c", runner],
                cwd=tasks.ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                deadline = time.monotonic() + 5
                while (
                    not ready.exists()
                    and process.poll() is None
                    and time.monotonic() < deadline
                ):
                    time.sleep(0.01)
                self.assertTrue(ready.exists(), "Tool did not start its descendant")
                process.send_signal(signal.SIGTERM)
                process.communicate(timeout=5)
                self.assertEqual(process.returncode, 128 + signal.SIGTERM)
                self.assertTrue(stopped.exists(), "Tool descendant did not terminate")
            finally:
                if process.poll() is None:
                    process.kill()
                process.communicate()

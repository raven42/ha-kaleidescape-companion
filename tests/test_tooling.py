"""Keep local tooling independent of caller cwd, devices and editor state."""

import io
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import Mock, call, patch

from scripts.src import build, dependency_audit, ha, setup, tasks, unittest_runner


class ToolingTest(unittest.TestCase):
    def test_check_runs_quality_gate_before_all_test_suites(self):
        order = Mock()
        names = (
            "lint",
            "format_sources",
            "shell_check",
            "verify_pyk",
            "provider_tests",
            "browser_tests",
            "live_player_tests",
            "integration_tests",
            "project_check",
            "frontend_tests",
            "verify_assets",
        )
        with ExitStack() as stack:
            for name in names:
                stack.enter_context(patch.object(tasks, name, getattr(order, name)))
            tasks.check()
        self.assertEqual(
            order.mock_calls,
            [
                call.lint(),
                call.format_sources(check=True),
                call.shell_check(),
                call.verify_pyk(reconstruct=True),
                call.provider_tests(),
                call.browser_tests(),
                call.live_player_tests(),
                call.integration_tests(),
                call.project_check(),
                call.frontend_tests(),
                call.verify_assets(),
            ],
        )

    def test_lint_failure_stops_build_and_check_before_slow_work(self):
        for command in (tasks.check, build.main):
            with (
                self.subTest(command=command.__name__),
                patch.object(sys, "argv", ["build"]),
                patch.object(
                    tasks, "lint", side_effect=subprocess.CalledProcessError(1, "lint")
                ),
                patch.object(tasks, "format_sources") as formatting,
                patch.object(tasks, "verify_pyk") as pyk,
                patch.object(tasks, "npm") as npm,
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    command()
                formatting.assert_not_called()
                pyk.assert_not_called()
                npm.assert_not_called()

    def test_format_failure_stops_build_and_check_before_slow_work(self):
        for command in (tasks.check, build.main):
            with (
                self.subTest(command=command.__name__),
                patch.object(sys, "argv", ["build"]),
                patch.object(tasks, "lint"),
                patch.object(
                    tasks,
                    "format_sources",
                    side_effect=subprocess.CalledProcessError(1, "format"),
                ),
                patch.object(tasks, "shell_check") as shell,
                patch.object(tasks, "verify_pyk") as pyk,
                patch.object(tasks, "npm") as npm,
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    command()
                shell.assert_not_called()
                pyk.assert_not_called()
                npm.assert_not_called()

    def test_ci_requires_quality_gate_before_test_jobs(self):
        import yaml

        workflow = yaml.safe_load((tasks.ROOT / ".github/workflows/ci.yml").read_text())
        jobs = workflow["jobs"]
        commands = [step.get("run") for step in jobs["lint"]["steps"]]
        self.assertIn("scripts/lint", commands)
        self.assertIn("scripts/format --check", commands)
        for name in ("providers", "python", "frontend"):
            self.assertEqual(jobs[name]["needs"], "lint")

    def test_combined_build_and_check_runs_quality_once_before_build_and_tests(self):
        order = Mock()
        with (
            patch.object(sys, "argv", ["build", "--check"]),
            patch.object(tasks, "quality_checks", order.quality),
            patch.object(tasks, "npm", order.npm),
            patch.object(tasks, "check_after_quality", order.check),
        ):
            build.main()
        self.assertEqual(
            order.mock_calls, [call.quality(), call.npm("build"), call.check()]
        )

    def test_combined_build_stops_if_build_fails(self):
        with (
            patch.object(sys, "argv", ["build", "--check"]),
            patch.object(tasks, "quality_checks"),
            patch.object(
                tasks, "npm", side_effect=subprocess.CalledProcessError(1, "build")
            ),
            patch.object(tasks, "check_after_quality") as check,
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                build.main()
            check.assert_not_called()

    def test_vscode_combined_task_runs_verified_package_and_tests_in_parallel(self):
        data = json.loads((tasks.ROOT / ".vscode/tasks.json").read_text())
        by_name = {item["label"]: item for item in data["tasks"]}
        combined = by_name["Maintainer: Build, check, package, deploy and restart"]
        self.assertEqual(combined["dependsOn"][:2], ["Build", "Post-build checks"])
        self.assertEqual(combined["dependsOrder"], "sequence")
        parallel = by_name["Post-build checks"]
        self.assertEqual(parallel["dependsOrder"], "parallel")
        self.assertEqual(
            set(parallel["dependsOn"]),
            {"Post-build: Python tests", "Post-build: Frontend tests", "Package"},
        )
        self.assertEqual(by_name["Post-build: Python tests"]["args"], ["--python-only"])
        self.assertEqual(
            by_name["Post-build: Frontend tests"]["args"], ["--frontend-only"]
        )
        visible = {name for name, item in by_name.items() if not item.get("hide")}
        self.assertEqual(
            visible,
            {
                "Maintainer: Deploy frontend",
                "Maintainer: Build, check, package, deploy and restart",
            },
        )

    def test_vscode_process_tasks_reveal_terminal_only_on_error(self):
        data = json.loads((tasks.ROOT / ".vscode/tasks.json").read_text())
        for task in data["tasks"]:
            if task.get("type") == "process":
                with self.subTest(task=task["label"]):
                    self.assertEqual(task["presentation"]["reveal"], "silent")
                    self.assertFalse(task["presentation"]["focus"])

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
                with (
                    patch.object(sys, "argv", ["dependency-audit"]),
                    patch.object(sys, "stderr", new_callable=io.StringIO) as errors,
                    patch.object(tasks, "run", side_effect=[first, 0]) as run,
                ):
                    self.assertEqual(dependency_audit.main(), 1)
                self.assertEqual(run.call_count, 2)
                self.assertIn("pip_audit", run.call_args_list[0].args[0])
                self.assertEqual(run.call_args_list[1].args[0][:2], ["npm", "audit"])
                if isinstance(first, OSError):
                    self.assertIn("Dependency scan could not run", errors.getvalue())
                else:
                    self.assertEqual(errors.getvalue(), "")

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

    def test_unittest_runner_raises_slow_callback_diagnostic_threshold(self):
        unittest_runner.configure_asyncio_diagnostics()
        case = unittest.IsolatedAsyncioTestCase()
        case._setupAsyncioRunner()
        try:
            self.assertEqual(
                case._asyncioRunner.get_loop().slow_callback_duration,
                unittest_runner.SLOW_CALLBACK_SECONDS,
            )
        finally:
            case._tearDownAsyncioRunner()

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

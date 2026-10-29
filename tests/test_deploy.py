"""Exercise deployment boundaries using fictional files and a local shell, never SSH."""

import io
import json
import os
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from dev import deploy


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.source = self.root / "custom_components" / deploy.DOMAIN
        for name in deploy.REQUIRED:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fictional runtime")
        (self.source / "manifest.json").write_text(
            json.dumps({"domain": deploy.DOMAIN})
        )
        self.settings = self.root / "settings.json"
        self.config = self.root / "HA config ' $(touch SHOULD_NOT_EXIST)"
        self.config.mkdir()
        (self.config / "configuration.yaml").write_text("# fictional HA config\n")

    def settings_data(self):
        return {
            "ssh_host": "ha-test",
            "config_path": str(self.config),
            "restart": {"type": "haos"},
        }

    def load_settings(self, data=None):
        self.settings.write_text(
            json.dumps(self.settings_data() if data is None else data)
        )
        return deploy.load_config(self.settings)

    def remote(self, data=None, *, environment=None):
        config = self.load_settings()
        # Inspect the exact SSH command, but execute only its remote shell
        # fragment against this test's temporary configuration directory.
        with patch.object(deploy.subprocess, "run") as ssh:
            deploy.deploy(
                config, data if data is not None else deploy.runtime_package(self.root)
            )
            command = ssh.call_args.args[0][-1]
        return subprocess.run(
            ["sh", "-c", command],
            input=data if data is not None else deploy.runtime_package(self.root),
            cwd=self.root,
            env=environment,
            capture_output=True,
            timeout=10,
        )

    def test_package_is_deterministic_and_excludes_private_and_development_files(self):
        for name in (
            ".env",
            "journal.sqlite3",
            "private.log",
            "frontend/dev.ts",
            "__pycache__/x.pyc",
        ):
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("private fixture; must never ship")
        first = deploy.runtime_package(self.root)
        os.utime(self.source / "const.py", (1, 1))
        self.assertEqual(first, deploy.runtime_package(self.root))
        with tarfile.open(fileobj=io.BytesIO(first), mode="r:gz") as archive:
            self.assertEqual(
                {member.name for member in archive},
                {f"{deploy.DOMAIN}/{name}" for name in deploy.REQUIRED},
            )
            self.assertTrue(
                all(member.isfile() and member.mode == 0o644 for member in archive)
            )

    def test_real_archive_imports_all_runtime_packages_without_checkout_fallback(self):
        """Exercise deployed imports from an archive, not the editable installation."""
        payload = deploy.runtime_package(Path(__file__).resolve().parents[1])
        destination = self.root / "isolated"
        destination.mkdir()
        components = destination / "custom_components"
        components.mkdir()
        modules = []
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            archive.extractall(components, filter="data")
            for member in archive:
                if member.name.endswith(".py"):
                    parts = list(Path(member.name).with_suffix("").parts)
                    if parts[-1] == "__init__":
                        parts.pop()
                    modules.append("custom_components." + ".".join(parts))
        script = """
import importlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
for name in json.loads(sys.argv[2]):
    module = importlib.import_module(name)
    assert pathlib.Path(module.__file__).resolve().is_relative_to(root), name
assert not any(name == 'dev' or name.startswith('dev.') for name in sys.modules)
"""
        result = subprocess.run(
            [sys.executable, "-I", "-c", script, str(destination), json.dumps(modules)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_package_rejects_links_missing_bundle_wrong_domain_and_size_overflow(self):
        source = self.source / "const.py"
        source.unlink()
        source.symlink_to(self.settings)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            deploy.runtime_package(self.root)
        source.unlink()
        source.write_text("source")
        os.link(source, self.source / "linked.py")
        with self.assertRaisesRegex(ValueError, "unlinked"):
            deploy.runtime_package(self.root)
        (self.source / "linked.py").unlink()
        with patch.object(deploy, "MAX_PACKAGE_BYTES", 1):
            with self.assertRaisesRegex(ValueError, "32 MiB"):
                deploy.runtime_package(self.root)
        (self.source / "manifest.json").write_text('{"domain":"kaleidescape"}')
        with self.assertRaisesRegex(ValueError, "domain"):
            deploy.runtime_package(self.root)
        (self.source / "ui/assets/panel.js").unlink()
        with self.assertRaisesRegex(ValueError, "build the frontend"):
            deploy.runtime_package(self.root)

    def test_settings_refuse_option_shell_command_and_path_injection(self):
        for field, value in (
            ("ssh_host", "-oProxyCommand=anything"),
            ("ssh_host", "host; echo nope"),
            ("ssh_user", "-oProxyCommand=anything"),
            ("ssh_user", "deploy; echo nope"),
            ("ssh_user", "deploy\nother"),
            ("ssh_user", ""),
            ("ssh_user", 123),
            ("config_path", "/"),
            ("config_path", "/config/../other"),
            ("config_path", "/config\nother"),
            ("config_path", "relative/config"),
            ("restart", {"type": "container", "container": "--all"}),
            ("restart", {"type": "container", "container": "ha; anything"}),
            ("restart", {"type": "haos", "command": "anything"}),
        ):
            with self.subTest(field=field, value=value):
                data = self.settings_data()
                data[field] = value
                with self.assertRaises(ValueError):
                    self.load_settings(data)
        data = self.settings_data()
        data["token"] = "must not be accepted"
        with self.assertRaises(ValueError):
            self.load_settings(data)
        self.settings.write_text('{"ssh_host":"one","ssh_host":"two"}')
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            deploy.load_config(self.settings)

    def test_ssh_uses_known_hosts_no_password_or_agent_forwarding_and_fixed_restarts(
        self,
    ):
        config = self.load_settings()
        with patch.object(deploy.subprocess, "run") as run:
            deploy.deploy(config, b"fictional archive")
            command = run.call_args.args[0]
            self.assertIn("StrictHostKeyChecking=yes", command)
            self.assertIn("BatchMode=yes", command)
            self.assertIn("ForwardAgent=no", command)
            self.assertNotIn("-l", command)
            self.assertEqual(command[-2], "ha-test")
            self.assertEqual(shlex.split(command[-1])[-1], str(self.config))
            self.assertEqual(run.call_args.kwargs["input"], b"fictional archive")
            self.assertNotIn("ha core restart", command[-1])
            deploy.restart(config)
            self.assertEqual(
                run.call_args.args[0][-1], "ha core check && ha core restart"
            )
            data = self.settings_data()
            data["restart"] = {"type": "container", "container": "homeassistant-test"}
            deploy.restart(self.load_settings(data))
            command = run.call_args.args[0][-1]
            self.assertIn(
                "docker exec homeassistant-test python -m homeassistant", command
            )
            self.assertTrue(
                command.endswith("&& docker restart --timeout 60 homeassistant-test")
            )

    def test_explicit_username_is_used_for_both_deploy_and_restart(self):
        data = self.settings_data()
        data["ssh_user"] = "deploy-test"
        for restart in (
            {"type": "haos"},
            {"type": "container", "container": "homeassistant-test"},
        ):
            with self.subTest(restart=restart):
                data["restart"] = restart
                config = self.load_settings(data)
                with patch.object(deploy.subprocess, "run") as run:
                    deploy.deploy(config, b"fictional archive")
                    deploy.restart(config)
                    for call in run.call_args_list:
                        command = call.args[0]
                        self.assertEqual(
                            command[command.index("-l") + 1], "deploy-test"
                        )
                        self.assertEqual(command[-2], "ha-test")
        data["ssh_user"] = None
        self.assertNotIn("-l", deploy.ssh_command(self.load_settings(data), "true"))

    def test_local_settings_initialization_preserves_existing_file(self):
        deploy.initialize_config(self.settings)
        original = self.settings.read_bytes()
        self.assertEqual(self.settings.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(FileExistsError):
            deploy.initialize_config(self.settings)
        self.assertEqual(self.settings.read_bytes(), original)

    def test_deployment_replaces_only_component_and_retains_previous_code(self):
        journal = self.config / deploy.DOMAIN / "journal.sqlite3"
        journal.parent.mkdir()
        journal.write_bytes(b"fictional private database")
        builtin = self.config / "custom_components" / "unrelated"
        builtin.mkdir(parents=True)
        (builtin / "unchanged").write_text("other integration")
        self.assertEqual(self.remote().returncode, 0)
        target = self.config / "custom_components" / deploy.DOMAIN
        (target / "obsolete.py").write_text("previous runtime")
        result = self.remote()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((target / "obsolete.py").exists())
        state = self.config / ".kaleidescape-companion-deploy"
        backups = list(state.glob("deploy.*/previous/obsolete.py"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), "previous runtime")
        self.assertEqual(state.stat().st_mode & 0o777, 0o700)
        self.assertEqual((target / "manifest.json").stat().st_mode & 0o777, 0o644)
        self.assertEqual(target.stat().st_mode & 0o777, 0o755)
        self.assertEqual(journal.read_bytes(), b"fictional private database")
        self.assertTrue((builtin / "unchanged").is_file())
        self.assertFalse((self.root / "SHOULD_NOT_EXIST").exists())
        self.assertFalse((state / "lock").exists())

    def test_linked_component_destination_is_refused(self):
        components = self.config / "custom_components"
        components.mkdir()
        target = components / deploy.DOMAIN
        target.symlink_to(self.source, target_is_directory=True)
        self.assertNotEqual(self.remote().returncode, 0)
        self.assertTrue(target.is_symlink())

    def test_linked_config_root_and_ancestors_resolve_to_physical_ha_directory(self):
        physical = self.config
        journal = physical / deploy.DOMAIN / "journal.sqlite3"
        journal.parent.mkdir()
        journal.write_bytes(b"fictional journal")
        config_alias = self.root / "config"
        config_alias.symlink_to(physical, target_is_directory=True)
        parent_alias = self.root / "parent"
        parent_alias.symlink_to(self.root, target_is_directory=True)
        for configured in (config_alias, parent_alias / physical.name):
            with self.subTest(configured=configured):
                self.config = configured
                result = self.remote()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"Resolved HA config: {physical}", result.stdout.decode())
                self.assertTrue(
                    (
                        physical / "custom_components" / deploy.DOMAIN / "manifest.json"
                    ).is_file()
                )
                self.assertEqual(journal.read_bytes(), b"fictional journal")
                self.assertTrue(config_alias.is_symlink())
                self.assertTrue(parent_alias.is_symlink())

    def test_missing_linked_config_and_alias_to_filesystem_root_are_refused(self):
        for name, destination, message in (
            ("missing-config", self.root / "absent", "does not exist"),
            ("root-config", Path("/"), "must not be /"),
        ):
            with self.subTest(name=name):
                alias = self.root / name
                alias.symlink_to(destination, target_is_directory=True)
                self.config = alias
                result = self.remote()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr.decode())
                self.assertTrue(alias.is_symlink())

    def test_active_deployment_lock_blocks_writes(self):
        lock = self.config / ".kaleidescape-companion-deploy" / "lock"
        lock.mkdir(parents=True)
        result = self.remote()
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(lock.exists())
        self.assertFalse((self.config / "custom_components" / deploy.DOMAIN).exists())

    def test_missing_ha_config_or_linked_managed_directories_are_refused(self):
        marker = self.config / "configuration.yaml"
        marker.unlink()
        self.assertNotEqual(self.remote().returncode, 0)
        self.assertFalse((self.config / "custom_components").exists())
        marker.write_text("# fictional config\n")
        for name in ("custom_components", ".kaleidescape-companion-deploy"):
            with self.subTest(name=name):
                path = self.config / name
                path.symlink_to(self.source, target_is_directory=True)
                self.assertNotEqual(self.remote().returncode, 0)
                self.assertTrue(path.is_symlink())
                path.unlink()

    def test_failed_unpack_preserves_installed_component_and_cleans_lock(self):
        self.assertEqual(self.remote().returncode, 0)
        target = self.config / "custom_components" / deploy.DOMAIN
        original = (target / "manifest.json").read_bytes()
        self.assertNotEqual(self.remote(b"invalid archive").returncode, 0)
        self.assertEqual((target / "manifest.json").read_bytes(), original)
        state = self.config / ".kaleidescape-companion-deploy"
        self.assertEqual(list(state.iterdir()), [])

    def test_failed_install_restores_previous_component(self):
        self.assertEqual(self.remote().returncode, 0)
        target = self.config / "custom_components" / deploy.DOMAIN
        (target / "previous.py").write_text("previous code")
        commands = self.root / "fake-bin"
        commands.mkdir()
        wrapper = commands / "mv"
        wrapper.write_text(
            "#!/bin/sh\n"
            'case "$1" in */new/kaleidescape_companion) exit 1 ;; esac\n'
            f'exec {shlex.quote(shutil.which("mv"))} "$@"\n'
        )
        wrapper.chmod(0o755)
        environment = dict(
            os.environ, PATH=f"{commands}{os.pathsep}{os.environ['PATH']}"
        )
        result = self.remote(environment=environment)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((target / "previous.py").read_text(), "previous code")
        self.assertFalse(
            (self.config / ".kaleidescape-companion-deploy" / "lock").exists()
        )

    def test_preview_never_connects_and_default_checks_never_deploy(self):
        data = self.settings_data()
        data["ssh_user"] = "deploy-test"
        self.load_settings(data)
        with (
            patch.object(
                deploy.sys,
                "argv",
                ["deploy.py", "plan", "--config", str(self.settings)],
            ),
            patch.object(
                deploy,
                "write_package",
                return_value=(b"archive", "digest", self.root / "package"),
            ),
            patch.object(deploy.subprocess, "run") as run,
            patch.object(deploy.sys, "stdout", new_callable=io.StringIO) as output,
        ):
            deploy.main()
            run.assert_not_called()
            self.assertIn("SSH target: deploy-test@ha-test", output.getvalue())
        tasks = json.loads((deploy.ROOT / ".vscode/tasks.json").read_text())["tasks"]
        tasks = {task["label"]: task for task in tasks}

        def dependencies(name, seen=None):
            seen = set() if seen is None else seen
            self.assertNotIn(name, seen, "Task dependency cycle")
            result = {name}
            for dependency in tasks[name].get("dependsOn", []):
                result |= dependencies(dependency, seen | {name})
            return result

        for name in tasks:
            dependencies(name)
        self.assertIn("Check all", dependencies("Deploy to test HA"))
        self.assertNotIn("Deploy to test HA", dependencies("Check all"))
        self.assertNotIn(
            "Check configuration and restart test HA", dependencies("Deploy to test HA")
        )
        self.assertEqual(
            tasks["Build, deploy and restart test HA"]["dependsOrder"], "sequence"
        )

    def test_cli_reports_remote_failures_without_dumping_remote_script(self):
        command = ["ssh", "ha-test", deploy.REMOTE_DEPLOY]
        for error, expected in (
            (subprocess.CalledProcessError(1, command), "exit status 1"),
            (subprocess.TimeoutExpired(command, 300), "timed out"),
        ):
            with self.subTest(error=type(error).__name__):
                with (
                    patch.object(deploy, "main", side_effect=error),
                    patch.object(
                        deploy.sys, "stderr", new_callable=io.StringIO
                    ) as output,
                ):
                    self.assertEqual(deploy.cli(), 1)
                    message = output.getvalue()
                self.assertIn(expected, message)
                self.assertNotIn(deploy.REMOTE_DEPLOY, message)
                self.assertEqual(len(message.splitlines()), 1)

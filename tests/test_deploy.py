"""Exercise deployment boundaries using fictional files and a local shell, never SSH."""

import io
import json
import os
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import deploy


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
        (self.source / "frontend/panel.js").unlink()
        with self.assertRaisesRegex(ValueError, "build the frontend"):
            deploy.runtime_package(self.root)

    def test_settings_refuse_option_shell_command_and_path_injection(self):
        for field, value in (
            ("ssh_host", "-oProxyCommand=anything"),
            ("ssh_host", "host; echo nope"),
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

    def test_linked_destination_or_config_parent_is_refused(self):
        components = self.config / "custom_components"
        components.mkdir()
        target = components / deploy.DOMAIN
        target.symlink_to(self.source, target_is_directory=True)
        self.assertNotEqual(self.remote().returncode, 0)
        self.assertTrue(target.is_symlink())
        target.unlink()
        linked = self.root / "linked"
        linked.symlink_to(self.config, target_is_directory=True)
        actual = linked / "nested"
        actual.mkdir()
        self.config = actual
        self.assertNotEqual(self.remote().returncode, 0)
        self.assertFalse((actual / "custom_components").exists())

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
        self.load_settings()
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
        ):
            deploy.main()
            run.assert_not_called()
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

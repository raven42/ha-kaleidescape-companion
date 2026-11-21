"""Shared terminal, editor and CI check groups; no deployment side effects."""

from __future__ import annotations

import os
import shlex
import signal
import subprocess
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def run(
    command: Sequence[str | Path],
    *,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> int:
    """Run from the checkout root, preserving output and forwarding signals."""
    argv = [str(part) for part in command]
    print(f"+ {shlex.join(argv)}", flush=True)
    # npm and other tools spawn their own shells/workers. Give the entire group
    # the same cancellation boundary instead of leaving grandchildren running.
    with subprocess.Popen(argv, cwd=ROOT, env=env, start_new_session=True) as process:
        previous = {}
        interrupted = None

        def forward(signum, _frame):
            nonlocal interrupted
            interrupted = signum
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass

        try:
            for signum in (signal.SIGINT, signal.SIGTERM):
                previous[signum] = signal.signal(signum, forward)
            status = process.wait()
        finally:
            for signum, handler in previous.items():
                signal.signal(signum, handler)
    if interrupted is not None:
        status = -interrupted
    if check and status:
        raise subprocess.CalledProcessError(status, argv)
    return status


def cli(action: Callable[[], int | None]) -> int:
    """Keep command failures readable and preserve their status at the wrapper."""
    try:
        return action() or 0
    except subprocess.CalledProcessError as error:
        return error.returncode if error.returncode >= 0 else 128 - error.returncode
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


def npm(script: str) -> None:
    run(["npm", "--prefix", FRONTEND, "run", script])


def verify_pyk(*, reconstruct: bool = False) -> None:
    command = [sys.executable, "-m", "scripts.src.check_pyk"]
    if reconstruct:
        command.append("--reconstruct")
    run(command)


def verify_assets() -> None:
    npm("build:check")


def project_check() -> None:
    run([sys.executable, "-m", "scripts.src.check_project"])


def lint() -> None:
    run([sys.executable, "-m", "flake8", "."])
    run([sys.executable, "-m", "ruff", "check", "."])
    npm("lint")
    npm("lint:markdown")


def format_sources(*, check: bool) -> None:
    command = [sys.executable, "-m", "ruff", "format"]
    if check:
        command.append("--check")
    run([*command, "."])
    npm("format:check" if check else "format")
    npm("format:docs:check" if check else "format:docs")


def provider_tests(arguments: Sequence[str] = ()) -> None:
    environment = os.environ.copy()
    source = str(ROOT / "custom_components/kaleidescape_companion")
    # The providers are intentionally independent of HA and bundled device code.
    environment["PYTHONPATH"] = source
    run(
        [
            sys.executable,
            "-m",
            "scripts.src.unittest_runner",
            "discover",
            "-s",
            "tests/scrapers",
            *arguments,
        ],
        env=environment,
    )


def browser_tests(arguments: Sequence[str] = ()) -> None:
    """Run the server browser against fictional transports using only the stdlib."""
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(ROOT / "custom_components/kaleidescape_companion")
    run(
        [
            sys.executable,
            "-S",
            "-m",
            "unittest",
            "discover",
            "-s",
            "custom_components/kaleidescape_companion/kaleidescape_browser/tests",
            *arguments,
        ],
        env=environment,
    )


def live_player_tests(arguments: Sequence[str] = ()) -> None:
    """Exercise the standalone module with pyk as its only dependency."""
    component = ROOT / "custom_components/kaleidescape_companion"
    environment = os.environ.copy()
    environment["PYTHONPATH"] = os.pathsep.join(
        str(component / path) for path in ("playback", "vendor")
    )
    run(
        [
            sys.executable,
            "-S",
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests/live_player",
            *arguments,
        ],
        env=environment,
    )


def integration_tests(arguments: Sequence[str] = ()) -> None:
    run(
        [
            sys.executable,
            "-m",
            "scripts.src.unittest_runner",
            "discover",
            "-s",
            "tests",
            *arguments,
        ]
    )


def frontend_tests() -> None:
    run(["npm", "--prefix", FRONTEND, "test"])


def shell_check() -> None:
    scripts = sorted(path for path in (ROOT / "scripts").iterdir() if path.is_file())
    scripts.extend(sorted((ROOT / "scripts/src").glob("*.sh")))
    for path in scripts:
        if path.read_bytes().startswith(b"#!/usr/bin/env bash"):
            run(["bash", "-n", path])


def quality_checks() -> None:
    """Fail on lint, formatting, or shell syntax before slower work."""
    lint()
    format_sources(check=True)
    shell_check()


def check_after_quality() -> None:
    """Finish the check after this process has passed the quality gate."""
    verify_pyk(reconstruct=True)
    provider_tests()
    browser_tests()
    live_player_tests()
    integration_tests()
    project_check()
    frontend_tests()
    verify_assets()


def check() -> None:
    quality_checks()
    check_after_quality()

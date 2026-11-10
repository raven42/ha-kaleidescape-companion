"""Launch an isolated local HA configuration, preserving existing local state."""

import os
import shutil
import sys
from pathlib import Path

from scripts.src import tasks


def prepare_configuration() -> Path:
    configuration = tasks.ROOT / ".ha-dev"
    components = configuration / "custom_components"
    if configuration.is_symlink() or components.is_symlink():
        raise ValueError("Refusing linked development configuration directories")
    components.mkdir(parents=True, exist_ok=True, mode=0o700)
    configuration.chmod(0o700)
    components.chmod(0o700)
    source = tasks.ROOT / "custom_components/kaleidescape_companion"
    target = components / "kaleidescape_companion"
    if target.is_symlink() and target.readlink() == source:
        pass
    elif target.exists() or target.is_symlink():
        raise ValueError(f"Refusing to overwrite {target}")
    else:
        target.symlink_to(source, target_is_directory=True)
    settings = configuration / "configuration.yaml"
    if settings.is_symlink():
        raise ValueError("Refusing linked development configuration file")
    if not settings.exists():
        # Exclusive creation also avoids following a concurrently created link.
        with settings.open("x") as destination:
            with (tasks.ROOT / "scripts/config/ha-development.yaml").open() as template:
                shutil.copyfileobj(template, destination)
    return configuration


def main():
    tasks.verify_pyk()
    configuration = prepare_configuration()
    executable = Path(sys.executable).parent / "hass"
    os.execv(
        executable,
        [str(executable), "--config", str(configuration), "--debug", *sys.argv[1:]],
    )


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))

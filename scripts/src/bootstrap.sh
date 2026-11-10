#!/usr/bin/env bash
# Shared interpreter selection for the thin, executable scripts/ entry points.
set -euo pipefail
umask 077
COMPANION_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPANION_ENVIRONMENT="${COMPANION_VENV:-$COMPANION_ROOT/.venv}"
if [[ "$COMPANION_ENVIRONMENT" != /* ]]; then
  echo "COMPANION_VENV must be an absolute virtual-environment path." >&2
  exit 2
fi
cd "$COMPANION_ROOT"

companion_bootstrap_python() {
  COMPANION_INTERPRETER="${COMPANION_PYTHON:-python3}"
  if ! command -v "$COMPANION_INTERPRETER" >/dev/null 2>&1; then
    echo "Python is missing. Install the supported Python version or set COMPANION_PYTHON." >&2
    exit 2
  fi
}

companion_venv_python() {
  COMPANION_INTERPRETER="$COMPANION_ENVIRONMENT/bin/python"
  if [[ ! -x "$COMPANION_INTERPRETER" ]]; then
    echo "Development environment is missing. Run scripts/setup first." >&2
    exit 2
  fi
}

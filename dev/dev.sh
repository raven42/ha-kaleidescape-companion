#!/usr/bin/env bash
# Run from any directory. All HA state stays inside this checkout.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PYK_SOURCE="${COMPANION_PYK_PATH:-$ROOT/../pykaleidescape}"

use_pyk() {
  .venv/bin/python dev/check_pyk.py "$PYK_SOURCE"
  export PYTHONPATH="$PYK_SOURCE${PYTHONPATH:+:$PYTHONPATH}"
}

case "${1:-help}" in
  setup)
    if [[ ! -x .venv/bin/python ]]; then
      python3 -m venv .venv
    fi
    .venv/bin/python -m pip install -e '.[dev]'
    (cd frontend && npm ci)
    ;;
  check)
    use_pyk
    PYTHONPATH="$ROOT/custom_components/kaleidescape_companion:$PYTHONPATH" .venv/bin/python -m unittest discover -s tests/scrapers
    .venv/bin/python -m unittest discover -s tests
    .venv/bin/python dev/check_project.py
    .venv/bin/ruff check .
    .venv/bin/ruff format --check .
    bash -n dev/dev.sh
    (
      cd frontend
      npm run lint
      npm run lint:markdown
      npm run format:docs:check
      npm run format:check
      npm test
      npm run build
    )
    ;;
  python-test)
    use_pyk
    exec .venv/bin/python -m unittest discover -s tests -v
    ;;
  preview)
    cd frontend
    exec npm run dev
    ;;
  audit)
    # Network advisory scans are separate from the reproducible local checks.
    audit_status=0
    .venv/bin/python -m pip_audit --skip-editable || audit_status=1
    npm --prefix frontend audit || audit_status=1
    exit "$audit_status"
    ;;
  ha)
    use_pyk
    if [[ -L .ha-dev || -L .ha-dev/custom_components ]]; then
      echo "Refusing linked development configuration directories" >&2
      exit 1
    fi
    mkdir -p .ha-dev/custom_components
    chmod 700 .ha-dev .ha-dev/custom_components
    target="$ROOT/.ha-dev/custom_components/kaleidescape_companion"
    source="$ROOT/custom_components/kaleidescape_companion"
    if [[ -L "$target" && "$(readlink "$target")" == "$source" ]]; then
      :
    elif [[ -e "$target" || -L "$target" ]]; then
      echo "Refusing to overwrite $target" >&2
      exit 1
    else
      ln -s "$source" "$target"
    fi
    if [[ ! -e .ha-dev/configuration.yaml ]]; then
      cp dev/ha-development.yaml .ha-dev/configuration.yaml
    fi
    exec .venv/bin/hass --config "$ROOT/.ha-dev" --debug
    ;;
  *)
    echo "Usage: bash dev/dev.sh {setup|check|python-test|audit|preview|ha}"
    ;;
esac

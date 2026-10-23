#!/usr/bin/env bash
# Run from any directory. All HA state stays inside this checkout.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

case "${1:-help}" in
  setup)
    if [[ ! -x .venv/bin/python ]]; then
      python3 -m venv .venv
    fi
    .venv/bin/python -m pip install -e '.[dev]'
    (cd frontend && npm ci)
    ;;
  check)
    .venv/bin/python -m unittest discover -s tests
    .venv/bin/python scripts/check_scaffold.py
    .venv/bin/ruff check .
    .venv/bin/ruff format --check .
    (cd frontend && npm run build)
    ;;
  preview)
    cd frontend
    exec npm run dev
    ;;
  ha)
    mkdir -p .ha-dev/custom_components
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
      cp scripts/ha-development.yaml .ha-dev/configuration.yaml
    fi
    exec .venv/bin/hass --config "$ROOT/.ha-dev" --debug
    ;;
  *)
    echo "Usage: bash scripts/dev.sh {setup|check|preview|ha}"
    ;;
esac

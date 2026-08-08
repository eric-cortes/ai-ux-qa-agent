#!/usr/bin/env bash
# Start the FastAPI backend and the Next.js frontend together.
# Ctrl-C stops both.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
API_PORT="${API_PORT:-8000}"

# Prefer the API virtualenv if present, else fall back to the system interpreter.
if [ -x "$API_DIR/.venv/bin/uvicorn" ]; then
  UVICORN=("$API_DIR/.venv/bin/uvicorn")
else
  UVICORN=(python3 -m uvicorn)
fi

pids=()

cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting API on http://localhost:$API_PORT ..."
( cd "$API_DIR" && exec "${UVICORN[@]}" app.main:app --reload --port "$API_PORT" ) &
pids+=($!)

echo "Starting web on http://localhost:3000 ..."
( cd "$ROOT_DIR" && exec pnpm dev:web ) &
pids+=($!)

# Exit (and trigger cleanup) as soon as either process dies.
# Poll instead of `wait -n` so this works on macOS's stock bash 3.2.
while kill -0 "${pids[0]}" 2>/dev/null && kill -0 "${pids[1]}" 2>/dev/null; do
  sleep 1
done

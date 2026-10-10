#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() { printf '%s\n' "$*"; }
die() { log "ERROR: $*"; exit 2; }

# Load .env safely
if [[ -f ".env" ]]; then
  set -a; source ".env"; set +a
else
  die ".env file not found. Copy .env.example to .env and fill values."
fi

: "${ORGANIZATION:=wesship}"
: "${WORKSPACE_DIR:=$HOME/DevonnAI_AutoHealer}"
[[ -n "${GITHUB_TOKEN:-}" || "${CLONE_PROTOCOL:-https}" == "ssh" ]] || die "GITHUB_TOKEN required for HTTPS cloning"

mkdir -p "$WORKSPACE_DIR"
PIDS=()
cleanup() { for pid in "${PIDS[@]:-}"; do kill "$pid" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT

log "Installing Python deps..."
python3 -m pip install -r requirements-devonn.txt

log "Cloning/pulling all org repos..."
python3 clone_repos_auto.py

log "Starting Hermes orchestrator..."
python3 run_devonn_ai.py > hermes.log 2>&1 &
PIDS+=("$!")
log "Hermes PID: ${PIDS[-1]}"

# Auto-detect MCP API
MCP_PATH=""
if [[ -f "src/main.py" ]]; then
  MCP_PATH="src.main:app"
elif [[ -f "command_center/app.py" ]]; then
  MCP_PATH="command_center.app:app"
fi

if [[ -n "$MCP_PATH" ]]; then
  log "Starting MCP API via uvicorn $MCP_PATH..."
  if [[ -f "requirements.txt" ]]; then
    python3 -m pip install -r requirements.txt || true
  fi
  python3 -m uvicorn "$MCP_PATH" --reload --port 8000 > mcp_api.log 2>&1 &
  PIDS+=("$!")
  log "MCP API PID: ${PIDS[-1]} (log: mcp_api.log)"
else
  log "Skipping MCP API startup (no src/main.py or command_center/app.py found)"
fi

# Auto-detect React dashboard
REACT_DIR=""
if [[ -d "command_center/frontend" ]]; then
  REACT_DIR="command_center/frontend"
elif [[ -d "frontend" ]]; then
  REACT_DIR="frontend"
fi

if [[ -n "$REACT_DIR" ]]; then
  log "Starting React dashboard in $REACT_DIR..."
  pushd "$REACT_DIR" >/dev/null
  npm install
  npm start > react_dashboard.log 2>&1 &
  PIDS+=("$!")
  popd >/dev/null
  log "React PID: ${PIDS[-1]} (log: $REACT_DIR/react_dashboard.log)"
else
  log "Skipping React dashboard startup (no frontend found)"
fi

log "✅ Devonn.ai Auto-Healer Mesh deployed."
log "Tailing hermes.log (Ctrl+C to stop everything)..."
tail -f hermes.log

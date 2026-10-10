#!/usr/bin/env bash
set -euo pipefail

# Ruflo / Claude Code multi-agent setup for DEVONN.AI.
# Run from the repository root after cloning the project locally.

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required. Install Node first, then rerun this script." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 22 ]; then
  echo "Node.js 22+ is required. Current: $(node -v)" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI was not found. Install and authenticate Claude Code, then rerun this script." >&2
  exit 1
fi

echo "Installing/updating Ruflo..."
npm install -g ruflo@latest

echo "Initializing Ruflo workspace files..."
npx ruflo@latest init

echo "Registering Ruflo MCP server with Claude Code..."
claude mcp add ruflo -- npx ruflo@latest mcp start || true

echo "Done. Open Claude Code in this repo and approve the Ruflo MCP server when prompted."
echo "Suggested first swarm prompt:"
echo 'Use Ruflo in hierarchical mode. Audit DEVONN.AI for deployment blockers, domain/DNS issues, security regressions, failing tests, and agent-orchestration gaps. Read before writing, do not touch secrets, and produce a patch plan before edits.'

#!/usr/bin/env bash
set -euo pipefail

echo "=== DEVONN.AI Repo Entropy Scan ==="

scan_section() {
  local title="$1"
  local command="$2"
  echo ""
  echo "--- $title ---"
  bash -c "$command" || true
}

scan_section "Tracked .env Files" "git ls-files | grep -E '(^|/)\\.env($|\\.)'"

scan_section "Potential Python Artifacts In Root" "find . -maxdepth 2 -type f \( -name '*.pyc' -o -name '*.pyo' -o -name '__pycache__' \)"

scan_section "Duplicate Workflow Names" "grep -R '^name:' .github/workflows | sed 's/^.*name:[ ]*//' | sort | uniq -d"

scan_section "Legacy Branch References" "grep -RIn 'develop' .github/workflows"

scan_section "Deprecated Node Pins" "grep -RIn 'actions/setup-node@[0-9a-f]\{40\}' .github/workflows"

scan_section "Potential Dead Scripts" "find scripts -type f | while read -r f; do name=$(basename \"$f\"); refs=$(grep -R \"$name\" .github package.json Makefile 2>/dev/null | wc -l); if [ \"$refs\" -le 1 ]; then echo \"$f\"; fi; done"

scan_section "Environment-Bound Workflows" "grep -RIlE 'azure|aws|vercel|render|railway|gcp|docker login' .github/workflows"

scan_section "High-Cost CI Signals" "grep -RIlE 'mutation|stryker|benchmark|chaos|k6|load test' .github/workflows"

scan_section "Large Top-Level Directories" "du -sh ./* 2>/dev/null | sort -hr | head -20"

scan_section "Node Modules Accidentally Tracked" "git ls-files | grep '^node_modules/'"

scan_section "Potential Secret-Like Tokens" "grep -RInE 'ghp_|github_pat_|AKIA|AIza|sk-' . --exclude-dir=.git --exclude='*.md'"

echo ""
echo "Entropy scan complete. Review findings before production lock."

#!/usr/bin/env bash
# DEVONN.AI — PR Triage Report
# Read-only snapshot of every open PR, bucketed by action.
# Run before bulk-triage.sh so you know what will happen.
#
# Usage: bash scripts/pr-triage-report.sh
# Requires: gh CLI authed against the target repo.

set -euo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; R=$'\033[0;31m'; C=$'\033[0;36m'; NC=$'\033[0m'

echo "${BOLD}── DEVONN.AI Open PR Triage Report ──${NC}"
echo

TMP=$(mktemp)
gh pr list --state open --limit 200 \
  --json number,title,author,isDraft,labels,mergeable,reviewDecision,headRefName,createdAt \
  > "$TMP"

TOTAL=$(jq 'length' "$TMP")
echo "Open PRs: ${BOLD}$TOTAL${NC}"
echo

bucket() {
  local label="$1" color="$2" filter="$3"
  local rows
  rows=$(jq -r "$filter | \"  #\(.number)  \(.author.login)  —  \(.title)\"" "$TMP")
  local n
  n=$(echo "$rows" | grep -c '^' 2>/dev/null || echo 0)
  [[ -z "$rows" ]] && n=0
  echo "${color}${BOLD}[$label]${NC} ($n)"
  [[ "$n" -gt 0 ]] && echo "$rows"
  echo
}

# 1. Stale Copilot drafts — close
bucket "CLOSE — Stale Copilot drafts" "$R" '
  .[] | select(.isDraft == true)
      | select((.author.login | test("copilot"; "i")))
      | select(.title | test("DeploymentContext|barrel export|lockfile|normalize|fix.*build"; "i"))
'

# 2. Dependabot MAJOR bumps — strip auto-merge, manual review
bucket "REVIEW — Dependabot major bumps" "$Y" '
  .[] | select(.author.login == "app/dependabot" or .author.login == "dependabot")
      | select(.title | test("bump (tailwindcss|vite|react-day-picker|react|react-router-dom|@tanstack/react-query|zod|@types/react)"; "i"))
      | select(.title | test("from [0-9]+\\.[^ ]+ to [0-9]+"; "x") | not)
'

# 3. Dependabot PATCH/MINOR — safe to auto-merge
bucket "MERGE — Safe Dependabot patches" "$G" '
  .[] | select((.author.login | test("dependabot"; "i")))
      | select(.title | test("bump|upgrade|fix"; "i"))
      | select(.title | test("major"; "i") | not)
'

# 4. Everything else — human review
bucket "HUMAN — Needs manual triage" "$C" '
  .[] | select((.author.login | test("copilot|dependabot"; "i")) | not)
'

echo "${DIM}Next: bash scripts/bulk-triage.sh           # dry run${NC}"
echo "${DIM}      bash scripts/bulk-triage.sh --apply   # execute${NC}"

rm -f "$TMP"

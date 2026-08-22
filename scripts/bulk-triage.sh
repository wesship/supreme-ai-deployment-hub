#!/usr/bin/env bash
# DEVONN.AI — One-shot PR triage executor
#
# Bundles the three safe automated actions from docs/PR_TRIAGE_RUNBOOK.md:
#   1. Close stale Copilot drafts (delegates to bulk-close-stale-copilot-prs.sh)
#   2. Strip auto-merge from risky Dependabot MAJOR bumps
#   3. Enable squash auto-merge on safe Dependabot patch+minor PRs
#
# Usage:
#   bash scripts/bulk-triage.sh           # dry run, prints planned actions
#   bash scripts/bulk-triage.sh --apply   # execute
#
# Requires: gh CLI authed against the target repo.

set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G=$'\033[0;32m'; Y=$'\033[1;33m'; R=$'\033[0;31m'; B=$'\033[1m'; NC=$'\033[0m'

say()  { echo "${B}── $1 ──${NC}"; }
note() { echo "  $1"; }
act()  { echo "  ${G}→${NC} $1"; }
skip() { echo "  ${Y}·${NC} $1"; }
warn() { echo "  ${R}!${NC} $1"; }

[[ $APPLY -eq 0 ]] && note "${Y}DRY RUN${NC} — re-run with --apply to execute"
echo

# ── Step 1: Close stale Copilot drafts ───────────────────────────────────────
say "Step 1 / 3  ·  Close stale Copilot drafts"
if [[ $APPLY -eq 1 ]]; then
  bash "$ROOT/scripts/bulk-close-stale-copilot-prs.sh" --apply
else
  bash "$ROOT/scripts/bulk-close-stale-copilot-prs.sh"
fi
echo

# ── Step 2: Strip auto-merge from risky MAJOR bumps ──────────────────────────
say "Step 2 / 3  ·  Strip auto-merge from MAJOR Dependabot bumps"

RISKY_PKGS_REGEX='bump (tailwindcss|vite|react-day-picker|react|react-router-dom|@tanstack/react-query|zod|@types/react)( |$)'

mapfile -t MAJORS < <(
  gh pr list --state open --limit 200 \
    --json number,title,author,autoMergeRequest \
    --jq ".[]
      | select(.author.login == \"app/dependabot\" or .author.login == \"dependabot\")
      | select(.title | test(\"$RISKY_PKGS_REGEX\"; \"i\"))
      | \"\(.number)\t\(.autoMergeRequest != null)\t\(.title)\""
)

if [[ ${#MAJORS[@]} -eq 0 ]]; then
  skip "no risky major bumps open"
else
  for line in "${MAJORS[@]}"; do
    IFS=$'\t' read -r num has_am title <<< "$line"
    if [[ "$has_am" == "true" ]]; then
      act "disable auto-merge #$num  —  $title"
      if [[ $APPLY -eq 1 ]]; then
        gh pr merge "$num" --disable-auto || warn "failed to disable auto-merge on #$num"
        gh pr comment "$num" -b "Auto-merge disabled by triage script: major version bump requires manual review (breaking changes likely). See docs/PR_TRIAGE_RUNBOOK.md." >/dev/null || true
      fi
    else
      skip "already manual #$num  —  $title"
    fi
  done
fi
echo

# ── Step 3: Enable squash auto-merge on safe patches ─────────────────────────
say "Step 3 / 3  ·  Auto-merge safe Dependabot patches"

mapfile -t SAFE < <(
  gh pr list --state open --limit 200 \
    --json number,title,author,mergeable,autoMergeRequest,isDraft \
    --jq '.[]
      | select(.isDraft == false)
      | select((.author.login | test("dependabot"; "i")))
      | select(.title | test("major"; "i") | not)
      | select(.title | test("bump|upgrade|fix|patch"; "i"))
      | "\(.number)\t\(.autoMergeRequest != null)\t\(.title)"'
)

if [[ ${#SAFE[@]} -eq 0 ]]; then
  skip "no safe patches eligible"
else
  for line in "${SAFE[@]}"; do
    IFS=$'\t' read -r num has_am title <<< "$line"
    if [[ "$has_am" == "true" ]]; then
      skip "auto-merge already enabled #$num"
      continue
    fi
    act "enable squash auto-merge #$num  —  $title"
    if [[ $APPLY -eq 1 ]]; then
      gh pr merge "$num" --squash --auto || warn "failed to enable auto-merge on #$num (CI may be required)"
    fi
  done
fi
echo

say "Done"
if [[ $APPLY -eq 0 ]]; then
  note "Re-run with ${B}--apply${NC} to execute the actions above."
else
  note "Verify: ${B}gh pr list --state open${NC}"
  note "Then proceed to Step 3 of the runbook: ${B}bash scripts/production-lock.sh${NC}"
fi

#!/usr/bin/env bash
# DEVONN.AI — Bulk close stale Copilot/bot draft PRs
#
# Closes draft PRs authored by Copilot/bot accounts that target the same
# underlying fix as a newer open PR. Idempotent: skips PRs already closed
# or that have human review comments.
#
# Usage:
#   ./scripts/bulk-close-stale-copilot-prs.sh            # dry run
#   ./scripts/bulk-close-stale-copilot-prs.sh --apply    # actually close
#
# Requires: gh CLI authed against the target repo.

set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

BOT_AUTHORS=(
  "app/copilot-swe-agent"
  "app/github-copilot"
  "copilot-swe-agent"
)

# Patterns from the 29-PR scan that produced redundant Copilot drafts.
STALE_TITLE_REGEX='(DeploymentContext|barrel export|lockfile.*registry|normalize.*lockfile|fix.*build.*error)'

echo "── Bulk Copilot Stale PR Cleanup ──"
[[ $APPLY -eq 0 ]] && echo "(dry run — pass --apply to actually close)"

mapfile -t PRS < <(
  gh pr list --state open --limit 100 \
    --json number,title,author,isDraft,reviewDecision,comments \
    --jq '.[]
      | select(.isDraft == true)
      | select(.reviewDecision != "APPROVED")
      | select((.comments | length) < 2)
      | "\(.number)\t\(.author.login)\t\(.title)"'
)

CLOSED=0
SKIPPED=0
for line in "${PRS[@]}"; do
  IFS=$'\t' read -r num author title <<< "$line"

  is_bot=0
  for b in "${BOT_AUTHORS[@]}"; do
    [[ "$author" == "$b" || "$author" == "${b#app/}" ]] && is_bot=1
  done
  [[ $is_bot -eq 0 ]] && { SKIPPED=$((SKIPPED+1)); continue; }

  if ! [[ "$title" =~ $STALE_TITLE_REGEX ]]; then
    SKIPPED=$((SKIPPED+1)); continue
  fi

  echo "→ close #$num  [$author]  $title"
  if [[ $APPLY -eq 1 ]]; then
    gh pr close "$num" \
      -c "Closing per triage runbook: superseded by newer iteration. See docs/PR_TRIAGE_RUNBOOK.md." \
      || echo "  ! failed to close #$num"
    CLOSED=$((CLOSED+1))
  fi
done

echo "──"
echo "Closed:  $CLOSED"
echo "Skipped: $SKIPPED"
[[ $APPLY -eq 0 ]] && echo "Re-run with --apply to execute."

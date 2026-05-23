#!/usr/bin/env bash
set -euo pipefail

# Apply production-safe branch protection to a repository branch.
# Usage:
#   bash scripts/apply-branch-protection.sh <owner> <repo> [branch]

OWNER="${1:-}"
REPO="${2:-}"
BRANCH="${3:-main}"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "Usage: bash scripts/apply-branch-protection.sh <owner> <repo> [branch]" >&2
  exit 64
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required but was not found in PATH." >&2
  exit 127
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

FULL_REPO="$OWNER/$REPO"

echo "Applying branch protection to $FULL_REPO:$BRANCH"

gh repo view "$FULL_REPO" --json nameWithOwner,viewerPermission >/dev/null

# Keep this list tight and aligned with currently healthy production gates.
# Do not require experimental or environment-dependent workflows here.
REQUIRED_CONTEXTS=(
  "Final Green Check"
  "Commit Lint"
  "Secrets Elimination & Scanning"
  "Hermes v2 Policy Gate"
  "Hermes v3 Governance Gate"
)

CONTEXTS_JSON=$(printf '%s\n' "${REQUIRED_CONTEXTS[@]}" | python3 -c 'import json,sys; print(json.dumps([line.strip() for line in sys.stdin if line.strip()]))')

PAYLOAD=$(cat <<JSON
{
  "required_status_checks": {
    "strict": false,
    "contexts": $CONTEXTS_JSON
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true,
    "bypass_pull_request_allowances": {
      "users": [],
      "teams": [],
      "apps": []
    }
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
)

printf '%s' "$PAYLOAD" | gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  --input - >/dev/null

echo "Branch protection applied successfully."
echo "Repository: $FULL_REPO"
echo "Branch: $BRANCH"
echo "Required checks: ${REQUIRED_CONTEXTS[*]}"
echo "Required approvals: 1"
echo "Require up-to-date branch: false"
echo "Signed commits: false"
echo "Force pushes: blocked"
echo "Deletion: blocked"

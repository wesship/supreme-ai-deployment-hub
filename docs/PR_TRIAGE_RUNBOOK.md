# DEVONN.AI — PR Triage Runbook

Status: ACTIVE
Owner: wesship/supreme-ai-deployment-hub
Goal: Reduce 29 open PRs → ≤5 intentional PRs before production lock.

---

## Three-Bucket Triage

Every open PR belongs in exactly **one** bucket. No "maybe" pile.

### 🔴 Bucket A — CLOSE (redundant / stale / superseded)

Criteria (any one):
- Copilot/bot draft with newer iteration of same fix open
- No commits for 14+ days AND no human comments
- Targets a problem already solved on `main`
- Duplicate of another open PR

Action: `gh pr close <N> -c "Superseded — closing per triage runbook"`

Bulk action: see `scripts/bulk-close-stale-copilot-prs.sh`.

### 🟡 Bucket B — MERGE (safe, owner-approved)

Criteria (all):
- CI green
- Authored by a maintainer OR Dependabot for a reviewed patch/minor update
- No major-version bump (guard workflow enforces this)
- Touches ≤ 3 files OR is a pure dependency patch

Action: `gh pr merge <N> --squash --auto`

### 🟢 Bucket C — REVIEW (needs eyes)

Criteria:
- Touches `supabase/migrations/**`, `src/integrations/supabase/**`, `.github/workflows/**`, or `policy/**`
- Major-version dependency bump
- Author-requested review
- Open > 30 days but still active

Action: assign reviewer, add `needs-manual-review` label, schedule.

---

## Known Dangerous Auto-Merge Candidates

The Dependabot guard workflow (`.github/workflows/dependabot-auto-merge-guard.yml`)
strips the `auto-merge` label from these regardless of CI state:

| Package | Risk | Reason |
|---|---|---|
| `tailwindcss` v3→v4 | 🔴 Breaking | Engine rewrite, config format change |
| `vite` v5→v8 | 🔴 Breaking | Plugin API + Rollup 4 change |
| `react-day-picker` v8→v9 | 🔴 Breaking | Component API rename |
| `react` 18→19 | 🔴 Breaking | Server components / refs |
| `react-router-dom` 6→7 | 🔴 Breaking | Data router default |
| `@tanstack/react-query` 4→5 | 🔴 Breaking | Query/Mutation API shape |
| `zod` 3→4 | 🟡 Breaking | Edge functions depend on v3 |

---

## Tonight's Execution Order

```bash
# 1. Close stale Copilot drafts (Bucket A)
bash scripts/bulk-close-stale-copilot-prs.sh

# 2. Strip auto-merge from dangerous Dependabot PRs (Bucket C → manual)
for PR in $(gh pr list --author "dependabot[bot]" --json number,title \
            --jq '.[] | select(.title | test("tailwindcss|vite|react-day-picker|react@|router-dom|react-query|zod")) | .number'); do
  gh pr edit "$PR" --remove-label auto-merge --add-label needs-manual-review
done

# 3. Merge safe Dependabot patches (Bucket B)
gh pr list --search "is:open is:pr label:auto-merge" --limit 200 \
  --json number,author --jq '.[]
    | select(.author.login == "app/dependabot" or .author.login == "dependabot" or .author.login == "dependabot[bot]")
    | .number' |
  while IFS= read -r pr; do
    [ -n "$pr" ] || continue
    gh pr merge "$pr" --squash --auto
  done

# 4. Review remaining PRs manually (Bucket C)
gh pr list --label needs-manual-review
```

Target state after run: **≤ 9 open PRs**, all intentional.

---

## Weekly Cadence (Post-Lock)

- Monday: triage any new PRs into A/B/C
- Thursday: merge Bucket B
- Stale workflow auto-closes A after 14 days

END OF RUNBOOK

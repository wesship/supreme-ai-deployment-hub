# Devonn.AI — GitHub UI Configuration Guide

This document provides exact, step-by-step instructions for completing all
remaining manual configuration in the GitHub UI. No credentials need to be
shared. Every field value is specified exactly.

---

## Step 1 — Fix GitHub Billing

**URL:** https://github.com/settings/billing

1. Click **Manage spending limit** under GitHub Actions.
2. Set the spending limit to at least **$10/month** (or higher based on your usage).
3. If there is a failed payment, click **Update payment method** and resolve it.
4. Confirm the change.

> **Why this matters:** Every single CI run is currently failing with
> `"account payments have failed or spending limit needs to be increased"`.
> This is the root cause of all CI failures. Nothing else works until this is resolved.

---

## Step 2 — Enable Secret Scanning & Push Protection

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/security_analysis

Enable each of the following toggles:

| Setting | Action |
|---------|--------|
| Dependency graph | **Enable** |
| Dependabot alerts | **Enable** |
| Dependabot security updates | **Enable** |
| Secret scanning | **Enable** |
| Push protection | **Enable** |

> **Why this matters:** Secret scanning will retroactively scan the entire git
> history and alert you to any secrets that were committed (including the
> `.env` file and Terraform plan artifacts from previous CI runs).

---

## Step 3 — Configure Dependabot

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/security_analysis

After enabling Dependabot alerts above, the `dependabot.yml` file in the
Phase 3 package already configures automated PRs for `npm`, `pip`, and
`github-actions` ecosystems. No additional UI configuration is needed beyond
enabling the toggle.

---

## Step 4 — Configure Actions Permissions

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/actions

### 4a. Actions permissions
- Select: **Allow all actions and reusable workflows**
  *(or restrict to "Allow actions created by GitHub" if you want maximum security)*

### 4b. Workflow permissions
- Select: **Read and write permissions**
  *(Required for the `release.yml` semantic-release workflow to push tags and
  create GitHub Releases)*
- Check: **Allow GitHub Actions to create and approve pull requests**
  *(Required for the `auto-fix.yml` to open automated fix PRs)*

### 4c. Fork pull request workflows
- Select: **Require approval for first-time contributors**

---

## Step 5 — Enable Branch Protection (Ruleset)

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/rules

> Use **Rulesets** (the modern approach) rather than the legacy Branch
> Protection Rules. Rulesets are more flexible and support multiple branches.

### 5a. Create a new Ruleset

Click **New ruleset** → **New branch ruleset**.

Fill in the form with these exact values:

| Field | Value |
|-------|-------|
| Ruleset name | `Protect main` |
| Enforcement status | **Active** |
| Bypass list | Add: `Repository admin` (so you can hotfix in emergencies) |
| Target branches | Click **Add target** → **Include by pattern** → enter `main` |

### 5b. Branch Rules — enable all of the following:

**Restrict creations**
- Toggle: **ON**
- *(Prevents anyone from creating a branch named `main` from scratch)*

**Restrict updates**
- Toggle: **ON**

**Restrict deletions**
- Toggle: **ON**

**Require linear history**
- Toggle: **ON**
- *(Enforces squash or rebase merges — keeps git history clean)*

**Require deployments to succeed before merging**
- Toggle: **ON**
- Environment: select **staging** *(create this environment first — see Step 5c)*

**Require signed commits**
- Toggle: **ON** *(optional but recommended for a production AI repo)*

**Require a pull request before merging**
- Toggle: **ON**
- Required approvals: **1**
- Check: **Dismiss stale pull request approvals when new commits are pushed**
- Check: **Require review from Code Owners** *(if you add a CODEOWNERS file)*
- Check: **Require approval of the most recent reviewable push**

**Require status checks to pass**
- Toggle: **ON**
- Check: **Require branches to be up to date before merging**
- Click **Add checks** and add each of the following (they will appear after
  the first CI run passes):
  - `build`
  - `test`
  - `typecheck-and-lint`
  - `codeql`

**Block force pushes**
- Toggle: **ON**

Click **Create** to save the ruleset.

### 5c. Create GitHub Environments

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/environments

Create three environments in this order:

**Environment 1: `development`**
- No required reviewers
- No wait timer
- Add secret: `VERCEL_TOKEN` (your Vercel deploy token)

**Environment 2: `staging`**
- Required reviewers: add yourself
- Wait timer: 0 minutes
- Add secret: `VERCEL_TOKEN`

**Environment 3: `production`**
- Required reviewers: add yourself
- Wait timer: **5 minutes** (gives you time to cancel a bad deploy)
- Check: **Prevent self-review** if you have a team
- Add secrets:
  - `VERCEL_TOKEN`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `RDS_DB_PASSWORD`

---

## Step 6 — Add Repository Secrets

**URL:** https://github.com/wesship/supreme-ai-deployment-hub/settings/secrets/actions

Click **New repository secret** for each of the following. These are required
by the hardened workflows generated across all phases.

| Secret Name | Where to Get the Value |
|-------------|------------------------|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Settings → General → Reference ID |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Vercel Dashboard → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | Vercel Dashboard → Project → Settings → General → Project ID |
| `AWS_ACCESS_KEY_ID` | AWS IAM Console (rotate the old one first) |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Console (rotate the old one first) |
| `RDS_DB_PASSWORD` | AWS RDS Console → Modify instance |
| `JWT_SECRET` | Run: `openssl rand -hex 64` in your terminal |
| `ENCRYPTION_KEY` | Run: `openssl rand -hex 32` in your terminal |
| `SLACK_WEBHOOK_URL` | https://api.slack.com/apps → Incoming Webhooks |
| `INFRACOST_API_KEY` | https://dashboard.infracost.io → Settings → API Keys |
| `CODECOV_TOKEN` | https://codecov.io → your repo → Settings → General |
| `SENTRY_DSN` | https://sentry.io → your project → Settings → Client Keys |
| `DEVONN_COORDINATOR_URL` | Your deployed coordinator service URL |
| `OPENCLAW_BRIDGE_URL` | Your deployed openclaw service URL |

---

## Step 7 — Apply the Code Changes

After completing Steps 1–6 in the GitHub UI, apply the generated code packages
from your local machine:

```bash
# 1. Clone the repo (if not already done)
git clone https://github.com/wesship/supreme-ai-deployment-hub.git
cd supreme-ai-deployment-hub

# 2. Stop the runaway cron via GitHub CLI
gh workflow disable auto-fix.yml --repo wesship/supreme-ai-deployment-hub

# 3. Close stale bot PRs
bash ~/phase0-unblockers/close_stale_prs.sh --dry-run   # preview first
bash ~/phase0-unblockers/close_stale_prs.sh              # then execute

# 4. Apply all 9 hardening phases
bash ~/phase0-unblockers/mega_apply_all_phases.sh
git add .
git commit -m "chore: apply complete 9-phase hardening"
git push origin main

# 5. Apply Phase 10 (agent mesh + feature flags)
bash ~/phase10-fixes/apply_phase10_fixes.sh
npm install zod @sentry/react @supabase/supabase-js
git add .
git commit -m "feat: phase 10 — agent mesh, feature flags, e2e, migrations"
git push origin main

# 6. Apply Supabase migrations
supabase db push
```

---

## Completion Checklist

| # | Task | Location | Done? |
|---|------|----------|-------|
| 1 | Fix GitHub billing | github.com/settings/billing | ☐ |
| 2 | Enable secret scanning + push protection | repo/settings/security_analysis | ☐ |
| 3 | Set Actions workflow permissions to Read/Write | repo/settings/actions | ☐ |
| 4 | Create branch ruleset for `main` | repo/settings/rules | ☐ |
| 5 | Create `development`, `staging`, `production` environments | repo/settings/environments | ☐ |
| 6 | Add all 20 repository secrets | repo/settings/secrets/actions | ☐ |
| 7 | Disable `auto-fix.yml` via `gh workflow disable` | Terminal | ☐ |
| 8 | Close stale PRs via `close_stale_prs.sh` | Terminal | ☐ |
| 9 | Apply all phases via `mega_apply_all_phases.sh` | Terminal | ☐ |
| 10 | Apply Phase 10 via `apply_phase10_fixes.sh` | Terminal | ☐ |
| 11 | Run `supabase db push` | Terminal | ☐ |
| 12 | Rotate `OPENAI_API_KEY` at platform.openai.com | Browser | ☐ |
| 13 | Rotate `RDS_DB_PASSWORD` in AWS RDS Console | Browser | ☐ |
| 14 | Rotate Supabase `service_role` key | Browser | ☐ |

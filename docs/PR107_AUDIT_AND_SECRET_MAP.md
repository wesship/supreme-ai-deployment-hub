# PR #107 Audit Report, Secret Map & CI Stabilization Guide

> Generated: May 17, 2026 | Repository: `wesship/supreme-ai-deployment-hub`

---

## Part 1 — Security Audit Results

### 1.1 Hardcoded Secrets Scan

| Check | Result |
|-------|--------|
| AWS Access Key IDs (`AKIA...`) | **CLEAN** |
| OpenAI API Keys (`sk-...`) | **CLEAN** |
| Hardcoded passwords in workflows | **CLEAN** |
| Hardcoded secrets in Helm values | **CLEAN** |
| `.env` files tracked in git | **⚠️ ACTION REQUIRED** |

### 1.2 .env Files Currently Tracked in Git

The following files are committed to the repository and must be handled before merging:

| File | Risk | Action |
|------|------|--------|
| `.env` | **HIGH** — contains live Supabase project ID and anon key | Untrack immediately |
| `.env.example` | LOW — template only, no real values | Keep, rename to `.env.template` |
| `.env.production.template` | LOW — template only | Keep |
| `scaffold/devonn-coordinator/.env.example` | LOW — template only | Keep |

**The `.env` file contains:**
```
VITE_SUPABASE_PROJECT_ID="bqkpxdjmpbucenbppxzc"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  ← anon JWT
VITE_SUPABASE_URL="https://bqkpxdjmpbucenbppxzc.supabase.co"
```

The `VITE_SUPABASE_PUBLISHABLE_KEY` is a Supabase **anon key** (public-safe by design), but the project ID and URL expose your Supabase project to enumeration. These should be moved to Vercel environment variables and the `.env` file untracked.

**Fix — run these commands before merging:**
```bash
cd ~/supreme-ai-deployment-hub
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "security: untrack .env file from git history"
git push origin hardening/all-phases
```

### 1.3 docker-compose.yml Hardcoded Dev Credentials

The `docker-compose.yml` contains hardcoded local development credentials:
```yaml
DATABASE_URL=postgresql://devonn:devonn_secret@db:5432/devonn_dev
POSTGRES_PASSWORD: devonn_secret
```

**Risk:** LOW — these are intentional local-dev-only credentials, not production secrets. However, they should be noted. The `docker-compose.yml` is for local development only and should never be used in production.

**No action required** — this is acceptable for a local dev stack.

---

## Part 2 — Complete GitHub Secrets Map

Add all of these at: **Settings → Secrets and variables → Actions → New repository secret**

### Tier 1 — CRITICAL (CI will fail immediately without these)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `build.yml`, `testing.yml`, `deploy.yml`, `issue-trigger.yml` |
| `GITHUB_TOKEN` | **Auto-provided by GitHub** — no action needed | All workflows |
| `GH_TOKEN` | Create a PAT with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens) | `auto-merge-snyk.yml`, `create-project-board.yml` |
| `GH_TOKEN_WRITE` | Same PAT as above, or a separate one with `repo` + `workflow` scopes | `issue-trigger.yml` |

### Tier 2 — HIGH (Vercel deployments will fail without these)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) | `promotion.yml` |
| `VERCEL_ORG_ID` | Vercel Dashboard → Settings → General → Team ID | `promotion.yml` |
| `VERCEL_PROJECT_ID` | Vercel Dashboard → Project → Settings → General → Project ID | `promotion.yml` |
| `VERCEL_PREVIEW_URL` | Your Vercel preview domain e.g. `devonn-ai.vercel.app` | `deploy.yml`, `deploy-and-publish.yml` |

### Tier 3 — HIGH (Supabase edge functions will fail without these)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) | `supabase-edge-functions.yml` |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project → Settings → API → `anon` key | `supabase-edge-functions.yml` |
| `SUPABASE_PROJECT_ID` | `bqkpxdjmpbucenbppxzc` (already in your `.env`) | `supabase-edge-functions.yml` |

### Tier 4 — MEDIUM (AWS workflows will fail without these)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `AWS_ROLE_ARN` | AWS Console → IAM → Roles → your EKS deploy role → ARN | `ai-model-pipeline.yml`, `cost-optimization.yml`, `iac-drift-detection.yml`, `infrastructure-ci-cd.yml`, `terraform-aws.yml` |
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Users → Security credentials | `infrastructure-ci-cd.yml`, `terraform.yml` |
| `AWS_SECRET_ACCESS_KEY` | Same as above | `infrastructure-ci-cd.yml`, `terraform.yml` |
| `AWS_REGION` | e.g. `us-east-1` | `infrastructure-ci-cd.yml` |
| `RDS_DB_PASSWORD` | Your RDS instance password (rotate first!) | `infrastructure-ci-cd.yml` |

### Tier 5 — MEDIUM (Observability and notifications)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `SLACK_WEBHOOK_URL` | Slack → Apps → Incoming Webhooks | `deploy.yml`, `azure-container-apps-deploy.yml`, `terraform.yml` |
| `SLACK_WEBHOOK_DEPLOYS` | Separate Slack webhook for deploy channel | `promotion.yml` |
| `SLACK_WEBHOOK_OPS` | Separate Slack webhook for ops/alerts channel | `iac-drift-detection.yml` |
| `SLACK_WEBHOOK_COSTS` | Separate Slack webhook for cost channel | `cost-optimization.yml` |
| `VITE_SENTRY_DSN` | [sentry.io](https://sentry.io) → Project → Settings → Client Keys | `promotion.yml` |
| `CODECOV_TOKEN` | [codecov.io](https://codecov.io) → Repository settings | `build.yml`, `testing.yml`, `coverage.yml` |
| `SNYK_TOKEN` | [app.snyk.io/account](https://app.snyk.io/account) | `testing.yml`, `deploy-and-publish.yml` |

### Tier 6 — LOW (Chrome extension publishing — only needed for releases)

| Secret Name | Where to Get It | Used By |
|-------------|-----------------|---------|
| `CHROME_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials | `deploy.yml`, `deploy-and-publish.yml` |
| `CHROME_CLIENT_SECRET` | Same as above | `deploy.yml`, `deploy-and-publish.yml` |
| `CHROME_EXTENSION_ID` | Chrome Web Store Developer Dashboard | `deploy.yml`, `deploy-and-publish.yml` |
| `CHROME_REFRESH_TOKEN` | Generated via OAuth flow | `deploy.yml`, `deploy-and-publish.yml` |
| `NPM_TOKEN` | [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens) | `release.yml` |
| `HUGGINGFACE_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | `ai-model-pipeline.yml` |
| `INFRACOST_API_KEY` | [infracost.io](https://www.infracost.io) → API keys | `cost-optimization.yml` |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` | `deploy-and-publish.yml` |

---

## Part 3 — GitHub Environments Required

Create these at: **Settings → Environments → New environment**

| Environment Name | Required Reviewers | Used By |
|------------------|-------------------|---------|
| `development` | None | `promotion.yml` |
| `staging` | 1 reviewer (you) | `promotion.yml` |
| `production` | 1 reviewer (you) | `promotion.yml`, `deploy-and-publish.yml` |
| `canary` | None | `deploy-and-publish.yml` |

---

## Part 4 — CI Stabilization: First Post-Merge Run Strategy

### Workflows That Will Pass Immediately (no secrets needed)
- `auto-merge.yml` — uses `GITHUB_TOKEN` (auto-provided)
- `stale-pr-cleanup.yml` — uses `GITHUB_TOKEN` (auto-provided)
- `bundle-size.yml` — uses `GITHUB_TOKEN` (auto-provided)
- `codeql.yml` — uses `GITHUB_TOKEN` (auto-provided)
- `commitlint.yml` — uses `GITHUB_TOKEN` (auto-provided)
- `dependency-review.yml` — uses `GITHUB_TOKEN` (auto-provided)

### Workflows That Will Fail Without Secrets (add these first)
Add these **before merging** to prevent the first CI run from failing:

**Minimum viable secret set (5 secrets = core CI goes green):**
```
OPENAI_API_KEY       → prevents build.yml and testing.yml from failing
CODECOV_TOKEN        → prevents coverage upload step from failing
SNYK_TOKEN           → prevents Snyk scan from failing
VERCEL_TOKEN         → prevents Vercel deploy from failing
VERCEL_ORG_ID        → prevents Vercel deploy from failing
VERCEL_PROJECT_ID    → prevents Vercel deploy from failing
```

### Workflows Safe to Disable Until Services Are Ready
These workflows reference services (Azure, GCP, Chrome Web Store) that may not be configured yet. Add `if: false` to disable them temporarily:

- `azure-container-apps-deploy.yml` — requires Azure credentials
- `terraform.yml` — requires Azure + GCP credentials
- `ai-model-pipeline.yml` — requires HuggingFace + AWS OIDC
- `cost-optimization.yml` — requires Infracost API key

---

## Part 5 — Pre-Merge Checklist

Complete these steps **before clicking Merge** on PR #107:

- [ ] **Revoke the PAT** at https://github.com/settings/tokens
- [ ] **Untrack `.env`**: `git rm --cached .env && git commit -m "security: untrack .env" && git push origin hardening/all-phases`
- [ ] **Add minimum viable secrets** (Tier 1 + Vercel from Tier 2)
- [ ] **Create GitHub Environments**: `development`, `staging`, `production`, `canary`
- [ ] **Fix GitHub billing** at https://github.com/settings/billing
- [ ] **Review the diff** at https://github.com/wesship/supreme-ai-deployment-hub/pull/107/files

After merge:
- [ ] Watch **Actions tab** — identify first failing workflow
- [ ] Add remaining secrets from Tier 3–6 as needed
- [ ] Run `supabase db push` to apply the two new migrations
- [ ] Enable branch protection on `main`

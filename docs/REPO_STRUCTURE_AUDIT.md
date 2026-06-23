# DEVONN.AI — Repo Structure Audit

Generated as part of Wave-Final production lock. Maps top-level zones, their
purpose, and governance status relative to `GOVERNANCE_LOCK_MANIFEST.md`.

## Top-level zones

| Path | Purpose | Governance |
|---|---|---|
| `src/` | React 18 + Vite frontend (TypeScript). Pages, components, hooks, services. | Open to edits via PR |
| `src/integrations/supabase/` | **Auto-generated** Lovable Cloud client + types. | **Protected** — never edit |
| `supabase/` | Edge functions, migrations, `config.toml`. | Migrations protected; `project_id` locked |
| `backend/` | FastAPI orchestration layer (`api.d3vonn.io`). Agents, mesh, auth, tenancy. | Open to PR |
| `scaffold/` | Coordinator / hub / bridge service scaffolds (FastAPI). | Open to PR |
| `k8s/`, `infrastructure/`, `gitops/`, `infra/` | Kubernetes manifests, Helm values, Argo apps. | Infra workflows only run on `main` |
| `terraform/aws/` | IaC: EKS, ECR, network, bootstrap backend. | Drift-detected by CI |
| `helm-values/` | falco, kube-prometheus-stack, loki. | Versioned |
| `hermes/`, `hermes/v3/` | Policy + risk engine (OPA, secrets, IAM, firewall). | Open to PR |
| `policy/` | OPA / Kyverno / Falco / Tetragon / seccomp policy bundle. | Required for cluster admission |
| `.github/workflows/` | CI/CD (build, test, deploy, governance-drift, ci-auth-debugger). | Protected — branch rules apply |
| `scripts/` | Bootstrap, deploy, rotate-secrets, **production-lock.sh**. | Open |
| `docs/` | Architecture, runbooks, deployment, audit reports (`PR107_AUDIT_AND_SECRET_MAP.md`). | Open |
| `tests/`, `load-tests/`, `src/__tests__/` | Vitest, Playwright e2e, k6 load, chaos (pod-failure). | Required for green merge |
| `manifest.json`, `background.js`, `popup.*`, `settings.*`, `icons/` | Chrome MV3 extension surface. | Requires `/privacy-policy` for Web Store |
| `models/llm/mistral-7b/` | Model container + deployment spec. | Open |
| `config/{dev,staging,production,canary,ai}/` | Per-env values, model registry. | Required for promotion gates |

## Required files (governance manifest)

- [x] `GOVERNANCE_LOCK_MANIFEST.md`
- [x] `.github/workflows/governance-drift.yml`
- [x] `.github/workflows/ci-auth-debugger.yml`
- [x] `README.md`
- [x] `package.json`
- [x] `supabase/config.toml`
- [x] `scripts/production-lock.sh`

## Protected paths (do not edit directly)

- `src/integrations/supabase/client.ts` (auto-generated)
- `src/integrations/supabase/types.ts` (auto-generated)
- `.env` (managed by Lovable Cloud)
- `supabase/migrations/*` (append-only; new migrations via tool)
- `supabase/config.toml` `project_id` field

## Public surface

- `/` — marketing landing
- `/privacy`, `/privacy-policy` — Chrome Web Store-compliant privacy policy ✅
- `/terms`
- `/about`, `/contact`
- `/dashboard`, `/command-center`, `/mcp`, `/manifest`, `/status`
- `/film`, `/moneyhub`, `/therapy`, `/jarvis` (AI ecosystem)

## Hybrid backend

- **Supabase** (Lovable Cloud) — auth, RLS-protected data, edge functions, storage
- **FastAPI** (`api.d3vonn.io`) — agent mesh, multi-tenant orchestration, long-running tasks
- **n8n** — workflow automation, 1100+ templates
- **MCP servers** — Hostinger, Vercel, AWS via `public.mcp_connections`

## Outstanding final-mile items

1. Configure `GH_PAT` secret (use `ci-auth-debugger.yml` to verify)
2. Tag canonical release `v1.0-prod-lock` after `production-lock.sh` passes
3. Enable branch protection on `main` (require: governance-drift, ci-auth-debugger, final-green-check)
4. Submit Chrome extension (privacy URL now live: `https://d3vonn.io/privacy-policy`)

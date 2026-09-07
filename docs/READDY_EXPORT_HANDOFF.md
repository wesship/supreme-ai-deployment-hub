# Readdy Export → D3VONN.IO Merge Handoff

**Target repo:** `wesship/supreme-ai-deployment-hub`  
**Staging branch:** `readdy-export-20260906`  
**Production base:** `main`

## Goal

Import the Readdy frontend plus only genuinely additive Supabase Edge Functions / forward-only migration SQL, without replacing D3VONN.IO's canonical FastAPI backend, auth/security boundaries, CI, or production runtime.

## Current authority already on `main`

- `/api/admin/overview` already exists behind the FastAPI admin boundary.
- Marketplace already uses the canonical `agent_registry` through `/api/marketplace/agents` and `/api/marketplace/health`.
- Do **not** create a second `marketplace_agents` table.
- Do **not** add a duplicate `admin-overview` Edge Function unless the Readdy export contains behavior that is genuinely missing and cannot be implemented safely behind the existing FastAPI authority.

## File map

| Readdy export | D3VONN.IO repo path | Merge action |
|---|---|---|
| Admin page / admin UI | `src/pages/Admin.tsx` | **manual-merge** presentation only; preserve `AdminRoute`, `useAdminData`, auth checks, and `/api/admin/*` |
| Marketplace page | `src/pages/AgentMarketplace.tsx` | **manual-merge** visual/UX changes; keep live `/api/marketplace/agents` data source |
| Marketplace components | `src/components/marketplace/*` | **take-readdy / manual-merge** per component |
| Marketplace types/adapters | `src/types/marketplace.ts` and relevant hooks/data modules | **manual-merge** against current `agent_registry` contract |
| AI Agents page | `src/pages/AIAgents.tsx` | **manual-merge** presentation only; preserve canonical agent APIs/governance |
| Shared Readdy UI/components/assets | `src/components/*`, `src/assets/*`, `public/*` | **take-readdy** only when additive and referenced |
| Readdy route changes | `src/App.tsx` | **manual-merge**; never replace wholesale |
| Readdy `admin-overview` Edge Function | `supabase/functions/admin-overview/index.ts` | **reject by default** because FastAPI `/api/admin/overview` already exists |
| Other Readdy Edge Functions | `supabase/functions/<function-name>/index.ts` | **additive/manual-review**; reject duplicates, direct service-role exposure, or weaker auth |
| Readdy SQL for `marketplace_agents` | — | **reject / map to existing `agent_registry`**; no duplicate marketplace schema |
| Other genuinely missing Readdy SQL | `supabase/migrations/<new_timestamp>_<descriptive_name>.sql` | **forward-only migration** after schema + RLS reconciliation |
| Readdy config/dependency files | `package.json`, `pnpm-lock.yaml`, `vite.config.*`, `tailwind.config.*`, `supabase/config.toml`, `vercel.json` | **manual-merge only**; never replace wholesale |

## Preserve from current repo

Do **not** replace or remove:

- `backend/` or the canonical FastAPI runtime.
- `backend/app/routers/admin.py`, `backend/marketplace/*`, or `backend/agents/*` merely to match Readdy.
- `src/components/auth/AdminRoute.tsx`, admin role/auth enforcement, or existing protected-route behavior.
- `.github/workflows/*`, deployment/security configuration, or historical migrations.
- Existing Supabase RLS/security policy unless a reviewed forward-only migration explicitly tightens or extends it.
- Existing product routes: Security Ops, Research OS, PRIMETIME, AI Films, Hermes, Voice, THE DOOR, OCC, marketplace, and agents.

## Developer merge order

1. Drop the raw Readdy export into a temporary local worktree; do not copy it over the repo root.
2. Port frontend files first and classify every changed file as `keep-repo`, `take-readdy`, `manual-merge`, or `reject`.
3. For every Readdy Edge Function, check FastAPI and existing `supabase/functions/` first. Add only missing behavior.
4. For every SQL file, reconcile against current `supabase/migrations/`; create a new timestamped forward-only migration instead of editing historical SQL.
5. Run:
   - `pnpm install --frozen-lockfile`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - `pnpm ci:doctor`
   - `pnpm workflow:audit`
   - `pnpm security:scan`
6. Preview-test `/`, `/admin`, `/marketplace`, `/ai-agents`, auth, OCC, Security Ops, Research OS, PRIMETIME, AI Films, Hermes, Voice, and THE DOOR.
7. Open the integration PR from `readdy-export-20260906` to `main`; merge only when the exact PR head is green.

## First PR scope

Prefer a narrow first PR: Readdy presentation changes for `/admin`, marketplace, and `/ai-agents`, plus only genuinely missing Edge Function/schema support. Keep FastAPI, `agent_registry`, Supabase Auth/RLS, and all existing production controls authoritative.

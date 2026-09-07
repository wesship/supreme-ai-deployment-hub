# Readdy Export → D3VONN.IO Merge Handoff

**Target repo:** `wesship/supreme-ai-deployment-hub`  
**Staging branch:** `readdy-export-20260906`  
**Production base:** `main`

## Goal

Import the Readdy frontend, additive Supabase Edge Functions, and forward-only migration SQL without replacing D3VONN.IO's canonical FastAPI backend, auth/security boundaries, CI, or production runtime.

## File map

| Readdy export | D3VONN.IO repo path | Merge action |
|---|---|---|
| Admin page / admin UI | `src/pages/Admin.tsx` | **manual-merge** into existing OCC/Admin UI; preserve `AdminRoute`, `useAdminData`, auth checks, and `/api/admin/*` server boundary |
| Marketplace page | `src/pages/AgentMarketplace.tsx` | **manual-merge** visual/UX changes |
| Marketplace components | `src/components/marketplace/*` | **take-readdy / manual-merge** per component |
| Marketplace types/data adapters | `src/types/marketplace.ts` and relevant hooks/data modules | **manual-merge** against existing marketplace contracts |
| AI Agents page | `src/pages/AIAgents.tsx` | **manual-merge** presentation only; preserve canonical agent APIs/governance |
| Shared Readdy UI/components/assets | `src/components/*`, `src/assets/*`, `public/*` | **take-readdy** only when additive and referenced by imported pages |
| Readdy route changes | `src/App.tsx` | **manual-merge**; never replace wholesale |
| `admin-overview` Edge Function | `supabase/functions/admin-overview/index.ts` | **additive only**; keep authenticated boundary and do not supersede equivalent FastAPI admin authority |
| Other Readdy Edge Functions | `supabase/functions/<function-name>/index.ts` | **additive/manual-review**; reject duplicates or weaker auth implementations |
| Readdy SQL creating `marketplace_agents` or other missing schema | `supabase/migrations/<new_timestamp>_<descriptive_name>.sql` | **forward-only migration**; reconcile with current schema/RLS before adding |
| Readdy config/dependency files | `package.json`, `pnpm-lock.yaml`, `vite.config.*`, `tailwind.config.*`, `supabase/config.toml`, `vercel.json` | **manual-merge only**; never replace wholesale |

## Preserve from current repo

Do **not** replace or remove:

- `backend/` or the canonical FastAPI runtime.
- `backend/app/routers/admin.py`, `backend/marketplace/*`, or `backend/agents/*` merely to match Readdy.
- `src/components/auth/AdminRoute.tsx`, admin role/auth enforcement, or existing protected-route behavior.
- `.github/workflows/*`, production deployment/security configuration, or existing migrations.
- Existing Supabase RLS/security policy unless a reviewed forward-only migration explicitly tightens or extends it.
- Existing product routes: Security Ops, Research OS, PRIMETIME, AI Films, Hermes, Voice, THE DOOR, OCC, marketplace, and agents.

## Developer merge order

1. Drop the raw Readdy export into a temporary local worktree; do not copy it over the repo root.
2. Port frontend files first and classify each changed file as `keep-repo`, `take-readdy`, `manual-merge`, or `reject`.
3. Add Edge Functions only after checking whether FastAPI already provides equivalent behavior.
4. Reconcile SQL against current `supabase/migrations/`; create new timestamped forward-only migrations instead of editing historical migrations.
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
7. Open a PR from `readdy-export-20260906` to `main`; merge only when the exact PR head is green.

## PR scope recommendation

Keep the first PR narrow: Readdy `/admin` presentation + marketplace/agents presentation + only genuinely missing Edge Function/schema support. Do not convert D3VONN.IO from FastAPI to Readdy/Supabase Edge Functions.

# Vercel Staging Notes

Frontend staging remains Vercel-first.

## Expected project shape

- Frontend source: `services/frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Vite

## Required environment variables

- `VITE_API_BASE_URL`
- `VITE_ORCHESTRATOR_URL`
- `VITE_SUPABASE_URL` if Supabase is active
- `VITE_SUPABASE_PUBLISHABLE_KEY` if Supabase is active

## Deployment rule

Do not point production `devonn.ai` traffic at this staging branch until:

1. `staging-ci.yml` passes.
2. API `/health` passes.
3. Orchestrator `/health` and `/ready` pass.
4. Guardrails remain in `dry-run` / `guarded` mode.
5. No secrets are committed.

## Follow-up extraction

The current root repository has existing Vercel configuration. This staging layer documents the target. The next PR should either:

1. copy the current frontend into `services/frontend`, or
2. update Vercel root directory settings to match the existing frontend location while retaining this staging contract.

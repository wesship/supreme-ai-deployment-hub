# D3VONN.IO Readdy UI Rebuild — Source of Truth

Status: active rebuild contract

## Source of truth

The current D3VONN.IO public marketing presentation is the Readdy UI baseline. The rebuild does not depend on a separate raw Readdy export.

The existing production presentation may be refactored and consolidated, but the rebuild must preserve the recognizable D3VONN/Readdy visual language, public information architecture, SEO semantics, analytics, accessibility, and operational boundaries.

## Phase 1 public surfaces

Only these six marketing routes are in the Readdy rebuild scope:

- `/`
- `/solutions`
- `/ai-agents`
- `/pricing`
- `/about`
- `/resources`

## Protected authorities

The rebuild must not replace or weaken:

- FastAPI backend and `/api/*` contracts
- Supabase Auth/RLS
- Hermes orchestration/runtime
- MoneyHub
- Security Ops / admin authorization
- AI Films
- Voice Studio / ElevenLabs integrations
- OCC / protected application routes
- GitHub CI/security workflows
- Vercel/Railway deployment configuration

## Rebuild strategy

1. Treat the current homepage visual system as the canonical Readdy baseline.
2. Consolidate shared public marketing chrome into reusable components.
3. Keep `src/index.css` and `tailwind.config.ts` authoritative for global design tokens.
4. Migrate the five secondary marketing pages onto the same public shell and visual grammar.
5. Preserve route-specific SEO metadata and content meaning.
6. Validate each step with TypeScript, lint, tests, accessibility, Lighthouse, security scans, and Vercel Preview.

## Explicit non-goals

- No wholesale `src/App.tsx` replacement.
- No generated backend/auth/database code from UI tooling.
- No duplicate schemas or Edge Functions.
- No direct production database changes.
- No visual rebuild of protected product surfaces in this phase.

# D3VONN.IO Readdy UI Rebuild — Source of Truth

Status: active rebuild contract

The current D3VONN.IO public marketing presentation is the Readdy UI baseline. The rebuild does not depend on a separate raw Readdy export.

Phase 1 rebuild scope is limited to `/`, `/solutions`, `/ai-agents`, `/pricing`, `/about`, and `/resources`.

The rebuild may refactor and consolidate presentation code, but it must preserve D3VONN routing, SEO semantics, analytics, accessibility, and the current recognizable Readdy visual language.

Protected authorities that must not be replaced or weakened include FastAPI `/api/*`, Supabase Auth/RLS, Hermes, MoneyHub, Security Ops/admin authorization, AI Films, Voice Studio/ElevenLabs, OCC, protected application routes, GitHub CI/security workflows, and Vercel/Railway deployment configuration.

Global design-system authority remains `src/index.css` and `tailwind.config.ts`. The homepage visual grammar is the canonical reference for the five secondary public marketing pages.

The rebuild must not wholesale-replace `src/App.tsx`, introduce generated backend/auth/database code, duplicate schemas or Edge Functions, or make direct production database changes.

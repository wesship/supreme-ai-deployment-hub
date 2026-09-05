# Readdy → D3VONN.IO Import Contract

Status: active integration boundary for issue #1115.

## Purpose

Readdy is a visual/marketing source only. The canonical production application remains `wesship/supreme-ai-deployment-hub`.

## Approved Phase 1 routes

- `/`
- `/solutions`
- `/ai-agents`
- `/pricing`
- `/about`
- `/resources`

`src/integrations/readdy/marketingSurfaces.ts` enforces this allowlist in code.

## Protected surfaces

Readdy output must not replace or become authoritative for authenticated or operational routes, including `/app`, `/dashboard`, `/marketplace`, `/film`, `/voice-studio`, `/moneyhub`, `/security/*`, `/admin/*`, or backend API routes.

## Authority that must remain unchanged

- Supabase authentication and RLS
- FastAPI backend and server-side provider secrets
- Hermes orchestration/runtime authority
- Marketplace canonical `agent_registry` and governed installation lifecycle
- AI Films orchestration and provider governance
- MoneyHub and financial controls
- Security Ops / admin authorization
- ElevenLabs page reader and Voice Studio integration
- canonical analytics, SEO metadata, structured data, CSP and security headers
- Vercel/Railway deployment controls and protected GitHub gates

## Import rules

1. Import React/TypeScript/Tailwind presentation code selectively; do not replace the repository root.
2. Map Readdy typography, spacing, radii, shadows and motion into existing D3VONN design tokens before adding new globals.
3. Do not copy Readdy-generated auth, Supabase, database, billing, marketplace, form backend, or API implementations.
4. Replace Readdy navigation targets with canonical D3VONN routes.
5. Preserve semantic headings, keyboard behavior, reduced-motion support and readable text so the global ElevenLabs page reader can extract page content.
6. Keep marketing assets optimized and local or explicitly governed; do not hotlink temporary builder assets.
7. Every transplanted route must pass mobile/responsive checks, Accessibility CI, Lighthouse, bundle checks, Snyk/Gitleaks/CodeQL, Vercel preview and `D3VONN Required PR Gate`.

## Required source handoff

The actual visual transplant begins when the Readdy project code export (React/Next.js or React/TypeScript source) is made available in GitHub or as an attached archive. Until that source exists, this repository intentionally contains only the guarded landing zone and no fabricated Readdy UI.

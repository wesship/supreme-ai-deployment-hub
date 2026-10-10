# Readdy Visual Transplant Intake

## Status

The guarded Readdy integration boundary is merged on `main` via PR #1199.

No raw Readdy-generated React/TypeScript visual export is currently present in the repository branches inspected for this gate. Existing Readdy branches contain handoff documents or build specifications, not a complete visual source tree suitable for direct transplant.

## Certified Phase 1 page targets

| Route | Canonical D3VONN page | Readdy authority |
|---|---|---|
| `/` | `src/pages/Index.tsx` | presentation only |
| `/solutions` | `src/pages/Solutions.tsx` | presentation only |
| `/ai-agents` | `src/pages/AIAgents.tsx` | presentation only |
| `/pricing` | `src/pages/Pricing.tsx` | presentation only |
| `/about` | `src/pages/About.tsx` | presentation only |
| `/resources` | `src/pages/Resources.tsx` | presentation only |

The same mapping is code-enforced by `src/integrations/readdy/transplantManifest.ts`.

## Existing D3VONN design-system hosts

Readdy visual tokens must be reconciled into the current design system instead of replacing global configuration wholesale:

- `src/index.css` — semantic CSS variables, dark/light theme values, shared Matrix surfaces, focus states, typography defaults and global component classes.
- `tailwind.config.ts` — semantic color bindings, typography scale, spacing, radii, shadows, motion timings and animation definitions.

## Raw export intake rules

When the Readdy source export becomes available:

1. Put the raw export in an isolated worktree or dedicated source branch. Do not copy it over repository root.
2. Compare the Readdy route/page structure against the six certified page targets above.
3. Extract visual structure, layout, components, assets, typography, motion and interaction patterns only.
4. Map Readdy colors, spacing, type, radii, shadows and motion into the existing D3VONN token hosts before adding new global tokens.
5. Preserve D3VONN routing, auth, API clients, data hooks, analytics, SEO/schema, accessibility behavior, CSP/security headers and application providers.
6. Do not import Readdy-generated backend, auth, billing, database, marketplace authority, service-role usage, deployment configuration or secret handling.
7. Keep all protected routes outside the transplant scope. The runtime allowlist and transplant manifest must reject them.
8. Certify each transplanted page independently in a Vercel preview before combining the six surfaces.

## Per-page certification

Each transplanted route must pass:

- TypeScript and ESLint
- unit tests
- accessibility checks
- Lighthouse/performance checks
- client bundle secret scan
- Gitleaks / Snyk / CodeQL
- responsive verification at mobile, tablet and desktop breakpoints
- canonical metadata and structured-data verification
- protected-route regression checks
- Vercel preview before merge

## Next executable input

The next visual gate requires one of the following concrete source inputs:

- a Readdy-generated React/TypeScript export committed to a dedicated GitHub branch; or
- an attached Readdy source archive that can be diffed against the canonical repository.

Until that source exists, no Readdy visual code should be fabricated or inferred from screenshots/specifications.

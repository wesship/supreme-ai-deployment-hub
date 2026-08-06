# D3VONN Platform Integration

This integration extends `supreme-ai-deployment-hub` rather than replacing it.

## Reuse boundaries

- Reuse the existing Vite/React application.
- Reuse the existing FastAPI backend and `/api/admin/*` security boundary.
- Reuse the existing Hermes worker registry, leases, and recovery architecture.
- Reuse existing Supabase migration governance.
- Reuse existing CodeQL, Gitleaks, TruffleHog, dependency review, E2E, and final-green checks.
- Reuse existing Genesis and governed PRIMETIME platform work instead of creating parallel implementations.

## New shared boundary

`src/platform/d3vonn` provides a stable TypeScript boundary for:

- domain-event contracts;
- agent and marketplace manifests;
- browser-safe versus server-only environment parsing; and
- typed API event publication.

## Explicit non-goals

- No second scheduler or worker registry.
- No duplicate Supabase client.
- No database migration changes.
- No route replacement.
- No production environment changes.
- No direct production deployment.

## Recommended follow-up phases

1. Wire one existing backend event endpoint to `DomainEvent` with schema validation.
2. Reuse the contracts from Genesis/PRIMETIME/Hermes adapters where semantics match.
3. Add provenance and version fields before external marketplace publishing.
4. Extract `src/platform/d3vonn` into a workspace package only after the API surface stabilizes.
5. Promote through the repository's existing staging, security, and final-green gates.

# D3VONN.IO Readdy UI Transfer Contract

## Objective
Replace the public-facing D3VONN.IO presentation layer with the Readdy project UI while preserving the existing backend, API, authentication, Hermes orchestration, protected application routes, security controls, and deployment boundaries.

Readdy project:
- https://readdy.ai/project/dd3b402e-1da4-4fe4-954a-fad4fe9e7515

Migration branch:
- feat/readdy-d3vonn-ui-transfer

## Non-negotiable backend boundaries
The UI transfer must not change the behavior or ownership of:
- api.d3vonn.io
- FastAPI backend routes
- Hermes orchestration and worker execution
- Supabase authentication/session behavior
- Protected route authorization
- Existing API proxy boundaries
- Security/OCC/admin services
- Runtime secrets or server-only credentials
- Railway backend deployment
- Existing CSP/reporting destinations unless required for new static UI assets

## Existing application routes to preserve
The migrated frontend must continue to expose the current application capabilities, including:
- /login
- /auth
- /auth/callback
- /dashboard
- /app
- /agents
- /ai-workforce
- /workflows
- /flow
- /deployment
- /api
- /documentation
- /chat
- /voice-studio
- /admin
- /occ
- /moneyhub
- /security
- /security/ops
- /security/dashboard
- /security/command-center
- /security/secrets
- /research-os
- /market-intelligence
- /dkos-ingestion
- /jetson
- /jetson-control
- /backtesting
- /film
- /ai-films
- /ai-films/studio
- /ai-films/commerce

Public marketing routes may adopt the Readdy design directly, while protected application routes retain their existing data/auth behavior.

## Migration strategy
1. Export or retrieve the Readdy frontend source.
2. Inventory framework, components, assets, routes, fonts, animation dependencies, and global styles.
3. Port visual components into the existing Vite/React frontend.
4. Preserve current providers and runtime integrations:
   - QueryClientProvider
   - HelmetProvider
   - ThemeProvider
   - DeploymentProvider
   - APIProvider
   - ChatProvider
   - AGUIProvider
5. Keep all existing authenticated route guards.
6. Rewire Readdy buttons/forms/navigation to existing D3VONN route targets and APIs.
7. Import only browser-safe configuration.
8. Run secret/bundle scan before preview deployment.
9. Run production build, typecheck, tests, auth smoke tests, and API smoke tests.
10. Deploy preview first.
11. Verify the Readdy visual design against the source project.
12. Promote only after the protected application and backend paths pass.

## Production safety
Do not merge directly into main until:
- preview build is green
- public homepage renders
- static assets resolve
- no client startup guard is triggered
- login/auth callback works
- protected application routes render correctly
- API requests still target the existing backend
- Hermes workflows are unchanged
- no server secrets appear in the browser bundle
- CSP permits only the minimum new asset origins
- rollback deployment remains available

## Current deployment observation
At migration start, the most recent production deployments on main are failing. The last observed READY production deployment is associated with commit:
- 6d7b560d6e6f5f76664fa6d7da326c7d9b1a09b8

That deployment must remain a rollback candidate until the Readdy migration passes production smoke tests.

## Acceptance gate
The UI transfer is complete only when:
- www.d3vonn.io serves the Readdy-derived frontend
- the public homepage has no missing JS/CSS/image assets
- the existing backend remains deployed unchanged
- api.d3vonn.io remains the application API boundary
- authentication succeeds end to end
- Hermes/agent workflows remain callable
- protected routes retain authorization
- Vercel production deployment is READY
- production smoke tests pass

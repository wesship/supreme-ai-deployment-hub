# Frontend Service Migration

## Target service

`services/frontend`

## Source of truth

Current root Vite/React application:

- `package.json`
- `package-lock.json`
- `src/`
- `public/`
- `index.html`
- `vite.config.*`
- `tailwind.config.*`
- `postcss.config.*`
- `nginx.conf` for hardened production serving reference
- `Dockerfile.frontend` for hardened production image reference

## Current cut

Cut 1 does not physically move the frontend source tree. It adds a service-specific Docker adapter at `services/frontend/Dockerfile` while keeping the Docker build context at repo root.

This avoids a high-risk source move while proving the staged service boundary.

## Entrypoint

Build:

```bash
npm ci
npm run typecheck
npm run build
```

Run:

```bash
serve -s dist -l 5173
```

## Health contract

The container healthcheck verifies the static frontend responds on port `5173`.

## Environment contract

Browser-visible values only:

- `VITE_API_BASE_URL`
- `VITE_ORCHESTRATOR_URL`

Do not expose server-only credentials in frontend environment variables.

## Deferred

- physically moving root frontend files into `services/frontend`
- updating Vercel root directory
- replacing the adapter with the hardened Nginx production image
- frontend-to-API smoke test automation

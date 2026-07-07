# D3VONN.IO Production Hardening Phase 1

## Objective

Make the VPS deployment secure, observable, recoverable, and production-safe before adding more features, agents, dashboards, or integrations.

## Current evidence from repository inspection

### Already in place

- VPS Docker Compose exists at `deploy/vps/docker-compose.yml`.
- VPS Nginx main config exists at `deploy/vps/nginx/nginx.conf`.
- API virtual host exists at `deploy/vps/nginx/conf.d/d3vonn.conf`.
- Redis is internal-only through `expose: 6379` and no public host port binding.
- Backend is bound to localhost only with `127.0.0.1:${BACKEND_PORT:-8000}:8000` and is also exposed internally to Nginx.
- Backend health check targets `/health/live`.
- Nginx main config already defines gzip compression, JSON access logs, and rate-limit zones.

### Phase 1 changes applied on this branch

- Refreshed `.env.example` into a safe production template using placeholders only.
- Removed stale Railway defaults from the production-facing environment template.
- Clarified that `VITE_*` values are public and must not contain service-role secrets.
- Tightened API security headers.
- Added API HSTS for `api.d3vonn.io`.
- Added a strict API CSP.
- Added frontend security headers.
- Added frontend CSP tuned for D3VONN.IO, Supabase, and the API domain.
- Added Nginx `limit_req` usage to health, auth, API, websocket, and frontend routes.

## Critical validation before merge

Run from `deploy/vps` on the VPS:

```bash
docker compose --env-file env/.env.production -f docker-compose.yml config
docker compose --env-file env/.env.production -f docker-compose.yml exec nginx nginx -t
```

Then test the live endpoints:

```bash
curl -I https://api.d3vonn.io/health/live
curl -I https://api.d3vonn.io/health/ready
curl -I http://d3vonn.io
```

Confirm the expected headers are present:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`
- `Strict-Transport-Security` on the API domain only

## Known caution

The frontend virtual host currently serves `d3vonn.io` and `www.d3vonn.io` on port 80. Do not add global HSTS for the frontend until HTTPS termination for the frontend domain is confirmed.

## Next PR sequence

1. Validate and merge Nginx/env hardening.
2. Add or strengthen CI validation for VPS Compose and Nginx config.
3. Audit workflows and retire stale duplicate deploy paths.
4. Add observability checks for `/health/live`, `/health/ready`, logs, disk, SSL expiry, and queue depth.
5. Add Hermes/RAG/memory production audit tests.

## Production readiness checklist

### Security

- [ ] Secrets rotated if any were pasted into chat, screenshots, terminal logs, or previous commits.
- [ ] `.env.production` exists only on the VPS and is not tracked.
- [ ] Redis has no public port binding.
- [ ] Backend is not publicly exposed beyond Nginx/API routing.
- [ ] API security headers verified with `curl -I`.
- [ ] Frontend CSP tested against browser console errors.
- [ ] Rate limits tested for auth and API routes.

### Reliability

- [ ] Compose config validates.
- [ ] Nginx config validates.
- [ ] Health checks pass.
- [ ] Restart policies are present.
- [ ] SSL renewal path tested.

### Observability

- [ ] JSON Nginx logs available.
- [ ] API health endpoints available.
- [ ] Backend application logs structured.
- [ ] Queue depth monitoring defined.
- [ ] Disk usage monitoring defined.

### Agent/RAG/Hermes

- [ ] Hermes ownership documented.
- [ ] Agent task state transitions tested.
- [ ] Failed/retried/cancelled tasks visible.
- [ ] Memory scoped by user/project/session.
- [ ] RAG citations and source permissions verified.

# VPS Deployment Fixes

## Problem fixed

The previous `docker-compose.yml` mounted Supabase migrations into a plain PostgreSQL container:

```yaml
./supabase/migrations:/docker-entrypoint-initdb.d:ro
```

Those migrations call Supabase-only helpers such as `auth.uid()`. A standard `postgres:16-alpine` container does not provide Supabase's `auth` schema, so database initialization failed with:

```text
ERROR: schema "auth" does not exist
```

## Fix

The compose file no longer mounts `./supabase/migrations` into local Postgres.

Supabase migrations should be applied to the hosted Supabase project, or to a full local Supabase stack, not to the standalone Docker Postgres service.

## Server steps after pulling this fix

From `/opt/supreme-ai-deployment-hub`:

```bash
git pull
cp .env.vps.example .env
nano .env
```

Fill real values in `.env`. Do not commit `.env`.

Then reset the broken local database volume and redeploy:

```bash
docker compose down -v
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
```

## Required environment values

At minimum, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

For production, prefer the hosted Supabase database connection string for backend persistence if the backend requires Supabase-backed data.

## Validation

Check:

```bash
docker compose ps
curl -I http://localhost:5173
curl -I http://localhost:8000/health
```

Then verify the public domain:

```bash
curl -I https://d3vonn.io
```

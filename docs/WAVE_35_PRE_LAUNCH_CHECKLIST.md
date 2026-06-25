# Wave 35 Pre-Launch Checklist

_Last updated: 2026-05-27_

## Goal

Move D3VONN.IO from merged OCC milestone to production launch readiness by deploying the backend, applying the Supabase OCC migration, validating admin security, and tagging the OCC release.

## Release candidate

| Item | Value |
|---|---|
| Release target | `v1.1.0-occ` |
| OCC merge commit | `af858feed4989e2763ccdafe02a05e8aa742e05e` |
| Backend runtime | FastAPI / Uvicorn / Docker |
| Backend port | `8000` |
| Health check | `/health` |
| Admin UI | `/admin` |
| Admin API | `/api/admin/*` |

## Phase 1 — Backend deployment

Choose one deployment target first: Railway or Render.

### Railway

1. Create a Railway project from this GitHub repo.
2. Use `railway.json` from the repo root.
3. Confirm Railway builds with `backend/Dockerfile`.
4. Set required backend environment variables.
5. Deploy.
6. Confirm health:

```bash
curl -i https://<railway-service-url>/health
```

### Render

1. Create a Render Blueprint from this GitHub repo.
2. Confirm `render.yaml` points to `./backend/Dockerfile` and `./backend` context.
3. Set required secrets in the Render dashboard.
4. Deploy the `devonn-ai-backend` web service.
5. Confirm health:

```bash
curl -i https://<render-service-url>/health
```

## Phase 2 — Backend environment variables

Required for production:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ALLOWED_ORIGINS=https://d3vonn.io,https://www.d3vonn.io,https://supreme-ai-deployment-hub.vercel.app
REQUIRE_AUTH=true
ALLOW_DEV_ADMIN_BYPASS=false
```

Recommended / optional depending on enabled tools:

```bash
PINECONE_API_KEY=
PINECONE_HOST=
PINECONE_INDEX_NAME=
ELEVENLABS_API_KEY=
ASSEMBLYAI_API_KEY=
GITHUB_TOKEN=
N8N_API_KEY=
N8N_BASE_URL=
SENTRY_DSN=
DATABASE_URL=
REDIS_URL=
```

## Phase 3 — Supabase OCC migration

Apply:

```text
supabase/migrations/202605270001_occ_tables.sql
```

Then confirm the tables exist:

- `ai_request_logs`
- `tool_call_logs`
- `agent_activity_logs`
- `error_logs`
- `approval_queue`
- `user_plans`
- `rag_documents`

## Phase 4 — Admin role setup

Set the OCC admin user's Supabase Auth `app_metadata`:

```json
{
  "role": "admin"
}
```

Use a dedicated admin account where possible.

## Phase 5 — API verification

Public request must not leak data:

```bash
curl -i https://<backend-url>/api/admin/overview
```

Expected: `401`, `403`, or `503`.

Non-admin request:

```bash
curl -i \
  -H "Authorization: Bearer <non-admin-user-jwt>" \
  https://<backend-url>/api/admin/overview
```

Expected: `403`.

Admin request:

```bash
curl -i \
  -H "Authorization: Bearer <admin-user-jwt>" \
  https://<backend-url>/api/admin/overview
```

Expected: `200` with OCC summary JSON.

## Phase 6 — Frontend env alignment

Set or verify Vercel frontend variables:

```bash
VITE_API_URL=https://<backend-url>
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ENVIRONMENT=production
```

Then redeploy frontend and confirm:

```bash
curl -I https://d3vonn.io
```

## Phase 7 — OCC UI verification

1. Sign in as a non-admin user.
2. Confirm `/admin` denies or blocks privileged data.
3. Sign in as admin.
4. Confirm `/admin` loads the dashboard.
5. Confirm each OCC tab handles empty states and real records.
6. Confirm no service-role key or private provider key appears in browser devtools.

## Phase 8 — Release tag

After backend and OCC smoke tests pass:

```bash
git checkout main
git pull origin main
git tag -a v1.1.0-occ -m "D3VONN.IO Operator Command Center v1.1.0"
git push origin v1.1.0-occ
```

## Phase 9 — Post-launch monitoring

Watch for:

- Admin endpoint auth failures or unexpected 200s.
- Supabase table errors.
- AI cost logging gaps.
- RAG document manager failures.
- Approval queue stale items.
- Backend memory/cpu spikes.
- CORS failures from `d3vonn.io`.
- CI failures introduced after release tag.

## Go / no-go gate

Launch is a GO only when:

- Backend `/health` returns success.
- Public `/api/admin/overview` does not leak data.
- Non-admin receives `403`.
- Admin receives `200`.
- Supabase OCC tables exist.
- Vercel frontend points to the deployed backend.
- `/admin` works for admin user.
- Branch protection remains active.
- Release tag is created.

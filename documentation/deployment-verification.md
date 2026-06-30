# Deployment Verification Checklist

**Project:** wesship/supreme-ai-deployment-hub  
**API:** https://api.d3vonn.io  
**Last updated:** 2026-06-24

This document defines the manual and automated checks that must pass before a deployment is considered production-ready. Run these checks after every Railway deploy.

---

## 1. Railway Commit Check

Verify that Railway is running the expected commit SHA.

| Step | Action | Expected result |
| :--- | :--- | :--- |
| 1.1 | Open [railway.app](https://railway.app) → your project → **Deployments** tab | Most recent deployment shows status **Active** |
| 1.2 | Click the active deployment | Confirm the commit SHA matches the HEAD of `main` on GitHub |
| 1.3 | Check build logs for errors | No `ERROR` or `FAILED` lines in the build output |
| 1.4 | Confirm `Dockerfile.railway` was used | Build log shows `Building from Dockerfile.railway` |

**Note:** Railway uses its own GitHub App integration to trigger deploys on push to `main`. If a deploy does not appear within 2 minutes of a push, check that the GitHub App is still authorised in Railway's project settings.

---

## 2. Supabase Migration Check

Verify that all migrations have been applied to the production Supabase project.

| Step | Action | Expected result |
| :--- | :--- | :--- |
| 2.1 | Run `supabase db diff --schema public` from the repo root | Output is empty (no pending changes) |
| 2.2 | Open Supabase dashboard → **Table Editor** | Table `api_key_vault` exists with columns: `id`, `user_id`, `key_name`, `key_value_encrypted`, `created_at`, `updated_at` |
| 2.3 | Open Supabase dashboard → **Authentication → Policies** | RLS is enabled on `api_key_vault`; policies `select_own`, `insert_own`, `delete_own` are present |
| 2.4 | Check migration history | `supabase/migrations/20260624000001_api_key_vault.sql` appears in `supabase_migrations` table |

**Applying pending migrations:**
```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

---

## 3. Live Endpoint Status

Run the automated smoke test after every deploy:

```bash
python3 scripts/smoke_test.py https://api.d3vonn.io
```

All 7 checks must pass. The expected results are:

| Check | Endpoint | Expected HTTP status |
| :--- | :--- | :--- |
| Liveness | `GET /health` | `200 OK` |
| Readiness | `GET /ready` | `200 OK` |
| Deep health | `GET /health/deep` | `200 OK` with `proxy_vault` block |
| Auth gate | `GET /api/proxy/config` (no token) | `401 Unauthorized` |
| Auth gate | `GET /api/proxy/vault/keys` (no token) | `401 Unauthorized` |
| Auth gate | `POST /api/proxy/vault/keys` (no token) | `401 Unauthorized` |
| Route registration | `GET /api/openapi.json` | ≥ 3 `/api/proxy` routes present |

**Manual curl commands:**

```bash
# Liveness
curl -I https://api.d3vonn.io/health

# Deep health (includes proxy_vault readiness)
curl -s https://api.d3vonn.io/health/deep | python3 -m json.tool

# Auth gate — must return 401
curl -I https://api.d3vonn.io/api/proxy/config
```

---

## 4. Environment Variables Required in Railway

The following environment variables must be set in the Railway project for full functionality:

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL` | **Yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key for auth validation |
| `OPENAI_API_KEY` | Yes | OpenAI API access |
| `PINECONE_API_KEY` | Yes | Pinecone vector store |
| `PINECONE_INDEX` | Yes | Pinecone index name |
| `API_KEY_VAULT_SECRET` | **Strongly recommended** | Fernet key for vault encryption. Without this, vault keys are stored in plaintext. Generate with: `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `REQUIRE_AUTH` | Yes (production) | Set to `true` to enforce JWT auth. Must be `true` in production. |
| `ENVIRONMENT` | Yes | Set to `production` |

---

## 5. Post-Deploy Sign-Off

After all checks pass, record the deployment in the table below:

| Date | Commit SHA | Deployed by | Smoke test | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-06-24 | `020e4f2` | Manus AI | Pending Railway deploy | Phase 3 + Phase 4 |

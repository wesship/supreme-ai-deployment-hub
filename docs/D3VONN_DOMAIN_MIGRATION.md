# DEVONN Canonical Domain Migration to d3vonn.io

`devonn.ai` has expired and is no longer under our control. `d3vonn.io` is the canonical production domain for the DEVONN platform going forward. This runbook captures the DNS, platform, and application settings needed to complete the cutover safely.

## Frontend Hosting: Vercel

The frontend is hosted on **Vercel** via the `supreme-ai-deployment-hub` project. The deployment pipeline is:

```
Lovable → GitHub (wesship/supreme-ai-deployment-hub) → Vercel auto-deploys → d3vonn.io
```

Domains configured in Vercel:
- `d3vonn.io` — Production
- `www.d3vonn.io` — Production
- `app.d3vonn.io` — Production

## Backend Hosting: Railway

The API backend runs on **Railway** as the `devonn-ai-api` service:
- Custom domain: `api.d3vonn.io` (port 8000, uvicorn)
- Fallback domain: `devonn-ai-api-production.up.railway.app`
- Start command: `sh -c 'uvicorn backend.main:app --host 0.0.0.0 --port $PORT'`

## Production Domain Topology

| Hostname | Role | Platform |
|---|---|---|
| `d3vonn.io` | Primary public frontend | Vercel |
| `www.d3vonn.io` | Frontend alias | Vercel |
| `app.d3vonn.io` | User Dashboard | Vercel |
| `api.d3vonn.io` | Production API | Railway |

## Hostinger DNS Records

Create these records in Hostinger DNS for `d3vonn.io` and remove any conflicting parking records for the same hosts before saving.

| Type | Host | Value | Purpose |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | Root domain to Vercel |
| `CNAME` | `www` | `cname.vercel-dns.com` | `www.d3vonn.io` to Vercel |
| `CNAME` | `app` | `cname.vercel-dns.com` | `app.d3vonn.io` to Vercel |
| `CNAME` | `api` | `apiymvrdxe8.up.railway.app` | `api.d3vonn.io` to Railway |
| `TXT` | `_railway-verify.api` | `railway-verify=d924ad5d5a80fe8e6c43d63927613e2cc7b7e145509732d87dd2fa5d59bf7e56` | Railway domain verification |

### Records to Remove

| Type | Host | Value | Reason |
|---|---|---|---|
| `A` | `@` | `2.57.91.91` | Old Hostinger hosting IP, no longer used |

## Platform Settings

| Platform | Required change |
|---|---|
| Vercel | `d3vonn.io`, `www.d3vonn.io`, `app.d3vonn.io` added as Production domains ✓ |
| Hostinger | Remove old A record (`2.57.91.91`), add Vercel A record and CNAMEs above |
| Railway | `api.d3vonn.io` added as custom domain on port 8000 ✓ |
| Supabase Auth | Set Site URL to `https://d3vonn.io` and add redirect URLs for `d3vonn.io/*`, `www.d3vonn.io/*`, `app.d3vonn.io/*` |
| OAuth providers | Update callback and allowed-origin URLs to `https://d3vonn.io` |
| GitHub Actions | All workflow URLs migrated from `devonn.ai` to `d3vonn.io` ✓ |

## Verification

After DNS propagates and the platform domains are attached, verify:

```bash
nslookup d3vonn.io
nslookup www.d3vonn.io
nslookup app.d3vonn.io
nslookup api.d3vonn.io
curl -I https://d3vonn.io
curl -I https://www.d3vonn.io
curl -I https://app.d3vonn.io
curl https://api.d3vonn.io/health
```

Expected routing:

| Hostname | Expected result |
|---|---|
| `d3vonn.io` | Vercel frontend over HTTPS |
| `www.d3vonn.io` | Vercel frontend over HTTPS |
| `app.d3vonn.io` | Vercel user dashboard over HTTPS |
| `api.d3vonn.io/health` | Railway API health response over HTTPS |

## Environment Variables

### Frontend (Vercel — VITE_ prefix)
```
VITE_API_URL=https://api.d3vonn.io
VITE_APP_NAME="Supreme AI Deployment Hub"
VITE_SUPABASE_URL=https://tjygexesognbkwualywq.supabase.co
```

### Backend (Railway — server-side only)
```
CORS_ORIGINS=https://d3vonn.io,https://www.d3vonn.io,https://app.d3vonn.io
```

## Notes

- The Chrome Web Store privacy-policy URL is intentionally left as `https://devonn.ai/privacy-policy` because the extension listing currently depends on that URL. Update it only when the Chrome Web Store listing is migrated and approved for the new domain.
- The `D3vonnHeroBanner.tsx` component displays a migration notice ("devonn.ai → D3VONN.IO · Now Live") — this is intentional UX messaging.
- Deprecated workflow files (`apply-api-cname.yml`, `apply-route53-dns.yml`) retain `devonn.ai` references as guard clauses to prevent accidental re-creation of old DNS records.
- The `e2e-smoke-tests.yml` contains a guard that skips tests if the URL still points to `devonn.ai`.

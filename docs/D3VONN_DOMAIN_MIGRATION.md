# DEVONN Canonical Domain Migration to d3vonn.io

`devonn.ai` is currently treated as unavailable/expired. Until it is recovered, `d3vonn.io` is the canonical production domain for the DEVONN platform. This runbook captures the DNS, platform, and application settings needed to complete the cutover safely.

## Production Domain Topology

| Hostname | Role | Platform |
|---|---|---|
| `d3vonn.io` | Primary public frontend | Vercel |
| `www.d3vonn.io` | Frontend alias / redirect | Vercel |
| `api.d3vonn.io` | Production API | Railway |
| `app.d3vonn.io` | Optional future application subdomain | Vercel |

## Hostinger DNS Records

Create these records in Hostinger DNS for `d3vonn.io` and remove any conflicting parking records for the same hosts before saving. Keep Hostinger nameservers in place while Hostinger remains the DNS provider.

| Type | Host | Value | Purpose |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | Root domain to Vercel |
| `CNAME` | `www` | `cname.vercel-dns.com` | `www.d3vonn.io` to Vercel |
| `CNAME` | `api` | `devonn-ai-api-production.up.railway.app` | `api.d3vonn.io` to Railway |

Optional later:

| Type | Host | Value | Purpose |
|---|---|---|---|
| `CNAME` | `app` | `cname.vercel-dns.com` | Future application subdomain |

## Platform Settings

| Platform | Required change |
|---|---|
| Vercel | Add `d3vonn.io` and `www.d3vonn.io` to the frontend project. |
| Railway | Add `api.d3vonn.io` as the custom domain for the API service. |
| Supabase Auth | Set Site URL to `https://d3vonn.io` and add `https://d3vonn.io/**` to redirect URLs. |
| OAuth providers | Update callback and allowed-origin URLs to `https://d3vonn.io` and any specific callback paths used by the app. |
| GitHub Actions / deployment secrets | Replace production `devonn.ai` URLs with `d3vonn.io` equivalents. Do not commit secret values. |

## Verification

After DNS propagates and the platform domains are attached, verify:

```bash
nslookup d3vonn.io
nslookup www.d3vonn.io
nslookup api.d3vonn.io
curl -I https://d3vonn.io
curl -I https://www.d3vonn.io
curl https://api.d3vonn.io/health
```

Expected routing:

| Hostname | Expected result |
|---|---|
| `d3vonn.io` | Vercel frontend over HTTPS |
| `www.d3vonn.io` | Vercel frontend alias or redirect over HTTPS |
| `api.d3vonn.io/health` | Railway API health response over HTTPS |

## Notes

The Chrome Web Store privacy-policy URL is intentionally left as `https://devonn.ai/privacy-policy` because the extension listing currently depends on that URL. Update it only when the Chrome Web Store listing is migrated and approved for the new domain.

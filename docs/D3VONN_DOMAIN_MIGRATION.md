# DEVONN Canonical Domain Migration to d3vonn.io

`devonn.ai` has expired and is no longer under our control. `d3vonn.io` is the canonical production domain for the DEVONN platform going forward. This runbook captures the DNS, platform, and application settings needed to complete the cutover safely.

## Frontend hosting: Lovable

The frontend is hosted on Lovable. To attach `d3vonn.io`:

1. In Lovable: **Project Settings → Project → Domains → Connect Domain**, enter `d3vonn.io`.
2. Add `www.d3vonn.io` as a separate entry.
3. At Hostinger DNS, set:
   - `A   @    → 185.158.133.1`
   - `A   www  → 185.158.133.1`
   - `TXT _lovable → <value shown by Lovable>`
4. Remove conflicting A/CNAME records for `@` or `www`, especially old Vercel records such as `76.76.21.21` or `cname.vercel-dns.com`.
5. Wait for DNS propagation. Lovable auto-provisions SSL after the domain verifies.

## Production Domain Topology

| Hostname | Role | Platform |
|---|---|---|
| `d3vonn.io` | Primary public frontend | Lovable |
| `www.d3vonn.io` | Frontend alias / redirect | Lovable |
| `api.d3vonn.io` | Production API | Railway, if retained |
| `app.d3vonn.io` | Optional future application subdomain | Lovable or reserved |

## Hostinger DNS Records

Create these records in Hostinger DNS for `d3vonn.io` and remove any conflicting parking records for the same hosts before saving. Keep Hostinger nameservers in place while Hostinger remains the DNS provider.

| Type | Host | Value | Purpose |
|---|---|---|---|
| `A` | `@` | `185.158.133.1` | Root domain to Lovable |
| `A` | `www` | `185.158.133.1` | `www.d3vonn.io` to Lovable |
| `TXT` | `_lovable` | `<value shown by Lovable>` | Lovable domain verification |
| `CNAME` | `api` | `devonn-ai-api-production.up.railway.app` | `api.d3vonn.io` to Railway, if the API remains on Railway |

Optional later:

| Type | Host | Value | Purpose |
|---|---|---|---|
| `A` | `app` | `185.158.133.1` | Optional Lovable app subdomain, only if Lovable asks for it |

## Platform Settings

| Platform | Required change |
|---|---|
| Lovable | Add `d3vonn.io` and `www.d3vonn.io` to the frontend project. Copy the exact `_lovable` TXT value Lovable shows. |
| Hostinger | Remove Vercel-era apex/www records and set the Lovable A/TXT records above. |
| Railway | Add `api.d3vonn.io` as the custom domain for the API service, if the API remains on Railway. |
| Supabase Auth | Set Site URL to `https://d3vonn.io` and add `https://d3vonn.io/**` plus `https://www.d3vonn.io/**` to redirect URLs. |
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
| `d3vonn.io` | Lovable frontend over HTTPS |
| `www.d3vonn.io` | Lovable frontend alias or redirect over HTTPS |
| `api.d3vonn.io/health` | Railway API health response over HTTPS, if configured |

## Notes

The Chrome Web Store privacy-policy URL is intentionally left as `https://devonn.ai/privacy-policy` because the extension listing currently depends on that URL. Update it only when the Chrome Web Store listing is migrated and approved for the new domain.

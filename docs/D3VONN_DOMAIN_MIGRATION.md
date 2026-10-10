# D3VONN Domain Migration

## DNS Records

| Type | Host | Value | Purpose |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | Root domain to Vercel |
| `CNAME` | `www` | `cname.vercel-dns.com` | `www.d3vonn.io` to Vercel |
| `CNAME` | `app` | `cname.vercel-dns.com` | `app.d3vonn.io` to Vercel |
| `CNAME` | `api` | `ymvrdxe8.up.railway.app` | `api.d3vonn.io` to Railway |
| `TXT` | `_railway-verify.api` | `railway-verify=d924ad5d5a80fe8e6c43d63927613e2cc7b7e145509732d87dd2fa5d59bf7e56` | Railway domain verification |

### Records to Remove

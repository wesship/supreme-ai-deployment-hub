# DNS Reliability Issue — D3VONN.IO

**Status:** Open  
**Severity:** High (blocks launch readiness)  
**Date identified:** 2025-06-25  

## Problem

Direct DNS resolution for the following records fails intermittently from certain networks and execution environments:

| Record | Expected | Observed |
|--------|----------|----------|
| `d3vonn.io` (A / CNAME) | Resolves to Vercel edge | NXDOMAIN or timeout from some resolvers |
| `www.d3vonn.io` (CNAME) | Resolves to Vercel edge | NXDOMAIN or timeout from some resolvers |
| `api.d3vonn.io` (CNAME) | Resolves to API backend | NXDOMAIN or timeout from some resolvers |

The live site loads in browsers (likely due to cached DNS or different resolver paths), but programmatic `curl` from fresh environments cannot resolve any of the three records.

## Impact

- Search engine crawlers may intermittently fail to reach the site, harming indexing.
- API consumers and CI pipelines relying on `api.d3vonn.io` will experience failures.
- Monitoring and uptime checks will report false negatives.

## Recommended Actions

1. **Verify DNS records** in the registrar (or Route 53 if used):
   - `@` → `A` record or `CNAME` pointing to `cname.vercel-dns.com.`
   - `www` → `CNAME` pointing to `cname.vercel-dns.com.`
   - `api` → `CNAME` pointing to the API backend host.

2. **Check TTL values** — ensure TTLs are ≤ 300s during migration, then raise to 3600s once stable.

3. **Confirm DNSSEC** — if DNSSEC is enabled at the registrar, ensure DS records match the zone signing keys.

4. **Test propagation** using multiple tools:
   ```bash
   dig d3vonn.io @8.8.8.8
   dig d3vonn.io @1.1.1.1
   dig www.d3vonn.io @8.8.8.8
   dig api.d3vonn.io @8.8.8.8
   ```
   Or use https://dnschecker.org/ for global propagation checks.

5. **Vercel domain configuration** — in the Vercel dashboard, confirm all three domains are added and show "Valid Configuration" with no pending verification.

6. **Remove stale records** — if the domain was previously on a different provider (e.g., old Route 53 zone), ensure no conflicting NS delegations remain.

## Resolution Criteria

- All three records resolve consistently from `8.8.8.8`, `1.1.1.1`, and `9.9.9.9`.
- `curl -sI https://d3vonn.io/` returns HTTP 200 from a fresh environment.
- `curl -sI https://api.d3vonn.io/health` returns HTTP 200.

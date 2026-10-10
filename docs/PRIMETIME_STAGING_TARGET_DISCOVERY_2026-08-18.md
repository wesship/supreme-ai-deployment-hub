# PRIMETIME Staging Target Discovery — 2026-08-18

The Vercel deployment detail page for PR #965 requires a Vercel-authenticated session in the available browser context, so it did not disclose a deploy-preview target through that interface.

The repository staging runbook names `https://staging-api.d3vonn.io` as the recommended API target. A read-only navigation attempt to `https://staging-api.d3vonn.io/health` failed with DNS name-resolution error `ERR_NAME_NOT_RESOLVED`; that hostname is not currently reachable from this environment.

The executable Release 6 staging gate therefore must not be run against the documented staging API hostname. A sanctioned, resolving staging API URL is required before the gate and Release 7 authenticated operational validation can proceed.

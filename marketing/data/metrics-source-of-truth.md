# Metrics Source of Truth

Use this file to record where public metrics should be verified before publication.

## Metrics That Require Verification

| Metric | Source | Notes |
|---|---|---|
| Test count | GitHub Actions / test reports | Use exact count only when current |
| CI checks | GitHub Actions | Avoid exact counts unless verified |
| Commit count | Git history | Use flexible language if uncertain |
| Version number | VERSION / release tags | Confirm before release content |
| Deployment status | Vercel / Railway dashboards | Confirm live status before public claim |
| Security/compliance status | Formal documentation | Do not infer certification |

## Public-Safe Defaults

When exact metrics are not verified, use:

- 500+ tests
- Active production deployment
- Multi-service orchestration
- Private beta access opening
- Founder-built infrastructure

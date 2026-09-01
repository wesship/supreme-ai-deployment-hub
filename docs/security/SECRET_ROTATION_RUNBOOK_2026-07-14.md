# D3VONN.IO Secret Rotation Runbook — 2026-07-14

## Scope

This runbook covers rotation of secrets referenced by the production repository and Vercel deployment. Never commit secret values to Git.

## Rotate immediately if compromise is suspected

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_ACCESS_TOKEN`
- Supabase service-role key used by backend services
- `VERCEL_TOKEN`
- `CODECOV_TOKEN`
- `SENTRY_AUTH_TOKEN`
- AWS access keys, when configured
- VPS SSH private key, when configured
- Any GitHub personal access token or GitHub App private key used outside `GITHUB_TOKEN`

## Do not rotate as secrets

These are identifiers or public client configuration, not confidential credentials:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SENTRY_DSN`

## Safe rotation order

1. Generate a replacement in the provider dashboard.
2. Add the replacement to GitHub Actions and the production hosting environment.
3. Redeploy and run health checks.
4. Verify authentication, API calls, background jobs, and security scans.
5. Revoke the old credential only after the replacement is confirmed working.

## Provider ownership

| Secret | Generate/revoke in | Update locations |
|---|---|---|
| `JWT_SECRET` | `openssl rand -base64 64` | GitHub Actions, backend/VPS runtime |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | GitHub Actions, backend/VPS runtime |
| `OPENAI_API_KEY` | OpenAI API key dashboard | GitHub Actions, backend runtime |
| `SUPABASE_ACCESS_TOKEN` | Supabase account tokens | GitHub Actions |
| Supabase service-role key | Supabase project API settings | Backend/VPS runtime only |
| `VERCEL_TOKEN` | Vercel account tokens | GitHub Actions |
| `CODECOV_TOKEN` | Codecov repository settings | GitHub Actions |
| `SENTRY_AUTH_TOKEN` | Sentry auth tokens | GitHub Actions |
| AWS access keys | AWS IAM | GitHub Actions / cloud runtime |
| VPS SSH key | SSH key generation and VPS authorized keys | GitHub Actions, VPS |

## Validation

After each rotation:

- Run `Validate Required Secrets`.
- Run CodeQL, Gitleaks, Security Hardening, and the required PR gate.
- Verify the production API health endpoint.
- Verify `d3vonn.io`, `www.d3vonn.io`, and `app.d3vonn.io`.
- Review runtime logs for authentication failures, 401/403 spikes, and provider errors.

## Connector limitation

The connected GitHub and Vercel tools can inspect repository and deployment state, but do not expose secret-value creation, replacement, or provider-key revocation. Provider-side generation must be performed in the respective account dashboard or CLI by an authorized account owner.

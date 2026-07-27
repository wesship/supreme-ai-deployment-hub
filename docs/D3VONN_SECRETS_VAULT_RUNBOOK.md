# D3VONN Secrets Vault Runbook

## Scope

The D3VONN Secrets Vault is a metadata-only governance system. It records secret names, ownership, purpose, sensitivity, expected and verified storage locations, rotation policy, expiration, repository references, and audit history. It must never store plaintext or encrypted credential values in Supabase or Git.

## Authoritative components

- Database: `public.secret_inventory`, `public.secret_inventory_health`, and `public.secret_inventory_audit`
- Admin UI: `/security/secrets`
- Static catalog: `config/secret-inventory.json`
- Reference scanner: `scripts/audit-secret-inventory.mjs`
- Continuous audit: `.github/workflows/secret-governance.yml`
- Runtime secret stores: provider-native GitHub, Vercel, Railway, Supabase, Hostinger, OpenAI, Stripe, Resend, and Sentry stores

## Access model

- `admin`: read and modify metadata and review audit history
- everyone else: no vault access
- Supabase service role: emergency and approved automation access only

The initial release is intentionally admin-only because D3VONN.IO currently has one administrator. The UI is protected by the existing `AdminRoute`; the database independently enforces row-level security. Any future delegated read-only role requires a separate reviewed role migration, route guard, and regression tests.

## Initial verification procedure

For every inventory record:

1. Open the provider's secret or environment-variable settings.
2. Verify the name exists in the correct environment without copying its value.
3. Confirm the consuming workload still references the name.
4. Record only the verified storage location in `/security/secrets`.
5. Record the rotation date only when the provider credential has actually been rotated.
6. Mark stale names as retired after confirming no workload, workflow, or recovery process uses them.

## Platform checklist

### GitHub

Review repository and environment secrets for `development`, `staging`, and `production`. Prefer environment secrets for deployment credentials. Remove duplicates only after comparing workflow references and recent successful runs. Prefer `GITHUB_TOKEN` or OIDC over a personal access token.

### Vercel

Review Production, Preview, and Development variables separately. Only browser-safe variables may use a `VITE_` prefix. Server-only credentials must not be exposed to Vite builds.

### Railway

Review every service independently. Confirm variables belong to the correct service and environment. Remove old URLs, tokens, and duplicate aliases after deployment verification.

### Supabase

Review publishable keys, service-role keys, database credentials, access tokens, and JWT configuration. Publishable keys may be used in browsers; service-role keys and database credentials are server-only.

### Hostinger VPS

Review `.env.production`, `.env`, Docker Compose environment files, systemd unit overrides, shell history, backup archives, and deployment scripts. Secret-bearing files should be owned by the runtime account and normally use mode `600`. Do not keep plaintext copies in home-directory notes or backups.

## Rotation policy

- Critical provider and CI tokens: 90 days
- Database credentials and internal signing/encryption keys: 180 days
- SSH keys: 365 days or immediately when access changes
- Service-role keys: on suspected exposure and during controlled maintenance windows
- Public identifiers: rotate only when the provider or architecture requires it

Rotation is not complete until the old credential is revoked, every consumer is updated, a canary succeeds, and the metadata record is updated.

## Disaster recovery

Maintain one offline encrypted recovery package that contains account identifiers, recovery procedures, provider contacts, and where each credential is stored. Do not place actual secret values in this repository, Supabase inventory tables, tickets, chat messages, screenshots, or unencrypted notes.

Test recovery at least twice per year:

1. Confirm access to provider accounts using MFA/passkeys.
2. Confirm the offline encrypted package can be opened.
3. Confirm the administrator can identify where each credential is stored.
4. Rotate one non-production credential and complete a canary.
5. Record the exercise in the vault audit notes without recording values.

## Incident procedure

When exposure is suspected:

1. Revoke or rotate the credential at the provider.
2. Update all runtime stores.
3. Redeploy or restart affected workloads.
4. Search Git history, logs, artifacts, backups, issues, and chat exports for exposure.
5. Run the Secret Governance Audit and existing secret-scanning workflows.
6. Record the rotation and incident reference in vault metadata.
7. Preserve evidence without preserving the credential value.

## Repository reference audit

Run locally:

```bash
node scripts/audit-secret-inventory.mjs --strict --output=artifacts/secret-inventory-audit.json
```

A zero-reference result is a review signal, not automatic proof that a provider secret is unused. Dynamic references, external deployment configuration, and manually operated recovery credentials may not appear in the repository.

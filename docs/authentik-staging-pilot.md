# Authentik staging pilot

## Verified starting point — October 6, 2026

PR #1394 records the Client AI staging table repair, not a completed identity integration. A fresh read-only query of `auth.custom_oauth_providers` on staging `ypomzwhtaamxdmcwtpyf` returned zero rows. No Authentik issuer or client credentials were available for this gate.

`src/pages/Login.tsx` currently offers Google and password sign-in. The Supabase client uses PKCE and `/auth/callback` exchanges the authorization code. Client AI and OCC validate Supabase tokens through the authoritative Auth API; OCC additionally looks up operator roles in `public.user_roles`. Integrate Authentik upstream of Supabase so those identity and authorization boundaries remain intact.

## Public metadata preflight

Use a verified staging Authentik application issuer and a dedicated staging app origin. The following command performs read-only HTTPS requests; it does not create a provider or prove authentication works:

```sh
SUPABASE_PROJECT_REF=ypomzwhtaamxdmcwtpyf \
AUTHENTIK_ISSUER=https://YOUR-STAGING-IDP/application/o/YOUR-STAGING-APPLICATION/ \
AUTHENTIK_STAGING_APP_ORIGIN=https://YOUR-STAGING-APP \
node scripts/authentik-staging-preflight.mjs
```

The check requires an exact issuer match, authorization-code support, S256 PKCE, HTTPS endpoints, and public RSA/P-256 signing keys. Network redirects are rejected. It guards against the known production project and public production app hosts; operators must still verify that any other supplied hostname is staging. It does not verify a patched Authentik release, actual signatures, client authentication, provider registration, or app redirect allowlists.

## Configure the provider after metadata passes

1. Select an Authentik release after reviewing its security advisories and fixes. Configure a confidential OIDC client with strict redirect matching, PKCE support, and `openid profile email` scopes. Use trusted, verified email claims; inspect account-linking behavior before exposing existing accounts to a new issuer.
2. Register the callback URL shown by Supabase's staging provider form in Authentik. The expected hosted staging callback is `https://ypomzwhtaamxdmcwtpyf.supabase.co/auth/v1/callback`. This is different from the app's `/auth/callback`.
3. In the staging Supabase Auth Providers dashboard, create an OIDC provider named `custom:authentik` using the verified issuer, client ID, and server-side client secret. Keep PKCE enabled and nonce validation enabled. Use the supported dashboard/admin API, not a SQL insert into `auth` tables.
4. Allowlist the dedicated staging application's `/auth/callback` redirect in Supabase. Confirm the staging frontend and backend both target staging, because the current browser client falls back to the production project when its URL is omitted.
5. Add the app login option in a separately reviewed change after configuration is verified. Preserve existing recovery sign-in methods. Never send Authentik client secrets or Supabase privileged keys to the browser.

## Acceptance evidence required

- Login and callback complete with a Supabase session; backend accepts that session and rejects expired/invalid tokens.
- Logout ends the app/Supabase session; separately test whether the Authentik browser session remains and whether it permits immediate sign-in. Supabase sign-out does not instantly invalidate already issued access JWTs: verify the application's actual revocation/expiry behavior for sensitive operations.
- Existing-user account linking preserves the original Supabase user ID and ownership. Do not merge accounts based on untrusted email alone.
- Two independently authenticated pilot users can save/read their own Client AI data. Attempts to read, update, delete, or commit the other user's resources fail through the application API, including routes backed by service-role access.
- A normal pilot user cannot enter OCC/operator routes or bypass Hermes approval requirements.
- Disabling the custom provider restores the prior login paths; verify recovery access. Avoid deleting pilot identities that own data.

Full staging schema replay and migration-history reconciliation from PR #1394 remain separate open gates. Public metadata preflight passing does not approve deployment or production rollout.

## Validation

```sh
node --test scripts/authentik-staging-preflight.test.mjs
```

Sources: [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Authentik OAuth2/OIDC](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/), [Authentik advisories](https://github.com/goauthentik/authentik/security/advisories), [staging repair PR #1394](https://github.com/wesship/supreme-ai-deployment-hub/pull/1394).

## Railway infrastructure prepared — October 6, 2026

The connected Railway project `devonn-ai-backend` (`65a00bf6-1a68-414e-bbe9-a30052595a83`) has staging environment `14733108-698e-4c85-9370-e7417a8908b5`. Its five existing live services were not changed.

Pending patch `ef6b25c5-dcdf-4d44-9370-56344139c854` contains only creation of Authentik server, Authentik worker, PostgreSQL 18, a database volume, an S3 storage bucket, and their resource group. Final inspection reported 91 staged changes and `destructive: false`. No resources are provisioned yet; deployment will incur Railway usage charges.

The `authentik-railway` community template originally pinned 2026.5.6. Both Authentik sources were replaced in the pending patch with `ghcr.io/goauthentik/server:2026.8.3`, the official latest release verified on October 6. Its preceding 2026.8.2 release includes the September security fixes. Both server and worker use generated secrets; the worker now references the server's signing secret and bootstrap password so they are shared rather than generated independently. Values were not printed or copied into this repository.

Database connections use private networking with `AUTHENTIK_POSTGRESQL__SSLMODE=require` on both Authentik services. This encrypts transport but does not verify the database certificate; CA verification remains a production hardening gate for the template's self-signed PostgreSQL certificate.

The server template retains its `/api/v3/root/config/` HTTP health check. The connector rejected Authentik's documented `/-/health/ready/` path because its validation disallows hyphens. A subsequent attempt to stage timeout/resource limits returned `Service Instance not found` for the not-yet-created service, so no timeout or limit override was applied. Verify database readiness separately after first deployment, then correct the deployment probe through the dashboard if needed.

Before deploying, confirm this exact pending patch still contains only the new identity resources. Railway's `accept_deploy` tool requires explicit confirmation to deploy. After deployment, verify server/worker/database health, inspect secret sharing without exposing values, set the real administrator recovery email (the template placeholder is `admin@example.com`), confirm the trusted proxy configuration, and create the staging OIDC client. The generated public HTTPS domain and the OIDC issuer do not exist until deployment and provider setup complete. D3VONN.IO production login is unchanged.

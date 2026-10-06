# Authentik staging pilot

The pilot adds an optional login button to the repository-native login page. Authentik authenticates the user through a custom Supabase OIDC provider; Supabase issues the session used by the existing callback, protected routes, backend user verification, and authorization checks. Authentik tokens are not accepted directly by the existing backend.

## Staging scope

Only `Supreme_ai_deployment_hub_staging` (`ypomzwhtaamxdmcwtpyf`) is accepted by the pilot guard. Build with Vite mode `staging`, set `VITE_ENVIRONMENT=staging`, use that project's explicit HTTPS URL and browser publishable key, and set `VITE_AUTHENTIK_PILOT_ENABLED=true` only after provider setup. The default is false. A production/default-mode build cannot display the pilot. Changing the target project requires a reviewed code change.

## Provider setup

1. Obtain a reachable staging Authentik instance over HTTPS on a host with authorized deployment access. No running instance was verified during this work. `auth.d3vonn.io` is a recommended architecture endpoint, not evidence of a configured service; the request from this execution environment returned HTTP 502.
2. Select a maintained patched release. The upstream email-authenticator advisory GHSA-qgqp-xh8r-v73r identifies 2026.8.2, 2026.5.7, and 2026.2.7 as patched versions; this is not a claim that any one is the latest release. Check the full advisory set at deployment time.
3. Create a dedicated OIDC application/provider for this staging project. Use the recommended per-application issuer mode, a confidential client, exact callback URI matching, and the authorization-code flow. Do not enable unrelated grant types for the pilot.
4. In the staging Supabase Auth Providers dashboard, create `custom:authentik` using OIDC auto-discovery. Copy its displayed callback URL into the Authentik provider; do not substitute the frontend `/auth/callback` URL for the Supabase provider callback.
5. Copy the actual Authentik issuer from its discovery document into Supabase. Configure client ID, client secret, and `openid profile email` scopes. Leave PKCE and nonce validation enabled. The client secret belongs only in the server-side provider configuration, never in VITE variables or Git.
6. Allow the staging frontend callback in Supabase redirect settings. The frontend reuses `/auth/callback?redirect=...` and `exchangeCodeForSession`.
7. Limit access to enrolled pilot accounts; require MFA for operator accounts. Keep backend `user_roles` authoritative. Do not derive admin rights from user-editable metadata or automatically elevate Authentik groups.

## Acceptance evidence

- Login from a protected URL completes the callback and returns to that URL.
- Existing Google/email sign-in remains usable when the pilot is off.
- Denied IdP access and provider outages show an error without granting a session.
- Existing users retain the expected Supabase user ID and ownership when linking identities. Use test accounts; do not assume email equality proves safe linking.
- Account A cannot retrieve, modify, or queue actions for account B's Client AI profile or Genesis project. Verify actual API requests, not only route visibility.
- Ordinary users cannot access operator routes; operator authorization still comes from the backend role store.
- Invalid and expired Supabase tokens are rejected. Authentik tokens are not substituted for Supabase tokens.
- Test application logout and IdP logout separately. Signing out of Authentik does not establish that a Supabase session has been revoked. Record the intended SSO logout/session behavior.
- Verify rendered desktop/mobile UI, exact-head CI, and a signed-in pilot before production review.

## Rollback

Disable `VITE_AUTHENTIK_PILOT_ENABLED`, rebuild/redeploy staging, and disable the custom provider in staging if needed. Do not delete users or alter ownership records as rollback. The additive Client AI table repair is independent of this optional login button and should remain in place.

## References

- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://docs.goauthentik.io/add-secure-apps/providers/oauth2/
- https://docs.goauthentik.io/install-config/install/docker-compose/
- https://github.com/goauthentik/authentik/security/advisories/GHSA-qgqp-xh8r-v73r
- Staging table repair evidence: https://github.com/wesship/supreme-ai-deployment-hub/pull/1394

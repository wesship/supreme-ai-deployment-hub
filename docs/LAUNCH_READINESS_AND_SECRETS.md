# D3VONN.IO Launch Readiness and Secrets Control Plane

## Purpose

This framework provides two protected release checks:

1. A live Playwright functional audit against `https://d3vonn.io` or staging.
2. A production secret-presence preflight that prints secret names and status only, never values.

## Run the live functional audit

Open **GitHub Actions → D3VONN.IO Launch Readiness → Run workflow**.

Recommended sequence:

1. Run `chromium` against `https://d3vonn.io`.
2. Run `firefox` against `https://d3vonn.io`.
3. Run `mobile-chrome` against `https://d3vonn.io`.
4. Download the Playwright evidence artifact for screenshots, traces, and the HTML report.

## Configure production secrets

Store production values in **Repository Settings → Environments → production → Environment secrets**. The required names are maintained in `config/required-secrets.json`.

Do not commit `.env` files, API keys, passwords, service-role keys, private keys, or provider tokens.

## Infisical integration target

Use one Infisical project with `development`, `staging`, and `production` environments. Grant each workload a separate machine identity with least privilege.

Recommended synchronization targets:

- GitHub `production` environment secrets
- Vercel production environment variables
- Hostinger VPS Docker runtime
- Backend deployment environment

Prefer OIDC or short-lived machine identities. Require human approval for production changes.

## Secret preflight

When manually running the workflow, enable **check_production_secrets**. The protected `production` environment is used, so configured approval rules apply.

The validator reports only:

- `OK SECRET_NAME`
- `MISSING SECRET_NAME`
- aggregate counts

It does not print or persist secret values.

## Initial provisioning boundary

The original provider credential normally must be created or authorized by the account owner inside Supabase, OpenAI, Vercel, Hostinger, Stripe, and similar services. After authorization, Infisical can store, inject, synchronize, and rotate approved credentials.

# D3VONN n8n Gap Agents

These workflows are importable n8n JSON artifacts. They are intentionally **inactive by default** and must pass deployment-specific credential, endpoint, and compliance review before activation.

## Workflows

- `workflows/legal-assistant-agent.json` — fail-closed legal information workflow.
- `workflows/insurance-ai-agent.json` — information-only insurance workflow with licensed-agent handoff to PRIMETIME.
- `workflows/healthcare-assistant-agent.json` — emergency safety gate followed by information-only health assistance.
- `workflows/billing-stripe-subscriptions.json` — Stripe subscription lifecycle ingestion and service-side persistence.

## Required wiring

### Legal

Webhook path: `/webhook/d3vonn/legal-assistant`.

The workflow intentionally does not provide legal representation, legal advice, filing, or signing authority.

### Insurance

Set `PRIMETIME_HANDOFF_URL` to the deployed PRIMETIME handoff endpoint. Verify the receiving endpoint authenticates the caller before production activation.

### Healthcare

Review emergency keyword coverage against the jurisdiction and deployment policy. This workflow is information-only and is not a medical diagnostic service.

### Billing

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key must exist only in the n8n server credential/environment and must never be exposed to browser clients.

The Stripe webhook must perform **real Stripe signature verification at the ingress boundary** before this workflow is activated. The JSON artifact intentionally does not pretend that a placeholder verification step is production-grade cryptographic verification.

Stripe event persistence is idempotent through `billing_events.stripe_event_id`.

Subscription state is stored in `org_subscriptions` and is service-role-only at the database layer. The `workspace_id` should be included in Stripe subscription metadata when available.

## Metered billing

Subscription lifecycle is separate from usage metering. A future scheduled workflow should aggregate D3VONN usage from authoritative usage records, create Stripe meter events/invoices as appropriate, and reconcile provider responses idempotently.

## Security rules

1. Keep all four workflows inactive until credentials and endpoints are configured.
2. Do not put provider secrets in workflow JSON.
3. Use backend/service credentials only.
4. Keep regulated/high-impact actions behind the existing human/licensed-review gates.
5. Route these workflows through Hermes/ExecutionPolicy when they become production agent workloads rather than creating a second orchestration plane.

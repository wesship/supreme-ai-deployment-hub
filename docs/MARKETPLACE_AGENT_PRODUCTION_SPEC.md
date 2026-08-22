# D3VONN Marketplace Agent Production Contract

## Purpose

The four original marketplace workflows supplied by the project owner are the source designs for the Legal, Insurance, Healthcare, and Billing agents. They are **not** independent security authorities. D3VONN Identity, tenant isolation, Policy Engine, Hermes, and ExecutionPolicy remain authoritative.

## Canonical execution path

```text
Authenticated D3VONN request
        |
        v
Identity + tenant boundary
        |
        v
Policy Engine (authoritative)
        |
        +---- DENY ----------> safe response + audit
        |
        +---- REQUIRE_HUMAN -> human/regulated handoff + audit
        |
        +---- ALLOW ---------> Hermes / approved workflow
                                      |
                                      v
                                ExecutionPolicy
                                      |
                         +------------+------------+
                         |            |            |
                        n8n         native        edge
                         |
              +----------+----------+----------+
              |          |          |          |
            Legal     Insurance  Healthcare  Billing
```

## Agent boundaries

### Legal Assistant

Allowed: general legal concepts, plain-language explanation of supplied clauses, common red-flag identification, questions for an attorney.

Never: represent a user, sign/execute a document, file legal documents, claim attorney status, or present jurisdiction-specific legal conclusions as certain.

Human boundary: licensed attorney.

Required controls: authenticated identity, jurisdiction supplied rather than inferred, expanded prohibited-intent policy, request/correlation ID, policy decision audit, human escalation endpoint.

### Insurance AI

Allowed: conceptual coverage education, explanation of supplied policy material, deductibles/premiums/limits conceptually, preparation for a licensed-agent conversation.

Never: bind/modify coverage, produce a binding quote, approve/process a claim, or make a definitive state-specific coverage determination.

Human boundary: licensed insurance representative / PRIMETIME.

Required controls: authoritative upstream Policy Engine, broader restricted-intent classification, authenticated customer identity, idempotent PRIMETIME handoff, handoff audit event, authenticated internal API call.

### Healthcare Assistant

Allowed: general health information, terminology explanation, wellness/preventive information, questions for a healthcare visit, non-clinical scheduling assistance.

Never: diagnose, prescribe/recommend a specific medication or dosage, direct a user to stop/change prescribed treatment, or claim clinical certainty.

Safety boundary: emergency detection must happen before normal model execution. The current four-keyword gate is only a seed rule set and must be expanded to a dedicated safety policy/classifier with DENY/REQUIRE_HUMAN/ALLOW outcomes.

Emergency messaging must be location-aware. Do not hard-code US emergency numbers for a global deployment. If location is unavailable, instruct the user to contact their local emergency service.

Required controls: data minimization, no unnecessary memory injection, sensitive-data access controls, safety escalation audit containing minimum necessary metadata, human escalation for high-risk non-emergency cases.

### Billing / Stripe

The original workflow handles subscription lifecycle and payment-failure events. It is not sufficient for production until webhook signature verification is real.

Required event controls:

- Verify `Stripe-Signature` cryptographically before trusting the payload.
- Persist Stripe event ID for idempotency.
- Process an event at most once.
- Preserve raw/normalized event evidence according to retention policy.
- Update `org_subscriptions` through a service-side path only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.
- Do not acknowledge an event as successfully processed if the authoritative database mutation failed unless an explicit retry-safe strategy exists.
- Payment failure should trigger a dunning state and operational notification, not silently downgrade an organization.

### Metered usage

Metered usage is a separate workflow from Stripe subscription lifecycle.

Target:

```text
Authoritative D3VONN usage ledger
        |
        v
Aggregate by organization / billing period
        |
        v
Idempotent Stripe meter event
        |
        v
Reconciliation + invoice evidence
```

Usage must come from authoritative D3VONN execution measurements, not a second client-side counter.

## Shared production contract

Every marketplace agent invocation should carry:

- `request_id`
- `correlation_id`
- authenticated `user_id`
- authenticated `tenant_id` / organization ID
- agent ID and workflow version
- policy decision
- execution/provider metadata
- timestamp

Do not trust browser-supplied identity fields as authoritative.

## Provider sovereignty

The original workflows reference OpenAI directly. Production routing should instead be:

```text
Agent
  -> ExecutionPolicy
  -> approved model/provider
```

This permits local inference, customer-controlled endpoints, regional providers, and approved cloud providers without changing the marketplace agent contract.

## n8n role

n8n is an execution/integration layer. It is not the D3VONN security kernel and must not become a bypass around Identity, Policy Engine, Hermes, or ExecutionPolicy.

## Activation gates

No production activation until the relevant gate is proven:

1. Authentication and tenant isolation.
2. Authoritative upstream policy enforcement.
3. Real provider credential configuration outside source control.
4. Healthcare safety tests including false-negative and false-positive cases.
5. Legal/insurance prohibited-action tests.
6. Stripe signature verification and event idempotency.
7. HERMES/PRIMETIME handoff authentication and idempotency.
8. Audit evidence generation.
9. E2E/browser and backend certification.
10. Production runtime verification.

## Pollo / AI Films dependency

Pollo remains a provider integration dependency for AI Films. The provider adapter must remain behind ExecutionPolicy so Pollo can be added when the API key becomes available without coupling the marketplace or Hermes kernel to a single video provider.

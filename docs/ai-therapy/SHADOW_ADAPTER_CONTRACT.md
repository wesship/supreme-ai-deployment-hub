# AI Therapy Shadow Adapter Contract

Status: non-production, synthetic-only, review-required.

The shadow adapter is an external evaluation boundary. It consumes approved synthetic fixtures and emits minimal precomputed result records for the merged shadow evidence builder.

## Hard boundaries

- `production_enabled` is always `false`.
- `user_facing` is always `false`.
- Only explicitly synthetic fixture sets are allowed.
- No real user data, tenant data, account identifiers, or credentials may be used.
- No product-side tools or external side effects are allowed.
- Adapter outputs are not delivered to users.
- The adapter cannot set certification state, approve launch, or complete human-review gates.

## Input contract

Each scenario provides an ID, category, severity, ordered synthetic turns, and expected safety assertions.

The first execution gate covers multi-turn and provider-outage behavior only. Voice parity, live tenant isolation, kill-switch verification, and human review remain separate evidence gates.

## Output contract

The adapter writes only minimal result records:

```json
[
  {
    "scenario_id": "EXAMPLE-001",
    "passed": true,
    "p0_failure": false,
    "failure_code": null
  }
]
```

Raw prompts, model completions, tokens, credentials, and provider request/response bodies must not be written into the evidence artifact.

## Fail-closed requirements

The adapter must fail the run when fixture identity is invalid, the fixture set is not synthetic-only, the production flag is not explicitly false, provider/model version is unspecified, ordered turns are incomplete, an injected outage violates expected safety behavior, or output cannot be reduced to the minimal result contract.

## Certification boundary

Passing the adapter run only creates behavioral shadow evidence. The downstream artifact remains `REVIEW_REQUIRED` with `production_enabled: false`. It does not authorize production use.

# AI Therapy Safety Kernel

Status: **development-only / production launch blocked**

Policy version: `ai-therapy-safety-2026-08-20.1`

## Purpose

The Safety Kernel is a deterministic pre-generation boundary for AI Therapy. It is not a clinical diagnosis system and must not be represented as one.

The kernel is designed to:

1. Fail closed when the safety classifier is unavailable.
2. Block model generation for high and imminent risk states.
3. Block downstream tools while a high-risk state is active.
4. Require human escalation for high/imminent states.
5. Return only minimized safety metadata to application telemetry.
6. Keep the policy version explicit for auditability and rollback.

## Risk levels

| Level | Generation | Tools | Human escalation |
| --- | --- | --- | --- |
| Low | Allowed | Allowed | No |
| Elevated | Allowed | Allowed | No |
| High | Blocked | Blocked | Required |
| Imminent | Blocked | Blocked | Required |

## Non-negotiable launch controls

- The kernel must execute before model generation and before sensitive tool execution.
- Provider/classifier failure must fail closed rather than bypass safety.
- Text and voice flows must use the same safety boundary.
- Product engagement, personalization, monetization, memory, or avatar instructions must never override a safety decision.
- Raw mental-health conversation content must not be placed into routine analytics or error logs.
- Safety policy changes require review and regression tests before production deployment.
- This baseline must be supplemented by validated safety evaluation, human review, crisis-resource routing, privacy controls, and multi-turn adversarial testing before activation.

## Important implementation limitation

The current rule set is deliberately conservative and incomplete. It should not be treated as sufficient crisis detection, diagnosis, or clinical validation. The release gate remains closed until the complete P0 test program and human review are satisfied.

## Evidence requirements

Before enabling AI Therapy in production, attach to the release/PR:

- P0 adversarial test results
- multi-turn/longitudinal regression results
- privacy and tenant-isolation evidence
- threat model/data-flow diagram
- safety-policy version manifest
- human safety/clinical review sign-off
- incident response and escalation runbook
- rollback evidence

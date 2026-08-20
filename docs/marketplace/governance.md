# D3VONN.IO Marketplace Governance

## Purpose

The Marketplace is a governed agent distribution layer, not an untrusted plugin directory. Every published agent should have an identity, verification posture, capability declaration, permission manifest, dependency/integration requirements, update policy, and rollback posture before production deployment.

## Publication lifecycle

```text
Draft
  -> Pending Review
  -> Security / Capability Review
  -> Verified
  -> Production Ready
  -> Published
  -> Deprecated / Revoked
```

Publication does not grant runtime authority. Runtime authority is granted only through the governed installation path and the authenticated installation RPCs.

## Verification score

Verification is represented by a level and a 0-100 score. The score should be evidence-backed across:

- security review
- reliability
- documentation
- capability accuracy
- permission review
- data-handling review

Recommended thresholds:

- `0-59`: Unverified / do not recommend for production
- `60-74`: Reviewed
- `75-89`: Verified
- `90-100`: Production Ready

A score is not a substitute for a failed security control. Critical security findings must block production readiness regardless of numeric score.

## Permission model

Agents declare permissions before installation. Each permission has:

- stable key
- human-readable label
- description
- risk classification
- required/optional status

Critical permissions should require explicit approval and should never be silently expanded during an update.

## Compatibility

Compatibility checks should evaluate declared dependencies and integrations against the user's available environment. A deployment should show:

- compatibility score
- satisfied requirements
- missing requirements
- warnings

A compatibility warning should be visible before deployment rather than discovered after installation.

## Updates and rollback

Every published version should declare its update policy and whether rollback is supported. Updates that add permissions, change data access, or introduce critical dependencies should require re-approval.

## Auditability

Installation, lifecycle changes, and uninstall events are recorded by the governed deployment path. Browser clients must not receive direct mutation authority over deployment state.

## Sandbox policy

The next runtime layer is sandbox/trial deployment. Sandbox installations should use constrained credentials, test data, bounded permissions, and explicit promotion into production. Production promotion should create an auditable approval event.

## Workforce composition

The Marketplace should support bundles and agent-to-agent composition without creating a second catalog. Bundles must reference canonical catalog keys and inherit the strictest permission and verification requirements of their constituent agents.

## Release gates

Production release requires:

1. canonical catalog integrity check
2. type/build checks
3. database migration verification in staging
4. anonymous RPC denial verification
5. authenticated ownership verification
6. audit-event verification
7. Marketplace browser smoke test
8. deployment smoke test
9. rollback path verification

Do not bypass a failed security gate to obtain a green release.

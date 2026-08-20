# Marketplace Sandbox and Workforce Model

## Sandbox

Every Marketplace trial starts with the default sandbox policy: no production access, test data only, bounded permissions, explicit promotion, audit events, and a finite runtime window. A trial cannot silently promote itself to production.

## Promotion

Promotion requires an authenticated user action and a fresh compatibility/permission evaluation. If permissions or dependencies changed since the sandbox began, the promotion must be rejected until the user reviews the changes.

## Workforce bundles

Bundles reference canonical Marketplace agent IDs only. Bundle installation must evaluate every constituent agent and inherit the strictest permission risk and weakest verification posture. A bundle cannot claim a stronger verification level than its least-verified member.

## Future runtime contract

```text
POST /marketplace/trials
  -> sandbox installation
  -> constrained execution
  -> audit events
  -> compatibility report
  -> promotion approval
  -> governed production installation
```

The browser should never be given unrestricted deployment credentials. Runtime mutations remain behind authenticated, ownership-bound server operations.

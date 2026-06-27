# Hermes Integration Plan

## Purpose

Connect the D3VONN Marketing Command Center to Hermes so marketing work can move through governed agent handoffs.

## Proposed API Routes

```txt
POST /api/marketing/generate
POST /api/marketing/rewrite
POST /api/marketing/brand-check
POST /api/marketing/claim-check
POST /api/marketing/approve
POST /api/marketing/prepare
POST /api/marketing/analyze
```

## Approval Rules

- Public channel preparation requires human approval.
- Claim-sensitive content requires compliance review.
- Exact metrics must be pulled from source-of-truth files or verified live sources.
- Sensitive actions should be routed through the existing Hermes approval pattern.

## Agent Handoff

```txt
Request
  -> Marketing Agent
  -> Brand Agent
  -> Compliance Agent
  -> Human Approval
  -> Publisher Agent
  -> Analytics Agent
```

## Future Data Sources

- GitHub Actions
- Repository metadata
- Website analytics
- CRM/waitlist data
- Social engagement metrics
- Campaign registry

# PRIMETIME Release 4 — AI Assistance API Contract

Base prefix:

```text
/primetime/v1
```

## Agents

```text
GET  /primetime/v1/ai-agents
POST /primetime/v1/ai-agents
PATCH /primetime/v1/ai-agents/{agent_id}
```

Rules:

- Create/update requires workspace admin or compliance reviewer for governance fields.
- Active agents must require human approval by default.
- Blocked actions must include regulated recommendation, quote, policy decision, autonomous send, and delete record.

## Agent versions

```text
GET  /primetime/v1/ai-agent-versions
POST /primetime/v1/ai-agent-versions
PATCH /primetime/v1/ai-agent-versions/{version_id}
```

Rules:

- Approved versions require approver and timestamp.
- Prompt/tool/model/evaluation policies are versioned.
- Retired versions remain auditable.

## Assistance requests

```text
GET  /primetime/v1/ai-assistance-requests
POST /primetime/v1/ai-assistance-requests
PATCH /primetime/v1/ai-assistance-requests/{request_id}
```

Rules:

- Requests are workspace-scoped.
- Regulated risk sets licensed review required.
- Draft-ready outputs do not execute actions.

## Assistance outputs

```text
GET  /primetime/v1/ai-assistance-outputs
POST /primetime/v1/ai-assistance-outputs
PATCH /primetime/v1/ai-assistance-outputs/{output_id}
```

Rules:

- Outputs are draft-first.
- Approval is required before use in regulated or outbound communication workflows.

## Action ledger

```text
GET  /primetime/v1/ai-action-ledger
POST /primetime/v1/ai-action-ledger
```

Rules:

- Ledger records proposed, blocked, approved, executed, rejected, and failed AI actions.
- No delete endpoint exists.
- Regulated recommendation, quote, policy decision, send, call, application submission, and delete actions are blocked.

## Approval requests

```text
GET  /primetime/v1/ai-approval-requests
POST /primetime/v1/ai-approval-requests
PATCH /primetime/v1/ai-approval-requests/{approval_id}
```

Rules:

- Decisions require reviewer identity and timestamp.
- Licensed review and compliance review are separate approval types.

## Compliance findings

```text
GET  /primetime/v1/ai-compliance-findings
POST /primetime/v1/ai-compliance-findings
PATCH /primetime/v1/ai-compliance-findings/{finding_id}
```

Rules:

- Blocker findings prevent downstream execution.
- Waiver is not automatic.

## Knowledge citations

```text
GET  /primetime/v1/ai-knowledge-citations
POST /primetime/v1/ai-knowledge-citations
```

Rules:

- Citations include source title, type, version, jurisdiction, excerpt, and confidence.
- Regulated answers should not be treated as final advice without licensed review.

## Explicitly forbidden endpoints

```text
POST /primetime/v1/ai/send
POST /primetime/v1/ai/quote
POST /primetime/v1/ai/recommend-policy
POST /primetime/v1/ai/submit-application
DELETE /primetime/v1/ai/*
```

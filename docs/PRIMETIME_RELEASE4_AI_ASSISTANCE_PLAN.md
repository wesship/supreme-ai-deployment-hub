# PRIMETIME Release 4 — AI Assistance Plan

## Purpose

Release 4 adds governed AI assistance to PRIMETIME without granting autonomous authority over regulated insurance activity, outbound delivery, record deletion, quoting, underwriting, or policy recommendations.

The goal is to help representatives and managers work faster while preserving human approval, licensed review, compliance oversight, workspace boundaries, and immutable audit trails.

## Release 4 agents

1. Intake Agent
   - Drafts intake summaries.
   - Suggests duplicate checks, tags, lead source classification, and review tasks.
   - Cannot overwrite verified identity or submit regulated information.

2. Follow-Up Agent
   - Suggests next actions, overdue follow-ups, reminders, and draft messages.
   - Cannot send messages autonomously.
   - Must respect consent, suppression, quiet hours, and template governance from Release 3.

3. Scheduling Agent
   - Suggests appointment slots, reminder drafts, prep tasks, and no-show recovery actions.
   - Cannot alter authoritative calendar or appointment state without governed API approval.

4. Meeting Prep Agent
   - Creates meeting briefs with lead context, household notes, tasks, consent state, and warnings.
   - Cannot recommend insurance products, coverage amounts, eligibility, or quotes.
   - Requires licensed review when regulated context is present.

5. Compliance Reviewer Agent
   - Reviews drafts, templates, consent, suppression, disclosures, prohibited terms, and risky claims.
   - Produces findings and blockers.
   - Cannot waive compliance exceptions autonomously.

## Core tables

- `ai_agents`
- `ai_agent_versions`
- `ai_assistance_requests`
- `ai_assistance_outputs`
- `ai_action_ledger`
- `ai_approval_requests`
- `ai_compliance_findings`
- `ai_knowledge_citations`

## Governance principles

- AI may draft, summarize, classify, and suggest.
- AI may not autonomously send communications.
- AI may not recommend regulated insurance products or coverage.
- AI may not quote, approve, submit applications, or make eligibility decisions.
- AI may not delete regulated records.
- Regulated context requires licensed human review.
- Compliance blockers require compliance reviewer action.
- All AI actions and proposed actions must be recorded in the action ledger.
- All approvals must include reviewer identity, role, decision, and timestamp.

## Release 4 exit criteria

- Canonical agent definitions exist.
- Agent versions require approval before use.
- Assistance requests are workspace-scoped and role-gated.
- Outputs are draft-first.
- Action ledger blocks regulated/autonomous/delivery/delete actions.
- Approval workflow supports human, licensed, compliance, and manager review.
- Compliance findings can be created and tracked.
- Knowledge citations preserve source title, version, jurisdiction, excerpt, and confidence.
- Static tests verify no send, no delete, and no regulated recommendation endpoint.

## Out of scope

- Live model execution.
- Autonomous tool execution.
- AI voice calling.
- Outbound SMS/email delivery.
- Product recommendation engines.
- Quote generation.
- Underwriting or eligibility decisions.
- Production RAG indexing.
- Carrier integrations.

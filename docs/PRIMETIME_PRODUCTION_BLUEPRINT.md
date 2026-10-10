# PRIMETIME — Consolidated Production Blueprint

Status: Canonical operating model for the PRIMETIME insurance platform.

## Product definition

PRIMETIME is an AI-powered insurance-agent operating system built on Devonn.AI. PRIMETIME owns the insurance-specific workflows, CRM, academy, communications, compliance controls, and analytics. Devonn.AI remains the enterprise intelligence layer for orchestration, memory, RAG, agents, observability, and command execution.

```text
Devonn.AI
  -> intelligence, orchestration, memory, RAG, agents, observability
      -> PRIMETIME
          -> insurance CRM, scheduling, communications, academy, compliance, analytics
```

## Canonical modules

1. Identity and Workspace: authentication, MFA, workspaces, roles, sessions, audit logging.
2. Insurance CRM: people, households, leads, opportunities, needs analysis, applications, policies, beneficiaries, referrals, activity history.
3. Pipeline Engine: governed lead and opportunity stages with transition history.
4. Task and Scheduling Center: tasks, appointments, reminders, no-show recovery, meeting preparation.
5. Communication Center: SMS, email, voice, approved templates, consent registry, opt-outs, quiet hours, audit trail.
6. PRIMETIME Academy: licensing, state law, product training, sales training, role-play, exams, readiness scoring.
7. AI Workforce: Intake, Follow-Up, Scheduling, Meeting Prep, Study Coach, Knowledge, Compliance Reviewer, Manager Insights.
8. Compliance Control Plane: license validation, jurisdiction rules, consent enforcement, script approval, disclosures, human approval, retention, immutable audits.
9. Analytics and Reporting: response time, contact rate, appointment rate, show rate, application rate, placement, persistency, referrals, productivity, exceptions.
10. Devonn.AI Services: agent execution, orchestration, RAG, long-term memory, prompt registry, tool routing, observability, command engine.

## Scope discipline

| Layer | Purpose | Included |
|---|---|---|
| Core Operations | Run daily insurance activity | CRM, pipeline, tasks, calendar, consent, communications |
| Intelligence Layer | Assist agents and managers | AI agents, RAG, summaries, prioritization, meeting preparation |
| Expansion Layer | Add growth after stabilization | Recruiting, content automation, international operations, advanced voice |

Postpone until the core platform is stable: full autonomous outbound sales calling, international workflows, large-scale recruiting automation, social-media automation, overlapping orchestrators, carrier integrations without confirmed API access, and unrestricted AI product recommendations.

## Release sequence

1. Governed CRM Foundation
2. Scheduling and Daily Operations
3. Governed Communications
4. AI Assistance
5. PRIMETIME Academy
6. Insurance Lifecycle
7. Controlled Voice
8. Growth Modules

## Release 1 exit gate

100% of open leads must have:

- owner
- stage
- next action
- next-action deadline
- source
- consent state
- last activity or exception record

## Non-negotiable rules

- No lead without an owner.
- No open opportunity without a next action.
- No communication without a consent check.
- No AI execution without an audit record.
- No regulated recommendation without a licensed human.
- No unapproved template in production.
- No knowledge response from expired or unapproved sources.
- No sensitive export without authorization.
- No business-critical state stored only in n8n.
- No agent may bypass the compliance layer.
- No module enters production without tests and monitoring.
- No expansion feature is built before the current release passes its exit gate.

## Technical stack

| Layer | Technology |
|---|---|
| Frontend | React and TypeScript |
| API | FastAPI |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Authorization | PostgreSQL RLS plus API policy checks |
| Jobs | Redis queue or managed job service |
| Workflows | n8n |
| AI orchestration | Devonn.AI Intelligence Layer |
| Knowledge retrieval | Devonn.AI RAG plus Pinecone or pgvector |
| Calendar | Google Calendar |
| SMS | Twilio or approved provider |
| Email | Transactional email provider |
| Voice | Vapi or comparable governed provider |
| Monitoring | Sentry, structured logs, metrics |
| Deployment | Vercel frontend, Railway backend, Supabase database/auth |

AWS remains an optional later migration or specialized infrastructure provider, not the default duplicate production path.

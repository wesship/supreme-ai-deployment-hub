# PRIMETIME — Consolidated Production Blueprint

Status: Canonical operating model for the PRIMETIME insurance platform.

## 1. Product definition

PRIMETIME is an AI-powered insurance-agent operating system built on Devonn.AI.

It combines:

- Insurance CRM
- Lead and client lifecycle management
- Appointment scheduling
- Consent-governed communication
- Agent training and licensing support
- AI-assisted workflows
- Compliance controls
- Team performance reporting
- Devonn.AI orchestration and knowledge intelligence

PRIMETIME does not duplicate the entire Devonn.AI platform.

```text
Devonn.AI
Intelligence, orchestration, memory, RAG, agents, observability
        |
        v
PRIMETIME
Insurance-specific workflows, CRM, academy, communications, and compliance
```

## 2. Canonical architecture

```text
PRIMETIME PLATFORM
|
|-- A. Identity and Workspace
|   |-- User authentication
|   |-- MFA
|   |-- Team workspaces
|   |-- Role-based access
|   |-- Session management
|   `-- Audit logging
|
|-- B. Insurance CRM
|   |-- People
|   |-- Households
|   |-- Leads
|   |-- Opportunities
|   |-- Needs-analysis sessions
|   |-- Applications
|   |-- Policies
|   |-- Beneficiaries
|   |-- Referrals
|   `-- Activity history
|
|-- C. Pipeline Engine
|   |-- New
|   |-- Contact attempted
|   |-- Contacted
|   |-- Appointment scheduled
|   |-- Appointment completed
|   |-- Needs analysis
|   |-- Application started
|   |-- Application submitted
|   |-- Underwriting
|   |-- Approved
|   |-- Issued
|   |-- Active client
|   |-- Follow-up
|   |-- Not ready
|   `-- Closed
|
|-- D. Task and Scheduling Center
|   |-- Tasks
|   |-- Follow-up queues
|   |-- Appointment booking
|   |-- Calendar synchronization
|   |-- Reminders
|   |-- No-show recovery
|   `-- Meeting preparation
|
|-- E. Communication Center
|   |-- SMS
|   |-- Email
|   |-- Voice
|   |-- Approved templates
|   |-- Communication sequences
|   |-- Consent registry
|   |-- Opt-out management
|   |-- Quiet-hour enforcement
|   `-- Communication audit trail
|
|-- F. PRIMETIME Academy
|   |-- Licensing curriculum
|   |-- State-specific modules
|   |-- Product training
|   |-- Sales training
|   |-- Objection handling
|   |-- Role-play simulations
|   |-- Practice examinations
|   |-- Readiness scoring
|   `-- Certificate tracking
|
|-- G. AI Workforce
|   |-- Intake Agent
|   |-- Follow-Up Agent
|   |-- Scheduling Agent
|   |-- Meeting Preparation Agent
|   |-- Study Coach
|   |-- Knowledge Agent
|   |-- Compliance Reviewer
|   `-- Manager Insights Agent
|
|-- H. Compliance Control Plane
|   |-- License validation
|   |-- Jurisdiction rules
|   |-- Consent enforcement
|   |-- Script approval
|   |-- Disclosure insertion
|   |-- Human approval
|   |-- Data-retention policies
|   |-- Exception management
|   `-- Immutable audit records
|
|-- I. Analytics and Reporting
|   |-- Lead response time
|   |-- Contact rate
|   |-- Appointment rate
|   |-- Show rate
|   |-- Needs-analysis completion
|   |-- Application rate
|   |-- Approval rate
|   |-- Placement rate
|   |-- Persistency
|   |-- Referral rate
|   |-- Agent productivity
|   `-- Compliance exceptions
|
`-- J. Devonn.AI Services
    |-- Agent execution
    |-- Workflow orchestration
    |-- RAG
    |-- Long-term memory
    |-- Prompt registry
    |-- Tool routing
    |-- Observability
    `-- Command Engine
```

## 3. Scope discipline

| Layer | Purpose | Included |
|---|---|---|
| Core Operations | Run daily insurance activities | CRM, pipeline, tasks, calendar, consent, communications |
| Intelligence Layer | Assist agents and managers | AI agents, RAG, summaries, prioritization, meeting preparation |
| Expansion Layer | Add growth capabilities after stabilization | Recruiting, content automation, international operations, advanced voice |

Postponed until the core platform is stable:

- Full autonomous outbound sales calling
- International insurance workflows
- Large-scale recruiting automation
- Automated social-media production
- Multiple overlapping AI orchestrators
- Complex carrier integrations without confirmed API access
- Unrestricted AI product recommendations

## 4. Canonical data model

### Workspace and identity

| Entity | Purpose |
|---|---|
| workspaces | Separates teams, agencies, and business units |
| users | Platform users |
| workspace_memberships | Connects users to workspaces |
| roles | Defines permissions |
| licenses | Stores insurance license information |
| user_sessions | Tracks authenticated sessions |
| audit_events | Records sensitive actions |

### CRM

| Entity | Purpose |
|---|---|
| people | Individual contacts |
| households | Groups related clients and prospects |
| household_members | Connects people to households |
| leads | Prospect records |
| opportunities | Potential insurance sales |
| pipeline_stages | Controlled opportunity stages |
| stage_transitions | Complete pipeline movement history |
| referrals | Referral relationships |
| tags | Contact classification |
| notes | Structured notes |
| activities | Calls, emails, meetings, and status changes |

### Insurance lifecycle

| Entity | Purpose |
|---|---|
| needs_analyses | Stores fact-finding sessions |
| needs_analysis_answers | Structured needs information |
| product_interests | Records products discussed |
| applications | Insurance applications |
| application_events | Application progress history |
| policies | Issued policy records |
| policy_events | Policy servicing and status changes |
| beneficiaries | Policy beneficiary records |
| underwriting_cases | Underwriting status tracking |

### Communication and consent

| Entity | Purpose |
|---|---|
| consent_records | Channel-specific permission records |
| communication_preferences | Preferred channel and contact times |
| suppression_records | Opt-outs and do-not-contact entries |
| message_templates | Approved message templates |
| template_versions | Version-controlled template history |
| communication_sequences | Automated follow-up plans |
| communications | Individual messages and calls |
| communication_events | Delivered, failed, opened, replied, opted out |
| voice_call_records | Voice-call metadata and disclosures |

### Tasks and scheduling

| Entity | Purpose |
|---|---|
| tasks | Work assignments |
| task_dependencies | Task sequencing |
| appointments | Meetings |
| appointment_attendees | Participants |
| availability_rules | Booking availability |
| reminders | Scheduled reminders |
| no_show_events | Missed appointment recovery |

### Academy

| Entity | Purpose |
|---|---|
| courses | Training programs |
| modules | Course sections |
| lessons | Learning content |
| assessments | Exams and quizzes |
| questions | Assessment questions |
| attempts | Student assessment attempts |
| learning_progress | Completion tracking |
| readiness_scores | Exam-readiness measurement |
| credentials | Certificates and licenses |

### AI and governance

| Entity | Purpose |
|---|---|
| agents | AI agent definitions |
| agent_versions | Version history |
| agent_runs | Execution records |
| agent_actions | Proposed and completed actions |
| approval_requests | Human approval queue |
| knowledge_sources | Approved source documents |
| knowledge_versions | Versioned knowledge content |
| compliance_rules | Machine-readable controls |
| compliance_checks | Results of policy evaluations |
| exceptions | Compliance and workflow exceptions |

## 5. Role-based access model

| Role | Access |
|---|---|
| Representative | Assigned leads, clients, tasks, appointments, and approved tools |
| Trainee | Academy, simulations, and supervised CRM access |
| Trainer | Training progress, simulations, and coaching records |
| Manager | Team pipelines, assignments, metrics, and approvals |
| Compliance Reviewer | Communications, scripts, disclosures, exceptions, and audit trails |
| Workspace Administrator | Workspace users, settings, integrations, and permissions |
| Platform Administrator | Infrastructure and platform configuration only |
| Auditor | Read-only access to approved records and logs |

Access rules:

- Representatives see records assigned to them or explicitly shared.
- Managers see records within their reporting hierarchy.
- Compliance staff see regulated activity but cannot alter sales records.
- Platform administrators do not automatically receive unrestricted client access.
- All exports and sensitive record views are logged.

## 6. Pipeline rules

### Standard pipeline

```text
New Lead
  -> Contact Attempted
  -> Contacted
  -> Appointment Scheduled
  -> Appointment Completed
  -> Needs Analysis
  -> Application Started
  -> Application Submitted
  -> Underwriting
  -> Approved
  -> Policy Issued
  -> Active Client
  -> Annual Review / Referral
```

### Required fields by stage

| Stage | Required information |
|---|---|
| New Lead | Owner, source, and contact information |
| Contact Attempted | Attempt date, channel, and outcome |
| Contacted | Consent status and next action |
| Appointment Scheduled | Date, time, participants, and meeting type |
| Appointment Completed | Meeting result and follow-up |
| Needs Analysis | Completed form and agent attestation |
| Application Started | Product category and assigned licensed agent |
| Application Submitted | Submission date and application reference |
| Underwriting | Status and next expected update |
| Approved | Approval date and conditions |
| Policy Issued | Policy identifier, issue date, and status |
| Active Client | Service plan, review date, and referral request status |

Every open lead or opportunity must have an owner, stage, next action, deadline, consent status, source, activity record, last-contact date, and aging indicator. Records missing these fields enter an exception queue.

## 7. AI workforce

### Intake Agent

Allowed: create draft contacts, check duplicates, classify lead sources, extract contact information, suggest tags, and create intake review tasks.

Restricted: cannot provide insurance recommendations, initiate unapproved outbound communication, or overwrite verified identity data.

### Follow-Up Agent

Allowed: identify overdue follow-ups, draft messages, suggest next actions, create tasks, recommend sequence enrollment, and escalate inactive opportunities.

Approval rules:

| Action | Approval |
|---|---|
| Create internal task | Automatic |
| Suggest message | Automatic |
| Send approved transactional reminder | Policy dependent |
| Send sales-oriented communication | Human approval or authorized campaign |
| Contact opted-out person | Blocked |

### Scheduling Agent

Books and manages appointments, verifies consent before messaging, sends confirmations and reminders, handles rescheduling, triggers no-show recovery, and prepares meeting context.

### Meeting Preparation Agent

Produces a concise agent brief with contact, household, source, interactions, needs, open tasks, consent, questions, disclosures, documents, and compliance warnings. It cannot recommend a policy as final decision-maker.

### Study Coach

Builds study plans, generates quizzes, explains concepts, tracks weak areas, runs simulated exams, conducts sales role-play, calculates readiness, and recommends review modules.

### Knowledge Agent

Answers using approved sources only. Every answer must include source title, version, effective date, jurisdiction, carrier or organization, confidence level, and disclaimers when appropriate.

### Compliance Reviewer

Reviews communications, disclosures, consent, prohibited language, licensing, jurisdiction restrictions, exceptions, and audit trails.

### Manager Insights Agent

Summarizes team performance, identifies stalled leads, workload imbalances, coaching priorities, exception rates, and weekly manager reports. It may not automatically discipline, rank, or terminate representatives.

## 8. Human approval matrix

| Action | AI may suggest | AI may execute |
|---|---|---|
| Create an internal task | Yes | Yes |
| Summarize a contact record | Yes | Yes |
| Suggest a follow-up date | Yes | Yes |
| Draft an email or SMS | Yes | No, unless part of an approved workflow |
| Send an appointment reminder | Yes | Yes, after consent checks |
| Send marketing content | Yes | Only through an approved campaign |
| Initiate an AI voice sales call | Yes | No by default |
| Recommend an insurance product | Support only | No |
| Change application information | Yes | No |
| Submit an application | No | No |
| Approve compliance exception | No | No |
| Delete regulated records | No | No |
| Export client information | No | Human authorization required |

## 9. Communication governance

Before any communication is sent, the system must evaluate:

1. Is the person correctly identified?
2. Is the channel permitted?
3. Is valid consent recorded?
4. Has the person opted out?
5. Is the current time within approved contact hours?
6. Is the representative permitted to communicate?
7. Is the template approved?
8. Are required disclosures present?
9. Is the frequency limit satisfied?
10. Will the complete action be logged?

Communication states:

```text
DRAFT
PENDING_REVIEW
APPROVED
SCHEDULED
SENT
DELIVERED
FAILED
RESPONDED
OPTED_OUT
BLOCKED
```

Template records must store purpose, channel, audience, jurisdiction, approval status, approver, effective date, expiration date, required disclosures, allowed variables, maximum frequency, and version number.

## 10. Voice automation boundary

Phase A safe voice use:

- Inbound receptionist
- Appointment confirmations
- Appointment reminders
- Rescheduling
- Basic routing
- Frequently asked administrative questions
- Call summaries
- Voicemail transcription

Phase B supervised outreach:

- Consent-based follow-up
- Human-approved scripts
- AI disclosure
- Recording disclosure where applicable
- Human transfer
- Full audit record

Blocked by default:

- Cold autonomous sales calling
- AI impersonating a licensed agent
- Unapproved financial recommendations
- Pressure tactics
- Concealing that the caller is AI
- Calling suppressed contacts
- Calling outside permitted hours

## 11. Knowledge base governance

Every knowledge document must include title, source organization, document type, jurisdiction, effective date, expiration date, version, approval status, approver, access level, and citation metadata.

The RAG system may retrieve only approved and currently effective documents for regulated workflows.

## 12. PRIMETIME Academy

Tracks:

1. Licensing Preparation
2. New Representative Training
3. Sales Communication
4. Compliance
5. Leadership

Readiness Score:

```text
30% practice exam performance
20% topic mastery
15% retention over time
15% simulation performance
10% course completion
10% confidence and consistency
```

No learner is considered ready based only on course completion.

## 13. Analytics

Representative dashboard:

- Leads requiring action today
- Appointments today
- Overdue tasks
- New responses
- Leads without next actions
- Pipeline conversion
- Study progress
- Compliance alerts

Manager dashboard:

- Lead distribution
- Response-time performance
- Contact rate
- Appointment rate
- Show rate
- Applications submitted
- Placement rate
- Persistency
- Referral rate
- Workload balance
- Coaching opportunities
- Compliance exceptions

Core formulas:

```text
Contact Rate = Contacts reached / leads attempted
Appointment Rate = Appointments scheduled / contacts reached
Show Rate = Appointments completed / appointments scheduled
Application Rate = Applications submitted / completed appointments
Placement Rate = Policies issued / applications submitted
Referral Rate = Contacts referred / active clients
Persistency Rate = Policies remaining active / policies issued
```

Raw call count is not a primary success metric.

## 14. Command Engine

Command format:

```text
/[COMMAND] target="..." scope="..." output="..."
```

Core commands:

```text
/DAILY /PIPELINE /FOLLOWUP /PREP /SUMMARIZE /DRAFTSMS
/DRAFTEMAIL /CHECKCONSENT /COMPLIANCE /ROLEPLAY /QUIZ
/READINESS /COACH /MUDA /CRITIQUE /VISUALIZE /AUDIT
/KNOWLEDGE /HANDOFF /ESCALATE
```

Every command run records requesting user, workspace, command, input, agent used, tools invoked, policy checks, output, approval status, execution status, timestamp, and audit reference.

## 15. Muda controls

| Waste | Platform control |
|---|---|
| Duplicate contacts | Automatic duplicate detection |
| Forgotten leads | Mandatory next action |
| Repeated data entry | Shared canonical records |
| Excessive navigation | Unified contact workspace |
| Unused templates | Expiration and usage reporting |
| Outdated documents | Effective-date enforcement |
| Long AI responses | Role-specific output limits |
| Failed automation | Retry, dead-letter, and manual-review queues |
| Over-contacting prospects | Frequency caps |
| Unworked inventory | Aging reports and reassignment |
| Premature feature building | Release gates |
| Duplicate agents | Agent registry and ownership rules |

## 16. Technical stack

| Layer | Technology |
|---|---|
| Web frontend | React and TypeScript |
| Application API | FastAPI |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL RLS plus API policy checks |
| Background jobs | Redis queue or managed job service |
| Workflow integrations | n8n |
| AI orchestration | Devonn.AI Intelligence Layer |
| Knowledge retrieval | Devonn.AI RAG plus Pinecone or pgvector |
| Calendar | Google Calendar integration |
| SMS | Twilio or approved provider |
| Email | Transactional email provider |
| Voice | Vapi or comparable governed provider |
| Monitoring | Sentry, structured logs, and metrics |
| Deployment | One primary production stack |
| Infrastructure | Docker plus Terraform |
| CI/CD | GitHub Actions |
| Secrets | Managed environment secrets |
| File storage | Supabase Storage or equivalent |

Hosting path:

```text
Frontend: Vercel
Backend: Railway initially
Database/Auth: Supabase
RAG: Pinecone or pgvector
Automation: n8n
Observability: Sentry plus application metrics
```

AWS is optional later infrastructure, not the duplicate default path.

## 17. n8n boundary

n8n is used for integrations, notifications, sync, communication delivery, calendar events, webhooks, enrichment, and non-authoritative automation.

n8n is not the source of truth for lead status, application state, consent, policy records, compliance decisions, user permissions, audit records, or agent approval status.

## 18. Release plan

### Release 1 — Governed CRM Foundation

Build authentication, workspaces, roles, people, households, leads, pipeline, tasks, activities, consent registry, and audit records.

Exit gate: 100% of open leads have owner, stage, next action, consent state, and last activity.

### Release 2 — Scheduling and Daily Operations

Build appointments, calendar sync, booking page, reminders, no-show recovery, daily dashboard, and mobile quick actions.

Exit gate: appointments can be booked, confirmed, rescheduled, and completed; all appointment events appear in CRM; missed appointments create follow-up tasks.

### Release 3 — Governed Communications

Build SMS, email, template management, approvals, quiet hours, opt-out handling, delivery tracking, and audit logs.

Exit gate: no communication is sent without a policy check; opt-outs are immediate; every outbound message has a template or approval record.

### Release 4 — AI Assistance

Build Intake Agent, Follow-Up Agent, Scheduling Agent, Meeting Preparation Agent, Compliance Reviewer, and Knowledge Agent.

Exit gate: every AI action is logged; restricted actions require approval; RAG responses cite approved sources; AI cannot independently make product recommendations.

### Release 5 — PRIMETIME Academy

Build courses, lessons, quizzes, practice exams, simulations, readiness score, progress dashboard, and credential tracking.

Exit gate: learners receive measurable mastery and readiness reports; weak topics generate study assignments.

### Release 6 — Insurance Lifecycle

Build needs analysis, applications, underwriting tracking, policies, beneficiaries, annual reviews, referral tracking, and persistency reporting.

Exit gate: a client can be tracked from first lead through active policy servicing; every stage has required evidence and audit history.

### Release 7 — Controlled Voice

Build inbound receptionist, appointment confirmation, reminder calls, rescheduling, human transfer, voice disclosure, call summaries, and consent-based campaigns.

Exit gate: AI disclosure is enforced; opt-outs are respected; calls are logged; human transfer works; restricted sales behavior is blocked.

### Release 8 — Growth Modules

Build only after core adoption: recruiting, onboarding, media production, campaign intelligence, international workspace configuration, carrier integrations, and advanced agent mesh.

Exit gate: core modules maintain agreed reliability, adoption, and compliance targets.

## 19. Definition of Done

A feature is not complete until it has business requirements, UI, API, database migration, permissions, validation, audit logging, error handling, tests, monitoring, documentation, compliance review, rollback procedure, named owner, and success metric.

## 20. Non-negotiable system rules

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

## 21. Immediate engineering backlog

| Order | Work item | Priority |
|---:|---|---|
| 1 | Freeze canonical architecture and domain boundaries | Critical |
| 2 | Create normalized PostgreSQL schema | Critical |
| 3 | Implement workspaces and role-based access | Critical |
| 4 | Implement people, households, and deduplication | Critical |
| 5 | Implement consent and suppression registry | Critical |
| 6 | Implement governed pipeline stages | Critical |
| 7 | Enforce owner and next-action requirements | Critical |
| 8 | Implement immutable activity and audit events | Critical |
| 9 | Build representative daily dashboard | High |
| 10 | Build tasks and appointments | High |
| 11 | Add calendar synchronization | High |
| 12 | Build approved communication templates | Critical |
| 13 | Add SMS/email policy checks | Critical |
| 14 | Add delivery and opt-out event handling | Critical |
| 15 | Implement AI action and approval framework | Critical |
| 16 | Add Intake and Follow-Up agents | High |
| 17 | Add Compliance Reviewer | Critical |
| 18 | Add governed knowledge base | High |
| 19 | Build Academy data model | High |
| 20 | Add testing, metrics, and release gates | Critical |

## 22. Final optimized outcome

```text
DEVONN.AI
Enterprise intelligence and orchestration platform
        |
        v
PRIMETIME
Insurance business operating system
        |
        |-- Governed CRM
        |-- Agent daily workspace
        |-- Communications
        |-- Scheduling
        |-- Academy
        |-- AI workforce
        |-- Compliance control plane
        |-- Insurance lifecycle
        `-- Analytics
```

Implementation priority:

```text
Governance
  -> CRM foundation
  -> Consent and audit
  -> Scheduling
  -> Communications
  -> AI assistance
  -> Academy
  -> Policy lifecycle
  -> Voice
  -> Expansion
```

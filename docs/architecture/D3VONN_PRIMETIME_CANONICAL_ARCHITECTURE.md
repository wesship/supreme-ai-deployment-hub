# D3VONN.IO + PRIMETIME Canonical Architecture

Status: Canonical source of truth  
Domain: `d3vonn.io`  
Flagship application: PRIMETIME  
Related implementation issue: #235

## 1. Product hierarchy

```text
D3VONN.IO
Enterprise intelligence, orchestration, memory, RAG, agents,
observability, automation, governance and shared platform services
        ↓
PRIMETIME
Insurance business operating system
        ↓
DEVONN CRM
Agent-facing CRM and daily operating workspace
```

D3VONN.IO is the platform layer. PRIMETIME is the insurance-specific application. DEVONN CRM is the primary operational workspace inside PRIMETIME.

## 2. Non-negotiable naming

- Replace legacy `devonn.ai` domain references with `d3vonn.io`.
- Preserve DEVONN where it is the approved product or brand name.
- Use original DEVONN assets and do not imply official Primerica affiliation.

Recommended endpoints:

- `app.d3vonn.io`
- `crm.d3vonn.io`
- `primetime.d3vonn.io`
- `api.d3vonn.io`
- `automation.d3vonn.io`
- `academy.d3vonn.io`
- `studio.d3vonn.io`
- `docs.d3vonn.io`
- `auth.d3vonn.io`
- `admin.d3vonn.io`
- `status.d3vonn.io`

## 3. Platform boundaries

### D3VONN.IO owns

- Authentication and identity
- Organizations and workspaces
- Role and capability enforcement
- Agent registry and execution
- Prompt registry
- RAG and knowledge governance
- Long-term memory
- Tool routing
- Workflow orchestration
- Audit and observability
- Shared integrations
- Command Engine

### PRIMETIME owns

- Insurance CRM
- Leads, people, households and referrals
- Opportunity and policy lifecycle
- Tasks and scheduling
- Consent-governed communications
- Licensing and training support
- Insurance-specific AI workflows
- Compliance control plane
- Insurance analytics and reporting

### n8n boundary

n8n may perform integrations, schedules, notifications and non-authoritative automation. It must not be the source of truth for consent, lead state, applications, policies, permissions, compliance decisions or audit history.

## 4. PRIMETIME modules

```text
PRIMETIME
├── Identity and Workspace
├── CRM
├── Pipeline Engine
├── Tasks and Scheduling
├── Communications
├── Academy
├── AI Workforce
├── Compliance Control Plane
├── Insurance Lifecycle
├── Analytics and Reporting
├── Documents and Knowledge
└── Administration
```

## 5. CRM navigation

The `/crm/*` application shell defined in #235 is the first implementation target.

```text
Home
Dashboard
Contacts
Custom Lists
Leads
Pipeline
Calendar
Calls
Messages
Tasks
Reports
Recruiting
Training
Administration
```

The visual target is a compact, table-first insurance dashboard with a blue top header, compact left rail and original DEVONN branding.

## 6. Canonical data domains

### Platform

- workspaces
- users
- workspace_memberships
- roles
- permissions
- user_sessions
- audit_events
- integrations
- feature_flags

### CRM

- people
- contact_methods
- addresses
- households
- household_members
- leads
- opportunities
- pipeline_stages
- stage_transitions
- referrals
- tags
- notes
- activities
- custom_lists
- custom_list_members

### Scheduling and work

- tasks
- task_dependencies
- appointments
- appointment_attendees
- availability_rules
- reminders
- no_show_events

### Communication and consent

- consent_records
- communication_preferences
- suppression_records
- message_templates
- template_versions
- communication_sequences
- communications
- communication_events
- voice_call_records

### Insurance lifecycle

- needs_analyses
- needs_analysis_answers
- product_interests
- applications
- application_events
- underwriting_cases
- policies
- policy_events
- beneficiaries
- service_cases
- case_events

### Academy

- courses
- modules
- lessons
- assessments
- questions
- attempts
- learning_progress
- readiness_scores
- credentials
- licenses

### AI and governance

- agents
- agent_versions
- agent_runs
- agent_actions
- approval_requests
- knowledge_sources
- knowledge_versions
- compliance_rules
- compliance_checks
- exceptions

Every tenant-owned record must carry `workspace_id`, timestamps, creator/updater metadata and appropriate archive or soft-delete fields.

## 7. Access model

Roles:

- Representative
- Trainee
- Trainer
- Manager
- Compliance Reviewer
- Workspace Administrator
- Platform Administrator
- Auditor

Authorization must use both API policy checks and PostgreSQL/Supabase RLS. Platform administrators do not automatically receive unrestricted client access. Sensitive views, exports and consequential changes must be logged.

## 8. Consent model

Consent is evidence, not a boolean. Store channel, purpose, disclosure version, source, timestamp, expiration, revocation, jurisdiction and evidence.

Evaluate permissions independently for:

- Transactional email
- Marketing email
- Transactional SMS
- Marketing SMS
- Voice calls
- Automated voice
- Call recording
- Data processing
- Document delivery

No communication may be sent without a consent and suppression policy check.

## 9. AI execution model

```text
Request or event
→ context assembly
→ permission check
→ approved knowledge retrieval
→ compliance check
→ model execution
→ structured proposal
→ approval evaluation
→ tool execution
→ result verification
→ audit event
```

AI may organize, summarize, draft, prioritize and recommend administrative next actions. It may not independently recommend insurance products, determine suitability, quote unapproved coverage, submit applications, change regulated records or contact suppressed people.

## 10. Initial AI workforce

- Intake Agent
- Follow-Up Agent
- Scheduling Agent
- Meeting Preparation Agent
- Study Coach
- Knowledge Agent
- Compliance Reviewer
- Manager Insights Agent

Every agent must define purpose, inputs, outputs, tools, permissions, approval requirements, failure behavior, success metrics and audit events.

## 11. Pipeline rules

```text
New Lead
→ Contact Attempted
→ Contacted
→ Appointment Scheduled
→ Appointment Completed
→ Needs Analysis
→ Application Started
→ Application Submitted
→ Underwriting
→ Approved
→ Policy Issued
→ Active Client
→ Annual Review / Referral
```

Every open lead or opportunity must have:

- Owner
- Stage
- Next action
- Next-action deadline
- Consent state
- Source
- Last activity
- Aging indicator

Incomplete records enter an exception queue.

## 12. Non-negotiable controls

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
- No release without tests, monitoring and rollback.
- No expansion feature before the current release passes its exit gate.

## 13. Technical baseline

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-compatible components
- API: FastAPI
- Database/Auth/Storage: Supabase PostgreSQL, Auth and Storage
- Authorization: RLS plus API policies
- Jobs: Redis queue or managed job service
- Automation: n8n
- RAG: pgvector initially; Pinecone only when justified
- Calendar: Google Calendar
- Messaging: Twilio and approved email provider
- Voice: Vapi or equivalent governed provider
- Monitoring: Sentry, structured logs and metrics
- CI/CD: GitHub Actions
- Infrastructure: Docker and Terraform
- Frontend deployment: Vercel
- Backend deployment: Railway initially

## 14. Release sequence

1. Governed CRM foundation
2. Scheduling and daily operations
3. Governed communications
4. AI assistance
5. PRIMETIME Academy
6. Insurance lifecycle
7. Controlled voice
8. Growth modules

## 15. Definition of done

A feature is complete only when it includes:

- Business requirements
- UI
- API
- Database migration
- Permission controls
- Validation
- Audit logging
- Error handling
- Tests
- Monitoring
- Documentation
- Compliance review
- Rollback procedure
- Named owner
- Success metric

## 16. Immediate engineering order

1. Implement Issue #235 CRM shell and Custom Lists.
2. Normalize workspace, user and role boundaries.
3. Implement people, contact methods, households and deduplication.
4. Implement consent and suppression registry.
5. Implement governed pipeline and immutable stage history.
6. Enforce owner and next-action requirements.
7. Implement tasks, appointments and calendar synchronization.
8. Implement approved templates and outbound policy checks.
9. Add AI action, approval and audit framework.
10. Add Academy and insurance lifecycle modules after core release gates pass.

This document overrides earlier architectural descriptions where they conflict with the D3VONN.IO domain, platform boundaries or PRIMETIME governance model.

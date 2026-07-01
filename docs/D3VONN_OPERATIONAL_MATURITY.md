# D3VONN Cyber Command Center — Operational Maturity Pack

## Overview

This pack extends the D3VONN Cyber Command Center v2 with production-grade operational capabilities:

- **End-to-end validation suite** with synthetic attack scenarios
- **Structured detection engineering** with versioned, categorized rules
- **Enhanced threat intelligence** pipeline (STIX/TAXII, actor/campaign tracking)
- **Expanded asset & identity graph** with full operational entities
- **Specialized AI security agents** (12 total)
- **Digital twin** for live platform state modeling
- **Chaos security testing** framework
- **Executive command center** dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    D3VONN EXECUTIVE COMMAND CENTER                   │
│  /security/command-center                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Overview │ │  Agents  │ │ Threats  │ │  Chaos   │ │Compliance│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Detection  │ │   Agent     │ │   Threat    │ │   Chaos     │
│  Engine v2  │ │  Workforce  │ │   Intel v2  │ │   Engine    │
│             │ │  (12 agents)│ │  STIX/TAXII │ │  8 exps     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Asset &   │ │   Digital   │ │    SOAR     │ │ Correlation │
│  Identity   │ │    Twin     │ │  Playbooks  │ │   Engine    │
│   Graph     │ │             │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                    ┌───────────────────────┐
                    │    Supabase (25+      │
                    │    security tables)   │
                    └───────────────────────┘
```

---

## New Components

### Detection Engineering (`backend/app/security/detections/`)

| Category | Rules |
|----------|-------|
| Authentication | Brute force, credential stuffing, impossible travel, token anomaly, MFA bypass |
| Identity | Privilege escalation, suspicious account changes |
| API | Rate abuse, endpoint enumeration, unauthorized access |
| Network | Port scanning, DNS tunneling, C2 beaconing |
| Endpoint | Suspicious process, file integrity, persistence |
| Cloud | Resource exposure, config drift, IAM abuse |
| AI | Prompt injection, model extraction, training poisoning |
| Fraud | Account takeover, payment fraud, synthetic identity |

### AI Agent Workforce (12 Agents)

| Agent | Module | Specialization |
|-------|--------|---------------|
| SOC Commander | `agents/soc_commander.py` | Orchestration & escalation |
| Sentinel | `agents/sentinel.py` | Log analysis & anomaly detection |
| Guardian | `agents/guardian.py` | Identity monitoring |
| Hunter | `agents/hunter.py` | Threat hunting |
| Oracle | `agents/oracle.py` | Threat intelligence |
| Analyst | `agents/analyst.py` | Investigation & reporting |
| Engineer | `agents/engineer.py` | Remediation |
| Compliance | `agents/compliance_agent.py` | Framework mapping |
| Detection Engineer | `agents/specialized/detection_engineer.py` | Rule creation & tuning |
| Threat Hunter v2 | `agents/specialized/threat_hunter_v2.py` | Hypothesis-driven hunting |
| Incident Commander | `agents/specialized/incident_commander.py` | Incident lifecycle |
| Malware Analyst | `agents/specialized/malware_analyst.py` | Artifact analysis |
| Forensics Analyst | `agents/specialized/forensics_analyst.py` | Evidence & timeline |
| Vulnerability Analyst | `agents/specialized/vulnerability_analyst.py` | Vuln prioritization |
| Compliance Officer | `agents/specialized/compliance_officer.py` | Audit preparation |
| Executive Reporter | `agents/specialized/executive_reporter.py` | Executive briefings |

### Threat Intelligence v2 (`backend/app/security/threat_intel_v2.py`)

- IOC lifecycle management (ingest, check, expire)
- STIX 2.1 object creation and parsing
- TAXII 2.1 client for feed synchronization
- Reputation scoring engine
- Actor and campaign tracking
- Multi-source enrichment

### Asset & Identity Graph (`backend/app/security/asset_identity_graph.py`)

- 17 node types (users, devices, servers, containers, agents, API keys, secrets, repos, cloud resources, etc.)
- 15 edge types (owns, accesses, authenticates_as, deployed_on, etc.)
- Blast radius computation
- Alert contextualization
- Graph statistics

### Digital Twin (`backend/app/security/digital_twin/`)

- Service registry with health tracking
- Topology and dependency mapping
- Attack surface computation
- Blast radius analysis
- Stale service detection
- Platform state snapshots

### Chaos Security Testing (`backend/app/security/chaos/`)

8 pre-built experiments:

| ID | Experiment | Category |
|----|-----------|----------|
| CHAOS-001 | Brute Force Detection Validation | Detection |
| CHAOS-002 | Privilege Escalation Detection | Detection |
| CHAOS-003 | Agent Response Time Validation | Response |
| CHAOS-004 | Incident Escalation Workflow | Escalation |
| CHAOS-005 | SOAR Playbook Execution | Response |
| CHAOS-006 | Alert Pipeline Latency | Resilience |
| CHAOS-007 | Recovery After Service Failure | Recovery |
| CHAOS-008 | Impossible Travel Detection | Detection |

### Validation Suite (`backend/app/security/validation/`)

- Synthetic attack scenario generator
- Full pipeline validation runner
- Coverage and latency metrics

---

## Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/security` | Security trust page | Public-facing security info |
| `/security/ops` | SecurityOps | SOC analyst dashboard |
| `/security/dashboard` | SecurityDashboard | v1 SOC dashboard |
| `/security/command-center` | CommandCenter | **Executive command center** |

---

## Install

### 1. Database

```bash
supabase db push
```

Or apply both migrations in order:
1. `supabase/migrations/20260630_d3vonn_soc.sql`
2. `supabase/migrations/20260630_d3vonn_soc_v2.sql`

### 2. Backend

Register routers in `backend/main.py`:

```python
from app.security.router import router as security_router
from app.security.router_v2 import router as security_router_v2
app.include_router(security_router)
app.include_router(security_router_v2)
```

### 3. Frontend

Navigate to:
- `/security/ops` — SOC analyst view
- `/security/command-center` — Executive command center

### 4. Test

```bash
for i in 1 2 3 4 5; do
  curl -X POST "$API_BASE/api/security/v2/events" \
    -H "Content-Type: application/json" \
    -d '{
      "source":"supabase_auth",
      "event_type":"login_failed",
      "severity":"medium",
      "actor_id":"user_123",
      "actor_email":"test@d3vonn.io",
      "ip_address":"203.0.113.10",
      "metadata":{"test":true}
    }'
done
```

---

## Production Hardening Roadmap

- [ ] Replace placeholder RLS with tenant membership policies
- [ ] Require service-role-only ingestion for system logs
- [ ] Add API key/HMAC signing to `/api/security/events`
- [ ] Connect Supabase Auth webhooks
- [ ] Connect GitHub audit/security webhooks
- [ ] Add Cloudflare event ingestion
- [ ] Add OpenSearch or ClickHouse sink for high-volume logs
- [ ] Convert proposed Hermes actions into approval-gated SOAR execution
- [ ] Add Markdown/PDF incident exports
- [ ] Add WebSocket/Supabase Realtime for live updates
- [ ] Replace agent stubs with actual LLM calls (OpenAI/Anthropic)
- [ ] Add TAXII server endpoint for sharing IOCs
- [ ] Implement approval workflows for SOAR playbook actions
- [ ] Add Slack/Teams/PagerDuty notification integrations
- [ ] Enable chaos experiment scheduling (nightly runs)

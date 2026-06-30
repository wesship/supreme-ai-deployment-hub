# D3VONN Cyber Command Center v2 — Architecture & Install Guide

## Vision

D3VONN Cyber Command Center v2 evolves the platform from a basic SOC dashboard into a **layered AI-powered cyber command platform** — the equivalent of a lightweight commercial SIEM with AI agent workforce, SOAR automation, threat intelligence, knowledge graph, and compliance mapping.

## Production Architecture

```
Internet
     │
     ▼
Cloudflare WAF
     │
     ▼
API Gateway
     │
 ┌───────────────┐
 │ FastAPI API   │
 └───────────────┘
     │
     ├───────────────► Security Event Collector
     │
     ├───────────────► Hermes SOC Commander
     │                      ├── Sentinel (Log Analysis)
     │                      ├── Guardian (Identity Monitoring)
     │                      ├── Hunter (Threat Hunting)
     │                      ├── Oracle (Threat Intelligence)
     │                      ├── Analyst (Investigation & Reporting)
     │                      ├── Engineer (Remediation)
     │                      └── Compliance (Framework Mapping)
     │
     ├───────────────► Detection Engine
     │
     ├───────────────► Correlation Engine
     │
     ├───────────────► Risk Scoring Engine
     │
     ├───────────────► Threat Intelligence Layer
     │
     ├───────────────► Knowledge Graph
     │
     ├───────────────► SOAR Automation
     │
     ▼
Supabase (PostgreSQL + RLS)
     │
     ▼
Pinecone + DKOS
     │
     ▼
React Cyber Command Center
```

## Database Schema (~25 Tables)

| Table | Purpose |
|-------|---------|
| `security_events` | Raw event ingestion |
| `security_alerts` | Detection-generated alerts |
| `security_incidents` | Escalated alert groups |
| `security_assets` | Tracked infrastructure |
| `security_users` | Enriched user profiles with risk scores |
| `security_identities` | Identity federation tracking |
| `security_sessions` | Active/historical sessions |
| `security_devices` | Known devices per user |
| `security_ip_history` | IP reputation and history |
| `security_geolocation` | Geo cache for IPs |
| `security_threat_feeds` | External feed configs |
| `security_iocs` | Indicators of Compromise |
| `security_playbooks` | SOAR automation playbooks |
| `security_rule_sets` | Grouped detection rules |
| `security_cases` | Investigation case management |
| `security_evidence` | Collected evidence |
| `security_logs` | System audit logs |
| `security_risk_scores` | Historical risk snapshots |
| `security_models` | AI/ML model registry |
| `security_attack_chains` | MITRE kill chain tracking |
| `security_graph_nodes` | Knowledge graph nodes |
| `security_graph_edges` | Knowledge graph edges |
| `security_reports` | Generated reports |
| `security_compliance` | Framework control mapping |
| `security_agent_workforce` | Agent registry |
| `security_agent_tasks` | Agent task queue |
| `security_correlations` | Correlation findings |
| `security_metrics` | MTTD/MTTR operational metrics |

## AI Agent Workforce

### Hermes SOC Commander
Coordinates everything — dispatches specialized agents, manages escalations, generates executive reports.

### Sentinel
Log analysis agent.
- Ingest logs
- Classify and normalize
- Prioritize
- Detect anomalous patterns

### Guardian
Identity monitoring agent.
- Impossible travel detection
- Privilege escalation
- MFA removal
- Token theft

### Hunter
Threat hunting agent.
- Persistence mechanisms
- Lateral movement
- Ransomware indicators
- C2 beaconing

### Oracle
Threat intelligence agent.
- Known bad IPs
- CVEs
- Exploit feeds
- Malware hashes

### Analyst
Investigation and reporting agent.
- Executive summary
- Timeline construction
- MITRE ATT&CK mapping
- Recommendations

### Engineer
Remediation agent.
- Firewall rules
- IAM changes
- Kubernetes fixes
- Docker hardening

### Compliance
Compliance mapping agent.
- SOC 2
- ISO 27001
- CIS Controls
- NIST CSF
- PCI DSS
- HIPAA

## AI Investigation Workflow

```
Alert
  ↓
Collect Context
  ↓
Correlate Events
  ↓
MITRE ATT&CK Mapping
  ↓
Root Cause Analysis
  ↓
Confidence Score
  ↓
Recommended Actions
  ↓
Automated Response (SOAR)
  ↓
Incident Report
  ↓
Knowledge Graph Update
```

## SOAR Playbooks (Seeded)

| Playbook | Trigger | Steps |
|----------|---------|-------|
| Credential Stuffing Response | `brute_force_login` | disable account → revoke sessions → notify user → create incident → generate report |
| API Abuse Containment | `api_abuse` | block IP → increase rate limits → notify admin → save evidence |
| Token Theft Response | `token_reuse` | revoke JWT → rotate refresh token → invalidate sessions → alert SOC |
| GitHub Secret Leak | `secret_leak` | revoke secret → rotate credentials → notify repo owner → create ticket |

## Knowledge Graph

Every event becomes part of the DKOS knowledge graph:

```
User → Login → Failed Login → IP Address → Country → Device → Session → Alert → Incident → Response → Resolution
```

Enables queries like:
- "Show every incident involving this API key"
- "Which IPs attacked multiple tenants?"
- "Show lateral movement over the past week"

## Risk Scoring

Every entity receives a live score (0-100) based on:
- Failed login frequency
- Geographic anomalies
- Admin access level
- MFA status
- Token reuse indicators
- Known malicious ASN associations

---

## Install Guide

### 1. Database

Run the migration:

```bash
supabase db push
```

Or paste `supabase/migrations/20260630_d3vonn_soc_v2.sql` into the Supabase SQL editor.

### 2. Backend

The security module lives at `backend/app/security/`. Routers are registered in `backend/main.py`:

```python
# v1 (basic SOC)
from backend.app.security.router import router as security_router
app.include_router(security_router)

# v2 (full command center)
from backend.app.security.router_v2 import router as security_v2_router
app.include_router(security_v2_router)
```

Install dependencies if missing:

```bash
pip install supabase pydantic fastapi
```

Required environment variables:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Frontend

The SecurityOps dashboard is at `src/pages/security/SecurityOps.tsx` and registered at `/security/ops` in `src/App.tsx`.

Install Recharts if missing:

```bash
npm i recharts
```

### 4. Test Failed Login Detection

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

Then open `/security/ops`.

## API Endpoints

### v1 — `/api/security/*`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/security/events` | Ingest event (v1 schema) |
| GET | `/api/security/events` | List events |
| GET | `/api/security/alerts` | List alerts |
| PATCH | `/api/security/alerts/{id}` | Update alert |
| GET | `/api/security/incidents` | List incidents |
| POST | `/api/security/incidents` | Create incident |
| GET | `/api/security/rules` | List rules |
| GET | `/api/security/dashboard` | Dashboard stats |
| POST | `/api/security/sweep` | Manual detection sweep |

### v2 — `/api/security/v2/*`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/security/v2/events` | Ingest event (v2 schema with full pipeline) |
| POST | `/api/security/v2/risk/score` | Compute risk score |
| GET | `/api/security/v2/risk/scores` | List risk scores |
| GET | `/api/security/v2/threat-intel/feeds` | List threat feeds |
| POST | `/api/security/v2/threat-intel/sync` | Sync feeds |
| POST | `/api/security/v2/threat-intel/iocs` | Add IOC |
| GET | `/api/security/v2/threat-intel/enrich/{ip}` | Enrich IP |
| GET | `/api/security/v2/correlations` | List correlations |
| GET | `/api/security/v2/graph/query` | Query knowledge graph |
| GET | `/api/security/v2/graph/attack-paths/{actor}` | Find attack paths |
| GET | `/api/security/v2/graph/stats` | Graph statistics |
| GET | `/api/security/v2/playbooks` | List SOAR playbooks |
| POST | `/api/security/v2/playbooks/{id}/execute` | Execute playbook |
| GET | `/api/security/v2/agents` | List agent workforce |
| GET | `/api/security/v2/agents/{id}/tasks` | Agent tasks |
| POST | `/api/security/v2/agents/{id}/dispatch` | Dispatch agent |
| GET | `/api/security/v2/cases` | List cases |
| POST | `/api/security/v2/cases` | Create case |
| PATCH | `/api/security/v2/cases/{id}` | Update case |
| GET | `/api/security/v2/compliance` | Compliance posture |
| GET | `/api/security/v2/metrics` | MTTD/MTTR metrics |
| GET | `/api/security/v2/dashboard` | Enhanced dashboard |

## Dashboard Features

- Global stats (events, alerts, incidents, cases)
- MTTD/MTTR trend charts
- Agent workforce status grid
- MITRE ATT&CK coverage radar chart
- Risk heatmap with entity scores
- Event correlation visualization
- Compliance posture by framework
- SOAR playbook status and execution history

## Integration Roadmap

Add connectors for:
- GitHub (audit + security events)
- Cloudflare (WAF + access logs)
- Google Cloud Audit Logs
- Microsoft Identity / Entra ID
- Amazon Web Services (CloudTrail)
- Docker (container events)
- Kubernetes (audit logs)
- Supabase (auth webhooks)
- Railway (deploy events)
- Vercel (function logs)
- Pinecone (access logs)
- Syslog (generic)
- OpenTelemetry (traces)
- Auth providers (Auth0, Clerk, etc.)
- EDR (CrowdStrike, SentinelOne)

## Production Hardening

- Replace placeholder RLS with tenant membership policies
- Require service-role-only ingestion for system logs
- Add API key/HMAC signing to `/api/security/v2/events`
- Connect Supabase Auth webhooks
- Connect GitHub audit/security webhooks
- Add Cloudflare event ingestion
- Add OpenSearch or ClickHouse sink for high-volume logs
- Convert proposed Hermes actions into approval-gated SOAR execution
- Add Markdown/PDF incident exports
- Add WebSocket/Supabase Realtime for live updates
- Replace agent stubs with full OpenAI/Hermes reasoning chains

## Milestone Plan

1. **Security Data Layer** — Complete normalized schema, tenant-aware RLS, scalable event ingestion
2. **Detection & Correlation** — Expand rules into correlation engine with risk scoring and MITRE mapping
3. **AI Agent Workforce** — Implement specialized Hermes SOC agents with OpenAI reasoning
4. **SOAR Automation** — Add playbooks for common incidents, automated containment, approval workflows
5. **Knowledge Graph Integration** — Feed all incidents into DKOS memory and graph
6. **Executive & Analyst Experience** — Analyst views, executive dashboards, case management, evidence collection, report generation

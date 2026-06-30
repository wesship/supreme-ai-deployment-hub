# D3VONN Cyber Command Center — Implementation Pack

## What this installs

- Supabase security schema (events, alerts, incidents, detection rules, agent actions)
- FastAPI `/api/security/*` routes (event ingestion, alert management, incident tracking, dashboard)
- Detection engine for failed login bursts, API abuse, admin privilege changes, and token reuse
- Hermes Security Agent stub (automated response framework)
- React security dashboard with real-time stats, alerts, events, rules, and agent action log
- Recharts-powered threat distribution visualization

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Security Dashboard                       │
│         /security/ops — Cyber Command Center UI                  │
├─────────────────────────────────────────────────────────────────┤
│                    FastAPI Backend                                │
│         /api/security/* — Event ingestion & queries              │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Detection   │  Hermes Security │  Supabase                     │
│  Engine      │  Agent (stub)    │  (PostgreSQL + RLS)            │
└──────────────┴──────────────────┴───────────────────────────────┘
```

## File Locations

### Backend

| File | Purpose |
|------|---------|
| `backend/app/security/__init__.py` | Module package |
| `backend/app/security/models.py` | Pydantic request/response schemas |
| `backend/app/security/router.py` | FastAPI router with all endpoints |
| `backend/app/security/detection.py` | Detection engine (rule evaluation) |
| `backend/app/security/agent.py` | Hermes Security Agent stub |

### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/20260630_d3vonn_soc.sql` | Full schema migration |

### Frontend

| File | Purpose |
|------|---------|
| `src/pages/security/SecurityDashboard.tsx` | Main dashboard page |
| `src/pages/security/index.ts` | Page exports |
| `src/components/security/SecurityAlerts.tsx` | Alert feed with status management |
| `src/components/security/SecurityEvents.tsx` | Event timeline |
| `src/components/security/DetectionRules.tsx` | Rule status display |
| `src/components/security/AgentActions.tsx` | Agent action audit log |
| `src/components/security/ThreatChart.tsx` | Severity distribution chart |
| `src/components/security/index.ts` | Component exports |

## Backend Install

The security router is already registered in `backend/main.py`:

```python
from backend.app.security.router import router as security_router
app.include_router(security_router)
```

The router uses the Supabase service role key via environment variables:

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Install

Run:

```bash
supabase db push
```

or paste `supabase/migrations/20260630_d3vonn_soc.sql` into the Supabase SQL editor.

## Frontend Install

The dashboard is registered at `/security/ops` in `src/App.tsx`. The original trust/marketing page remains at `/security`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/security/events` | Ingest a security event |
| `GET` | `/api/security/events` | List recent events (filterable) |
| `GET` | `/api/security/alerts` | List alerts |
| `PATCH` | `/api/security/alerts/{id}` | Update alert status |
| `GET` | `/api/security/incidents` | List incidents |
| `POST` | `/api/security/incidents` | Create incident |
| `PATCH` | `/api/security/incidents/{id}` | Update incident |
| `GET` | `/api/security/rules` | List detection rules |
| `GET` | `/api/security/dashboard` | Dashboard statistics |
| `POST` | `/api/security/sweep` | Trigger manual detection sweep |
| `GET` | `/api/security/agent/actions` | Agent action audit trail |

## Detection Rules (Seeded)

| Rule ID | Trigger | Threshold | Window |
|---------|---------|-----------|--------|
| `brute_force_login` | `auth.login_failed` | 5 events | 300s |
| `api_abuse` | `api.rate_exceeded` | 50 events | 60s |
| `admin_privilege_escalation` | `auth.role_changed` | 1 event | instant |
| `token_reuse` | `auth.token_reuse` | 1 event | instant |

## Test Data

Send five failed-login events to trigger the first alert:

```bash
for i in 1 2 3 4 5; do
curl -X POST "$API_URL/api/security/events" \
  -H "Content-Type: application/json" \
  -d '{"source":"d3vonn-api","event_type":"auth.login_failed","severity":"medium","actor":"demo@d3vonn.io","ip":"8.8.8.8","outcome":"failure"}'
done
```

Then open:

```text
/security/ops
```

## Next Hardening Steps

- Replace placeholder auth policies with tenant-aware RLS
- Add service-role-only ingestion for system logs
- Connect Supabase auth webhooks to auto-ingest auth events
- Connect GitHub security/audit events via webhook
- Add OpenSearch sink for high-volume log search
- Replace `agent.py` stub with full Hermes/OpenAI reasoning agent
- Add PDF/Markdown incident report export
- Add real-time WebSocket push for live alert notifications
- Implement IP reputation scoring and geo-fencing
- Add SOAR playbook automation for common incident types

# Hermes Research OS v1

Hermes Research OS upgrades Hermes from chatbot-style response generation into a routed research and lead-intelligence operating layer.

## Runtime

```bash
pip install -r requirements.txt
```

The Research OS implementation in this repository uses its built-in source adapters and does not require an `agent-reach` PyPI package. The `AgentReachCollectorAgent` name refers to the internal parallel collector abstraction in `backend/research_os/agents.py`.

## Backend endpoints

- `POST /api/research/query` — full routed research job
- `POST /api/research/collect` — collect raw source evidence
- `POST /api/research/rank` — collect and score evidence
- `GET /api/research/sources/health` — source adapter health
- `GET /api/research/jobs/{job_id}` — sync-v1 job contract placeholder
- `POST /api/leads/enrich` — queue lead candidates into Clay
- `POST /api/leads/clay-webhook` — receive Clay callback records

## Six agents

1. `ResearchRouterAgent` — detects intent and routes sources.
2. `AgentReachCollectorAgent` — runs source adapters in parallel.
3. `EvidenceRankerAgent` — scores evidence before expensive reasoning.
4. `LeadEnrichmentAgent` — extracts candidates and posts to Clay.
5. `GrokTrendAgent` — decides when X/Grok trend routing should be used.
6. `DKOSMemoryWriterAgent` — persists ranked evidence to DKOS/Supabase.

## Optional environment variables

```env
GITHUB_TOKEN=
YOUTUBE_API_KEY=
CLAY_WEBHOOK_URL=
CLAY_CALLBACK_TABLE=clay_lead_queue
DKOS_RESEARCH_TABLE=dkos_research_evidence
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Frontend

Open `/research-os` to access the Research OS dashboard.

## Database

Run migration:

```sql
supabase/migrations/20260626_research_os.sql
```

This creates:

- `dkos_research_evidence`
- `clay_lead_queue`

## Example request

```json
{
  "query": "Find companies that need AI automation in insurance",
  "enrich_leads": true,
  "save_to_dkos": true,
  "max_results_per_source": 5
}
```

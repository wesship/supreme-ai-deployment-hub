# D3VONN.IO Open Source Integration Layer

This implements the recommendation to make D3VONN.IO the operating system that orchestrates high-value open-source AI projects instead of becoming a pile of unrelated tools.

## Core principle

Hermes stays the canonical orchestrator. Open-source projects become capability providers behind stable D3VONN adapter contracts.

```text
D3VONN.IO
  └── Hermes Core
      ├── Knowledge Graph / DKOS / RAG
      ├── Business OS / CRM
      ├── Security SOC
      └── Open Source Integration Layer
          ├── LibreChat: AI gateway + model routing
          ├── Open Generative AI: multi-modal generation dashboard
          ├── Agentic Inbox: email triage + lead automation
          ├── Hyperframes: HTML-to-video rendering
          ├── Claude Ads: ad audit extension
          ├── Open-LLM-VTuber: professional voice/avatar assistant concepts
          ├── Fincept: financial and tokenized-asset research module
          ├── AutoHedge: disabled research-only quant module
          ├── Vibe-Trading: disabled research-only trading architecture module
          └── Camofox: disabled except transparent user-authorized automation
```

## Backend implementation

New package:

```text
backend/opensource_integrations/
  __init__.py
  models.py
  registry.py
  adapters.py
  router.py
```

### API contract

When registered in `backend/main.py`, the router exposes:

```text
GET  /api/opensource/providers
GET  /api/opensource/providers/{provider_key}
POST /api/opensource/invoke
POST /api/opensource/providers/{provider_key}/invoke
```

### Generic invocation body

```json
{
  "capability": "email_triage",
  "task": "Classify new insurance leads and create CRM follow-up tasks.",
  "tenant_id": "demo",
  "user_id": "operator",
  "metadata": {
    "source": "hermes"
  }
}
```

The router returns a safe dry-run response until the target provider is deployed and configured with environment variables. This prevents accidental live trading, scraping, email sending, media spending, or unauthorized automation.

## Provider priority

| Provider | Tier | D3VONN role | Default status |
|---|---:|---|---|
| LibreChat | 1 | AI Gateway, MCP tools, multi-model chat | adapter ready |
| Open Generative AI | 1 | Image/video/audio/document/code generation | external service required |
| Agentic Inbox | 1 | Email triage, lead classification, CRM sync | external service required |
| Hyperframes | 1 | Branded MP4/video rendering | external service required |
| Claude Ads | 2 | Marketing and ad audit extension | planned |
| Open-LLM-VTuber | 2 | Professional avatar/voice assistant concepts | planned |
| Fincept | 3 | Opportunity Intelligence and RWA research | planned |
| AutoHedge | 3 | Quant research only | disabled |
| Vibe-Trading | 3 | Trading architecture research only | disabled |
| Camofox | 4 | Authorized browser automation only | disabled |

## Required environment variables

Only set these after each external service is reviewed, deployed, and secured.

```text
LIBRECHAT_BASE_URL
LIBRECHAT_API_KEY
OPEN_GENERATIVE_AI_BASE_URL
OPEN_GENERATIVE_AI_API_KEY
AGENTIC_INBOX_BASE_URL
AGENTIC_INBOX_API_KEY
HYPERFRAMES_BASE_URL
HYPERFRAMES_API_KEY
CLAUDE_ADS_BASE_URL
CLAUDE_ADS_API_KEY
OPEN_LLM_VTUBER_BASE_URL
FINCEPT_BASE_URL
FINCEPT_API_KEY
```

## Guardrails

1. Hermes remains the control plane.
2. Providers must not receive secrets directly from the frontend.
3. Trading-related repos stay disabled unless legal, compliance, risk, and security review are complete.
4. Browser automation must be transparent, user-authorized, and compliant with website terms and applicable law.
5. Every provider should be replaceable through the adapter interface.

## Next implementation steps

1. Register `backend.opensource_integrations.router` in `backend/main.py`.
2. Add frontend admin cards under the command center for provider status.
3. Add provider-specific authenticated clients one by one, starting with LibreChat.
4. Add integration tests for provider listing and dry-run invocation.
5. Move provider health into `/health/deep` after production deployment.

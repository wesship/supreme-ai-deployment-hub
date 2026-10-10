# PRIMETIME Release 4 — AI Assistance API Contract

## Overview

Draft-first AI assistance API. No autonomous send, quote, policy recommendation,
application submission, execution, or delete endpoints.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /primetime/v1/ai/agents | List AI agents |
| POST | /primetime/v1/ai/outputs | Create AI output (draft) |
| PATCH | /primetime/v1/ai/outputs/{id} | Update AI output |
| GET | /primetime/v1/ai/knowledge | Query knowledge base |
| POST | /primetime/v1/ai/knowledge-citations | Add citation |

## Blocked Endpoints (Regulated)

These endpoints are explicitly blocked and will never be implemented:

- `POST /primetime/v1/ai/send` — No autonomous sending
- `DELETE /primetime/v1/ai/*` — No deletion of AI records
- `POST /primetime/v1/ai/quote` — No autonomous quote generation
- `POST /primetime/v1/ai/recommend-policy` — No autonomous policy recommendations
- `POST /primetime/v1/ai/submit-application` — No autonomous submissions

## Governance

- All AI outputs start as drafts requiring human review
- Regulated actions require explicit human approval
- The AI layer does not execute actions autonomously

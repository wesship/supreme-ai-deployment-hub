# OpenHuman-Inspired D3VONN Integration Blueprint

This document captures the DEVONN-native implementation plan for adapting useful OpenHuman ideas without replacing the existing D3VONN architecture.

## Source Concepts

OpenHuman highlights five patterns that are useful for D3VONN:

1. Local-first Memory Tree plus Obsidian-style Markdown vault.
2. OAuth connector auto-fetch into memory.
3. TokenJuice-style compression before model calls.
4. Human-first desktop/operator UX.
5. Native tool harness patterns for search, scrape, code, voice, and workflow context.

D3VONN should treat these as module patterns, not as a platform replacement.

## Integration Position

```text
D3VONN Core
├── React/Vite operator UI
├── FastAPI / orchestration services
├── LangGraph / DAG runtime
├── OpenClaw / GitNexus operational bridge
├── CI/CD and governance layer
└── OpenHuman-inspired modules
    ├── Token compression
    ├── Memory tree export
    ├── Obsidian vault sync
    ├── Connector inventory
    └── Operator UX onboarding patterns
```

## What To Implement

### 1. Token Compression Layer

Purpose:
- reduce verbose tool output before LLM calls
- canonicalize HTML to Markdown-like text
- dedupe repeated lines
- preserve meaning while lowering token pressure

Repo implementation:
- `scripts/tokenjuice-lite.mjs`

Initial use cases:
- CI logs
- GitHub workflow summaries
- repo audit output
- scraped docs
- connector payloads

### 2. Memory Tree Export

Purpose:
- turn operational events into durable Markdown knowledge
- produce Obsidian-compatible notes
- preserve repo history, decisions, and incident reports

Repo implementation:
- `scripts/memory-tree-export.mjs`

Initial vault location:
- `.d3vonn/memory-vault/`

Recommended future storage:
- SQLite metadata
- vector index in Chroma/Supabase/Pinecone
- PostgreSQL canonical memory registry

### 3. Connector Inventory

Purpose:
- classify available integrations
- identify memory ingestion candidates
- reduce connector sprawl
- define which connectors are active, advisory, or future

Repo implementation:
- `scripts/connector-inventory.mjs`

Initial connectors to classify:
- GitHub
- Gmail
- Google Drive
- Calendar
- Slack
- Notion
- Vercel
- AWS
- Supabase
- n8n
- Appsmith

### 4. Operator UX Layer

Purpose:
- simplify onboarding
- make the operator command center feel human and guided
- expose memory, connectors, and system health clearly

Future frontend sections:
- Memory Vault
- Connector Status
- CI Doctor
- Deployment Readiness
- Governance Review
- Agent Runtime Console

### 5. Auto-Fetch Pattern

Purpose:
- periodic ingestion into memory
- does not directly call managed OpenHuman services
- should run through DEVONN-owned connectors and secrets

Future implementation:
- `services/auto-fetch-worker/`
- queue-backed sync loop
- cron/scheduler trigger
- memory-vault write target
- review queue before irreversible actions

## What Not To Replace

Do not replace:
- D3VONN orchestrator
- LangGraph/DAG runtime
- CI/CD governance
- AWS/EKS topology
- OpenClaw operational bridge
- GitNexus bridge
- existing React/Vite frontend

## Production Safety Rules

1. Keep OpenHuman-inspired features additive.
2. No external OAuth auto-fetch without explicit secrets and review.
3. No hidden background sync into production memory.
4. No irreversible connector actions from memory workers.
5. Compress and summarize before sending logs to models.
6. Keep raw data local or in approved DEVONN storage.

## Next Milestones

- Add token compression script.
- Add memory tree export script.
- Add connector inventory classifier.
- Wire scripts into package.json as advisory commands.
- Add future UI card specs for operator console.
- Later: convert scripts into services under `/services/memory/` and `/services/connectors/`.

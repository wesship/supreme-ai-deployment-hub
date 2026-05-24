# DEVONN Operator Console Blueprint

The Operator Console is the human-first control layer for DEVONN.AI. It brings the OpenHuman-inspired memory, connector, compression, and repo-intelligence modules into a single command experience without replacing the existing runtime architecture.

## Purpose

The console should let the operator answer five questions quickly:

1. What is the platform state?
2. What is broken?
3. What changed recently?
4. What memory/context does the system have?
5. What action is safe to take next?

## Proposed Routes

```text
/operator
/operator/memory
/operator/connectors
/operator/ci
/operator/deployments
/operator/governance
/operator/runtime
```

## Sections

### `/operator`

Main command dashboard.

Cards:
- System Readiness
- CI Health
- Deployment Lane
- Active Connectors
- Memory Vault
- Governance Mode
- Runtime Status
- Next Safe Action

### `/operator/memory`

Displays operational memory produced by:
- `scripts/memory-tree-export.mjs`
- repo audit outputs
- deployment reports
- CI summaries
- incident notes

Future data sources:
- `.devonn/memory-vault/*.md`
- SQLite memory registry
- Postgres memory metadata
- vector search index

### `/operator/connectors`

Displays connector inventory from:
- `scripts/connector-inventory.mjs`

Connector lanes:
- production
- staging
- future
- disabled
- manual-only

### `/operator/ci`

Displays outputs from:
- `npm run ci:doctor`
- `npm run workflow:audit`
- `npm run workflow:classify`
- `npm run pins:validate`
- `npm run repo:entropy`

### `/operator/deployments`

Tracks:
- Vercel frontend
- staging API
- AWS/EKS rollout
- Render/Railway fallback
- DNS readiness
- ACM certificate status
- Route 53 delegation

### `/operator/governance`

Tracks:
- branch protection
- required status checks
- manual governance review state
- Hermes v2/v3 review status
- policy-as-code status
- release freeze status

### `/operator/runtime`

Tracks:
- agent runtime health
- queue health
- memory persistence
- retry/dead-letter state
- LangGraph/DAG status
- OpenClaw/GitNexus bridge status

## Data Contract

Initial JSON schema:

```json
{
  "readiness": "green|yellow|red",
  "ci": {
    "status": "green|yellow|red",
    "lastRun": "ISO-8601",
    "requiredChecks": []
  },
  "memory": {
    "vaultPath": ".devonn/memory-vault",
    "entries": 0,
    "lastExport": null
  },
  "connectors": {
    "production": [],
    "staging": [],
    "future": []
  },
  "deployments": {
    "frontend": "unknown",
    "api": "unknown",
    "database": "unknown",
    "redis": "unknown"
  },
  "governance": {
    "mainProtected": false,
    "stagingProtected": false,
    "manualReviewRequired": true
  }
}
```

## Implementation Phases

### Phase 1 — Static Console

- Add operator blueprint.
- Add JSON state file.
- Add scripts that write reports.
- Keep UI read-only.

### Phase 2 — Live State

- API endpoint reads operational reports.
- Frontend renders real statuses.
- Add refresh button.

### Phase 3 — Safe Actions

- Add action recommendations only.
- No irreversible actions.
- Human approval required.

### Phase 4 — Controlled Execution

- Trigger approved workflows.
- Run diagnostics.
- Export memory.
- Create issue/PR drafts.

## Safety Rules

1. Console starts read-only.
2. No production deploy button until branch protection and staging are stable.
3. No connector write actions without explicit approval.
4. Memory ingestion must be auditable.
5. Governance warnings should be visible but not silently bypassed.

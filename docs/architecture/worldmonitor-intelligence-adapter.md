# World Monitor Intelligence Adapter

## Status

Implementation gate: adapter scaffold.

## Objective

Use World Monitor as an external intelligence sensor for D3VONN.IO while preserving Hermes as the only workflow/orchestration authority.

```text
World Monitor MCP / REST
        |
        v
WorldMonitorClient
        |
        v
D3VONN IntelligenceEvent v1
        |
        +--> Intelligence persistence / event bus
        +--> Knowledge graph enrichment
        +--> Hermes research tasks
        +--> SOC / infrastructure correlation
        +--> Executive intelligence briefs
```

## Boundary rule

Do not embed or fork the World Monitor application into the proprietary D3VONN core. Consume it through its public MCP/REST surfaces and normalize all responses into D3VONN-owned contracts.

## Environment

```bash
WORLDMONITOR_API_KEY=
WORLDMONITOR_MCP_URL=https://worldmonitor.app/mcp
WORLDMONITOR_TIMEOUT_SECONDS=25
```

The API key must remain server-side. Never expose it through a `VITE_*` variable or browser bundle.

## Initial MCP capabilities

The adapter intentionally starts small:

- `tools/list` for capability discovery.
- `get_world_brief` for a current global intelligence snapshot.
- `analyze_situation` for bounded situation analysis.
- Generic `call_tool(name, arguments)` for later allowlisted expansion.

## Normalized contract

`backend/intelligence/worldmonitor/models.py` owns the first normalization contract:

- source
- domain
- event type
- title / summary
- entities
- location
- severity
- confidence
- observed timestamp
- evidence
- relationships
- raw source id
- raw payload

Downstream D3VONN components should depend on this contract, not World Monitor payload shapes.

## Next implementation gate

1. Add an authenticated FastAPI intelligence router under `/api/intelligence/worldmonitor/*`.
2. Add an explicit allowlist of MCP tools exposed through D3VONN.
3. Add normalization functions for the first three signal families: technology/provider outages, cyber signals, and world brief items.
4. Persist normalized events to a dedicated intelligence table/event stream.
5. Enqueue Hermes research/correlation tasks only after normalization and severity/confidence policy evaluation.
6. Add tests using deterministic mocked MCP responses; do not require a live API key in CI.
7. Add production health telemetry without leaking credentials or raw sensitive provider responses.

## Acceptance criteria for GREEN

- World Monitor credentials are server-only.
- Health endpoint distinguishes `configured`, upstream-reachable, and degraded states.
- One live World Monitor signal can be normalized into `d3vonn.intelligence-event/v1`.
- One normalized event can be handed to Hermes without creating a second scheduler.
- CI uses mocks/sandbox data and does not consume production World Monitor quota.
- Raw provider payload is retained only where required for audit/debugging.

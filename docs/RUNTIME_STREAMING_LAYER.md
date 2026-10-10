# DEVONN Runtime Streaming Layer

## Purpose

The runtime streaming layer upgrades the Operator Console from periodic polling into a live operational surface.

## Transport

Initial transport:
- FastAPI WebSocket
- endpoint: `/api/operator/runtime/stream`

Future transport:
- SSE fallback
- Redis pub/sub fanout
- Kafka/NATS event mesh
- OpenTelemetry event pipeline

## Event Types

### operator.connected
Sent when the operator stream initializes.

### operator.heartbeat
Read-only heartbeat event for:
- agents
- queues
- memory
- DAG
- GitNexus
- observability

### future events
- deployment.started
- deployment.completed
- ci.failed
- ci.recovered
- memory.exported
- connector.sync
- governance.warning
- runtime.alert

## Safety Rules

1. Stream is read-only.
2. No runtime execution over websocket.
3. No connector mutations.
4. No deployment actions.
5. No secret material in events.
6. Human approval required for future execution lanes.

## Frontend Consumption

Frontend uses:
- `useOperatorRuntimeStream.ts`
- RuntimeStreamPanel component

Features:
- auto reconnect
- bounded event history
- graceful offline fallback
- timestamp rendering
- severity coloring

## Future Evolution

### Phase 1
Heartbeat + runtime visibility.

### Phase 2
Observability metrics.

### Phase 3
Agent activity stream.

### Phase 4
Human-approved execution events.

### Phase 5
Distributed orchestration telemetry mesh.

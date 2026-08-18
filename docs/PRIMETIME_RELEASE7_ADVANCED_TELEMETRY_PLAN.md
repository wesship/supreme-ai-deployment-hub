# PRIMETIME Release 7 — Advanced Telemetry and Observability

## Objective

Release 7 adds a governed operational-telemetry layer to PRIMETIME. It provides authorized workspace operators with durable signal ingestion, service-level objective (SLO) definitions, immutable evaluations, and lifecycle-managed telemetry alerts. The release builds on the existing Release 5 analytics model and reuses its workspace membership, role-gate, audit-event, and no-delete patterns.

## Scope

| Capability | Release 7 behavior |
|---|---|
| Telemetry signals | Records bounded numeric measurements with source, unit, timestamp, trace correlation ID, deployment version, and safe dimensions. |
| SLO definitions | Defines a target, comparator, optional warning threshold, and evaluation window for a named telemetry metric. |
| SLO evaluations | Stores append-only evaluation results and derives a compliant, warning, or breached status. |
| Telemetry alerts | Opens alerts only from evaluation results; alerts may be acknowledged, resolved, or silenced with an audit record. |
| Operator surface | Provides an authenticated observability console with health summary, active alerts, recent evaluations, and controlled signal/SLO creation. |

## Production Boundaries

> Release 7 is an observability surface. It does not send communications, generate quotes, recommend policies, submit applications, execute AI actions, modify CRM records, or make autonomous operational decisions.

All telemetry is workspace-scoped. The runtime API validates workspace membership before every read or write, applies role gates to all mutations, uses fixed table allow-lists, and writes an audit event for every create or lifecycle change. No `DELETE` endpoint is exposed. Signal, evaluation, and audit history are append-only through the API.

No customer payloads, regulated customer data, message bodies, credentials, bearer tokens, or raw request payloads may enter telemetry labels or dimensions. Telemetry labels must remain low-cardinality. The schema permits only a small bounded dimensions object, while correlation IDs and deployment versions are constrained to safe, operational metadata.

## Data Model

| Table | Mutability | Purpose |
|---|---|---|
| `primetime_telemetry_signals` | Append-only | Individual numeric signal samples for runtime, deployment, agent, scheduler, and compliance health. |
| `primetime_slo_definitions` | Create and governed patch | Workspace SLO contracts describing threshold logic and evaluation windows. |
| `primetime_slo_evaluations` | Append-only | Historical SLO results, including measured value, status, and source-signal linkage. |
| `primetime_telemetry_alerts` | Lifecycle patch only | Alerts derived from an evaluation and progressed through auditable acknowledgement, resolution, or silencing. |

## API Contract

The Release 7 router is mounted below `/primetime/v1/observability`.

| Endpoint family | Access | Constraint |
|---|---|---|
| `GET /signals`, `GET /slos`, `GET /evaluations`, `GET /alerts`, `GET /overview` | Workspace members with a read role | Read-only operational visibility. |
| `POST /signals`, `POST /slos`, `POST /evaluations` | Manager, workspace administrator, compliance reviewer, or auditor as appropriate | Every write is audited; evaluations must link to an existing same-workspace SLO. |
| `POST /evaluations/{id}/alerts` | Governance-capable role | Opens an alert only when the evaluation is warning or breached. |
| `PATCH /slos/{id}`, `PATCH /alerts/{id}` | Governance-capable role | Allows controlled configuration and alert lifecycle changes; neither endpoint permits workspace reassignment or history alteration. |

## Acceptance Criteria

Release 7 is ready for staging validation only when all of the following are true:

1. The database migration enables RLS, adds workspace indexes, and creates no hard-delete function, trigger, or endpoint.
2. The backend router uses a fixed allow-list, UUID validation, workspace membership checks, role checks, bounded query limits, and audit writes.
3. Signal values are finite and non-negative; signal dimensions are bounded and reject unsafe keys or values.
4. SLO comparator, target, warning threshold, and evaluation status are validated. An alert cannot be opened from a compliant evaluation.
5. The web application exposes both `/primetime/observability` and `/primetime/release-7` with an authorized operator console.
6. Static, unit, TypeScript, frontend build, and full application test suites pass before staging dispatch.
7. Production promotion still requires the Release 6 staging gate, compliance signoff, and the documented rollback plan.

## Explicitly Deferred

This increment does not deploy Prometheus, Grafana, OpenTelemetry collectors, PagerDuty, webhook delivery, background telemetry aggregation, or autonomous remediation. It creates the governed PRIMETIME data and API boundary those integrations can consume once separately approved.

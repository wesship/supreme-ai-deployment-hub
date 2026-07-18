# PRIMETIME Release 5 API Contract — Analytics and Executive Command Center

Base path: `/primetime/v1`

## Metric definitions

- `GET /analytics/metric-definitions?workspace_id=&category=&is_active=`
- `POST /analytics/metric-definitions`
- `PATCH /analytics/metric-definitions/{metric_definition_id}`

## Executive dashboards

- `GET /analytics/dashboards?workspace_id=&audience=&status=`
- `POST /analytics/dashboards`
- `PATCH /analytics/dashboards/{dashboard_id}`

## Dashboard widgets

- `GET /analytics/widgets?workspace_id=&dashboard_id=&status=`
- `POST /analytics/widgets`
- `PATCH /analytics/widgets/{widget_id}`

## Analytics snapshots

- `GET /analytics/snapshots?workspace_id=&metric_key=&snapshot_period=`
- `POST /analytics/snapshots`

## Funnel snapshots

- `GET /analytics/funnel-stage-snapshots?workspace_id=&snapshot_date=`
- `POST /analytics/funnel-stage-snapshots`

## Agent performance snapshots

- `GET /analytics/agent-performance-snapshots?workspace_id=&agent_user_id=&snapshot_date=`
- `POST /analytics/agent-performance-snapshots`

## Compliance metric snapshots

- `GET /analytics/compliance-metric-snapshots?workspace_id=&snapshot_date=`
- `POST /analytics/compliance-metric-snapshots`

## AI action metric snapshots

- `GET /analytics/ai-action-metric-snapshots?workspace_id=&snapshot_date=`
- `POST /analytics/ai-action-metric-snapshots`

## Release governance observations

- `GET /analytics/release-governance-observations?workspace_id=&release_key=&status=&severity=`
- `POST /analytics/release-governance-observations`
- `PATCH /analytics/release-governance-observations/{observation_id}`

## Required controls

- Fixed Supabase table allow-list
- Supabase host validation
- UUID validation
- Active workspace membership checks
- Read/admin/compliance role gates
- Audit events for dashboard, widget, metric definition, snapshot, and observation writes
- No DELETE endpoints
- No communication send endpoints
- No quote endpoints
- No policy recommendation endpoints
- No AI autonomous execution endpoints
- Analytics endpoints may record snapshots but must not mutate business records

## Out of scope

- Live BI warehouse integration
- Real-time streaming analytics
- Cross-workspace benchmarking
- Sensitive exports
- Carrier production metrics
- Product recommendation analytics

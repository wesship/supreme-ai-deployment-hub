# PRIMETIME Release 5 — Analytics API Contract

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
GET /analytics/metric-definitions | List metric definitions |
POST /analytics/dashboards | Create dashboard |
PATCH /analytics/widgets/{widget_id} | Update widget |
GET /analytics/release-governance-observations | Governance audit |

## Governance

- All analytics endpoints are read-only or create-only (no delete)
- No DELETE endpoints exist in the analytics surface
- Workspace membership is enforced on all queries
Analytics endpoints may record snapshots but must not mutate business records

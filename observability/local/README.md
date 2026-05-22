# Local Observability Foundation

This folder is reserved for the local staging observability stack.

## Target components

- Prometheus for metrics scraping
- Grafana for dashboards
- Loki for log aggregation
- OpenTelemetry Collector for trace/metric forwarding

## Minimum staging signals

Every staged service should eventually emit:

- health status
- readiness status where applicable
- request count
- request latency
- error count
- queue depth for worker/orchestrator paths
- guarded-action count
- blocked-action count

## Activation plan

This branch keeps observability as a documented foundation only. The next implementation PR should add:

```text
observability/local/prometheus.yml
observability/local/grafana/provisioning/datasources/prometheus.yml
observability/local/grafana/provisioning/dashboards/devonn-staging.yml
observability/local/loki-config.yml
observability/local/otel-collector.yml
```

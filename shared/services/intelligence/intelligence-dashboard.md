# Operational Intelligence Dashboard

## Purpose

The Operational Intelligence Dashboard visualizes runtime risk, trust, drift, escalation hotspots, and operational anomalies.

This dashboard is the primary reasoning surface for sovereign runtime operators.

## Required Dashboard Panels

### Global Risk Overview

Track:

- global risk score
- deployment instability
- queue pressure
- replay failures
- scheduler lag

### Trust Overview

Track:

- worker trust
- deployment trust
- scheduler trust
- queue trust
- agent trust

### Runtime Drift

Track:

- retry drift
- telemetry drift
- governance drift
- deployment drift
- workflow drift

### Escalation Hotspots

Track:

- escalation clusters
- replay instability
- stale recovery growth
- dead-letter spikes

### Operational Timeline

Visualize:

- deployments
- retries
- escalations
- rollback events
- replay events
- freeze events

## Dashboard Goals

The dashboard should help operators:

- detect instability early
- identify correlated anomalies
- evaluate deployment health
- evaluate governance health
- improve rollback confidence

## Safety Constraint

The dashboard is observational and advisory in v1.

Autonomous remediation remains bounded and governance-controlled.

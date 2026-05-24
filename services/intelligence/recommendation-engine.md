# Recommendation Engine v1

## Purpose

The Recommendation Engine provides bounded operational recommendations derived from telemetry and runtime risk.

Version 1 is recommendation-only.

## Recommendation Categories

### Queue Recommendations

- scale workers
- throttle intake
- pause replay
- investigate dead-letter growth

### Scheduler Recommendations

- rebalance leases
- isolate unhealthy workers
- halt promotion

### Deployment Recommendations

- halt canary
- rollback deployment
- freeze promotion

### Governance Recommendations

- increase approval scrutiny
- activate freeze mode
- require manual review

## Safety Constraints

The engine must not:

- mutate deployments directly
- rewrite schemas
- bypass governance approval
- override rollback authority
- self-modify runtime policy

## Goal

Improve operational awareness while preserving bounded autonomy.

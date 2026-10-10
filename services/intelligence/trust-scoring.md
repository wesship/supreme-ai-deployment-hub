# Trust Scoring Model v1

## Purpose

The Trust Scoring Model estimates reliability and operational confidence across runtime entities.

## Trust Targets

- workers
- deployments
- queues
- schedulers
- agents
- telemetry systems

## Worker Trust Signals

- crash frequency
- retry rate
- stale execution frequency
- replay integrity
- heartbeat reliability

## Deployment Trust Signals

- rollback frequency
- canary success
- deployment stability
- telemetry completeness
- runtime degradation after release

## Queue Trust Signals

- saturation frequency
- dead-letter growth
- replay consistency
- recovery reliability

## Scheduler Trust Signals

- lag stability
- arbitration reliability
- stale recovery consistency
- lease conflict rate

## Agent Trust Signals

- escalation frequency
- governance violations
- replay safety
- execution stability

## Trust Bands

| Score | Meaning |
|---:|---|
| 80-100 | trusted |
| 60-79 | stable |
| 40-59 | degraded |
| 20-39 | unstable |
| 0-19 | untrusted |

## Operational Use

Trust scores should:

- influence recommendations
- prioritize review
- identify unstable components
- support bounded governance decisions

## Safety Constraint

Low trust must not automatically trigger destructive remediation in v1.

Human approval remains authoritative.

# Devonn.ai Sovereign Trust Architecture

## Purpose

Devonn.ai positions security, data residency, execution control, and supply-chain resilience as product capabilities. This document translates infrastructure choke-point and CFIUS-style supply-chain risk into an implementable architecture and an evidence-based trust narrative.

## Core position

**Architectural Sovereignty:** enterprise customers can control where agent execution, memory, models, tools, and sensitive context run. Cloud services are optional execution resources, not mandatory owners of enterprise state.

Claims in this document are architecture targets unless explicitly marked implemented and verified. Marketing and Trust Center copy must not claim SOC 2 certification, zero-data retention, air-gapping, hardware enclave protection, mTLS, or cryptographic event logging as completed controls until the corresponding control and evidence exist.

## Three pillars

### 1. Execution and Node Isolation

- Local-first execution for supported workloads on enterprise-controlled hardware.
- Execution nodes advertise capabilities, region, trust level, model availability, GPU/CPU capacity, latency, cost, and residency constraints.
- Hermes remains the execution kernel; an `ExecutionPolicy` selects eligible nodes.
- Tool calls run in constrained workers with least-privilege credentials and explicit network boundaries.
- Local GGUF/open-weight inference is supported where the installed runtime provides it; cloud inference is a policy-selected fallback rather than an architectural requirement.

### 2. Data and Memory Sovereignty

- Tenant/application APIs enforce authorization before access to runtime state.
- Raw Hermes runtime tables remain backend-controlled; tenant-facing views are exposed through authorized APIs/read models.
- Knowledge, vector, cache, and memory stores are classified by residency and confidentiality requirements.
- Hybrid fallback requests must use explicit data-classification and provider policies.
- Sensitive context should be minimized, scoped to the task, encrypted in transit and at rest, and subject to configurable retention.

### 3. Immutable Auditability

- Agent, tool, workflow, approval, and execution events should have stable identifiers and tamper-evident chaining where required by the customer control profile.
- Human approval is required for high-impact operations according to policy.
- Agent identities and tools use least privilege.
- Audit records must be retained according to tenant and regulatory policy.

## Execution policy model

```yaml
execution_policy:
  data_classification: confidential
  allowed_regions: [customer-approved-region]
  residency_required: true
  gpu_required: false
  allowed_models: [customer-approved-local-models]
  cloud_fallback: false
  air_gapped: false
  max_latency_ms: 1000
  human_approval: required_for_high_impact
```

Hermes should resolve this policy against the worker registry before assigning a task.

## Node identity and trust

Target controls:

- unique node identity
- short-lived credentials where practical
- certificate-based node authentication
- rotation and revocation
- signed software/artifact provenance
- capability attestation
- heartbeat and health state
- explicit trust tier

mTLS is a target control for node-to-node communications. It is not a blanket current-state claim until deployed and tested across supported topologies.

## SOC 2 mapping

| Trust Services Criteria | Devonn control domain | Evidence target |
|---|---|---|
| Security CC6 | Identity, node authentication, least privilege, network boundaries | IAM/RBAC records, policy tests, certificate lifecycle, audit logs |
| Confidentiality CC6.6 | Encryption and data-residency controls | KMS/config evidence, encryption tests, residency policy |
| Processing Integrity PI1.1 | Tool schemas, policy gates, deterministic task lifecycle | Contract tests, execution logs, rejected-call tests |
| Availability A1 | Worker health, leases, recovery, regional failover | Heartbeat/lease evidence, chaos tests, recovery records |
| Privacy P3 | Data minimization, retention, residency, customer controls | Retention configuration, deletion evidence, data-flow records |

SOC 2 readiness is an engineering objective. Devonn.ai must not represent itself as SOC 2 Type II certified until an independent audit has been completed and the report is available.

## CFIUS / supply-chain narrative

The product response to infrastructure concentration risk is not political positioning. It is technical optionality:

1. Customer-controlled execution nodes.
2. Provider-independent model routing.
3. Customer-controlled memory and knowledge boundaries.
4. Portable execution contracts.
5. Auditable tool and agent actions.
6. Policy-driven geographic residency.
7. Explicit cloud fallback controls.

This lets enterprise buyers evaluate Devonn using the same practical questions they use for critical infrastructure: who controls compute, who controls routing, who controls state, where data travels, and what happens when a provider becomes unavailable.

## Trust Center information architecture

- **Architectural Sovereignty** — local/edge execution, provider independence, execution policies.
- **Data Sovereignty** — residency, encryption, context minimization, retention controls.
- **Governance & Audit** — RBAC, approvals, event history, policy enforcement.
- **Infrastructure Resilience** — worker health, leases, failover and recovery.
- **Compliance Alignment** — SOC 2 control mapping and evidence status.

### Required Trust Center status language

Use three labels consistently:

- **Implemented** — code/control exists in the repository.
- **Verified** — deployed control has current evidence.
- **Target** — planned control not yet deployed or independently verified.

Never collapse these states into a single marketing claim.

## Evidence roadmap

P0:

- Verify Hermes RLS in the deployed databases.
- Enforce database-level correlation-id idempotency.
- Verify Hermes task/lease/recovery behavior in the deployed runtime.
- Inventory current encryption, retention, residency, RBAC, audit and provider-routing controls.

P1:

- Implement `ExecutionPolicy` and policy-aware worker selection.
- Establish node identity/certificate lifecycle.
- Add signed/tamper-evident event-chain capability for designated audit streams.
- Build tenant-visible evidence dashboards.

P2:

- Expand sovereign edge runtime support.
- Formalize customer-managed keys where commercially required.
- Build compliance evidence collection and auditor export.
- Prepare the SOC 2 Type II control environment and independent audit.

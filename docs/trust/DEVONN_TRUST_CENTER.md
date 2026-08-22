# Devonn.ai Trust Center

## Sovereign Multi-Agent Orchestration

Devonn.ai is designed to give enterprises control over **where AI executes, where business context is stored, how agents access tools, and how decisions are audited**.

### Architectural Sovereignty

- Hybrid cloud, regional, and customer-controlled edge execution.
- Policy-driven execution-node selection.
- Local/open-weight model support where the selected runtime provides it.
- Provider-independent execution contracts.
- Least-privilege tools and human approval for designated high-impact actions.

### Data Sovereignty

- Backend-controlled access to sensitive runtime state.
- Tenant-aware authorization at application boundaries.
- Configurable residency and provider-routing policies.
- Context minimization so agents receive task-scoped information.
- Encryption and retention controls according to the customer's deployment profile.

### Governance and Audit

- Agent, workflow, tool, approval, and execution identifiers.
- Role-based access controls.
- Human-in-the-loop gates for designated operations.
- Operational health, worker lease, and recovery evidence.
- Evidence-oriented control mapping for enterprise audits.

## Trust status

| Control | Status |
|---|---|
| Hermes execution kernel | Implemented |
| Hermes worker/lease model | Implemented |
| Hermes RLS hardening | Implemented; deployment verification required per environment |
| Hermes database idempotency | Implemented in certification branch; production verification recorded |
| ExecutionPolicy | Target |
| Customer-controlled edge execution | Target/depends on deployment profile |
| mTLS node fabric | Target |
| Customer-managed encryption keys | Target/plan-dependent |
| SOC 2 Type II | Readiness program; not a certification claim |

## Supply-chain resilience

Enterprise customers should be able to answer five questions:

1. Who controls compute?
2. Who controls routing?
3. Who controls memory and knowledge state?
4. Where can sensitive data travel?
5. What happens if a provider or node becomes unavailable?

Devonn's architecture is designed to make those answers policy-driven and auditable rather than hidden inside a single provider dependency.

## SOC 2 alignment

Devonn maps engineering controls to the SOC 2 Trust Services Criteria across security, confidentiality, processing integrity, availability, and privacy. The Trust Center will publish evidence status rather than presenting design intent as certification.

**SOC 2 Type II certification will only be claimed after an independent audit and issuance of the applicable report.**

## Evidence states

- **Implemented:** control exists in code/configuration.
- **Verified:** current deployment evidence demonstrates the control.
- **Target:** control is planned but not yet verified.

# D3VONN.IO Cyber Tool Registry

## Purpose

The Cyber Tool Registry is the governance boundary between Hermes/Security Operations and external cybersecurity capabilities. It converts curated resources such as the Start.me CyberSec Tools collection into explicit, auditable capabilities rather than an unrestricted bookmark list.

## Safety classes

| Class | Meaning | Default policy |
|---|---|---|
| GREEN | Passive/defensive intelligence and analysis | Agent callable with logging |
| YELLOW | Active scanning or authenticated security testing | Owned/authorized assets only; approval required |
| RED | Exploit execution, credential attacks, persistence, destructive actions or payload deployment | Lab/sandbox only; never autonomous production execution |

## Registry contract

Each tool or connector MUST declare:

```yaml
tool_id: example
name: Example
category: threat_intelligence
capabilities:
  - indicator_enrichment
execution_mode: api
risk_class: GREEN
authorization:
  owned_assets_only: true
  production: allowed
agent_access:
  hermes: true
  security_agent: true
  general_agents: false
human_approval:
  passive_query: false
  active_scan: true
logging:
  security_events: true
  agent_actions: true
status: proposed
```

## Initial capability families

1. Threat intelligence and IOC enrichment
2. STIX 2.1 / TAXII 2.1 interchange
3. DNS, certificate and domain intelligence
4. Vulnerability/CVE intelligence
5. Malware/hash intelligence
6. Detection engineering: Sigma, YARA and Suricata
7. SIEM/XDR integration (Wazuh first)
8. Application security: SAST, SCA, secrets, container and IaC scanning
9. Digital forensics and evidence analysis
10. Attack-surface management

## Hermes execution policy

```text
Request
  -> Registry lookup
  -> Capability + risk classification
  -> Asset authorization check
  -> Approval gate (when required)
  -> Connector execution
  -> Normalize result
  -> security_events / security_iocs
  -> Security Knowledge Graph
  -> Correlation + risk scoring
  -> Alert / case / incident
  -> agent_actions audit record
```

Unknown/unregistered tools fail closed.

## Threat-intelligence normalization

D3VONN should normalize external cyber-threat intelligence into STIX-compatible entities and relationships, with TAXII used where supported for transport. Internal graph objects can preserve provider-specific metadata while exposing a common representation to Hermes.

Core graph entities:

- asset
- domain
- IP address
- URL
- certificate
- user/identity
- device
- session
- vulnerability/CVE
- indicator
- malware
- attack pattern
- detection rule
- alert
- incident
- evidence
- response action

## Detection-as-code

Sigma is the portable SIEM detection representation. YARA and Suricata remain specialized detection formats. Proposed/generated detections MUST pass validation and testing before production activation.

```text
Threat intelligence
 -> hypothesis
 -> generated detection
 -> schema/lint validation
 -> fixture/replay test
 -> false-positive review
 -> human approval
 -> production rule
 -> telemetry/quality feedback
```

## Wazuh integration boundary

Wazuh is an optional SIEM/XDR telemetry and detection provider beneath D3VONN Security Operations. Hermes remains the orchestration/governance layer. Integration should use authenticated API/custom integration mechanisms and ingest normalized results into the D3VONN security schema.

## Production requirements

- Tenant-aware RLS for registry and execution records
- Service-role-only system ingestion
- HMAC/API authentication for external event ingestion
- Immutable audit record for agent actions
- Secrets stored outside registry rows
- Rate limits and provider quotas
- Timeouts/circuit breakers
- Egress allow-listing where practical
- Explicit asset ownership/authorization records for active operations
- Human approval for YELLOW actions
- RED actions prohibited from autonomous production execution

## Initial gate definition

The Cyber Tool Registry gate is GREEN only when:

1. Registry schema exists.
2. Risk classification is enforced server-side.
3. Unknown tools fail closed.
4. Every execution writes an audit record.
5. Active operations require authorization + approval.
6. STIX-compatible normalization is implemented for threat intelligence.
7. At least one passive connector completes end-to-end ingestion.
8. Security graph receives normalized entities/relationships.
9. `/security/ops` exposes registry/connector health.
10. Automated tests verify GREEN/YELLOW/RED policy behavior.

## Source seed

Curated source for capability discovery: `https://start.me/p/bpjxDe/cybersec-tools`.

The source is discovery input only. Inclusion on the page does not imply D3VONN approval. Every capability must independently pass registry review and classification before it becomes executable.
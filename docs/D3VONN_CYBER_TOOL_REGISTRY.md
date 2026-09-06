# D3VONN Cyber Tool Registry + Security Knowledge Graph Gate

## Purpose

The Cyber Tool Registry converts external cybersecurity resources into governed D3VONN capabilities instead of treating a bookmark directory as an executable toolchain.

The registry is metadata and policy only. It does **not** execute scanners, exploitation frameworks, credential attacks, payloads, or destructive actions.

## Start.me source status

Source collection:

`https://start.me/p/bpjxDe/cybersec-tools`

At implementation time, the public Start.me page returned Start.me's application update shell to the crawler instead of its underlying bookmark list. Because the page contents could not be enumerated reliably, entries are deliberately marked with `startme_membership: unverified` unless they are D3VONN-native AppSec tools marked `not_applicable`.

Do not change an entry to `verified` until the specific tool is directly confirmed on that collection.

## API

The existing mounted Security Operations API remains the parent capability. The registry is mounted separately at:

```text
GET  /api/security/tools/health
GET  /api/security/tools
GET  /api/security/tools/{tool_id}
POST /api/security/tools/policy/evaluate
GET  /api/security/tools/graph/projection
GET  /api/security/tools/stix/projection
```

None of these endpoints executes a security tool.

## Initial governed baseline

### GREEN — defensive/passive

- Wazuh — SIEM/XDR, log analysis, detection, file-integrity monitoring
- STIXview — STIX relationship visualization
- Sigma — portable detection-as-code rules
- YARA — file and malware pattern matching
- Suricata — network detection and packet analysis
- VirusTotal — passive IOC reputation/enrichment
- CodeQL — SAST and semantic code security queries
- Gitleaks — secrets detection
- Trivy — dependency/container/IaC scanning

### YELLOW — dual-use or authorization-sensitive

- Shodan — indexed internet/service intelligence
- Censys — certificate/host/service intelligence
- Have I Been Pwned — breach exposure lookup
- Nmap — active service discovery; explicit asset authorization + human approval required
- OWASP ZAP — DAST/API security testing; explicit asset authorization + human approval required

Passive indexed intelligence remains metadata-only in this gate. Active scanning is not implemented.

### RED — sandbox-only

- Metasploit Framework — registered only so policy can explicitly deny autonomous/production use

Red capabilities:

```text
production: DENY
Hermes access: DENY
Security Agent access: DENY
general agent access: DENY
lab/sandbox: requires explicit asset authorization + human approval
```

Registration is not execution enablement.

## Policy model

Each tool records:

```text
tool_id
name
category
description
execution_mode
risk_tier
status
capabilities[]
agent_access
logging requirements
source URL
source origin
Start.me verification state
```

Each capability records:

```text
activity_class: passive | active | restricted
requires_asset_authorization
requires_human_approval
production_allowed
```

The policy evaluator fails closed when:

- a tool is unregistered;
- a capability is unregistered;
- the selected agent is not authorized;
- an active capability lacks required asset authorization or human approval;
- a restricted capability is requested outside a lab/sandbox/test environment;
- a capability is not allowed in production.

The evaluator only returns an authorization decision. A later execution service must independently verify the decision, re-check authorization, log a `security_event`, log an `agent_action`, and enforce its own target allowlist.

## Hermes boundary

Hermes may reason over approved registry metadata and passive capabilities. General agents are denied by default.

The intended future flow is:

```text
Hermes Security Supervisor
        ↓
Cyber Tool Registry
        ↓
Policy evaluation
        ↓
Passive metadata capability OR approval request
        ↓
Security event / agent action audit
        ↓
Finding normalization
        ↓
Security Knowledge Graph
```

No raw command strings, API credentials, private keys, exploit payloads, or scanner targets are stored in the registry.

## Knowledge Graph projection

`graph_projection()` produces read-only graph-shaped objects:

- `security_tool` nodes
- `security_capability` nodes
- `provides_capability` edges

The projection does not persist to Supabase. This preserves the current database boundary until a dedicated, authenticated persistence gate is reviewed.

Example:

```text
Shodan
  ├── provides_capability → ip_enrichment
  └── provides_capability → indexed_service_discovery

Nmap
  └── provides_capability → active_service_discovery
       ├── asset_authorization_required = true
       └── human_approval_required = true
```

## STIX projection

The registry also provides non-persisted STIX-style custom metadata objects using the custom type:

`x-d3vonn-security-tool`

This is intentionally a custom D3VONN object instead of falsely mapping every security utility to a native STIX domain object.

## Existing D3VONN security integration

The current repository already has:

- `security_events`
- `security_alerts`
- `security_incidents`
- `detection_rules`
- Security Agent action audit
- threat-intelligence components
- a Security Knowledge Graph implementation

This gate extends that architecture. It does not create a parallel SOC or a second orchestrator.

## Hard safety invariants

```text
tool_execution_enabled = false
active_scan_execution_enabled = false
exploit_execution_enabled = false
credential_attack_execution_enabled = false
```

A registry `allow` result is not a command execution. It is only policy metadata for a separately reviewed future gate.

## Next gate

After this registry is green and merged:

1. confirm the actual Start.me bookmarks and update `startme_membership` records;
2. add passive adapters first (IOC/hash/domain/IP enrichment only);
3. normalize passive findings into a shared security finding schema;
4. persist approved tool/capability nodes into the existing Security Knowledge Graph through an authenticated server-side path;
5. require `security_events` and `agent_actions` audit records for every adapter call;
6. keep active scanning behind explicit asset authorization and human approval;
7. keep exploitation/credential/persistence capabilities out of production autonomous agents.

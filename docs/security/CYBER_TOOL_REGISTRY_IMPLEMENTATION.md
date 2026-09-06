# Cyber Tool Registry implementation notes

This file records the implementation boundary for the current registry branch. The canonical governance requirements remain in `docs/security/CYBER_TOOL_REGISTRY.md`.

## Implemented in this gate

- governed in-code registry for 15 initial tools/capability providers;
- GREEN/YELLOW/RED risk tiers;
- per-capability passive/active/restricted activity class;
- per-capability asset-authorization and human-approval requirements;
- Hermes/Security Agent/general-agent access flags;
- fail-closed policy evaluation for unknown tools/capabilities;
- read-only graph projection to `security_tool` / `security_capability` nodes;
- read-only STIX-style custom metadata projection;
- mounted API under `/api/security/tools`;
- no scanner, exploit, credential, payload, or destructive execution path;
- tests for key safety invariants.

## API surface

```text
GET  /api/security/tools/health
GET  /api/security/tools
GET  /api/security/tools/{tool_id}
POST /api/security/tools/policy/evaluate
GET  /api/security/tools/graph/projection
GET  /api/security/tools/stix/projection
```

`POST /policy/evaluate` is stateless policy evaluation. It does not call or execute the selected tool.

## Start.me source limitation

Discovery source:

`https://start.me/p/bpjxDe/cybersec-tools`

During this implementation, the public page returned Start.me's application-update shell rather than the underlying bookmark list to the crawler. Therefore tool records discovered from the D3VONN security design are marked `startme_membership: unverified` unless they are existing D3VONN AppSec dependencies marked `not_applicable`.

Do not promote an entry to `verified` until that specific bookmark is directly confirmed from the Start.me collection.

## Initial registry

GREEN defensive/passive baseline:

- Wazuh
- STIXview
- Sigma
- YARA
- Suricata
- VirusTotal
- CodeQL
- Gitleaks
- Trivy

YELLOW dual-use / authorization-sensitive baseline:

- Shodan
- Censys
- Have I Been Pwned
- Nmap
- OWASP ZAP

RED sandbox-only baseline:

- Metasploit Framework

Registration of a RED tool exists so policy can explicitly deny it; registration is not execution enablement.

## Hard runtime boundary

```text
tool_execution_enabled = false
active_scan_execution_enabled = false
exploit_execution_enabled = false
credential_attack_execution_enabled = false
```

The graph and STIX endpoints are projections only and do not persist to Supabase.

## Next implementation gate

The next safe step is one passive connector end-to-end, with:

1. server-side credential storage outside registry metadata;
2. provider egress allow-list;
3. strict timeout/rate-limit handling;
4. normalized finding schema;
5. `security_events` + `agent_actions` audit records;
6. authenticated persistence into the existing Security Knowledge Graph;
7. no active scan target input.

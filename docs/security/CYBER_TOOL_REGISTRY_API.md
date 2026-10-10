# Cyber Tool Registry API examples

All endpoints in this gate are metadata/policy only.

## Health

```http
GET /api/security/tools/health
```

Expected safety flags:

```json
{
  "tool_execution_enabled": false,
  "active_scan_execution_enabled": false,
  "exploit_execution_enabled": false,
  "credential_attack_execution_enabled": false
}
```

## List approved passive tools

```http
GET /api/security/tools?risk_tier=green&status=approved
```

## Evaluate an active scan request

```http
POST /api/security/tools/policy/evaluate
Content-Type: application/json

{
  "tool_id": "nmap",
  "capability": "active_service_discovery",
  "environment": "production",
  "asset_authorized": false,
  "human_approved": false,
  "actor": "hermes"
}
```

The response should require approval. It does not execute Nmap.

## Evaluate a restricted production request

```http
POST /api/security/tools/policy/evaluate
Content-Type: application/json

{
  "tool_id": "metasploit",
  "capability": "exploit_validation",
  "environment": "production",
  "asset_authorized": true,
  "human_approved": true,
  "actor": "human"
}
```

The response should deny the request because RED capabilities are sandbox/lab/test only.

## Security Knowledge Graph projection

```http
GET /api/security/tools/graph/projection
```

Returns read-only `security_tool` and `security_capability` nodes with `provides_capability` edges. No database persistence is performed.

## STIX-style projection

```http
GET /api/security/tools/stix/projection
```

Returns custom `x-d3vonn-security-tool` metadata objects for later threat-intelligence normalization. No external TAXII/STIX destination is contacted by this endpoint.

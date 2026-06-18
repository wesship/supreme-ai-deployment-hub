# Devonn.AI Web3 Intelligence Layer

This module implements the **Web3 Smart Contracts Guide — Clean Version** as a usable Devonn.AI backend capability.

It does not launch a token or deploy production smart contracts by itself. It adds the correct first layer: education, risk triage, implementation blueprints, event-listener planning, and RPC health checks.

## Why this exists

Smart contracts are powerful, but they are not a replacement for business structure, custody records, legal agreements, compliance, CRM, monitoring, or user education.

Devonn.AI should treat Web3 as one part of an operating system:

```text
User / Customer
   ↓
Frontend / Portal
   ↓
Wallet + Identity
   ↓
Devonn.AI Backend
   ↓
Smart Contract / Blockchain
   ↓
Event Listener
   ↓
Agents / CRM / Compliance / Knowledge Base
```

## Added backend endpoints

Base path:

```text
/api/web3
```

### `GET /api/web3/guide`

Returns the clean Web3 smart-contract guide as structured knowledge.

Use this for:

- Devonn.AI knowledge-base display
- onboarding users
- explaining smart-contract concepts
- seeding RAG content

### `POST /api/web3/risk-check`

Runs a pre-build risk check for a smart-contract idea.

Example request:

```json
{
  "name": "Token-Gated Client Portal",
  "use_case": "token_gated_access",
  "description": "A membership token unlocks a private Devonn.AI client portal.",
  "controls_real_value": false,
  "uses_upgradeable_proxy": false,
  "has_multisig_admin": true,
  "has_pause_function": true,
  "uses_oracle": false,
  "has_external_calls": false,
  "has_kyc_or_allowlist": true,
  "represents_real_world_asset": false
}
```

Returns:

- overall risk
- readiness score
- findings
- recommendations
- next steps

### `POST /api/web3/blueprint`

Converts a Web3 project concept into an implementation blueprint.

Example request:

```json
{
  "project_name": "Devonn Token-Gated Portal",
  "use_case": "token_gated_access",
  "target_users": ["clients", "admins"],
  "assets_controlled": ["membership access"],
  "admin_roles": ["owner", "pauser", "membership_admin"],
  "on_chain_data": ["membership token ownership"],
  "off_chain_data": ["CRM contact record", "consent logs"],
  "payments": "none in v1",
  "immutable_or_upgradeable": "undecided",
  "compliance_notes": "Do not position as investment or financial return."
}
```

Returns:

- architecture
- smart-contract requirements
- backend requirements
- agent workflows
- security requirements
- compliance questions
- deployment checklist

### `POST /api/web3/events/subscriptions`

Creates a deterministic event-routing plan for Devonn.AI agents.

Example request:

```json
{
  "chain_id": 11155111,
  "contract_address": "0x0000000000000000000000000000000000000000",
  "event_name": "MembershipMinted",
  "agent_route": "hermes.web3_event_triage",
  "notes": "Route membership events into CRM and onboarding."
}
```

This endpoint currently creates a planned subscription, not a persistent indexer. Production activation should add database tables for event subscriptions, event checkpoints, and dispatch history.

### `POST /api/web3/rpc/health`

Checks an EVM-compatible JSON-RPC endpoint.

Example request:

```json
{
  "rpc_url": "https://example-rpc-url",
  "chain_id": 11155111
}
```

Returns whether the RPC endpoint is reachable, the reported chain ID, and the latest block number.

## Recommended next implementation phase

### Phase 1 — included in this PR

- Web3 guide endpoint
- Risk-check endpoint
- Blueprint endpoint
- Event subscription planner
- RPC health check
- Router registration
- Documentation

### Phase 2 — next

Add persistence:

```text
web3_contracts
web3_event_subscriptions
web3_event_checkpoints
web3_event_dispatches
web3_wallet_contacts
web3_risk_assessments
```

### Phase 3 — next

Add real event listener:

```text
RPC / indexer
   ↓
Normalize logs
   ↓
Deduplicate
   ↓
Store checkpoint
   ↓
Dispatch to Hermes / Intelligence agents
   ↓
CRM / compliance / notification workflow
```

### Phase 4 — later

Add optional smart-contract templates:

- ERC-721 membership pass
- token-gated access registry
- revenue-split contract
- escrow prototype
- real-world asset registry prototype

Do not deploy real-value contracts until security review, compliance review, multisig admin, and incident-response controls are complete.

## Safety rule

For Devonn.AI, the safest Web3 sequence is:

```text
Knowledge base
   ↓
Risk checker
   ↓
Blueprint generator
   ↓
Testnet prototype
   ↓
Event listener
   ↓
Compliance-reviewed production contract
```

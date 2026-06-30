# D3VONN Agent Manifest Schema

> Version: d3vonn.io/v1

Every agent in the D3VONN platform must include a `manifest.yaml` file that declares its capabilities, permissions, dependencies, and operational parameters. This enables automatic discovery, orchestration, documentation generation, and marketplace capabilities.

## Schema Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | Schema version (`d3vonn.io/v1`) |
| `kind` | string | Yes | Must be `AgentManifest` |
| `metadata.name` | string | Yes | Human-readable agent name |
| `metadata.id` | string | Yes | Unique identifier (kebab-case) |
| `metadata.version` | semver | Yes | Agent version |
| `metadata.description` | string | Yes | What this agent does |
| `metadata.owner` | string | Yes | Owning team |
| `metadata.tier` | enum | Yes | `core` or `specialist` |
| `metadata.tags` | string[] | No | Discovery tags |
| `capabilities` | string[] | Yes | What the agent can do |
| `permissions` | object | Yes | Resource access declarations |
| `tools` | object[] | Yes | Tools the agent can invoke |
| `memory` | object | Yes | Memory configuration |
| `models` | object | Yes | LLM model preferences |
| `dependencies` | object | Yes | Service and agent dependencies |
| `events` | object | Yes | Published and subscribed events |
| `healthcheck` | object | Yes | Health monitoring config |
| `scaling` | object | No | Auto-scaling parameters |

## Example

```yaml
apiVersion: d3vonn.io/v1
kind: AgentManifest

metadata:
  name: My Agent
  id: my-agent
  version: "1.0.0"
  description: Description of what this agent does.
  owner: my-team
  tier: specialist
  tags:
    - example

capabilities:
  - capability-one
  - capability-two

permissions:
  knowledge:
    - read
  events:
    - publish

tools:
  - id: my-tool
    description: What this tool does.

memory:
  type: semantic
  backend: supabase-pgvector
  retention: 90d
  context_window: 128000

models:
  primary: gpt-4o
  fallback: claude-3.5-sonnet
  embedding: text-embedding-3-large

dependencies:
  services:
    - supabase
  agents:
    - hermes
  policies:
    - security/governance/opa/

events:
  publishes:
    - TaskCompleted
  subscribes:
    - TaskDelegated

healthcheck:
  endpoint: /api/agents/my-agent/health
  interval: 60s
  timeout: 10s
  unhealthy_threshold: 3

scaling:
  min_instances: 0
  max_instances: 5
  metric: active_tasks
  target_value: 3
```

## How Hermes Uses Manifests

1. **Discovery** — On startup, Hermes reads `agents/registry.yaml` and loads each agent's manifest.
2. **Routing** — When a task arrives, Hermes matches required capabilities against agent manifests.
3. **Permission Check** — Before delegation, Hermes verifies the agent has declared the necessary permissions.
4. **Health Monitoring** — Hermes periodically calls each agent's healthcheck endpoint.
5. **Scaling** — When queue depth exceeds thresholds, Hermes triggers scaling based on manifest config.
6. **Documentation** — Manifests are used to auto-generate the agent catalog in the Platform Console.

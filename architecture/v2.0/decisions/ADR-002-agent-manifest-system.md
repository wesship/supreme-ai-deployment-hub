# ADR-002: Agent Manifest System for Dynamic Discovery

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-06-30 |
| Decision Makers | Platform Team, AI Team |
| Supersedes | N/A |

## Context

As the D3VONN platform grows its agent fleet, Hermes (the orchestration kernel) needs a reliable way to discover available agents, understand their capabilities, verify their permissions, and monitor their health. Previously, agent registration was hardcoded in the backend router configuration, making it difficult to add new agents without code changes.

## Decision

Introduce a standardized agent manifest schema (`d3vonn.io/v1`) that every agent must provide. Each manifest is a YAML file declaring the agent's capabilities, permissions, tools, memory configuration, model preferences, dependencies, event subscriptions, health check parameters, and scaling rules.

Hermes loads manifests at startup via the agent registry (`agents/registry.yaml`) and uses them for capability-based routing, permission validation, health monitoring, and auto-scaling decisions.

## Consequences

**Positive consequences** include decoupled agent registration (new agents can be added by creating a manifest file without modifying Hermes code), self-documenting agents (manifests serve as both configuration and documentation), capability-based routing (Hermes can match tasks to agents based on declared capabilities rather than hardcoded rules), and marketplace enablement (manifests provide the metadata needed for an agent marketplace UI).

**Negative consequences** include the overhead of maintaining manifest files for each agent and the risk of manifests becoming stale if not validated in CI. This is mitigated by adding a CI step that validates all manifests against the schema.

## Alternatives Considered

A code-based registration approach (agents register themselves via an API call on startup) was considered but rejected because it requires agents to be running before they can be discovered, creating a chicken-and-egg problem for orchestration. The declarative manifest approach allows Hermes to understand the full agent fleet at startup without waiting for each agent to come online.

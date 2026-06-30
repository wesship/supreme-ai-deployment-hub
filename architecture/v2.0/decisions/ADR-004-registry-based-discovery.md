# ADR-004: Registry-Based Service Discovery

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-06-30 |
| Decision Makers | Platform Team |
| Supersedes | N/A |

## Context

The D3VONN platform contains multiple categories of components: agents, knowledge modules, integrations, automation workflows, and security policies. Each category has grown to include multiple entries that need to be discovered, configured, and managed. Previously, discovery was implicit — components were found by convention (file paths, import statements) or hardcoded in configuration files scattered throughout the codebase.

## Decision

Introduce a central YAML registry for each domain category:

| Registry | Location | Purpose |
|----------|----------|---------|
| Agent Registry | `agents/registry.yaml` | Catalog of all platform agents |
| Knowledge Index | `knowledge/index.yaml` | DKOS modules and pipelines |
| Integrations Catalog | `integrations/catalog.yaml` | External integrations and SDKs |
| Workflows Registry | `automation/workflows.yaml` | Automation workflows and events |
| Security Policies | `security/policies.yaml` | Policy engines and compliance frameworks |

Each registry entry includes a unique ID, human-readable name, type classification, description, status, file path, and relevant endpoints. Registries are loaded at application startup and can be refreshed at runtime.

## Consequences

**Positive consequences** include a single source of truth for each domain (no more hunting through code to find what exists), machine-readable catalogs that enable auto-generated documentation and UI, clear status tracking (active vs. planned components), and simplified onboarding (new contributors can read registries to understand the platform).

**Negative consequences** include the maintenance burden of keeping registries in sync with actual implementations and the risk of registries becoming stale. This is mitigated by adding CI validation that checks registry entries against actual file paths and by making registry updates part of the standard PR checklist for new features.

## Alternatives Considered

A database-backed service registry (like Consul or etcd) was considered but rejected at this stage because the platform does not yet require runtime service registration or deregistration. The YAML-based approach provides the organizational benefits with zero infrastructure overhead and full version control history. When the platform reaches a scale where dynamic registration is needed, the YAML registries can serve as the seed data for a runtime registry service.

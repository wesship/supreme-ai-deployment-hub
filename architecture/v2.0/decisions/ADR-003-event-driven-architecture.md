# ADR-003: Event-Driven Architecture with Standardized Events

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-06-30 |
| Decision Makers | Platform Team |
| Supersedes | N/A |

## Context

The D3VONN platform consists of multiple services (agents, backend, automation engine, security center) that need to communicate. Direct service-to-service calls create tight coupling, make it difficult to add new consumers, and reduce observability. As the platform scales to support multiple tenants and concurrent agent executions, a more decoupled communication pattern is needed.

## Decision

Adopt an event-driven architecture where services communicate through a standardized set of platform events. The initial event catalog includes 14 events defined in `automation/workflows.yaml`:

| Event | Producer | Description |
|-------|----------|-------------|
| AgentStarted | Hermes | An agent has begun executing a task |
| AgentCompleted | Hermes | An agent has successfully completed a task |
| AgentFailed | Hermes | An agent has failed during execution |
| TaskCreated | API Gateway | A new task has been submitted |
| TaskDelegated | Hermes | A task has been assigned to an agent |
| TaskCompleted | Agents | A task has been fully resolved |
| WorkflowTriggered | Automation | A workflow has been initiated |
| WorkflowCompleted | Automation | A workflow has finished |
| KnowledgeIndexed | DKOS | New knowledge has been indexed |
| SecurityAlertRaised | Security | A security threat has been detected |
| DeploymentStarted | CI/CD | A deployment has begun |
| DeploymentFinished | CI/CD | A deployment has completed |
| MemoryUpdated | DKOS | Agent memory has been persisted |
| GovernanceViolation | Hermes | A policy violation has been detected |

## Consequences

**Positive consequences** include loose coupling between services (producers and consumers are independent), improved observability (events create a natural audit trail), easier scaling (new consumers can subscribe without modifying producers), and better testability (events can be replayed for debugging).

**Negative consequences** include eventual consistency (consumers may not see events immediately), increased complexity in debugging distributed flows, and the need for event schema versioning as the platform evolves. These are mitigated by including correlation IDs in all events and maintaining a central event schema registry.

## Alternatives Considered

A synchronous RPC approach (gRPC or REST) was considered for inter-service communication but rejected because it creates temporal coupling (both services must be available simultaneously) and makes it difficult to add new consumers. The event-driven approach is better suited to the asynchronous nature of AI agent execution where tasks may take seconds to hours to complete.

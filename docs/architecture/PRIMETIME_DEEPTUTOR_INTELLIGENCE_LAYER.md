# PRIMETIME DeepTutor-Derived Intelligence Layer

Status: proposed implementation on `feat/primetime-deeptutor-intelligence-layer`

## Goal

Bring the highest-value DeepTutor patterns into D3VONN.IO + PRIMETIME without replacing the existing governed architecture.

DeepTutor is used as an architectural reference for layered long-term memory, versioned RAG knowledge and source citations, reusable skill contracts, durable multi-agent execution, retrieval provenance, and model/token/cost telemetry.

PRIMETIME remains the system of record for insurance CRM, consent, compliance and regulated state. n8n remains non-authoritative automation.

## Capability mapping

| DeepTutor pattern | PRIMETIME implementation |
|---|---|
| L1/L2/L3 memory | `primetime_memory_items` |
| Versioned knowledge | existing `primetime_knowledge_sources` / `primetime_knowledge_versions` plus `primetime_knowledge_chunks` |
| RAG citations | `primetime_retrieval_events` + `primetime_retrieval_sources` |
| SKILL.md-style reusable skills | `primetime_skills` |
| Persistent/sub-agent runs | `primetime_agent_runs` |
| Cost tracking | `primetime_ai_usage` |
| Multi-user isolation | mandatory `workspace_id` + RLS + API policy |

## Memory contract

### L1_raw
Short-lived, source-faithful interaction memory. It should preserve enough context to reconstruct the originating interaction without becoming a second CRM.

### L2_curated
Validated facts, preferences, decisions and constraints that are useful to a specific user, agent or project. Each item must retain provenance and confidence.

### L3_synthesized
Higher-order summaries or cross-interaction insights. L3 must be derivable from lower-level evidence and must never silently overwrite authoritative CRM, policy, consent or compliance records.

Memory may be superseded or expired. It is not immutable truth.

## RAG contract

Retrieval may use only:

1. the current authenticated workspace context;
2. approved knowledge sources;
3. non-expired knowledge versions;
4. chunks belonging to those versions.

Every retrieval event records a query hash and the exact returned chunks. Any user-visible grounded answer should be able to resolve citations back to these chunks.

## Skill contract

A skill is a versioned, workspace-scoped capability with purpose, instructions, allowed tools, required permissions, approval requirements, and lifecycle status.

Skills must not grant permissions that the invoking agent/user does not already possess. Tool execution remains subject to the existing permission, compliance and approval pipeline.

## Agent execution contract

```text
request/event
  -> context assembly
  -> workspace authorization
  -> approved-memory retrieval
  -> approved-knowledge retrieval
  -> compliance check
  -> model execution
  -> structured proposal
  -> approval evaluation
  -> tool execution
  -> result verification
  -> audit event
  -> usage/cost telemetry
```

Sub-agents are represented by `parent_run_id`. A child run cannot escape its parent's workspace or permission boundary.

## Security posture

The new tables intentionally use the same conservative backend-only RLS posture already established in Phase 2A. `anon` and `authenticated` receive explicit deny policies; trusted backend paths use `service_role`.

Do **not** weaken this boundary simply to expose RAG or memory directly to the browser. Add narrowly scoped authenticated policies only after a separate security review.

## Regulated-data boundary

The intelligence layer can organize, summarize, draft, prioritize and recommend administrative next actions. It must not independently recommend insurance products, determine suitability, quote unapproved coverage, submit an application, alter regulated policy state, contact a suppressed person, bypass a compliance rule, or treat generated memory as authoritative CRM state.

## Rollout order

1. Apply the migration in isolated staging.
2. Verify schema, extension availability and RLS.
3. Add repository-level service interfaces for memory, retrieval, skills and runs.
4. Add unit/integration tests for cross-workspace isolation and provenance.
5. Wire usage telemetry into existing agent execution.
6. Add authenticated read paths only after policy review.
7. Enable one low-risk Knowledge Agent workflow.
8. Expand to Research/Solve and autonomous/background agents after exit gates pass.

## Exit gates

- No cross-workspace memory reads.
- No cross-workspace retrieval results.
- Every grounded response has resolvable provenance.
- Every agent run is auditable.
- Restricted actions still require approval.
- No independent regulated recommendation.
- Usage/cost records are present for model calls.
- RLS and API authorization tests pass.
- Rollback remains available.

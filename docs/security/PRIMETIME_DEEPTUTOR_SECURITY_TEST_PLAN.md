# PRIMETIME DeepTutor Security Verification Plan

This plan is a release gate for the DeepTutor-derived intelligence layer.

## Required invariants

1. Every intelligence record has a non-null `workspace_id`.
2. A membership, parent agent run, retrieval event, or knowledge chunk referenced by a record must belong to the same workspace.
3. `anon` and `authenticated` cannot directly read or write intelligence tables until an explicit authenticated policy review is completed.
4. Child agent runs cannot cross the parent run's workspace.
5. Retrieval results cannot reference chunks from another workspace.
6. Memory is never authoritative CRM, consent, compliance, suppression, or regulated policy state.
7. Retrieved content is treated as untrusted data and cannot grant tools or permissions.
8. Every grounded answer has resolvable retrieval provenance.
9. Restricted tool actions remain behind the existing approval/compliance pipeline.
10. Every model invocation has usage/cost telemetry.

## Adversarial test cases

### Workspace isolation

- Attempt to insert a memory item using a creator membership from Workspace B while declaring Workspace A.
- Attempt to create a child run in Workspace A whose parent belongs to Workspace B.
- Attempt to attach a retrieval source from Workspace B to a Workspace A retrieval event.
- Attempt to retrieve Workspace B chunks from a Workspace A query.

Expected result: database/API authorization failure; no partial record is committed.

### RAG prompt injection

Use a test document containing instructions that attempt to override system policy, request secrets, or invoke tools.

Expected result: the content is treated strictly as retrieved data. It may be quoted/cited as data, but it cannot change policy, permissions, or tool authorization.

### Memory poisoning

Attempt to promote an untrusted conversation statement directly into L2/L3 memory.

Expected result: the memory pipeline requires provenance and its configured validation/approval policy before promotion. A generated memory cannot overwrite authoritative CRM or compliance state.

### Citation leakage

Retrieve a source, revoke access to that source, then attempt to resolve the citation through a user-facing API.

Expected result: citation resolution re-checks authorization and does not disclose the protected source.

### Skill escalation

Create a skill declaring a privileged tool in `allowed_tools` without the invoking agent/user permission.

Expected result: skill metadata cannot grant the missing permission; execution is denied or routed through the existing approval system.

## Staging exit gates

- [ ] Migration applies cleanly in isolated staging.
- [ ] `vector` extension is available and the configured embedding dimension matches the selected embedding provider.
- [ ] All new tables have RLS enabled.
- [ ] Explicit deny policies exist for `anon` and `authenticated`.
- [ ] Cross-workspace database guard tests pass.
- [ ] Cross-workspace API retrieval tests pass.
- [ ] Prompt-injection tests pass.
- [ ] Memory-poisoning tests pass.
- [ ] Citation authorization tests pass.
- [ ] Skill permission-escalation tests pass.
- [ ] Usage/cost telemetry is recorded for successful and failed model calls.
- [ ] Existing compliance/approval tests remain green.
- [ ] Rollback procedure has been rehearsed.

Do not enable autonomous/background agents until all gates above pass.
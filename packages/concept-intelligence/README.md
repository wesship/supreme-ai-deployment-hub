# PRIMETIME Concept Intelligence Engine v1

## Purpose

Convert approved source material into a governed, source-grounded concept graph that can detect clusters, gaps, contradictions, dependencies, and useful bridge questions.

## Authority model

1. Neo4j stores the canonical concept graph.
2. Supabase/Postgres stores governance, approvals, workspace metadata, and immutable audit events.
3. PRIMETIME controls command parsing, routing, lifecycle changes, and approval requirements.
4. InfraNodus, Algor, Heptabase, AFFiNE, Napkin, Edraw, Venngage, Mermaid, and Graphviz are replaceable adapters or output helpers.
5. No external mapping application may directly promote graph records to `CANONICAL`.

## Graph types

### Knowledge graph

Use Neo4j and Cytoscape.js for concepts, evidence, claims, entities, risks, policies, decisions, and semantic relationships.

### Operational graph

Use React Flow for agents, n8n workflows, approvals, API calls, schedules, error paths, and execution dependencies.

Do not merge these graph types without explicit typed boundaries.

## Lifecycle

```text
DISCOVERED
  -> EXTRACTED
  -> NORMALIZED
  -> DUPLICATE_REVIEW
  -> VALIDATION_REQUIRED
  -> VALIDATED
  -> APPROVED
  -> CANONICAL
```

Alternative terminal states:

```text
REJECTED
SUPERSEDED
ARCHIVED
```

## End-to-end flow

```text
Source ingestion
  -> native or external extraction
  -> schema validation
  -> concept normalization
  -> duplicate detection
  -> evidence attachment
  -> draft Neo4j graph
  -> cluster and centrality analysis
  -> gap and contradiction detection
  -> bridge-question ranking
  -> human or licensed review
  -> canonical promotion
  -> Cytoscape.js / React Flow / reporting output
```

## Evidence rule

Every material concept and relationship must retain:

- source identifier
- source type and locator
- exact excerpt or structured record pointer
- retrieval timestamp
- content hash
- extractor identity
- extraction confidence
- reviewer identity where applicable
- jurisdiction for regulated information
- version

AI-generated explanation is not evidence.

## Quality scoring

Calculate these graph-quality measures:

- Coverage: percentage of source concepts represented
- Evidence strength: percentage of nodes and edges with valid evidence
- Duplication: unresolved overlap rate
- Connectivity: important isolated-node rate
- Contradiction rate: unresolved conflicting-claim rate
- Review completion: percentage requiring review that has been reviewed
- Freshness: age and validity of supporting evidence
- Confidence: calibrated extraction and relationship confidence
- Actionability: percentage connected to decisions, risks, workflows, or next actions

## Bridge-question ranking

Rank bridge questions using a normalized score derived from:

```text
business impact
+ risk reduction
+ urgency
+ dependency relevance
+ evidence strength
- implementation effort
- uncertainty penalty
```

The engine should preserve component scores and never present ranking as mathematical certainty.

## Change detection

For each graph version, report:

- concepts added, removed, merged, or superseded
- relationships added, removed, or changed
- evidence changes
- confidence changes
- compliance impact
- affected agents and workflows
- outdated documentation
- new approval requirements

## Contradictions

A contradiction must be stored as a reviewable object containing:

- conflicting claim IDs
- source evidence for each claim
- affected graph records
- risk level
- impacted workflows
- assigned reviewer
- resolution status

The system must not silently choose one claim.

## Initial pilot

Analyze the complete lead-to-appointment process:

```text
Lead generation
  -> landing page
  -> consent capture
  -> CRM record
  -> lead scoring
  -> appointment scheduling
  -> licensed representative review
  -> follow-up
```

Pilot sources:

- Family Readiness campaign
- CRM architecture
- compliance controls
- prompt-code registry
- n8n workflows
- appointment rules
- approved SMS and email templates

Success criteria:

- detects missing consent relationships
- finds duplicate or conflicting workflows
- identifies missing approval gates
- identifies weak CRM handoffs and unclear ownership
- produces source-grounded bridge questions
- preserves provenance through canonical promotion

## Tool roles

Primary:

- Devonn native extractor
- Neo4j
- Cytoscape.js
- React Flow
- InfraNodus adapter
- Supabase governance
- PRIMETIME Approval Ledger

Secondary:

- Algor for training extraction
- Heptabase and AFFiNE for human review
- TheBrain for executive navigation
- Napkin, Edraw, and Venngage for presentation
- Mermaid and Graphviz for deterministic documentation

## Command family

`CONCEPT-360` expands into:

```text
CONCEPT-READ
CONCEPT-NORMALIZE
CONCEPT-DEDUPE
CONCEPT-SOURCE
CONCEPT-CLUSTER
CONCEPT-GAP
CONCEPT-BRIDGE
CONCEPT-CONFIDENCE
HUMAN-APPROVAL
CONCEPT-CANON
```

Canonical promotion is approval level 3.

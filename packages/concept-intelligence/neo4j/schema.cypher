CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.conceptId IS UNIQUE;

CREATE CONSTRAINT source_id_unique IF NOT EXISTS
FOR (s:Source) REQUIRE s.sourceId IS UNIQUE;

CREATE CONSTRAINT evidence_id_unique IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.evidenceId IS UNIQUE;

CREATE CONSTRAINT workspace_id_exists IF NOT EXISTS
FOR (w:Workspace) REQUIRE w.workspaceId IS UNIQUE;

CREATE INDEX concept_workspace_status IF NOT EXISTS
FOR (c:Concept) ON (c.workspaceId, c.status);

CREATE INDEX concept_canonical_name IF NOT EXISTS
FOR (c:Concept) ON (c.canonicalName);

CREATE INDEX concept_type IF NOT EXISTS
FOR (c:Concept) ON (c.type);

CREATE FULLTEXT INDEX concept_search IF NOT EXISTS
FOR (c:Concept) ON EACH [c.name, c.canonicalName, c.description];

// Canonical relationship properties:
// relationshipId, workspaceId, status, confidence, evidenceIds,
// createdBy, approvedBy, createdAt, updatedAt, version.

// Recommended node labels:
// Concept, Entity, Claim, Question, Risk, Policy, Workflow,
// Agent, Decision, Evidence, Artifact, Requirement, Source, Workspace.

// Recommended relationship types:
// RELATES_TO, DEPENDS_ON, SUPPORTS, CONTRADICTS, DERIVED_FROM,
// MENTIONED_IN, OWNED_BY, REQUIRES, BLOCKED_BY, APPROVED_BY,
// ROUTED_TO, GENERATED_BY, PART_OF, PRECEDES, FOLLOWS,
// HAS_RISK, HAS_GAP, BRIDGES.

/**
 * D3VONN Knowledge Intelligence (DKOS 2.0)
 *
 * Unified module providing semantic linking, gap detection,
 * contradiction detection, source scoring, ontology generation,
 * and knowledge lineage tracking.
 */

export {
  SemanticLinker,
  createSemanticLinker,
  type SemanticLink,
  type LinkType,
  type SemanticNode,
  type LinkStrength,
  type SemanticCluster,
} from "./semantic-linker";

export {
  GapDetector,
  createGapDetector,
  type KnowledgeGap,
  type GapSeverity,
  type GapCategory,
  type CoverageReport,
  type GapDetectorConfig,
  type KnowledgeNode,
  type QueryLogEntry,
} from "./gap-detector";

export {
  ContradictionDetector,
  createContradictionDetector,
  type Contradiction,
  type ContradictionType,
  type ResolutionStrategy,
  type Claim,
  type ContradictionReport,
  type StatementRef,
} from "./contradiction-detector";

export {
  SourceScorer,
  createSourceScorer,
  type Source,
  type SourceScore,
  type SourceType,
  type ScoreComponents,
  type ScoringConfig,
  type ValidationResult,
  DEFAULT_SCORING_CONFIG,
} from "./source-scoring";

export {
  OntologyGenerator,
  KnowledgeLineageTracker,
  RetrievalQualityScorer,
  createOntologyGenerator,
  createLineageTracker,
  createRetrievalScorer,
  type Ontology,
  type OntologyClass,
  type OntologyRelation,
  type LineageNode,
  type LineageGraph,
  type CitationEntry,
  type RetrievalScore,
  type Transformation,
} from "./ontology-generator";

/**
 * Bootstrap the full DKOS 2.0 intelligence stack
 */
export interface DKOSStack {
  semanticLinker: InstanceType<typeof import("./semantic-linker").SemanticLinker>;
  gapDetector: InstanceType<typeof import("./gap-detector").GapDetector>;
  contradictionDetector: InstanceType<typeof import("./contradiction-detector").ContradictionDetector>;
  sourceScorer: InstanceType<typeof import("./source-scoring").SourceScorer>;
  ontologyGenerator: InstanceType<typeof import("./ontology-generator").OntologyGenerator>;
  lineageTracker: InstanceType<typeof import("./ontology-generator").KnowledgeLineageTracker>;
  retrievalScorer: InstanceType<typeof import("./ontology-generator").RetrievalQualityScorer>;
}

export function bootstrapDKOS(): DKOSStack {
  const { createSemanticLinker } = require("./semantic-linker");
  const { createGapDetector } = require("./gap-detector");
  const { createContradictionDetector } = require("./contradiction-detector");
  const { createSourceScorer } = require("./source-scoring");
  const { createOntologyGenerator, createLineageTracker, createRetrievalScorer } = require("./ontology-generator");

  return {
    semanticLinker: createSemanticLinker(),
    gapDetector: createGapDetector(),
    contradictionDetector: createContradictionDetector(),
    sourceScorer: createSourceScorer(),
    ontologyGenerator: createOntologyGenerator(),
    lineageTracker: createLineageTracker(),
    retrievalScorer: createRetrievalScorer(),
  };
}

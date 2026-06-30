/**
 * D3VONN Knowledge Intelligence — Ontology Generator & Knowledge Lineage
 *
 * Automatically generates ontologies from knowledge base content,
 * discovers relationships, and tracks knowledge lineage/provenance.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface OntologyClass {
  id: string;
  name: string;
  parent?: string;
  properties: OntologyProperty[];
  instances: string[];
  description: string;
}

export interface OntologyProperty {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "reference";
  required: boolean;
  referenceClass?: string;
}

export interface OntologyRelation {
  id: string;
  name: string;
  sourceClass: string;
  targetClass: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  inverse?: string;
}

export interface Ontology {
  id: string;
  name: string;
  version: string;
  classes: OntologyClass[];
  relations: OntologyRelation[];
  generatedAt: string;
  sourceDocuments: number;
  confidence: number;
}

export interface LineageNode {
  id: string;
  knowledgeId: string;
  version: number;
  source: string;
  derivedFrom: string[];
  transformations: Transformation[];
  createdAt: string;
  createdBy: string;
  confidence: number;
}

export interface Transformation {
  type: "extraction" | "inference" | "aggregation" | "correction" | "merge" | "split";
  description: string;
  timestamp: string;
  agent?: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface LineageEdge {
  sourceId: string;
  targetId: string;
  relation: "derived_from" | "corrected_by" | "merged_into" | "split_from" | "validated_by";
}

export interface CitationEntry {
  id: string;
  knowledgeId: string;
  citedBy: string;
  citedAt: string;
  context: string;
  relevanceScore: number;
}

export interface RetrievalScore {
  queryId: string;
  knowledgeId: string;
  relevance: number;
  freshness: number;
  authority: number;
  compositeScore: number;
}

// ─────────────────────────────────────────────────────────────────
// Ontology Generator
// ─────────────────────────────────────────────────────────────────

export class OntologyGenerator {
  private documents: Map<string, { id: string; content: string; entities: string[]; relations: string[] }> = new Map();
  private ontologies: Ontology[] = [];

  addDocument(doc: { id: string; content: string; entities: string[]; relations: string[] }): void {
    this.documents.set(doc.id, doc);
  }

  generate(name: string): Ontology {
    const classes = this.extractClasses();
    const relations = this.extractRelations(classes);

    const ontology: Ontology = {
      id: `ontology_${Date.now()}`,
      name,
      version: "1.0.0",
      classes,
      relations,
      generatedAt: new Date().toISOString(),
      sourceDocuments: this.documents.size,
      confidence: this.calculateConfidence(classes, relations),
    };

    this.ontologies.push(ontology);
    return ontology;
  }

  getOntologies(): Ontology[] {
    return [...this.ontologies];
  }

  getLatestOntology(): Ontology | undefined {
    return this.ontologies[this.ontologies.length - 1];
  }

  private extractClasses(): OntologyClass[] {
    const entityCounts = new Map<string, Set<string>>();

    for (const [docId, doc] of this.documents) {
      for (const entity of doc.entities) {
        const normalized = entity.toLowerCase();
        const existing = entityCounts.get(normalized) ?? new Set();
        existing.add(docId);
        entityCounts.set(normalized, existing);
      }
    }

    // Entities appearing in multiple documents become classes
    const classes: OntologyClass[] = [];
    for (const [entity, docIds] of entityCounts) {
      if (docIds.size >= 2) {
        classes.push({
          id: `class_${entity.replace(/\s+/g, "_")}`,
          name: entity.charAt(0).toUpperCase() + entity.slice(1),
          properties: this.inferProperties(entity),
          instances: [...docIds],
          description: `Auto-generated class for "${entity}" (found in ${docIds.size} documents)`,
        });
      }
    }

    // Infer hierarchy from common prefixes
    this.inferHierarchy(classes);
    return classes;
  }

  private extractRelations(classes: OntologyClass[]): OntologyRelation[] {
    const relations: OntologyRelation[] = [];
    const classNames = new Set(classes.map((c) => c.name.toLowerCase()));

    for (const doc of this.documents.values()) {
      for (const rel of doc.relations) {
        const parts = rel.split(/\s+/);
        if (parts.length >= 3) {
          const source = parts[0].toLowerCase();
          const predicate = parts.slice(1, -1).join("_");
          const target = parts[parts.length - 1].toLowerCase();

          if (classNames.has(source) && classNames.has(target)) {
            const existing = relations.find((r) => r.sourceClass === source && r.targetClass === target && r.name === predicate);
            if (!existing) {
              relations.push({
                id: `rel_${relations.length}`,
                name: predicate,
                sourceClass: source,
                targetClass: target,
                cardinality: "many-to-many",
              });
            }
          }
        }
      }
    }

    return relations;
  }

  private inferProperties(entity: string): OntologyProperty[] {
    // Default properties for all classes
    return [
      { name: "name", type: "string", required: true },
      { name: "description", type: "string", required: false },
      { name: "created_at", type: "date", required: true },
    ];
  }

  private inferHierarchy(classes: OntologyClass[]): void {
    // Simple prefix-based hierarchy
    for (let i = 0; i < classes.length; i++) {
      for (let j = 0; j < classes.length; j++) {
        if (i === j) continue;
        if (classes[j].name.toLowerCase().startsWith(classes[i].name.toLowerCase() + " ")) {
          classes[j].parent = classes[i].id;
        }
      }
    }
  }

  private calculateConfidence(classes: OntologyClass[], relations: OntologyRelation[]): number {
    if (classes.length === 0) return 0;
    const avgInstances = classes.reduce((sum, c) => sum + c.instances.length, 0) / classes.length;
    const relationDensity = relations.length / Math.max(1, classes.length);
    return Math.min(1, (avgInstances / 5 + relationDensity / 3) / 2);
  }
}

// ─────────────────────────────────────────────────────────────────
// Knowledge Lineage Tracker
// ─────────────────────────────────────────────────────────────────

export class KnowledgeLineageTracker {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: LineageEdge[] = [];
  private citations: CitationEntry[] = [];

  addNode(node: LineageNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: LineageEdge): void {
    this.edges.push(edge);
  }

  addCitation(citation: CitationEntry): void {
    this.citations.push(citation);
  }

  getLineage(knowledgeId: string): LineageGraph {
    const relevantNodes: LineageNode[] = [];
    const relevantEdges: LineageEdge[] = [];
    const visited = new Set<string>();

    // BFS to find all ancestors
    const queue = [knowledgeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = [...this.nodes.values()].find((n) => n.knowledgeId === current);
      if (node) {
        relevantNodes.push(node);
        for (const derivedFrom of node.derivedFrom) {
          queue.push(derivedFrom);
          relevantEdges.push({ sourceId: derivedFrom, targetId: current, relation: "derived_from" });
        }
      }
    }

    return { nodes: relevantNodes, edges: relevantEdges };
  }

  getCitations(knowledgeId: string): CitationEntry[] {
    return this.citations.filter((c) => c.knowledgeId === knowledgeId);
  }

  getCitationCount(knowledgeId: string): number {
    return this.citations.filter((c) => c.knowledgeId === knowledgeId).length;
  }

  getProvenance(knowledgeId: string): { depth: number; sources: string[]; transformations: Transformation[] } {
    const lineage = this.getLineage(knowledgeId);
    const sources = lineage.nodes.filter((n) => n.derivedFrom.length === 0).map((n) => n.source);
    const transformations = lineage.nodes.flatMap((n) => n.transformations);
    return { depth: lineage.nodes.length, sources, transformations };
  }

  getStats(): { totalNodes: number; totalEdges: number; totalCitations: number; avgDepth: number } {
    let totalDepth = 0;
    const knowledgeIds = new Set([...this.nodes.values()].map((n) => n.knowledgeId));
    for (const id of knowledgeIds) {
      const lineage = this.getLineage(id);
      totalDepth += lineage.nodes.length;
    }
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      totalCitations: this.citations.length,
      avgDepth: knowledgeIds.size > 0 ? totalDepth / knowledgeIds.size : 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Retrieval Quality Scorer
// ─────────────────────────────────────────────────────────────────

export class RetrievalQualityScorer {
  private scores: RetrievalScore[] = [];
  private feedbackLog: { queryId: string; knowledgeId: string; helpful: boolean }[] = [];

  scoreRetrieval(queryId: string, knowledgeId: string, relevance: number, freshness: number, authority: number): RetrievalScore {
    const compositeScore = relevance * 0.5 + freshness * 0.25 + authority * 0.25;
    const score: RetrievalScore = { queryId, knowledgeId, relevance, freshness, authority, compositeScore };
    this.scores.push(score);
    return score;
  }

  addFeedback(queryId: string, knowledgeId: string, helpful: boolean): void {
    this.feedbackLog.push({ queryId, knowledgeId, helpful });
  }

  getAverageQuality(): number {
    if (this.scores.length === 0) return 0;
    return this.scores.reduce((sum, s) => sum + s.compositeScore, 0) / this.scores.length;
  }

  getHelpfulnessRate(): number {
    if (this.feedbackLog.length === 0) return 0;
    const helpful = this.feedbackLog.filter((f) => f.helpful).length;
    return helpful / this.feedbackLog.length;
  }

  getStats(): { totalScored: number; avgQuality: number; helpfulnessRate: number; feedbackCount: number } {
    return {
      totalScored: this.scores.length,
      avgQuality: this.getAverageQuality(),
      helpfulnessRate: this.getHelpfulnessRate(),
      feedbackCount: this.feedbackLog.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────

export function createOntologyGenerator(): OntologyGenerator {
  return new OntologyGenerator();
}

export function createLineageTracker(): KnowledgeLineageTracker {
  return new KnowledgeLineageTracker();
}

export function createRetrievalScorer(): RetrievalQualityScorer {
  return new RetrievalQualityScorer();
}

/**
 * D3VONN Knowledge Intelligence — Semantic Linker
 *
 * Automatically discovers and creates semantic links between
 * documents, concepts, and knowledge nodes based on content similarity,
 * shared entities, and conceptual relationships.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type LinkType =
  | "references"
  | "extends"
  | "contradicts"
  | "supports"
  | "supersedes"
  | "related"
  | "derived_from"
  | "prerequisite"
  | "alternative";

export interface SemanticLink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: LinkType;
  confidence: number; // 0-1
  evidence: string[];
  createdAt: string;
  discoveredBy: "auto" | "manual" | "agent";
  metadata: Record<string, unknown>;
}

export interface DocumentNode {
  id: string;
  title: string;
  content: string;
  entities: string[];
  concepts: string[];
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export interface LinkDiscoveryResult {
  links: SemanticLink[];
  totalCandidates: number;
  accepted: number;
  rejected: number;
  processingTimeMs: number;
}

export interface LinkerConfig {
  minConfidence: number;
  maxLinksPerDocument: number;
  enabledLinkTypes: LinkType[];
  entityMatchWeight: number;
  conceptMatchWeight: number;
  contentSimilarityWeight: number;
}

// ─────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_LINKER_CONFIG: LinkerConfig = {
  minConfidence: 0.6,
  maxLinksPerDocument: 20,
  enabledLinkTypes: ["references", "extends", "contradicts", "supports", "related", "derived_from"],
  entityMatchWeight: 0.4,
  conceptMatchWeight: 0.35,
  contentSimilarityWeight: 0.25,
};

// ─────────────────────────────────────────────────────────────────
// Semantic Linker
// ─────────────────────────────────────────────────────────────────

export class SemanticLinker {
  private documents: Map<string, DocumentNode> = new Map();
  private links: SemanticLink[] = [];
  private config: LinkerConfig;

  constructor(config: Partial<LinkerConfig> = {}) {
    this.config = { ...DEFAULT_LINKER_CONFIG, ...config };
  }

  addDocument(doc: DocumentNode): void {
    this.documents.set(doc.id, doc);
  }

  removeDocument(docId: string): void {
    this.documents.delete(docId);
    this.links = this.links.filter((l) => l.sourceId !== docId && l.targetId !== docId);
  }

  getDocument(docId: string): DocumentNode | undefined {
    return this.documents.get(docId);
  }

  getAllDocuments(): DocumentNode[] {
    return [...this.documents.values()];
  }

  discoverLinks(docId: string): LinkDiscoveryResult {
    const startTime = Date.now();
    const source = this.documents.get(docId);
    if (!source) {
      return { links: [], totalCandidates: 0, accepted: 0, rejected: 0, processingTimeMs: 0 };
    }

    const candidates: SemanticLink[] = [];
    let rejected = 0;

    for (const [targetId, target] of this.documents) {
      if (targetId === docId) continue;

      const entityScore = this.calculateEntityOverlap(source, target);
      const conceptScore = this.calculateConceptOverlap(source, target);
      const contentScore = this.calculateContentSimilarity(source, target);

      const confidence =
        entityScore * this.config.entityMatchWeight +
        conceptScore * this.config.conceptMatchWeight +
        contentScore * this.config.contentSimilarityWeight;

      if (confidence >= this.config.minConfidence) {
        const linkType = this.inferLinkType(source, target, entityScore, conceptScore);
        const evidence = this.gatherEvidence(source, target);

        candidates.push({
          id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: docId,
          targetId,
          linkType,
          confidence,
          evidence,
          createdAt: new Date().toISOString(),
          discoveredBy: "auto",
          metadata: { entityScore, conceptScore, contentScore },
        });
      } else {
        rejected++;
      }
    }

    // Sort by confidence and limit
    const accepted = candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxLinksPerDocument);

    this.links.push(...accepted);

    return {
      links: accepted,
      totalCandidates: this.documents.size - 1,
      accepted: accepted.length,
      rejected,
      processingTimeMs: Date.now() - startTime,
    };
  }

  discoverAllLinks(): LinkDiscoveryResult {
    const startTime = Date.now();
    let totalAccepted = 0;
    let totalRejected = 0;
    const allLinks: SemanticLink[] = [];

    for (const docId of this.documents.keys()) {
      const result = this.discoverLinks(docId);
      totalAccepted += result.accepted;
      totalRejected += result.rejected;
      allLinks.push(...result.links);
    }

    return {
      links: allLinks,
      totalCandidates: this.documents.size * (this.documents.size - 1),
      accepted: totalAccepted,
      rejected: totalRejected,
      processingTimeMs: Date.now() - startTime,
    };
  }

  getLinks(docId?: string): SemanticLink[] {
    if (!docId) return [...this.links];
    return this.links.filter((l) => l.sourceId === docId || l.targetId === docId);
  }

  getLinksByType(linkType: LinkType): SemanticLink[] {
    return this.links.filter((l) => l.linkType === linkType);
  }

  getLinkedDocuments(docId: string): DocumentNode[] {
    const linkedIds = new Set<string>();
    for (const link of this.links) {
      if (link.sourceId === docId) linkedIds.add(link.targetId);
      if (link.targetId === docId) linkedIds.add(link.sourceId);
    }
    return [...linkedIds].map((id) => this.documents.get(id)!).filter(Boolean);
  }

  getStats(): { documents: number; links: number; avgConfidence: number; linkTypes: Record<string, number> } {
    const linkTypes: Record<string, number> = {};
    let totalConfidence = 0;
    for (const link of this.links) {
      linkTypes[link.linkType] = (linkTypes[link.linkType] || 0) + 1;
      totalConfidence += link.confidence;
    }
    return {
      documents: this.documents.size,
      links: this.links.length,
      avgConfidence: this.links.length > 0 ? totalConfidence / this.links.length : 0,
      linkTypes,
    };
  }

  private calculateEntityOverlap(source: DocumentNode, target: DocumentNode): number {
    if (source.entities.length === 0 && target.entities.length === 0) return 0;
    const sourceSet = new Set(source.entities.map((e) => e.toLowerCase()));
    const targetSet = new Set(target.entities.map((e) => e.toLowerCase()));
    const intersection = [...sourceSet].filter((e) => targetSet.has(e));
    const union = new Set([...sourceSet, ...targetSet]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }

  private calculateConceptOverlap(source: DocumentNode, target: DocumentNode): number {
    if (source.concepts.length === 0 && target.concepts.length === 0) return 0;
    const sourceSet = new Set(source.concepts.map((c) => c.toLowerCase()));
    const targetSet = new Set(target.concepts.map((c) => c.toLowerCase()));
    const intersection = [...sourceSet].filter((c) => targetSet.has(c));
    const union = new Set([...sourceSet, ...targetSet]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }

  private calculateContentSimilarity(source: DocumentNode, target: DocumentNode): number {
    // Simple token-based Jaccard similarity
    const sourceTokens = new Set(source.content.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
    const targetTokens = new Set(target.content.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
    const intersection = [...sourceTokens].filter((t) => targetTokens.has(t));
    const union = new Set([...sourceTokens, ...targetTokens]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }

  private inferLinkType(source: DocumentNode, target: DocumentNode, entityScore: number, conceptScore: number): LinkType {
    // High entity overlap with different concepts suggests extension
    if (entityScore > 0.7 && conceptScore < 0.3) return "extends";
    // High concept overlap suggests strong relation
    if (conceptScore > 0.7) return "related";
    // Check for contradiction keywords
    const contradictionTerms = ["however", "contrary", "disagree", "incorrect", "wrong"];
    const hasContradiction = contradictionTerms.some(
      (t) => target.content.toLowerCase().includes(t) && entityScore > 0.3
    );
    if (hasContradiction) return "contradicts";
    // Check for support keywords
    const supportTerms = ["confirms", "validates", "supports", "agrees", "consistent"];
    const hasSupport = supportTerms.some(
      (t) => target.content.toLowerCase().includes(t) && entityScore > 0.3
    );
    if (hasSupport) return "supports";
    // Default to references
    return "references";
  }

  private gatherEvidence(source: DocumentNode, target: DocumentNode): string[] {
    const evidence: string[] = [];
    const sharedEntities = source.entities.filter((e) =>
      target.entities.map((t) => t.toLowerCase()).includes(e.toLowerCase())
    );
    if (sharedEntities.length > 0) {
      evidence.push(`Shared entities: ${sharedEntities.join(", ")}`);
    }
    const sharedConcepts = source.concepts.filter((c) =>
      target.concepts.map((t) => t.toLowerCase()).includes(c.toLowerCase())
    );
    if (sharedConcepts.length > 0) {
      evidence.push(`Shared concepts: ${sharedConcepts.join(", ")}`);
    }
    return evidence;
  }
}

export function createSemanticLinker(config?: Partial<LinkerConfig>): SemanticLinker {
  return new SemanticLinker(config);
}

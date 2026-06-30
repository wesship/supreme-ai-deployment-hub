/**
 * D3VONN Knowledge Intelligence — Gap Detector
 *
 * Identifies missing knowledge, incomplete coverage areas,
 * and unanswered questions within the knowledge base.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type GapSeverity = "critical" | "high" | "medium" | "low";
export type GapCategory = "missing_topic" | "incomplete_coverage" | "stale_content" | "orphan_node" | "missing_link" | "unanswered_query";

export interface KnowledgeGap {
  id: string;
  category: GapCategory;
  severity: GapSeverity;
  title: string;
  description: string;
  affectedNodes: string[];
  suggestedActions: string[];
  detectedAt: string;
  resolvedAt?: string;
  metadata: Record<string, unknown>;
}

export interface CoverageReport {
  totalTopics: number;
  coveredTopics: number;
  coveragePercentage: number;
  gaps: KnowledgeGap[];
  strongAreas: string[];
  weakAreas: string[];
  recommendations: string[];
}

export interface GapDetectorConfig {
  expectedTopics: string[];
  minDocumentsPerTopic: number;
  maxStaleDays: number;
  orphanThreshold: number; // min links to not be orphan
  queryLog: QueryLogEntry[];
}

export interface QueryLogEntry {
  query: string;
  timestamp: string;
  resultCount: number;
  relevanceScore: number;
}

export interface KnowledgeNode {
  id: string;
  topic: string;
  content: string;
  links: string[];
  lastUpdated: string;
  accessCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Gap Detector
// ─────────────────────────────────────────────────────────────────

export class GapDetector {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private gaps: KnowledgeGap[] = [];
  private config: GapDetectorConfig;

  constructor(config: Partial<GapDetectorConfig> = {}) {
    this.config = {
      expectedTopics: config.expectedTopics ?? [],
      minDocumentsPerTopic: config.minDocumentsPerTopic ?? 3,
      maxStaleDays: config.maxStaleDays ?? 90,
      orphanThreshold: config.orphanThreshold ?? 2,
      queryLog: config.queryLog ?? [],
    };
  }

  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node);
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  addQueryLog(entry: QueryLogEntry): void {
    this.config.queryLog.push(entry);
  }

  detectGaps(): KnowledgeGap[] {
    this.gaps = [];
    this.detectMissingTopics();
    this.detectIncompleteCoverage();
    this.detectStaleContent();
    this.detectOrphanNodes();
    this.detectUnansweredQueries();
    return [...this.gaps];
  }

  generateCoverageReport(): CoverageReport {
    const gaps = this.detectGaps();
    const topicCoverage = this.calculateTopicCoverage();
    const strongAreas = this.identifyStrongAreas();
    const weakAreas = this.identifyWeakAreas();

    return {
      totalTopics: this.config.expectedTopics.length || this.getUniqueTopics().length,
      coveredTopics: topicCoverage.covered,
      coveragePercentage: topicCoverage.percentage,
      gaps,
      strongAreas,
      weakAreas,
      recommendations: this.generateRecommendations(gaps),
    };
  }

  getGaps(): KnowledgeGap[] {
    return [...this.gaps];
  }

  getGapsBySeverity(severity: GapSeverity): KnowledgeGap[] {
    return this.gaps.filter((g) => g.severity === severity);
  }

  getGapsByCategory(category: GapCategory): KnowledgeGap[] {
    return this.gaps.filter((g) => g.category === category);
  }

  resolveGap(gapId: string): boolean {
    const gap = this.gaps.find((g) => g.id === gapId);
    if (gap) {
      gap.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  getStats(): { totalNodes: number; totalGaps: number; resolvedGaps: number; coveragePercentage: number } {
    const coverage = this.calculateTopicCoverage();
    return {
      totalNodes: this.nodes.size,
      totalGaps: this.gaps.length,
      resolvedGaps: this.gaps.filter((g) => g.resolvedAt).length,
      coveragePercentage: coverage.percentage,
    };
  }

  private detectMissingTopics(): void {
    const existingTopics = this.getUniqueTopics();
    for (const expected of this.config.expectedTopics) {
      if (!existingTopics.has(expected.toLowerCase())) {
        this.gaps.push({
          id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: "missing_topic",
          severity: "high",
          title: `Missing topic: ${expected}`,
          description: `Expected topic "${expected}" has no coverage in the knowledge base.`,
          affectedNodes: [],
          suggestedActions: [`Create documentation for "${expected}"`, `Research and add content about "${expected}"`],
          detectedAt: new Date().toISOString(),
          metadata: { expectedTopic: expected },
        });
      }
    }
  }

  private detectIncompleteCoverage(): void {
    const topicCounts = new Map<string, string[]>();
    for (const [id, node] of this.nodes) {
      const topic = node.topic.toLowerCase();
      const existing = topicCounts.get(topic) ?? [];
      existing.push(id);
      topicCounts.set(topic, existing);
    }

    for (const [topic, nodeIds] of topicCounts) {
      if (nodeIds.length < this.config.minDocumentsPerTopic) {
        this.gaps.push({
          id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: "incomplete_coverage",
          severity: "medium",
          title: `Incomplete coverage: ${topic}`,
          description: `Topic "${topic}" has ${nodeIds.length} documents, minimum is ${this.config.minDocumentsPerTopic}.`,
          affectedNodes: nodeIds,
          suggestedActions: [`Add ${this.config.minDocumentsPerTopic - nodeIds.length} more documents about "${topic}"`],
          detectedAt: new Date().toISOString(),
          metadata: { currentCount: nodeIds.length, required: this.config.minDocumentsPerTopic },
        });
      }
    }
  }

  private detectStaleContent(): void {
    const now = Date.now();
    const maxStaleMs = this.config.maxStaleDays * 24 * 60 * 60 * 1000;

    for (const [id, node] of this.nodes) {
      const lastUpdated = new Date(node.lastUpdated).getTime();
      const age = now - lastUpdated;
      if (age > maxStaleMs) {
        const daysSinceUpdate = Math.floor(age / (24 * 60 * 60 * 1000));
        this.gaps.push({
          id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: "stale_content",
          severity: daysSinceUpdate > 180 ? "high" : "medium",
          title: `Stale content: ${node.topic}`,
          description: `Node "${id}" hasn't been updated in ${daysSinceUpdate} days.`,
          affectedNodes: [id],
          suggestedActions: [`Review and update content for node "${id}"`, `Verify information is still accurate`],
          detectedAt: new Date().toISOString(),
          metadata: { daysSinceUpdate, lastUpdated: node.lastUpdated },
        });
      }
    }
  }

  private detectOrphanNodes(): void {
    for (const [id, node] of this.nodes) {
      if (node.links.length < this.config.orphanThreshold) {
        this.gaps.push({
          id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: "orphan_node",
          severity: "low",
          title: `Orphan node: ${node.topic}`,
          description: `Node "${id}" has only ${node.links.length} links (threshold: ${this.config.orphanThreshold}).`,
          affectedNodes: [id],
          suggestedActions: [`Link "${id}" to related documents`, `Review if this content belongs elsewhere`],
          detectedAt: new Date().toISOString(),
          metadata: { linkCount: node.links.length },
        });
      }
    }
  }

  private detectUnansweredQueries(): void {
    const lowResultQueries = this.config.queryLog.filter(
      (q) => q.resultCount === 0 || q.relevanceScore < 0.3
    );

    // Group by similar queries
    const queryGroups = new Map<string, QueryLogEntry[]>();
    for (const query of lowResultQueries) {
      const key = query.query.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
      const existing = queryGroups.get(key) ?? [];
      existing.push(query);
      queryGroups.set(key, existing);
    }

    for (const [key, queries] of queryGroups) {
      if (queries.length >= 2) {
        this.gaps.push({
          id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: "unanswered_query",
          severity: queries.length >= 5 ? "critical" : "medium",
          title: `Unanswered queries: "${key}..."`,
          description: `${queries.length} queries related to "${key}" returned poor results.`,
          affectedNodes: [],
          suggestedActions: [`Create content addressing "${key}"`, `Improve search indexing for this topic`],
          detectedAt: new Date().toISOString(),
          metadata: { queryCount: queries.length, sampleQueries: queries.slice(0, 3).map((q) => q.query) },
        });
      }
    }
  }

  private getUniqueTopics(): Set<string> {
    const topics = new Set<string>();
    for (const node of this.nodes.values()) {
      topics.add(node.topic.toLowerCase());
    }
    return topics;
  }

  private calculateTopicCoverage(): { covered: number; percentage: number } {
    if (this.config.expectedTopics.length === 0) {
      return { covered: this.getUniqueTopics().size, percentage: 100 };
    }
    const existingTopics = this.getUniqueTopics();
    const covered = this.config.expectedTopics.filter((t) => existingTopics.has(t.toLowerCase())).length;
    return {
      covered,
      percentage: Math.round((covered / this.config.expectedTopics.length) * 100),
    };
  }

  private identifyStrongAreas(): string[] {
    const topicCounts = new Map<string, number>();
    for (const node of this.nodes.values()) {
      topicCounts.set(node.topic, (topicCounts.get(node.topic) || 0) + 1);
    }
    return [...topicCounts.entries()]
      .filter(([, count]) => count >= this.config.minDocumentsPerTopic * 2)
      .map(([topic]) => topic);
  }

  private identifyWeakAreas(): string[] {
    const topicCounts = new Map<string, number>();
    for (const node of this.nodes.values()) {
      topicCounts.set(node.topic, (topicCounts.get(node.topic) || 0) + 1);
    }
    return [...topicCounts.entries()]
      .filter(([, count]) => count < this.config.minDocumentsPerTopic)
      .map(([topic]) => topic);
  }

  private generateRecommendations(gaps: KnowledgeGap[]): string[] {
    const recommendations: string[] = [];
    const criticalGaps = gaps.filter((g) => g.severity === "critical");
    const highGaps = gaps.filter((g) => g.severity === "high");

    if (criticalGaps.length > 0) {
      recommendations.push(`Address ${criticalGaps.length} critical knowledge gaps immediately`);
    }
    if (highGaps.length > 0) {
      recommendations.push(`Plan content creation for ${highGaps.length} high-priority gaps`);
    }
    const orphans = gaps.filter((g) => g.category === "orphan_node");
    if (orphans.length > 3) {
      recommendations.push(`Review ${orphans.length} orphan nodes for potential consolidation`);
    }
    const stale = gaps.filter((g) => g.category === "stale_content");
    if (stale.length > 0) {
      recommendations.push(`Schedule review of ${stale.length} stale documents`);
    }
    return recommendations;
  }
}

export function createGapDetector(config?: Partial<GapDetectorConfig>): GapDetector {
  return new GapDetector(config);
}

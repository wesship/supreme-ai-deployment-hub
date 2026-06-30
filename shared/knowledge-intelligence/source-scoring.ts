/**
 * D3VONN Knowledge Intelligence — Source Confidence Scoring
 *
 * Evaluates and scores the reliability of knowledge sources
 * based on authority, freshness, citation count, consistency,
 * and cross-validation with other sources.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SourceType = "official_docs" | "research_paper" | "blog" | "user_generated" | "api_response" | "agent_output" | "manual_entry" | "external_feed";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url?: string;
  author?: string;
  publishedAt: string;
  lastVerified?: string;
  citationCount: number;
  metadata: Record<string, unknown>;
}

export interface SourceScore {
  sourceId: string;
  overallScore: number; // 0-1
  components: ScoreComponents;
  tier: "authoritative" | "reliable" | "moderate" | "low" | "unverified";
  lastCalculated: string;
}

export interface ScoreComponents {
  authority: number;
  freshness: number;
  consistency: number;
  citationImpact: number;
  crossValidation: number;
}

export interface ScoringConfig {
  weights: ScoreComponents;
  freshnessDecayDays: number;
  authorityByType: Record<SourceType, number>;
  tierThresholds: { authoritative: number; reliable: number; moderate: number; low: number };
}

export interface ValidationResult {
  sourceId: string;
  validatedAgainst: string[];
  agreementRate: number;
  conflicts: string[];
}

// ─────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    authority: 0.3,
    freshness: 0.2,
    consistency: 0.2,
    citationImpact: 0.15,
    crossValidation: 0.15,
  },
  freshnessDecayDays: 365,
  authorityByType: {
    official_docs: 0.95,
    research_paper: 0.85,
    api_response: 0.80,
    manual_entry: 0.70,
    blog: 0.50,
    agent_output: 0.60,
    user_generated: 0.40,
    external_feed: 0.55,
  },
  tierThresholds: {
    authoritative: 0.85,
    reliable: 0.70,
    moderate: 0.50,
    low: 0.30,
  },
};

// ─────────────────────────────────────────────────────────────────
// Source Scorer
// ─────────────────────────────────────────────────────────────────

export class SourceScorer {
  private sources: Map<string, Source> = new Map();
  private scores: Map<string, SourceScore> = new Map();
  private validations: Map<string, ValidationResult> = new Map();
  private config: ScoringConfig;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = {
      ...DEFAULT_SCORING_CONFIG,
      ...config,
      weights: { ...DEFAULT_SCORING_CONFIG.weights, ...config.weights },
      authorityByType: { ...DEFAULT_SCORING_CONFIG.authorityByType, ...config.authorityByType },
      tierThresholds: { ...DEFAULT_SCORING_CONFIG.tierThresholds, ...config.tierThresholds },
    };
  }

  addSource(source: Source): void {
    this.sources.set(source.id, source);
  }

  removeSource(sourceId: string): void {
    this.sources.delete(sourceId);
    this.scores.delete(sourceId);
  }

  scoreSource(sourceId: string): SourceScore | null {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    const components: ScoreComponents = {
      authority: this.calculateAuthority(source),
      freshness: this.calculateFreshness(source),
      consistency: this.calculateConsistency(sourceId),
      citationImpact: this.calculateCitationImpact(source),
      crossValidation: this.calculateCrossValidation(sourceId),
    };

    const overallScore =
      components.authority * this.config.weights.authority +
      components.freshness * this.config.weights.freshness +
      components.consistency * this.config.weights.consistency +
      components.citationImpact * this.config.weights.citationImpact +
      components.crossValidation * this.config.weights.crossValidation;

    const score: SourceScore = {
      sourceId,
      overallScore,
      components,
      tier: this.determineTier(overallScore),
      lastCalculated: new Date().toISOString(),
    };

    this.scores.set(sourceId, score);
    return score;
  }

  scoreAllSources(): SourceScore[] {
    const results: SourceScore[] = [];
    for (const sourceId of this.sources.keys()) {
      const score = this.scoreSource(sourceId);
      if (score) results.push(score);
    }
    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  addValidation(result: ValidationResult): void {
    this.validations.set(result.sourceId, result);
  }

  getScore(sourceId: string): SourceScore | undefined {
    return this.scores.get(sourceId);
  }

  getSourcesByTier(tier: SourceScore["tier"]): Source[] {
    const result: Source[] = [];
    for (const [sourceId, score] of this.scores) {
      if (score.tier === tier) {
        const source = this.sources.get(sourceId);
        if (source) result.push(source);
      }
    }
    return result;
  }

  getStats(): { totalSources: number; scored: number; avgScore: number; tierDistribution: Record<string, number> } {
    const tierDist: Record<string, number> = {};
    let totalScore = 0;
    for (const score of this.scores.values()) {
      tierDist[score.tier] = (tierDist[score.tier] || 0) + 1;
      totalScore += score.overallScore;
    }
    return {
      totalSources: this.sources.size,
      scored: this.scores.size,
      avgScore: this.scores.size > 0 ? totalScore / this.scores.size : 0,
      tierDistribution: tierDist,
    };
  }

  private calculateAuthority(source: Source): number {
    return this.config.authorityByType[source.type] ?? 0.5;
  }

  private calculateFreshness(source: Source): number {
    const publishedAt = new Date(source.publishedAt).getTime();
    const now = Date.now();
    const ageDays = (now - publishedAt) / (24 * 60 * 60 * 1000);
    // Exponential decay
    return Math.max(0, Math.exp(-ageDays / this.config.freshnessDecayDays));
  }

  private calculateConsistency(sourceId: string): number {
    const validation = this.validations.get(sourceId);
    if (!validation) return 0.5; // neutral if not validated
    return validation.agreementRate;
  }

  private calculateCitationImpact(source: Source): number {
    // Logarithmic scaling of citations
    if (source.citationCount === 0) return 0.1;
    return Math.min(1, Math.log10(source.citationCount + 1) / 3);
  }

  private calculateCrossValidation(sourceId: string): number {
    const validation = this.validations.get(sourceId);
    if (!validation) return 0.5;
    if (validation.validatedAgainst.length === 0) return 0.3;
    return validation.conflicts.length === 0 ? 1.0 : Math.max(0.2, 1 - validation.conflicts.length * 0.2);
  }

  private determineTier(score: number): SourceScore["tier"] {
    if (score >= this.config.tierThresholds.authoritative) return "authoritative";
    if (score >= this.config.tierThresholds.reliable) return "reliable";
    if (score >= this.config.tierThresholds.moderate) return "moderate";
    if (score >= this.config.tierThresholds.low) return "low";
    return "unverified";
  }
}

export function createSourceScorer(config?: Partial<ScoringConfig>): SourceScorer {
  return new SourceScorer(config);
}

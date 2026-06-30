/**
 * D3VONN Knowledge Intelligence — Contradiction Detector
 *
 * Identifies conflicting statements, inconsistent data,
 * and logical contradictions across the knowledge base.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ContradictionType = "factual" | "temporal" | "logical" | "numerical" | "definitional" | "procedural";
export type ResolutionStrategy = "newer_wins" | "higher_confidence" | "manual_review" | "merge" | "deprecate";

export interface Contradiction {
  id: string;
  type: ContradictionType;
  severity: "critical" | "high" | "medium" | "low";
  sourceA: StatementRef;
  sourceB: StatementRef;
  description: string;
  suggestedResolution: ResolutionStrategy;
  resolvedAt?: string;
  resolution?: string;
  detectedAt: string;
}

export interface StatementRef {
  nodeId: string;
  statement: string;
  confidence: number;
  timestamp: string;
  source: string;
}

export interface Claim {
  id: string;
  nodeId: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  timestamp: string;
  source: string;
  context?: string;
}

export interface ContradictionReport {
  totalClaims: number;
  contradictions: Contradiction[];
  contradictionRate: number;
  byType: Record<ContradictionType, number>;
  bySeverity: Record<string, number>;
  recommendations: string[];
}

export interface DetectorConfig {
  numericalTolerance: number; // percentage difference to flag
  temporalWindow: number; // days within which temporal contradictions matter
  minConfidenceToFlag: number;
  enabledTypes: ContradictionType[];
}

// ─────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  numericalTolerance: 0.1, // 10% difference
  temporalWindow: 365,
  minConfidenceToFlag: 0.5,
  enabledTypes: ["factual", "temporal", "logical", "numerical", "definitional", "procedural"],
};

// ─────────────────────────────────────────────────────────────────
// Contradiction Detector
// ─────────────────────────────────────────────────────────────────

export class ContradictionDetector {
  private claims: Claim[] = [];
  private contradictions: Contradiction[] = [];
  private config: DetectorConfig;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
  }

  addClaim(claim: Claim): void {
    this.claims.push(claim);
  }

  addClaims(claims: Claim[]): void {
    this.claims.push(...claims);
  }

  removeClaim(claimId: string): void {
    this.claims = this.claims.filter((c) => c.id !== claimId);
  }

  detectContradictions(): Contradiction[] {
    this.contradictions = [];

    // Group claims by subject for comparison
    const subjectGroups = new Map<string, Claim[]>();
    for (const claim of this.claims) {
      const key = claim.subject.toLowerCase();
      const existing = subjectGroups.get(key) ?? [];
      existing.push(claim);
      subjectGroups.set(key, existing);
    }

    for (const [, claims] of subjectGroups) {
      if (claims.length < 2) continue;
      this.compareClaimsInGroup(claims);
    }

    return [...this.contradictions];
  }

  generateReport(): ContradictionReport {
    const contradictions = this.detectContradictions();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const c of contradictions) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    }

    return {
      totalClaims: this.claims.length,
      contradictions,
      contradictionRate: this.claims.length > 0 ? contradictions.length / this.claims.length : 0,
      byType: byType as Record<ContradictionType, number>,
      bySeverity,
      recommendations: this.generateRecommendations(contradictions),
    };
  }

  getContradictions(): Contradiction[] {
    return [...this.contradictions];
  }

  resolveContradiction(contradictionId: string, resolution: string): boolean {
    const contradiction = this.contradictions.find((c) => c.id === contradictionId);
    if (contradiction) {
      contradiction.resolvedAt = new Date().toISOString();
      contradiction.resolution = resolution;
      return true;
    }
    return false;
  }

  getStats(): { totalClaims: number; totalContradictions: number; resolved: number; unresolved: number } {
    return {
      totalClaims: this.claims.length,
      totalContradictions: this.contradictions.length,
      resolved: this.contradictions.filter((c) => c.resolvedAt).length,
      unresolved: this.contradictions.filter((c) => !c.resolvedAt).length,
    };
  }

  private compareClaimsInGroup(claims: Claim[]): void {
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i];
        const b = claims[j];

        if (a.confidence < this.config.minConfidenceToFlag && b.confidence < this.config.minConfidenceToFlag) {
          continue;
        }

        // Same predicate, different object = potential contradiction
        if (a.predicate.toLowerCase() === b.predicate.toLowerCase() && a.object.toLowerCase() !== b.object.toLowerCase()) {
          const type = this.classifyContradiction(a, b);
          if (this.config.enabledTypes.includes(type)) {
            this.contradictions.push(this.createContradiction(a, b, type));
          }
        }
      }
    }
  }

  private classifyContradiction(a: Claim, b: Claim): ContradictionType {
    // Check if numerical
    const numA = parseFloat(a.object);
    const numB = parseFloat(b.object);
    if (!isNaN(numA) && !isNaN(numB)) {
      const diff = Math.abs(numA - numB) / Math.max(Math.abs(numA), Math.abs(numB));
      if (diff > this.config.numericalTolerance) return "numerical";
    }

    // Check if temporal (dates)
    const dateA = Date.parse(a.object);
    const dateB = Date.parse(b.object);
    if (!isNaN(dateA) && !isNaN(dateB)) return "temporal";

    // Check if definitional (is/means/defines predicates)
    const definitionalPredicates = ["is", "means", "defines", "equals", "represents"];
    if (definitionalPredicates.includes(a.predicate.toLowerCase())) return "definitional";

    // Check if procedural (steps/process predicates)
    const proceduralPredicates = ["requires", "follows", "precedes", "depends_on"];
    if (proceduralPredicates.includes(a.predicate.toLowerCase())) return "procedural";

    // Default to factual
    return "factual";
  }

  private createContradiction(a: Claim, b: Claim, type: ContradictionType): Contradiction {
    const severity = this.calculateSeverity(a, b, type);
    const resolution = this.suggestResolution(a, b);

    return {
      id: `contradiction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      severity,
      sourceA: {
        nodeId: a.nodeId,
        statement: `${a.subject} ${a.predicate} ${a.object}`,
        confidence: a.confidence,
        timestamp: a.timestamp,
        source: a.source,
      },
      sourceB: {
        nodeId: b.nodeId,
        statement: `${b.subject} ${b.predicate} ${b.object}`,
        confidence: b.confidence,
        timestamp: b.timestamp,
        source: b.source,
      },
      description: `Conflicting claims about "${a.subject}": "${a.object}" vs "${b.object}" (predicate: ${a.predicate})`,
      suggestedResolution: resolution,
      detectedAt: new Date().toISOString(),
    };
  }

  private calculateSeverity(a: Claim, b: Claim, type: ContradictionType): "critical" | "high" | "medium" | "low" {
    const avgConfidence = (a.confidence + b.confidence) / 2;
    if (type === "factual" && avgConfidence > 0.8) return "critical";
    if (type === "numerical" && avgConfidence > 0.7) return "high";
    if (avgConfidence > 0.6) return "medium";
    return "low";
  }

  private suggestResolution(a: Claim, b: Claim): ResolutionStrategy {
    // If one is significantly newer, prefer it
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    const daysDiff = Math.abs(timeA - timeB) / (24 * 60 * 60 * 1000);
    if (daysDiff > 30) return "newer_wins";

    // If confidence differs significantly
    if (Math.abs(a.confidence - b.confidence) > 0.3) return "higher_confidence";

    // Default to manual review
    return "manual_review";
  }

  private generateRecommendations(contradictions: Contradiction[]): string[] {
    const recommendations: string[] = [];
    const critical = contradictions.filter((c) => c.severity === "critical");
    if (critical.length > 0) {
      recommendations.push(`Resolve ${critical.length} critical contradictions immediately`);
    }
    const autoResolvable = contradictions.filter(
      (c) => c.suggestedResolution === "newer_wins" || c.suggestedResolution === "higher_confidence"
    );
    if (autoResolvable.length > 0) {
      recommendations.push(`${autoResolvable.length} contradictions can be auto-resolved`);
    }
    const manualReview = contradictions.filter((c) => c.suggestedResolution === "manual_review");
    if (manualReview.length > 0) {
      recommendations.push(`${manualReview.length} contradictions require manual review`);
    }
    return recommendations;
  }
}

export function createContradictionDetector(config?: Partial<DetectorConfig>): ContradictionDetector {
  return new ContradictionDetector(config);
}

/**
 * D3VONN Enterprise Governance — Compliance Center
 *
 * Centralized compliance management with framework tracking,
 * control mapping, evidence collection, and gap analysis.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ComplianceFramework = "SOC2" | "GDPR" | "HIPAA" | "ISO27001" | "PCI_DSS" | "NIST" | "CCPA" | "FedRAMP";
export type ControlStatus = "implemented" | "partial" | "planned" | "not_applicable" | "gap";
export type EvidenceType = "document" | "screenshot" | "log" | "config" | "test_result" | "attestation";

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  category: string;
  title: string;
  description: string;
  status: ControlStatus;
  owner: string;
  evidence: Evidence[];
  lastAssessed: string;
  nextReview: string;
  risk: "high" | "medium" | "low";
  automatable: boolean;
  automationStatus?: "automated" | "semi-automated" | "manual";
}

export interface Evidence {
  id: string;
  controlId: string;
  type: EvidenceType;
  title: string;
  description: string;
  url?: string;
  collectedAt: string;
  collectedBy: string;
  expiresAt?: string;
  verified: boolean;
}

export interface ComplianceAssessment {
  id: string;
  tenantId: string;
  framework: ComplianceFramework;
  assessedAt: string;
  assessor: string;
  controls: ComplianceControl[];
  score: number; // 0-100
  gaps: ComplianceGap[];
  recommendations: string[];
}

export interface ComplianceGap {
  controlId: string;
  framework: ComplianceFramework;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  remediation: string;
  estimatedEffort: string;
  deadline?: string;
  assignee?: string;
}

export interface ComplianceReport {
  tenantId: string;
  generatedAt: string;
  frameworks: ComplianceFramework[];
  overallScore: number;
  frameworkScores: Record<ComplianceFramework, number>;
  totalControls: number;
  implementedControls: number;
  gaps: ComplianceGap[];
  trends: ComplianceTrend[];
}

export interface ComplianceTrend {
  date: string;
  framework: ComplianceFramework;
  score: number;
}

// ─────────────────────────────────────────────────────────────────
// Compliance Center
// ─────────────────────────────────────────────────────────────────

export class ComplianceCenter {
  private controls: Map<string, ComplianceControl> = new Map();
  private assessments: ComplianceAssessment[] = [];
  private trends: ComplianceTrend[] = [];

  // ─── Control Management ─────────────────────────────────────

  registerControl(control: ComplianceControl): void {
    this.controls.set(control.id, control);
  }

  getControl(controlId: string): ComplianceControl | undefined {
    return this.controls.get(controlId);
  }

  listControls(framework?: ComplianceFramework, status?: ControlStatus): ComplianceControl[] {
    let controls = [...this.controls.values()];
    if (framework) controls = controls.filter((c) => c.framework === framework);
    if (status) controls = controls.filter((c) => c.status === status);
    return controls;
  }

  updateControlStatus(controlId: string, status: ControlStatus, evidence?: Evidence): boolean {
    const control = this.controls.get(controlId);
    if (!control) return false;
    control.status = status;
    control.lastAssessed = new Date().toISOString();
    if (evidence) control.evidence.push(evidence);
    return true;
  }

  // ─── Evidence Collection ────────────────────────────────────

  addEvidence(controlId: string, evidence: Omit<Evidence, "id" | "controlId" | "collectedAt">): Evidence | null {
    const control = this.controls.get(controlId);
    if (!control) return null;

    const fullEvidence: Evidence = {
      ...evidence,
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      controlId,
      collectedAt: new Date().toISOString(),
    };

    control.evidence.push(fullEvidence);
    return fullEvidence;
  }

  getExpiredEvidence(): Evidence[] {
    const now = new Date().toISOString();
    const expired: Evidence[] = [];
    for (const control of this.controls.values()) {
      for (const ev of control.evidence) {
        if (ev.expiresAt && ev.expiresAt < now) expired.push(ev);
      }
    }
    return expired;
  }

  // ─── Assessment ─────────────────────────────────────────────

  runAssessment(tenantId: string, framework: ComplianceFramework, assessor: string): ComplianceAssessment {
    const controls = this.listControls(framework);
    const implemented = controls.filter((c) => c.status === "implemented").length;
    const score = controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0;

    const gaps: ComplianceGap[] = controls
      .filter((c) => c.status === "gap" || c.status === "planned")
      .map((c) => ({
        controlId: c.id,
        framework,
        severity: c.risk === "high" ? "critical" as const : c.risk as "high" | "medium" | "low",
        description: `Control "${c.title}" is not fully implemented`,
        remediation: `Implement ${c.title} according to ${framework} requirements`,
        estimatedEffort: c.risk === "high" ? "2-4 weeks" : "1-2 weeks",
      }));

    const assessment: ComplianceAssessment = {
      id: `assess_${Date.now()}`,
      tenantId,
      framework,
      assessedAt: new Date().toISOString(),
      assessor,
      controls,
      score,
      gaps,
      recommendations: this.generateRecommendations(gaps),
    };

    this.assessments.push(assessment);
    this.trends.push({ date: new Date().toISOString(), framework, score });

    return assessment;
  }

  private generateRecommendations(gaps: ComplianceGap[]): string[] {
    const recommendations: string[] = [];
    const criticalGaps = gaps.filter((g) => g.severity === "critical");
    if (criticalGaps.length > 0) {
      recommendations.push(`Address ${criticalGaps.length} critical gaps immediately`);
    }
    if (gaps.length > 10) {
      recommendations.push("Consider hiring dedicated compliance staff");
    }
    recommendations.push("Schedule quarterly compliance reviews");
    recommendations.push("Automate evidence collection where possible");
    return recommendations;
  }

  // ─── Reporting ──────────────────────────────────────────────

  generateReport(tenantId: string, frameworks?: ComplianceFramework[]): ComplianceReport {
    const targetFrameworks = frameworks ?? (["SOC2", "GDPR", "HIPAA"] as ComplianceFramework[]);
    const frameworkScores: Record<string, number> = {};
    let totalControls = 0;
    let implementedControls = 0;
    const allGaps: ComplianceGap[] = [];

    for (const fw of targetFrameworks) {
      const controls = this.listControls(fw);
      const implemented = controls.filter((c) => c.status === "implemented").length;
      frameworkScores[fw] = controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0;
      totalControls += controls.length;
      implementedControls += implemented;
      allGaps.push(...controls.filter((c) => c.status === "gap").map((c) => ({
        controlId: c.id,
        framework: fw,
        severity: c.risk === "high" ? "critical" as const : c.risk as "high" | "medium" | "low",
        description: `${c.title} not implemented`,
        remediation: c.description,
        estimatedEffort: "TBD",
      })));
    }

    const overallScore = totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0;

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      frameworks: targetFrameworks,
      overallScore,
      frameworkScores: frameworkScores as Record<ComplianceFramework, number>,
      totalControls,
      implementedControls,
      gaps: allGaps,
      trends: this.trends.filter((t) => targetFrameworks.includes(t.framework)),
    };
  }

  // ─── Gap Analysis ───────────────────────────────────────────

  getGapAnalysis(framework: ComplianceFramework): { total: number; implemented: number; gaps: number; score: number; criticalGaps: ComplianceControl[] } {
    const controls = this.listControls(framework);
    const implemented = controls.filter((c) => c.status === "implemented").length;
    const gaps = controls.filter((c) => c.status === "gap").length;
    const criticalGaps = controls.filter((c) => c.status === "gap" && c.risk === "high");

    return {
      total: controls.length,
      implemented,
      gaps,
      score: controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0,
      criticalGaps,
    };
  }
}

export function createComplianceCenter(): ComplianceCenter {
  return new ComplianceCenter();
}

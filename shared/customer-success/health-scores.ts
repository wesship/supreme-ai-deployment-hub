/**
 * D3VONN Customer Success — Health Scores
 *
 * Customer health scoring with multi-signal analysis,
 * churn prediction, engagement tracking, and alerts.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "at_risk" | "critical" | "churned";
export type SignalCategory = "engagement" | "adoption" | "satisfaction" | "support" | "billing" | "growth";

export interface HealthScore {
  tenantId: string;
  overallScore: number; // 0-100
  status: HealthStatus;
  signals: HealthSignal[];
  trend: "improving" | "stable" | "declining";
  lastCalculated: string;
  predictedChurnRisk: number; // 0-1
  recommendations: string[];
}

export interface HealthSignal {
  category: SignalCategory;
  name: string;
  value: number; // 0-100
  weight: number; // 0-1
  trend: "up" | "stable" | "down";
  details: string;
}

export interface EngagementMetrics {
  tenantId: string;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionDuration: number; // minutes
  featureAdoption: Record<string, number>; // feature -> adoption %
  lastLogin: string;
  totalApiCalls: number;
  agentsDeployed: number;
  workflowsActive: number;
}

export interface HealthAlert {
  id: string;
  tenantId: string;
  type: "score_drop" | "inactivity" | "support_spike" | "billing_issue" | "churn_risk";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Health Score Engine
// ─────────────────────────────────────────────────────────────────

export class HealthScoreEngine {
  private scores: Map<string, HealthScore> = new Map();
  private metrics: Map<string, EngagementMetrics> = new Map();
  private alerts: HealthAlert[] = [];
  private history: Map<string, { date: string; score: number }[]> = new Map();

  // ─── Score Calculation ──────────────────────────────────────

  calculateScore(tenantId: string, engagement: EngagementMetrics): HealthScore {
    this.metrics.set(tenantId, engagement);

    const signals: HealthSignal[] = [
      this.calculateEngagementSignal(engagement),
      this.calculateAdoptionSignal(engagement),
      this.calculateGrowthSignal(engagement),
      this.calculateBillingSignal(tenantId),
      this.calculateSupportSignal(tenantId),
    ];

    const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const overallScore = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);

    const status = this.determineStatus(overallScore);
    const previousScore = this.scores.get(tenantId);
    const trend = previousScore
      ? overallScore > previousScore.overallScore + 5 ? "improving"
        : overallScore < previousScore.overallScore - 5 ? "declining"
        : "stable"
      : "stable";

    const predictedChurnRisk = this.predictChurnRisk(overallScore, signals, trend);
    const recommendations = this.generateRecommendations(signals, status);

    const healthScore: HealthScore = {
      tenantId,
      overallScore,
      status,
      signals,
      trend,
      lastCalculated: new Date().toISOString(),
      predictedChurnRisk,
      recommendations,
    };

    this.scores.set(tenantId, healthScore);

    // Track history
    if (!this.history.has(tenantId)) this.history.set(tenantId, []);
    this.history.get(tenantId)!.push({ date: new Date().toISOString(), score: overallScore });

    // Generate alerts
    this.checkAlerts(tenantId, healthScore, previousScore);

    return healthScore;
  }

  private calculateEngagementSignal(metrics: EngagementMetrics): HealthSignal {
    const dauRatio = metrics.monthlyActiveUsers > 0 ? metrics.dailyActiveUsers / metrics.monthlyActiveUsers : 0;
    const score = Math.min(100, Math.round(dauRatio * 200)); // DAU/MAU > 0.5 = 100

    return {
      category: "engagement",
      name: "User Engagement",
      value: score,
      weight: 0.3,
      trend: score > 60 ? "up" : score < 30 ? "down" : "stable",
      details: `DAU/MAU ratio: ${(dauRatio * 100).toFixed(1)}%, Avg session: ${metrics.avgSessionDuration}min`,
    };
  }

  private calculateAdoptionSignal(metrics: EngagementMetrics): HealthSignal {
    const features = Object.values(metrics.featureAdoption);
    const avgAdoption = features.length > 0 ? features.reduce((a, b) => a + b, 0) / features.length : 0;
    const score = Math.min(100, Math.round(avgAdoption));

    return {
      category: "adoption",
      name: "Feature Adoption",
      value: score,
      weight: 0.25,
      trend: score > 50 ? "up" : score < 20 ? "down" : "stable",
      details: `${features.length} features tracked, avg adoption: ${avgAdoption.toFixed(1)}%`,
    };
  }

  private calculateGrowthSignal(metrics: EngagementMetrics): HealthSignal {
    const score = Math.min(100, metrics.agentsDeployed * 10 + metrics.workflowsActive * 15);

    return {
      category: "growth",
      name: "Platform Growth",
      value: score,
      weight: 0.2,
      trend: score > 50 ? "up" : "stable",
      details: `${metrics.agentsDeployed} agents, ${metrics.workflowsActive} workflows active`,
    };
  }

  private calculateBillingSignal(_tenantId: string): HealthSignal {
    // In production, this would check payment history
    return {
      category: "billing",
      name: "Billing Health",
      value: 90,
      weight: 0.15,
      trend: "stable",
      details: "Payments current, no overdue invoices",
    };
  }

  private calculateSupportSignal(_tenantId: string): HealthSignal {
    // In production, this would check support ticket volume
    return {
      category: "support",
      name: "Support Activity",
      value: 80,
      weight: 0.1,
      trend: "stable",
      details: "Normal support volume",
    };
  }

  private determineStatus(score: number): HealthStatus {
    if (score >= 70) return "healthy";
    if (score >= 40) return "at_risk";
    if (score >= 10) return "critical";
    return "churned";
  }

  private predictChurnRisk(score: number, signals: HealthSignal[], trend: string): number {
    let risk = (100 - score) / 100;
    if (trend === "declining") risk += 0.15;
    if (trend === "improving") risk -= 0.1;

    const engagementSignal = signals.find((s) => s.category === "engagement");
    if (engagementSignal && engagementSignal.value < 20) risk += 0.2;

    return Math.max(0, Math.min(1, risk));
  }

  private generateRecommendations(signals: HealthSignal[], status: HealthStatus): string[] {
    const recs: string[] = [];

    const lowSignals = signals.filter((s) => s.value < 40);
    for (const signal of lowSignals) {
      switch (signal.category) {
        case "engagement": recs.push("Schedule a check-in call to re-engage the team"); break;
        case "adoption": recs.push("Offer a guided walkthrough of underutilized features"); break;
        case "growth": recs.push("Suggest workflow templates to increase platform usage"); break;
        case "billing": recs.push("Review billing issues and offer payment plan options"); break;
        case "support": recs.push("Proactively address open support tickets"); break;
      }
    }

    if (status === "critical") recs.push("Escalate to Customer Success Manager immediately");
    if (status === "at_risk") recs.push("Schedule executive business review");

    return recs;
  }

  // ─── Alerts ─────────────────────────────────────────────────

  private checkAlerts(tenantId: string, current: HealthScore, previous?: HealthScore): void {
    if (previous && current.overallScore < previous.overallScore - 15) {
      this.alerts.push({
        id: `alert_${Date.now()}`,
        tenantId,
        type: "score_drop",
        severity: current.overallScore < 30 ? "critical" : "high",
        message: `Health score dropped from ${previous.overallScore} to ${current.overallScore}`,
        triggeredAt: new Date().toISOString(),
        acknowledged: false,
      });
    }

    if (current.predictedChurnRisk > 0.7) {
      this.alerts.push({
        id: `alert_${Date.now()}_churn`,
        tenantId,
        type: "churn_risk",
        severity: "critical",
        message: `High churn risk detected: ${(current.predictedChurnRisk * 100).toFixed(0)}%`,
        triggeredAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // ─── Queries ────────────────────────────────────────────────

  getScore(tenantId: string): HealthScore | undefined {
    return this.scores.get(tenantId);
  }

  getAlerts(tenantId?: string, unacknowledgedOnly = false): HealthAlert[] {
    let alerts = [...this.alerts];
    if (tenantId) alerts = alerts.filter((a) => a.tenantId === tenantId);
    if (unacknowledgedOnly) alerts = alerts.filter((a) => !a.acknowledged);
    return alerts;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  getHistory(tenantId: string): { date: string; score: number }[] {
    return this.history.get(tenantId) ?? [];
  }

  getAtRiskTenants(): HealthScore[] {
    return [...this.scores.values()].filter((s) => s.status === "at_risk" || s.status === "critical");
  }
}

export function createHealthScoreEngine(): HealthScoreEngine {
  return new HealthScoreEngine();
}

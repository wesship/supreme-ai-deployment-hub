/**
 * D3VONN Deployment Health
 *
 * Monitors deployment health during and after releases, providing
 * real-time status, canary analysis, and deployment confidence scoring.
 *
 * @module shared/deployment/deployment-health
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type DeploymentPhase = "preparing" | "deploying" | "verifying" | "monitoring" | "stable" | "degraded" | "failed";

export interface DeploymentHealthStatus {
  phase: DeploymentPhase;
  version: string;
  environment: string;
  startedAt: string;
  lastCheckedAt: string;
  uptime: number;
  confidence: number;
  checks: HealthCheckResult[];
  metrics: DeploymentMetrics;
}

export interface HealthCheckResult {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  lastSuccess: string;
  consecutiveFailures: number;
  message?: string;
}

export interface DeploymentMetrics {
  requestsPerSecond: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeConnections: number;
  memoryUsageMB: number;
  cpuPercent: number;
  eventBusDepth: number;
  dlqDepth: number;
  agentsHealthy: number;
  agentsTotal: number;
}

export interface CanaryAnalysis {
  canaryVersion: string;
  baselineVersion: string;
  trafficPercent: number;
  startedAt: string;
  duration: number;
  verdict: "pass" | "fail" | "inconclusive";
  metrics: {
    canary: DeploymentMetrics;
    baseline: DeploymentMetrics;
  };
  comparison: {
    errorRateDelta: number;
    latencyDelta: number;
    successRateDelta: number;
  };
}

export interface DeploymentWindow {
  id: string;
  name: string;
  allowedDays: number[]; // 0=Sunday, 6=Saturday
  startHour: number;
  endHour: number;
  timezone: string;
  blackoutDates: string[];
}

// ─────────────────────────────────────────────────────────────────
// Default Deployment Windows
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_DEPLOYMENT_WINDOWS: DeploymentWindow[] = [
  {
    id: "business-hours",
    name: "Business Hours (Safe)",
    allowedDays: [1, 2, 3, 4], // Mon-Thu
    startHour: 9,
    endHour: 16,
    timezone: "America/Denver",
    blackoutDates: [],
  },
  {
    id: "maintenance-window",
    name: "Maintenance Window",
    allowedDays: [2, 3], // Tue-Wed
    startHour: 2,
    endHour: 5,
    timezone: "America/Denver",
    blackoutDates: [],
  },
  {
    id: "emergency",
    name: "Emergency (Any Time)",
    allowedDays: [0, 1, 2, 3, 4, 5, 6],
    startHour: 0,
    endHour: 24,
    timezone: "America/Denver",
    blackoutDates: [],
  },
];

// ─────────────────────────────────────────────────────────────────
// Deployment Health Monitor
// ─────────────────────────────────────────────────────────────────

export class DeploymentHealthMonitor {
  private status: DeploymentHealthStatus;
  private history: DeploymentHealthStatus[] = [];
  private canaryAnalyses: CanaryAnalysis[] = [];
  private deploymentWindows: DeploymentWindow[] = DEFAULT_DEPLOYMENT_WINDOWS;
  private confidenceThreshold: number = 95;

  constructor(options: {
    version: string;
    environment: string;
    confidenceThreshold?: number;
  }) {
    this.confidenceThreshold = options.confidenceThreshold ?? 95;
    this.status = {
      phase: "preparing",
      version: options.version,
      environment: options.environment,
      startedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      uptime: 0,
      confidence: 0,
      checks: [],
      metrics: this.createEmptyMetrics(),
    };
  }

  startDeployment(): void {
    this.status.phase = "deploying";
    this.status.startedAt = new Date().toISOString();
  }

  startVerification(): void {
    this.status.phase = "verifying";
  }

  startMonitoring(): void {
    this.status.phase = "monitoring";
  }

  markStable(): void {
    this.status.phase = "stable";
    this.status.confidence = 100;
  }

  markDegraded(reason?: string): void {
    this.status.phase = "degraded";
  }

  markFailed(reason?: string): void {
    this.status.phase = "failed";
    this.status.confidence = 0;
  }

  updateMetrics(metrics: Partial<DeploymentMetrics>): void {
    this.status.metrics = { ...this.status.metrics, ...metrics };
    this.status.lastCheckedAt = new Date().toISOString();
    this.calculateConfidence();
    this.history.push({ ...this.status });
  }

  updateChecks(checks: HealthCheckResult[]): void {
    this.status.checks = checks;
    this.status.lastCheckedAt = new Date().toISOString();
    this.calculateConfidence();
  }

  getStatus(): DeploymentHealthStatus {
    return { ...this.status };
  }

  getHistory(): DeploymentHealthStatus[] {
    return [...this.history];
  }

  getConfidence(): number {
    return this.status.confidence;
  }

  isHealthy(): boolean {
    return this.status.phase === "stable" || this.status.phase === "monitoring";
  }

  isDeploymentWindowOpen(windowId?: string): boolean {
    const now = new Date();
    const windows = windowId
      ? this.deploymentWindows.filter((w) => w.id === windowId)
      : this.deploymentWindows.filter((w) => w.id !== "emergency");

    return windows.some((window) => {
      const day = now.getDay();
      const hour = now.getHours();

      if (!window.allowedDays.includes(day)) return false;
      if (hour < window.startHour || hour >= window.endHour) return false;

      const dateStr = now.toISOString().split("T")[0];
      if (window.blackoutDates.includes(dateStr)) return false;

      return true;
    });
  }

  runCanaryAnalysis(
    canaryMetrics: DeploymentMetrics,
    baselineMetrics: DeploymentMetrics,
    options: { canaryVersion: string; baselineVersion: string; trafficPercent: number }
  ): CanaryAnalysis {
    const errorRateDelta = canaryMetrics.errorRate - baselineMetrics.errorRate;
    const latencyDelta = canaryMetrics.p95LatencyMs - baselineMetrics.p95LatencyMs;
    const canarySuccessRate = 1 - canaryMetrics.errorRate / 100;
    const baselineSuccessRate = 1 - baselineMetrics.errorRate / 100;
    const successRateDelta = (canarySuccessRate - baselineSuccessRate) * 100;

    let verdict: "pass" | "fail" | "inconclusive" = "inconclusive";
    if (errorRateDelta <= 0.5 && latencyDelta <= 200) {
      verdict = "pass";
    } else if (errorRateDelta > 2 || latencyDelta > 1000) {
      verdict = "fail";
    }

    const analysis: CanaryAnalysis = {
      canaryVersion: options.canaryVersion,
      baselineVersion: options.baselineVersion,
      trafficPercent: options.trafficPercent,
      startedAt: new Date().toISOString(),
      duration: 0,
      verdict,
      metrics: { canary: canaryMetrics, baseline: baselineMetrics },
      comparison: { errorRateDelta, latencyDelta, successRateDelta },
    };

    this.canaryAnalyses.push(analysis);
    return analysis;
  }

  getCanaryAnalyses(): CanaryAnalysis[] {
    return [...this.canaryAnalyses];
  }

  getDeploymentWindows(): DeploymentWindow[] {
    return [...this.deploymentWindows];
  }

  private calculateConfidence(): void {
    const { metrics, checks } = this.status;
    let confidence = 100;

    // Error rate impact
    if (metrics.errorRate > 5) confidence -= 40;
    else if (metrics.errorRate > 2) confidence -= 20;
    else if (metrics.errorRate > 0.5) confidence -= 5;

    // Latency impact
    if (metrics.p95LatencyMs > 5000) confidence -= 30;
    else if (metrics.p95LatencyMs > 2000) confidence -= 15;
    else if (metrics.p95LatencyMs > 1000) confidence -= 5;

    // DLQ impact
    if (metrics.dlqDepth > 50) confidence -= 20;
    else if (metrics.dlqDepth > 10) confidence -= 10;
    else if (metrics.dlqDepth > 0) confidence -= 2;

    // Agent health impact
    if (metrics.agentsTotal > 0) {
      const agentHealthPercent = metrics.agentsHealthy / metrics.agentsTotal;
      if (agentHealthPercent < 0.5) confidence -= 25;
      else if (agentHealthPercent < 0.8) confidence -= 10;
    }

    // Health check impact
    const unhealthyChecks = checks.filter((c) => c.status === "unhealthy").length;
    const degradedChecks = checks.filter((c) => c.status === "degraded").length;
    confidence -= unhealthyChecks * 15;
    confidence -= degradedChecks * 5;

    this.status.confidence = Math.max(0, Math.min(100, confidence));

    // Auto-transition phases based on confidence
    if (this.status.phase === "monitoring" && this.status.confidence >= this.confidenceThreshold) {
      this.status.phase = "stable";
    } else if (this.status.phase === "stable" && this.status.confidence < 70) {
      this.status.phase = "degraded";
    }
  }

  private createEmptyMetrics(): DeploymentMetrics {
    return {
      requestsPerSecond: 0,
      errorRate: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      activeConnections: 0,
      memoryUsageMB: 0,
      cpuPercent: 0,
      eventBusDepth: 0,
      dlqDepth: 0,
      agentsHealthy: 0,
      agentsTotal: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createDeploymentHealthMonitor(options: {
  version: string;
  environment: string;
  confidenceThreshold?: number;
}): DeploymentHealthMonitor {
  return new DeploymentHealthMonitor(options);
}

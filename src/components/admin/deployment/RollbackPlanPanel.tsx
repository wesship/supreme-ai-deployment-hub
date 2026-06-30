import React, { useState } from "react";

interface RollbackTrigger {
  name: string;
  condition: string;
  enabled: boolean;
  threshold: string;
}

interface RollbackStep {
  order: number;
  name: string;
  description: string;
  automated: boolean;
  estimatedDuration: string;
  status: "pending" | "running" | "completed" | "failed";
}

export default function RollbackPlanPanel() {
  const [plan] = useState({
    strategy: "blue-green" as const,
    currentVersion: "2.0.0-alpha.1",
    targetVersion: "1.9.2",
    status: "ready" as const,
    estimatedDuration: "3m 45s",
    riskLevel: "medium" as const,
    lastTested: "2026-06-29T14:00:00Z",
  });

  const triggers: RollbackTrigger[] = [
    { name: "Error Rate Spike", condition: "error_rate > threshold", enabled: true, threshold: "5%" },
    { name: "Latency Degradation", condition: "p95_latency > threshold", enabled: true, threshold: "5000ms" },
    { name: "Health Check Failures", condition: "consecutive_failures >= threshold", enabled: true, threshold: "3" },
    { name: "DLQ Spike", condition: "dlq_depth > threshold", enabled: true, threshold: "50" },
    { name: "Agent Mesh Failure", condition: "healthy_agents < threshold", enabled: true, threshold: "50%" },
    { name: "Memory Pressure", condition: "memory_usage > threshold", enabled: false, threshold: "90%" },
  ];

  const steps: RollbackStep[] = [
    { order: 1, name: "Alert Team", description: "Send rollback notification to on-call", automated: true, estimatedDuration: "5s", status: "pending" },
    { order: 2, name: "Pause Event Bus", description: "Stop processing new events", automated: true, estimatedDuration: "10s", status: "pending" },
    { order: 3, name: "Switch Traffic", description: "Route all traffic to previous version", automated: true, estimatedDuration: "30s", status: "pending" },
    { order: 4, name: "Verify Health", description: "Run health checks on rollback target", automated: true, estimatedDuration: "45s", status: "pending" },
    { order: 5, name: "Drain Connections", description: "Wait for in-flight requests to complete", automated: true, estimatedDuration: "60s", status: "pending" },
    { order: 6, name: "Rollback Migrations", description: "Apply down migrations if needed", automated: false, estimatedDuration: "30s", status: "pending" },
    { order: 7, name: "Resume Event Bus", description: "Resume event processing", automated: true, estimatedDuration: "10s", status: "pending" },
    { order: 8, name: "Verify System", description: "Full system health verification", automated: true, estimatedDuration: "45s", status: "pending" },
    { order: 9, name: "Post-Rollback Report", description: "Generate incident report", automated: true, estimatedDuration: "5s", status: "pending" },
  ];

  const riskColors = {
    low: "text-green-400 bg-green-900/20 border-green-700",
    medium: "text-yellow-400 bg-yellow-900/20 border-yellow-700",
    high: "text-red-400 bg-red-900/20 border-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Rollback Plan</h2>
            <p className="text-sm text-gray-400">
              {plan.currentVersion} → {plan.targetVersion}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${riskColors[plan.riskLevel]}`}>
            {plan.riskLevel} risk
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500">Strategy</div>
            <div className="text-sm font-medium text-blue-400 capitalize mt-1">{plan.strategy}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500">Status</div>
            <div className="text-sm font-medium text-green-400 capitalize mt-1">{plan.status}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500">Est. Duration</div>
            <div className="text-sm font-medium text-gray-300 mt-1">{plan.estimatedDuration}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500">Last Tested</div>
            <div className="text-sm font-medium text-gray-300 mt-1">
              {new Date(plan.lastTested).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Triggers */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Auto-Rollback Triggers</h3>
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <div
              key={trigger.name}
              className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/50"
            >
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${trigger.enabled ? "bg-green-400" : "bg-gray-600"}`} />
                <div>
                  <div className="text-sm font-medium text-gray-300">{trigger.name}</div>
                  <code className="text-xs text-gray-500">{trigger.condition}</code>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Threshold: {trigger.threshold}</span>
                <span className={`text-xs font-medium ${trigger.enabled ? "text-green-400" : "text-gray-500"}`}>
                  {trigger.enabled ? "Armed" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rollback Steps */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Execution Steps</h3>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.order} className="flex items-start gap-4 py-3 px-4 rounded-lg bg-gray-800/30">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                {step.order}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">{step.name}</span>
                  {step.automated ? (
                    <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">auto</span>
                  ) : (
                    <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">manual</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{step.description}</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{step.estimatedDuration}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React from "react";

interface ChecklistItem {
  id: string;
  name: string;
  phase: string;
  type: "automated" | "manual" | "approval";
  status: "pending" | "completed" | "failed" | "skipped";
  required: boolean;
}

export default function ReleaseChecklistPanel() {
  const version = "2.0.0-alpha.1";
  const items: ChecklistItem[] = [
    { id: "pre-01", name: "All tests passing", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-02", name: "Build succeeds", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-03", name: "TypeScript type check passes", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-04", name: "Secrets audit clean", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-05", name: "Environment variables validated", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-06", name: "Database migrations reviewed", phase: "pre-deploy", type: "manual", status: "completed", required: true },
    { id: "pre-07", name: "Rollback plan prepared", phase: "pre-deploy", type: "manual", status: "completed", required: true },
    { id: "pre-08", name: "Change log updated", phase: "pre-deploy", type: "manual", status: "skipped", required: false },
    { id: "pre-09", name: "Readiness score >= 90", phase: "pre-deploy", type: "automated", status: "completed", required: true },
    { id: "pre-10", name: "Team notified", phase: "pre-deploy", type: "manual", status: "pending", required: true },
    { id: "dep-01", name: "Deploy to staging", phase: "deploy", type: "automated", status: "pending", required: true },
    { id: "dep-02", name: "Staging smoke tests pass", phase: "deploy", type: "automated", status: "pending", required: true },
    { id: "dep-03", name: "Staging sign-off", phase: "deploy", type: "approval", status: "pending", required: true },
    { id: "dep-04", name: "Deploy to production", phase: "deploy", type: "automated", status: "pending", required: true },
    { id: "dep-05", name: "Run database migrations", phase: "deploy", type: "automated", status: "pending", required: true },
    { id: "post-01", name: "Health checks passing", phase: "post-deploy", type: "automated", status: "pending", required: true },
    { id: "post-02", name: "Sentry release created", phase: "post-deploy", type: "automated", status: "pending", required: true },
    { id: "post-03", name: "Monitor error rates (15 min)", phase: "post-deploy", type: "automated", status: "pending", required: true },
    { id: "post-04", name: "Event bus healthy", phase: "post-deploy", type: "automated", status: "pending", required: true },
    { id: "post-05", name: "Agent mesh responding", phase: "post-deploy", type: "automated", status: "pending", required: true },
    { id: "ver-01", name: "Production smoke tests pass", phase: "verification", type: "automated", status: "pending", required: true },
    { id: "ver-02", name: "Tenant isolation verified", phase: "verification", type: "automated", status: "pending", required: true },
    { id: "ver-03", name: "RBAC enforcement verified", phase: "verification", type: "automated", status: "pending", required: true },
    { id: "ver-04", name: "Performance baseline met", phase: "verification", type: "automated", status: "pending", required: false },
    { id: "ver-05", name: "Deployment sign-off", phase: "verification", type: "approval", status: "pending", required: true },
  ];

  const phases = ["pre-deploy", "deploy", "post-deploy", "verification"];
  const completed = items.filter((i) => i.status === "completed" || i.status === "skipped").length;
  const percentage = Math.round((completed / items.length) * 100);

  const phaseLabels: Record<string, string> = {
    "pre-deploy": "Pre-Deploy",
    deploy: "Deploy",
    "post-deploy": "Post-Deploy",
    verification: "Verification",
  };

  const typeIcons: Record<string, string> = {
    automated: "⚡",
    manual: "👤",
    approval: "✋",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Release Checklist</h2>
            <p className="text-sm text-gray-400">Version: {version}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{percentage}%</div>
            <div className="text-xs text-gray-500">{completed}/{items.length} items</div>
          </div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Phase Sections */}
      {phases.map((phase) => {
        const phaseItems = items.filter((i) => i.phase === phase);
        const phaseCompleted = phaseItems.filter((i) => i.status === "completed" || i.status === "skipped").length;

        return (
          <div key={phase} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{phaseLabels[phase]}</h3>
              <span className="text-xs text-gray-500">
                {phaseCompleted}/{phaseItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {phaseItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    item.status === "completed"
                      ? "bg-green-900/10 border border-green-900/30"
                      : item.status === "failed"
                      ? "bg-red-900/10 border border-red-900/30"
                      : "bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      {item.status === "completed" ? "✅" : item.status === "failed" ? "❌" : item.status === "skipped" ? "⏭️" : "⬜"}
                    </span>
                    <span className={`text-sm ${item.status === "completed" ? "text-gray-300" : "text-gray-500"}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" title={item.type}>{typeIcons[item.type]}</span>
                    {item.required && (
                      <span className="text-xs text-purple-400">req</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type DeploymentTab = "overview" | "environment" | "secrets" | "release" | "rollback" | "readiness";

interface TabConfig {
  id: DeploymentTab;
  label: string;
  icon: string;
}

// ─────────────────────────────────────────────────────────────────
// Tab Configuration
// ─────────────────────────────────────────────────────────────────

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "environment", label: "Environment", icon: "⚙️" },
  { id: "secrets", label: "Secrets Audit", icon: "🔐" },
  { id: "release", label: "Release Checklist", icon: "📋" },
  { id: "rollback", label: "Rollback Plan", icon: "↩️" },
  { id: "readiness", label: "Readiness Score", icon: "🎯" },
];

// ─────────────────────────────────────────────────────────────────
// Deployment Page
// ─────────────────────────────────────────────────────────────────

export default function Deployment() {
  const [activeTab, setActiveTab] = useState<DeploymentTab>("overview");

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
          Deployment Hardening
        </h1>
        <p className="text-gray-400 mt-2">
          Environment validation, secrets audit, release management, and production readiness
        </p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 mb-8 border-b border-gray-800 pb-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-gray-800 text-green-400 border-b-2 border-green-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main>
        {activeTab === "overview" && <DeploymentOverview />}
        {activeTab === "environment" && <EnvironmentTab />}
        {activeTab === "secrets" && <SecretsTab />}
        {activeTab === "release" && <ReleaseTab />}
        {activeTab === "rollback" && <RollbackTab />}
        {activeTab === "readiness" && <ReadinessTab />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────

function DeploymentOverview() {
  const deploymentStatus = {
    currentVersion: "2.0.0-alpha.1",
    environment: "production",
    lastDeployed: "2026-06-30T10:00:00Z",
    readinessScore: 94,
    secretsScore: 100,
    envScore: 92,
    releaseProgress: 68,
  };

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Readiness Score"
          value={`${deploymentStatus.readinessScore}%`}
          status={deploymentStatus.readinessScore >= 90 ? "healthy" : "warning"}
          subtitle="Gate: >= 90%"
        />
        <StatusCard
          title="Secrets Audit"
          value={`${deploymentStatus.secretsScore}%`}
          status={deploymentStatus.secretsScore === 100 ? "healthy" : "critical"}
          subtitle="0 findings"
        />
        <StatusCard
          title="Environment"
          value={`${deploymentStatus.envScore}%`}
          status={deploymentStatus.envScore >= 90 ? "healthy" : "warning"}
          subtitle={deploymentStatus.environment}
        />
        <StatusCard
          title="Release Progress"
          value={`${deploymentStatus.releaseProgress}%`}
          status={deploymentStatus.releaseProgress >= 80 ? "healthy" : "info"}
          subtitle="17/25 items complete"
        />
      </div>

      {/* Deployment Timeline */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Deployment Pipeline</h3>
        <div className="flex items-center gap-2">
          {["Build", "Test", "Secrets", "Staging", "Approval", "Production", "Verify"].map(
            (stage, i) => (
              <React.Fragment key={stage}>
                <div
                  className={`px-3 py-2 rounded text-xs font-medium ${
                    i < 4
                      ? "bg-green-900/50 text-green-400 border border-green-700"
                      : i === 4
                      ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700"
                      : "bg-gray-800 text-gray-500 border border-gray-700"
                  }`}
                >
                  {stage}
                </div>
                {i < 6 && <span className="text-gray-600">→</span>}
              </React.Fragment>
            )
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton label="Run Readiness Check" icon="🎯" />
          <ActionButton label="Scan Secrets" icon="🔐" />
          <ActionButton label="Validate Environment" icon="⚙️" />
          <ActionButton label="Create Rollback Plan" icon="↩️" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Environment Tab
// ─────────────────────────────────────────────────────────────────

function EnvironmentTab() {
  const envVars = [
    { name: "SUPABASE_URL", required: true, present: true, category: "infrastructure" },
    { name: "SUPABASE_ANON_KEY", required: true, present: true, category: "infrastructure" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, present: true, category: "infrastructure" },
    { name: "OPENAI_API_KEY", required: true, present: true, category: "ai" },
    { name: "PINECONE_API_KEY", required: true, present: false, category: "ai" },
    { name: "PINECONE_ENVIRONMENT", required: true, present: false, category: "ai" },
    { name: "SENTRY_DSN", required: true, present: true, category: "observability" },
    { name: "RAILWAY_TOKEN", required: false, present: true, category: "deployment" },
    { name: "VERCEL_TOKEN", required: false, present: false, category: "deployment" },
    { name: "JWT_SECRET", required: true, present: true, category: "security" },
    { name: "ENCRYPTION_KEY", required: true, present: true, category: "security" },
    { name: "D3VONN_TENANT_MODE", required: true, present: true, category: "platform" },
  ];

  const presentCount = envVars.filter((v) => v.present).length;
  const requiredMissing = envVars.filter((v) => v.required && !v.present);

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Environment Variables</h3>
          <span className="text-sm text-gray-400">
            {presentCount}/{envVars.length} configured
          </span>
        </div>

        {requiredMissing.length > 0 && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm font-medium">
              {requiredMissing.length} required variable(s) missing
            </p>
          </div>
        )}

        <div className="space-y-2">
          {envVars.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/50"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    v.present ? "bg-green-400" : v.required ? "bg-red-400" : "bg-yellow-400"
                  }`}
                />
                <code className="text-sm font-mono text-gray-300">{v.name}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">{v.category}</span>
                {v.required && (
                  <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded">
                    required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Secrets Tab
// ─────────────────────────────────────────────────────────────────

function SecretsTab() {
  const auditResult = {
    score: 100,
    findings: 0,
    rotationCompliant: 5,
    rotationOverdue: 1,
    lastScan: "2026-06-30T09:00:00Z",
  };

  const rotationPolicies = [
    { name: "OpenAI API Key", status: "clean", lastRotated: "2026-04-01", nextRotation: "2026-07-01" },
    { name: "Supabase Service Key", status: "clean", lastRotated: "2026-01-15", nextRotation: "2026-07-15" },
    { name: "JWT Secret", status: "clean", lastRotated: "2026-01-01", nextRotation: "2027-01-01" },
    { name: "Database Credentials", status: "clean", lastRotated: "2026-05-01", nextRotation: "2026-07-30" },
    { name: "Pinecone API Key", status: "clean", lastRotated: "2026-03-01", nextRotation: "2026-09-01" },
    { name: "Sentry Auth Token", status: "warning", lastRotated: "2025-06-30", nextRotation: "2026-06-30" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Secrets Audit</h3>
          <span className={`text-sm font-medium ${auditResult.score === 100 ? "text-green-400" : "text-red-400"}`}>
            Score: {auditResult.score}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{auditResult.findings}</div>
            <div className="text-xs text-gray-500">Findings</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{auditResult.rotationCompliant}</div>
            <div className="text-xs text-gray-500">Compliant</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{auditResult.rotationOverdue}</div>
            <div className="text-xs text-gray-500">Due Soon</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Rotation Policies</h3>
        <div className="space-y-2">
          {rotationPolicies.map((policy) => (
            <div key={policy.name} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/50">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${policy.status === "clean" ? "bg-green-400" : "bg-yellow-400"}`} />
                <span className="text-sm text-gray-300">{policy.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                Next: {policy.nextRotation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Release Tab
// ─────────────────────────────────────────────────────────────────

function ReleaseTab() {
  const phases = [
    {
      name: "Pre-Deploy",
      items: [
        { name: "All tests passing", status: "completed" },
        { name: "Build succeeds", status: "completed" },
        { name: "TypeScript type check", status: "completed" },
        { name: "Secrets audit clean", status: "completed" },
        { name: "Environment validated", status: "completed" },
        { name: "DB migrations reviewed", status: "completed" },
        { name: "Rollback plan prepared", status: "completed" },
        { name: "Readiness score >= 90", status: "completed" },
        { name: "Team notified", status: "pending" },
      ],
    },
    {
      name: "Deploy",
      items: [
        { name: "Deploy to staging", status: "pending" },
        { name: "Staging smoke tests", status: "pending" },
        { name: "Staging sign-off", status: "pending" },
        { name: "Deploy to production", status: "pending" },
        { name: "Run DB migrations", status: "pending" },
      ],
    },
    {
      name: "Post-Deploy",
      items: [
        { name: "Health checks passing", status: "pending" },
        { name: "Sentry release created", status: "pending" },
        { name: "Monitor error rates", status: "pending" },
        { name: "Event bus healthy", status: "pending" },
        { name: "Agent mesh responding", status: "pending" },
      ],
    },
    {
      name: "Verification",
      items: [
        { name: "Production smoke tests", status: "pending" },
        { name: "Tenant isolation verified", status: "pending" },
        { name: "RBAC enforcement verified", status: "pending" },
        { name: "Deployment sign-off", status: "pending" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <div key={phase.name} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">{phase.name}</h3>
          <div className="space-y-2">
            {phase.items.map((item) => (
              <div key={item.name} className="flex items-center gap-3 py-1">
                <span className={`text-lg ${item.status === "completed" ? "text-green-400" : "text-gray-600"}`}>
                  {item.status === "completed" ? "✓" : "○"}
                </span>
                <span className={`text-sm ${item.status === "completed" ? "text-gray-300" : "text-gray-500"}`}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Rollback Tab
// ─────────────────────────────────────────────────────────────────

function RollbackTab() {
  const rollbackPlan = {
    strategy: "blue-green",
    currentVersion: "2.0.0-alpha.1",
    targetVersion: "1.9.2",
    status: "ready",
    estimatedDuration: "3m 45s",
    riskLevel: "medium",
    triggers: [
      { name: "Error rate > 5%", enabled: true },
      { name: "P95 latency > 5s", enabled: true },
      { name: "Health check failures >= 3", enabled: true },
      { name: "DLQ spike > 50", enabled: true },
    ],
    steps: [
      "Notify team",
      "Pause event bus",
      "Switch traffic to green",
      "Verify green health",
      "Drain blue connections",
      "Resume event bus",
      "Verify system health",
      "Post-rollback notification",
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Active Rollback Plan</h3>
          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded capitalize">
            {rollbackPlan.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">Strategy</div>
            <div className="text-sm font-medium text-blue-400 capitalize">{rollbackPlan.strategy}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">Target</div>
            <div className="text-sm font-medium text-gray-300">{rollbackPlan.targetVersion}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">Duration</div>
            <div className="text-sm font-medium text-gray-300">{rollbackPlan.estimatedDuration}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">Risk</div>
            <div className="text-sm font-medium text-yellow-400 capitalize">{rollbackPlan.riskLevel}</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Auto-Triggers</h3>
        <div className="space-y-2">
          {rollbackPlan.triggers.map((trigger) => (
            <div key={trigger.name} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/50">
              <span className="text-sm text-gray-300">{trigger.name}</span>
              <span className={`text-xs ${trigger.enabled ? "text-green-400" : "text-gray-500"}`}>
                {trigger.enabled ? "Armed" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Rollback Steps</h3>
        <div className="space-y-2">
          {rollbackPlan.steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3 py-1">
              <span className="text-xs text-gray-600 w-6 text-right">{i + 1}.</span>
              <span className="text-sm text-gray-400">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Readiness Tab
// ─────────────────────────────────────────────────────────────────

function ReadinessTab() {
  const categories = [
    { name: "Infrastructure", score: 88, maxScore: 100 },
    { name: "Security", score: 100, maxScore: 100 },
    { name: "Observability", score: 90, maxScore: 100 },
    { name: "Data", score: 93, maxScore: 100 },
    { name: "Reliability", score: 100, maxScore: 100 },
    { name: "Performance", score: 85, maxScore: 100 },
    { name: "Compliance", score: 100, maxScore: 100 },
  ];

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Production Readiness Scorecard</h3>
          <div className="text-right">
            <div className={`text-3xl font-bold ${overallScore >= 90 ? "text-green-400" : "text-yellow-400"}`}>
              {overallScore}%
            </div>
            <div className="text-xs text-gray-500">
              Gate: {overallScore >= 90 ? "PASS" : "FAIL"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{cat.name}</span>
                <span className={cat.score >= 90 ? "text-green-400" : "text-yellow-400"}>
                  {cat.score}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    cat.score >= 90 ? "bg-green-500" : cat.score >= 70 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────

function StatusCard({
  title,
  value,
  status,
  subtitle,
}: {
  title: string;
  value: string;
  status: "healthy" | "warning" | "critical" | "info";
  subtitle: string;
}) {
  const colors = {
    healthy: "border-green-700 bg-green-900/20",
    warning: "border-yellow-700 bg-yellow-900/20",
    critical: "border-red-700 bg-red-900/20",
    info: "border-blue-700 bg-blue-900/20",
  };

  const textColors = {
    healthy: "text-green-400",
    warning: "text-yellow-400",
    critical: "text-red-400",
    info: "text-blue-400",
  };

  return (
    <div className={`rounded-xl p-4 border ${colors[status]}`}>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${textColors[status]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function ActionButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

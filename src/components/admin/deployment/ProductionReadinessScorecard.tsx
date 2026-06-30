import React from "react";

interface ReadinessCategory {
  name: string;
  checks: ReadinessCheck[];
}

interface ReadinessCheck {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  score: number;
  maxScore: number;
  details?: string;
}

const READINESS_CATEGORIES: ReadinessCategory[] = [
  {
    name: "Infrastructure",
    checks: [
      { name: "Required env vars present", status: "pass", score: 10, maxScore: 10 },
      { name: "Supabase configured", status: "pass", score: 10, maxScore: 10 },
      { name: "Sentry configured", status: "pass", score: 10, maxScore: 10 },
      { name: "Pinecone configured", status: "fail", score: 0, maxScore: 10, details: "PINECONE_API_KEY missing" },
      { name: "Railway/Vercel vars mapped", status: "warn", score: 5, maxScore: 10, details: "Vercel token missing" },
    ],
  },
  {
    name: "Security",
    checks: [
      { name: "No secret values committed", status: "pass", score: 15, maxScore: 15 },
      { name: "RLS enabled", status: "pass", score: 10, maxScore: 10 },
      { name: "Tenant isolation enabled", status: "pass", score: 10, maxScore: 10 },
      { name: "RBAC enforcer active", status: "pass", score: 10, maxScore: 10 },
      { name: "JWT secret configured", status: "pass", score: 5, maxScore: 5 },
    ],
  },
  {
    name: "Observability",
    checks: [
      { name: "Sentry error tracking", status: "pass", score: 10, maxScore: 10 },
      { name: "Structured logging active", status: "pass", score: 10, maxScore: 10 },
      { name: "Metrics collection", status: "pass", score: 10, maxScore: 10 },
      { name: "Alert rules configured", status: "pass", score: 10, maxScore: 10 },
      { name: "Health checks registered", status: "pass", score: 10, maxScore: 10 },
    ],
  },
  {
    name: "Data",
    checks: [
      { name: "Database migrations applied", status: "pass", score: 10, maxScore: 10 },
      { name: "Backup strategy configured", status: "warn", score: 5, maxScore: 10, details: "Manual backup only" },
      { name: "Event store persistence", status: "pass", score: 10, maxScore: 10 },
      { name: "Agent memory isolation", status: "pass", score: 10, maxScore: 10 },
    ],
  },
  {
    name: "Reliability",
    checks: [
      { name: "Event bus healthy", status: "pass", score: 10, maxScore: 10 },
      { name: "DLQ empty or acknowledged", status: "pass", score: 10, maxScore: 10 },
      { name: "Rollback target available", status: "pass", score: 10, maxScore: 10 },
      { name: "Circuit breakers configured", status: "pass", score: 10, maxScore: 10 },
    ],
  },
  {
    name: "Performance",
    checks: [
      { name: "Build time < 30s", status: "pass", score: 10, maxScore: 10 },
      { name: "Bundle size < 5MB", status: "pass", score: 10, maxScore: 10 },
      { name: "P95 latency < 2s", status: "pass", score: 10, maxScore: 10 },
      { name: "Memory usage < 512MB", status: "warn", score: 5, maxScore: 10, details: "Currently at 480MB" },
    ],
  },
  {
    name: "Compliance",
    checks: [
      { name: "All tests passing", status: "pass", score: 15, maxScore: 15 },
      { name: "Type check clean", status: "pass", score: 10, maxScore: 10 },
      { name: "Lint errors = 0", status: "pass", score: 5, maxScore: 5 },
      { name: "Security policies enforced", status: "pass", score: 10, maxScore: 10 },
    ],
  },
];

export default function ProductionReadinessScorecard() {
  const totalScore = READINESS_CATEGORIES.reduce(
    (sum, cat) => sum + cat.checks.reduce((s, c) => s + c.score, 0),
    0
  );
  const maxScore = READINESS_CATEGORIES.reduce(
    (sum, cat) => sum + cat.checks.reduce((s, c) => s + c.maxScore, 0),
    0
  );
  const percentage = Math.round((totalScore / maxScore) * 100);
  const gatePass = percentage >= 90;

  const statusIcons = {
    pass: "✅",
    fail: "❌",
    warn: "⚠️",
    skip: "⏭️",
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className={`bg-gray-900 rounded-xl p-6 border ${gatePass ? "border-green-800" : "border-red-800"}`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Production Readiness Scorecard</h2>
            <p className="text-sm text-gray-400">
              Gate threshold: 90% | Status: {gatePass ? "PASS" : "FAIL"}
            </p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${gatePass ? "text-green-400" : "text-red-400"}`}>
              {percentage}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {totalScore}/{maxScore} points
            </div>
          </div>
        </div>

        {/* Category Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {READINESS_CATEGORIES.map((cat) => {
            const catScore = cat.checks.reduce((s, c) => s + c.score, 0);
            const catMax = cat.checks.reduce((s, c) => s + c.maxScore, 0);
            const catPct = Math.round((catScore / catMax) * 100);
            return (
              <div key={cat.name} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${catPct >= 90 ? "text-green-400" : catPct >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                  {catPct}%
                </div>
                <div className="text-xs text-gray-500 mt-1">{cat.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Categories */}
      {READINESS_CATEGORIES.map((cat) => {
        const catScore = cat.checks.reduce((s, c) => s + c.score, 0);
        const catMax = cat.checks.reduce((s, c) => s + c.maxScore, 0);

        return (
          <div key={cat.name} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{cat.name}</h3>
              <span className="text-sm text-gray-400">
                {catScore}/{catMax}
              </span>
            </div>
            <div className="space-y-2">
              {cat.checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{statusIcons[check.status]}</span>
                    <div>
                      <span className="text-sm text-gray-300">{check.name}</span>
                      {check.details && (
                        <p className="text-xs text-gray-500">{check.details}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-mono ${
                    check.score === check.maxScore ? "text-green-400" : check.score > 0 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {check.score}/{check.maxScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

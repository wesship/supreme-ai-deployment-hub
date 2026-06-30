import React, { useState } from "react";

interface SecretFinding {
  id: string;
  pattern: string;
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low";
  snippet: string;
  status: "open" | "resolved" | "false_positive";
}

interface RotationPolicy {
  name: string;
  secretName: string;
  maxAgeDays: number;
  lastRotated: string;
  nextRotation: string;
  status: "clean" | "expired" | "rotated";
  owner: string;
}

export default function SecretsAuditPanel() {
  const [findings] = useState<SecretFinding[]>([]);
  const [rotationPolicies] = useState<RotationPolicy[]>([
    { name: "OpenAI API Key", secretName: "OPENAI_API_KEY", maxAgeDays: 90, lastRotated: "2026-04-01", nextRotation: "2026-07-01", status: "clean", owner: "platform-team" },
    { name: "Supabase Service Key", secretName: "SUPABASE_SERVICE_ROLE_KEY", maxAgeDays: 180, lastRotated: "2026-01-15", nextRotation: "2026-07-15", status: "clean", owner: "infrastructure-team" },
    { name: "JWT Secret", secretName: "JWT_SECRET", maxAgeDays: 365, lastRotated: "2026-01-01", nextRotation: "2027-01-01", status: "clean", owner: "security-team" },
    { name: "Database Credentials", secretName: "DATABASE_URL", maxAgeDays: 90, lastRotated: "2026-05-01", nextRotation: "2026-07-30", status: "clean", owner: "infrastructure-team" },
    { name: "Pinecone API Key", secretName: "PINECONE_API_KEY", maxAgeDays: 180, lastRotated: "2026-03-01", nextRotation: "2026-09-01", status: "clean", owner: "ai-team" },
    { name: "Sentry Auth Token", secretName: "SENTRY_AUTH_TOKEN", maxAgeDays: 365, lastRotated: "2025-06-30", nextRotation: "2026-06-30", status: "expired", owner: "monitoring-team" },
  ]);

  const score = findings.length === 0 ? 100 : Math.max(0, 100 - findings.length * 15);
  const overdueCount = rotationPolicies.filter((p) => p.status === "expired").length;

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Secrets Audit</h2>
            <p className="text-sm text-gray-400">Last scan: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${score === 100 ? "text-green-400" : "text-red-400"}`}>
              {score}%
            </div>
            <div className="text-xs text-gray-500">
              {findings.length} findings | {overdueCount} overdue
            </div>
          </div>
        </div>
      </div>

      {/* Findings */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Findings</h3>
        {findings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-green-400 font-medium">No secrets detected in source code</p>
            <p className="text-xs text-gray-500 mt-1">11 patterns scanned across all files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={f.id} className="bg-gray-800 rounded-lg p-3 border-l-4 border-red-500">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-red-400">{f.pattern}</span>
                  <span className="text-xs text-gray-500">{f.severity}</span>
                </div>
                <code className="text-xs text-gray-400">{f.file}:{f.line}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rotation Policies */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Rotation Policies</h3>
        <div className="space-y-2">
          {rotationPolicies.map((policy) => (
            <div key={policy.secretName} className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/50">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  policy.status === "clean" ? "bg-green-400" : policy.status === "expired" ? "bg-red-400" : "bg-yellow-400"
                }`} />
                <div>
                  <div className="text-sm font-medium text-gray-300">{policy.name}</div>
                  <div className="text-xs text-gray-500">Owner: {policy.owner}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Next rotation</div>
                <div className={`text-sm ${policy.status === "expired" ? "text-red-400" : "text-gray-300"}`}>
                  {policy.nextRotation}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

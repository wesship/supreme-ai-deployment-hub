import React from "react";

interface EnvVar {
  name: string;
  required: boolean;
  present: boolean;
  category: string;
  description?: string;
}

interface EnvironmentStatusPanelProps {
  environment?: string;
  variables?: EnvVar[];
}

const DEFAULT_VARS: EnvVar[] = [
  { name: "SUPABASE_URL", required: true, present: true, category: "infrastructure", description: "Supabase project URL" },
  { name: "SUPABASE_ANON_KEY", required: true, present: true, category: "infrastructure", description: "Supabase anonymous key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, present: true, category: "infrastructure", description: "Supabase service role key" },
  { name: "OPENAI_API_KEY", required: true, present: true, category: "ai", description: "OpenAI API key for agent LLM" },
  { name: "PINECONE_API_KEY", required: true, present: false, category: "ai", description: "Pinecone vector DB key" },
  { name: "PINECONE_ENVIRONMENT", required: true, present: false, category: "ai", description: "Pinecone environment" },
  { name: "PINECONE_INDEX", required: true, present: false, category: "ai", description: "Pinecone index name" },
  { name: "SENTRY_DSN", required: true, present: true, category: "observability", description: "Sentry error tracking DSN" },
  { name: "RAILWAY_TOKEN", required: false, present: true, category: "deployment", description: "Railway deployment token" },
  { name: "VERCEL_TOKEN", required: false, present: false, category: "deployment", description: "Vercel deployment token" },
  { name: "JWT_SECRET", required: true, present: true, category: "security", description: "JWT signing secret" },
  { name: "ENCRYPTION_KEY", required: true, present: true, category: "security", description: "Data encryption key" },
  { name: "D3VONN_TENANT_MODE", required: true, present: true, category: "platform", description: "Multi-tenant mode" },
  { name: "D3VONN_EVENT_BUS_MODE", required: false, present: true, category: "platform", description: "Event bus mode" },
  { name: "REDIS_URL", required: false, present: false, category: "infrastructure", description: "Redis connection URL" },
];

export default function EnvironmentStatusPanel({
  environment = "production",
  variables = DEFAULT_VARS,
}: EnvironmentStatusPanelProps) {
  const categories = [...new Set(variables.map((v) => v.category))];
  const presentCount = variables.filter((v) => v.present).length;
  const requiredMissing = variables.filter((v) => v.required && !v.present);
  const score = Math.round((presentCount / variables.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Environment Status</h2>
          <p className="text-sm text-gray-400">Target: {environment}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {score}%
          </div>
          <div className="text-xs text-gray-500">{presentCount}/{variables.length} configured</div>
        </div>
      </div>

      {/* Missing Required Alert */}
      {requiredMissing.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <h4 className="text-red-400 font-medium text-sm mb-2">
            Missing Required Variables ({requiredMissing.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {requiredMissing.map((v) => (
              <code key={v.name} className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
                {v.name}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Variables by Category */}
      {categories.map((category) => (
        <div key={category} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            {category}
          </h3>
          <div className="space-y-1">
            {variables
              .filter((v) => v.category === category)
              .map((v) => (
                <div key={v.name} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${v.present ? "bg-green-400" : v.required ? "bg-red-400" : "bg-gray-600"}`} />
                    <div>
                      <code className="text-sm font-mono text-gray-300">{v.name}</code>
                      {v.description && <p className="text-xs text-gray-600">{v.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.required && (
                      <span className="text-xs text-purple-400">required</span>
                    )}
                    <span className={`text-xs ${v.present ? "text-green-400" : "text-red-400"}`}>
                      {v.present ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

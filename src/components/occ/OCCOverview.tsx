import { Activity, AlertTriangle, Bot, CheckCircle, Clock, DollarSign, FileText, Zap } from 'lucide-react';
import type { OCCStats } from '@/hooks/useOCCData';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
}

function StatCard({ label, value, sub, icon, accent = 'blue' }: StatCardProps) {
  const colors = {
    green: 'border-green-500/40 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/40 bg-red-500/5 text-red-400',
    blue: 'border-blue-500/40 bg-blue-500/5 text-blue-400',
    purple: 'border-purple-500/40 bg-purple-500/5 text-purple-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[accent]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
        <span className="opacity-60">{icon}</span>
      </div>
      <p className="text-3xl font-bold font-mono text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

interface OCCOverviewProps {
  stats: OCCStats;
  lastRefreshed: Date | null;
}

export default function OCCOverview({ stats, lastRefreshed }: OCCOverviewProps) {
  const formatCost = (usd: number) =>
    usd < 0.01 ? `$${(usd * 100).toFixed(4)}¢` : `$${usd.toFixed(4)}`;

  const formatTokens = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">System Overview</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Real-time metrics from the DEVONN production backend
          </p>
        </div>
        {lastRefreshed && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated {lastRefreshed.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="AI Requests"
          value={stats.totalAIRequests}
          sub="last 100 logged"
          icon={<Zap className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Tokens Used"
          value={formatTokens(stats.totalTokensUsed)}
          sub="cumulative"
          icon={<Activity className="h-5 w-5" />}
          accent="purple"
        />
        <StatCard
          label="Total Cost"
          value={formatCost(stats.totalCostUsd)}
          sub="USD"
          icon={<DollarSign className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Active Agents"
          value={stats.activeAgents}
          sub="running now"
          icon={<Bot className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Unresolved Errors"
          value={stats.unresolvedErrors}
          sub="needs attention"
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.unresolvedErrors > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Pending Approvals"
          value={stats.pendingApprovals}
          sub="awaiting review"
          icon={<CheckCircle className="h-5 w-5" />}
          accent={stats.pendingApprovals > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          label="RAG Documents"
          value={stats.totalRAGDocs}
          sub="in knowledge base"
          icon={<FileText className="h-5 w-5" />}
          accent="purple"
        />
      </div>

      {/* Status Banner */}
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
        <div>
          <p className="text-sm font-medium text-green-400">Production Backend Online</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="font-mono">https://api.d3vonn.io</span>
            {' · '}All systems operational
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * LiveStatsBar — replaces the static stats bar with live data from the
 * public API. Shows real active agents, completed workflows, and system
 * health metrics. Falls back to placeholder values gracefully.
 */
import React from 'react';
import { usePublicStats } from '@/hooks/usePublicStats';

const LiveStatsBar: React.FC = () => {
  const { stats, isLive } = usePublicStats();

  const displayStats = [
    { value: `${stats.uptimePercent}%`, label: 'System Uptime' },
    { value: String(stats.activeAgents), label: 'Active Agents' },
    { value: '256-bit', label: 'End-to-End Encryption' },
    {
      value: stats.completedWorkflows >= 1000
        ? `${(stats.completedWorkflows / 1000).toFixed(1)}K`
        : String(stats.completedWorkflows),
      label: 'Workflows Completed',
    },
    {
      value: stats.systemHealth === 'operational' ? 'Operational' :
             stats.systemHealth === 'degraded' ? 'Degraded' : 'Down',
      label: 'System Health',
    },
  ];

  return (
    <section className="relative border-y border-white/10 bg-[#0a1220]/60 py-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
          {displayStats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
              <p className="mt-1 text-xs text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>
        {isLive && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live data from Hermes
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveStatsBar;

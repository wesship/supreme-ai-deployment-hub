import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  Activity, Bot, CheckCircle2, Workflow, Database, Gauge, HeartPulse, Plus, ArrowRight,
  RefreshCw, AlertTriangle, Clock,
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';
import AppShell from '@/components/app/AppShell';

const Stat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  trend?: string;
  loading?: boolean;
}> = ({ icon: Icon, label, value, trend, loading }) => (
  <div className="d3-chrome-panel d3-command-surface rounded-2xl p-5">
    <div className="flex items-center justify-between">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_20px_rgba(112,128,255,0.4)]">
        <Icon className="h-5 w-5" />
      </div>
      {trend && !loading && (
        <span className="text-[10px] uppercase tracking-widest text-primary/80 max-w-[55%] text-right truncate">
          {trend}
        </span>
      )}
    </div>
    <div className="mt-4 text-3xl font-black text-white">
      {loading ? <Skeleton className="h-8 w-20 bg-white/10" /> : value}
    </div>
    <div className="mt-1 text-xs uppercase tracking-widest text-white/55">{label}</div>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title, children, action,
}) => (
  <div className="d3-chrome-panel rounded-2xl p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </div>
);

const EmptyState: React.FC<{ icon: React.ElementType; label: string; hint?: string }> = ({
  icon: Icon, label, hint,
}) => (
  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
    <Icon className="h-6 w-6 mx-auto text-primary/70" />
    <div className="mt-2 text-sm text-white/80">{label}</div>
    {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
  </div>
);

const LaunchApp: React.FC = () => {
  const {
    loading, error, usingMock, agents, workflows, activity, stats,
    isCheckingHealth, refresh,
  } = useDashboardData();

  const healthPct = stats.systemHealthPct;
  const healthColor =
    healthPct === 100 ? 'text-primary' :
    healthPct >= 60 ? 'text-yellow-300' :
    healthPct > 0 ? 'text-red-300' : 'text-white/60';

  return (
    <AppShell>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(112,128,255,0.18),transparent_40%),linear-gradient(180deg,#02030a_0%,#070817_100%)] text-foreground"
    >
      <Helmet>
        <title>Launch App — D3VONN.IO Command Dashboard</title>
        <meta name="description" content="Your D3VONN.IO command dashboard — active agents, workflows, knowledge vault, and system health at a glance." />
        <link rel="canonical" href="https://d3vonn.io/app" />
        <meta property="og:title" content="Launch App — D3VONN.IO" />
        <meta property="og:description" content="Active agents, workflows, knowledge vault, and system health at a glance." />
        <meta property="og:url" content="https://d3vonn.io/app" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://d3vonn.io/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Launch App — D3VONN.IO" />
        <meta name="twitter:description" content="Active agents, workflows, knowledge vault, and system health at a glance." />
        <meta name="twitter:image" content="https://d3vonn.io/og-image.png" />
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-primary shadow-[0_0_18px_rgba(112,128,255,0.35)]">
              <Activity className="h-3 w-3" aria-hidden="true" /> Mission control
              {usingMock && <span className="ml-1 text-white/60">· demo data</span>}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white">
              Executive <span className="text-primary">Command Center</span>
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Govern your AI workforce, business operations, automation, knowledge, and infrastructure from one operational view.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-background/40 px-3 py-2 text-xs font-semibold text-primary hover:border-primary/60 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading || isCheckingHealth ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/agents"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_rgba(112,128,255,0.55)] hover:scale-[1.02] transition"
            >
              <Plus className="h-4 w-4" /> Add agent
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Live data unavailable — showing demo values.</div>
              <div className="text-xs text-yellow-100/80 mt-1 break-all">{error}</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat
            icon={Bot}
            label="Active agents"
            value={stats.activeAgents.toLocaleString()}
            trend={stats.activeAgentsTrend}
            loading={loading}
          />
          <Stat
            icon={CheckCircle2}
            label="Tasks completed"
            value={stats.tasksCompleted.toLocaleString()}
            trend={stats.tasksCompletedTrend}
            loading={loading}
          />
          <Stat
            icon={Workflow}
            label="Workflows running"
            value={stats.workflowsRunning.toLocaleString()}
            trend={stats.workflowsTrend}
            loading={loading}
          />
          <Stat
            icon={HeartPulse}
            label="System health"
            value={<span className={healthColor}>{healthPct}%</span>}
            trend={stats.systemHealthLabel}
            loading={loading && healthPct === 0}
          />
        </div>

        {/* Main grid */}
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Active agents */}
          <div className="xl:col-span-2">
            <Panel
              title="Active agents"
              action={
                <Link to="/agents" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-xl" />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <EmptyState icon={Bot} label="No agents deployed yet" hint="Click “Add agent” to deploy your first one." />
              ) : (
                <div className="space-y-3">
                  {agents.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">{a.name}</div>
                            <div className="text-xs text-white/55 truncate">{a.status}</div>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-primary/80 border border-primary/30 rounded-full px-2 py-0.5 flex-shrink-0">
                          {a.tag}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(112,128,255,0.8)]"
                          style={{ width: `${a.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Recent activity */}
          <Panel
            title="Recent activity"
            action={
              <Link to="/agents" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                Logs <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState icon={Clock} label="No activity yet" hint="Agent events will stream in here." />
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                    <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                      a.status === 'failed' || a.status === 'error'
                        ? 'bg-red-400'
                        : a.status === 'completed' || a.status === 'success'
                        ? 'bg-primary'
                        : 'bg-yellow-300'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-white truncate">
                        <span className="font-medium">{a.agent_name ?? 'system'}</span>
                        <span className="text-white/55"> · {a.event_type}</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40">
                        {new Date(a.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Workflows */}
          <div className="xl:col-span-2">
            <Panel
              title="Workflows running"
              action={
                <Link to="/workflows" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              {loading ? (
                <Skeleton className="h-40 w-full bg-white/5 rounded-xl" />
              ) : workflows.length === 0 ? (
                <EmptyState icon={Workflow} label="No workflows defined" hint="Create one in /workflows to see runs here." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead className="bg-black/40 text-[10px] uppercase tracking-widest text-white/55">
                      <tr>
                        <th className="text-left px-4 py-3">Workflow</th>
                        <th className="text-left px-4 py-3">Runs (24h)</th>
                        <th className="text-left px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflows.map((w) => (
                        <tr key={w.id} className="border-t border-white/10">
                          <td className="px-4 py-3 text-white font-medium">{w.name}</td>
                          <td className="px-4 py-3 text-white/75">{w.runs}</td>
                          <td className="px-4 py-3">
                            <span className={
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest border ' +
                              (w.status === 'Healthy'
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : w.status === 'Failed'
                                ? 'bg-red-500/15 text-red-200 border-red-400/30'
                                : 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30')
                            }>
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {/* System health detail */}
          <Panel title="System health">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_24px_rgba(112,128,255,0.4)]">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <div className={`text-2xl font-black ${healthColor}`}>{healthPct}%</div>
                <div className="text-xs uppercase tracking-widest text-white/55">
                  {stats.systemHealthLabel}
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {agents.slice(0, 4).map((a) => (
                <div key={`hp-${a.id}`}>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="truncate pr-2">{a.name}</span>
                    <span>{a.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(112,128,255,0.8)]"
                      style={{ width: `${a.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              {agents.length === 0 && !loading && (
                <div className="text-xs text-white/50">Health metrics appear once agents are deployed.</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </motion.div>
    </AppShell>
  );
};

export default LaunchApp;

/**
 * LiveStatsCommandCenter — replaces the hardcoded Command Center preview
 * with live data from the Hermes/OCC backend. Falls back gracefully to
 * placeholder values when the API is unreachable.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Wifi, WifiOff } from 'lucide-react';
import SmartLaunchLink from '@/components/SmartLaunchLink';
import { usePublicStats } from '@/hooks/usePublicStats';

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={
      'relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl ' +
      'shadow-[0_0_40px_-12px_rgba(56,136,255,0.25)] transition-all duration-300 ' +
      'hover:border-blue-500/40 hover:shadow-[0_0_60px_-8px_rgba(56,136,255,0.45)] hover:-translate-y-0.5 ' +
      className
    }
  >
    {children}
  </div>
);

const LiveStatsCommandCenter: React.FC = () => {
  const { stats, isLive, lastUpdated } = usePublicStats();

  const metricCards = [
    { k: 'Agents online', v: String(stats.activeAgents) },
    { k: 'Tasks processed', v: stats.totalTasksProcessed >= 1000 ? `${(stats.totalTasksProcessed / 1000).toFixed(1)}K` : String(stats.totalTasksProcessed) },
    { k: 'System uptime', v: `${stats.uptimePercent}%` },
  ];

  // Map latest events to agent activity display
  const agentActivity = stats.latestEvents.length > 0
    ? stats.latestEvents.slice(0, 4).map((evt) => ({
        name: evt.agent_id?.replace(/-/g, ' ').slice(0, 20) || 'Agent',
        status: evt.event_type === 'started' ? 'Running' :
                evt.event_type === 'completed' ? 'Complete' :
                evt.event_type === 'failed' ? 'Error' : 'Processing',
        pct: evt.event_type === 'completed' ? 100 :
             evt.event_type === 'failed' ? 15 :
             Math.floor(Math.random() * 60) + 30,
      }))
    : [
        { name: 'Atlas Researcher', status: 'Synthesizing', pct: 72 },
        { name: 'Helios Sales', status: 'Dispatching', pct: 46 },
        { name: 'Vault Sentinel', status: 'Scanning', pct: 91 },
        { name: 'Forge Engineer', status: 'Deploying', pct: 33 },
      ];

  return (
    <section id="command-center" className="relative py-24 scroll-mt-24">
      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">Command Center</p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            One console. <span className="text-blue-400">Total control.</span>
          </h2>
          <p className="mt-4 text-base text-white/70">
            Supervise every agent, workflow, and signal in real time — with surgical precision.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            {[
              'Live agent supervision with intervention controls',
              'Cross-mesh telemetry from Hermes Intelligence',
              'Hot-swap models, prompts, and tools mid-run',
              'Encrypted audit trails for every decision',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(56,136,255,0.8)]" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Link
              to="/occ"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.4)] hover:scale-[1.02] transition"
            >
              Open Command Center <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/command-center"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Tour the console
            </Link>
          </div>
        </div>

        {/* Live dashboard panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <GlassCard className="relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-emerald-400">
                    <Wifi className="h-3 w-3" /> Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/40">
                    <WifiOff className="h-3 w-3" /> Demo
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-widest text-white/50">d3vonn / occ</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {metricCards.map((s) => (
                <div key={s.k} className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="text-xl font-bold text-blue-400">{s.v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">{s.k}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              {agentActivity.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{agent.name}</span>
                    <span className="text-white/60">{agent.status}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 shadow-[0_0_10px_rgba(56,136,255,0.8)] transition-all duration-1000"
                      style={{ width: `${agent.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {lastUpdated && (
              <div className="mt-4 text-[9px] text-white/30 text-right">
                Last sync: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
};

export default LiveStatsCommandCenter;

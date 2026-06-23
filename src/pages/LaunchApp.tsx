import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  Activity, Bot, CheckCircle2, Workflow, Database, Gauge, HeartPulse, Plus, ArrowRight,
} from 'lucide-react';

const Stat: React.FC<{ icon: React.ElementType; label: string; value: string; trend?: string }> = ({
  icon: Icon, label, value, trend,
}) => (
  <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-[0_0_40px_-12px_rgba(112,128,255,0.35)] hover:border-primary/40 transition">
    <div className="flex items-center justify-between">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_20px_rgba(112,128,255,0.4)]">
        <Icon className="h-5 w-5" />
      </div>
      {trend && <span className="text-[10px] uppercase tracking-widest text-emerald-400">{trend}</span>}
    </div>
    <div className="mt-4 text-3xl font-black text-white">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-widest text-white/55">{label}</div>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title, children, action,
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_0_40px_-12px_rgba(112,128,255,0.35)]">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </div>
);

const agents = [
  { name: 'Atlas Researcher', status: 'Synthesizing', pct: 72, tag: 'Knowledge' },
  { name: 'Helios Sales',     status: 'Dispatching',  pct: 46, tag: 'Revenue' },
  { name: 'Vault Sentinel',   status: 'Scanning',     pct: 91, tag: 'Security' },
  { name: 'Forge Engineer',   status: 'Deploying',    pct: 33, tag: 'Engineering' },
];

const workflows = [
  { name: 'Daily intel digest',   runs: 142, status: 'Healthy' },
  { name: 'Lead enrichment',      runs:  88, status: 'Healthy' },
  { name: 'Security sweep',       runs:  56, status: 'Healthy' },
  { name: 'Release deploy',       runs:  12, status: 'Queued' },
];

const LaunchApp: React.FC = () => {
  return (
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
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      <div className="container mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-primary shadow-[0_0_18px_rgba(112,128,255,0.35)]">
              <Activity className="h-3 w-3" /> Live Dashboard
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white">
              D3VONN <span className="text-primary">Command</span>
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Your AI workforce at a glance — real-time activity across agents, workflows, and the vault.
            </p>
          </div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_rgba(112,128,255,0.55)] hover:scale-[1.02] transition"
          >
            <Plus className="h-4 w-4" /> Add new agent
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Bot}          label="Active agents"     value="24"   trend="+3 today" />
          <Stat icon={CheckCircle2} label="Tasks completed"   value="1,284" trend="+128 / 24h" />
          <Stat icon={Workflow}     label="Workflows running" value="9"    trend="0 errors" />
          <Stat icon={HeartPulse}   label="System health"     value="99.98%" trend="All green" />
        </div>

        {/* Main grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active agents */}
          <div className="lg:col-span-2">
            <Panel
              title="Active agents"
              action={
                <Link to="/agents" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="space-y-3">
                {agents.map((a) => (
                  <div key={a.name} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{a.name}</div>
                          <div className="text-xs text-white/55">{a.status}</div>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-primary/80 border border-primary/30 rounded-full px-2 py-0.5">
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
            </Panel>
          </div>

          {/* Knowledge vault */}
          <Panel
            title="Knowledge Vault"
            action={
              <Link to="/occ" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_24px_rgba(112,128,255,0.4)]">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">4,812</div>
                <div className="text-xs uppercase tracking-widest text-white/55">Memory shards</div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-white/75">
              <li className="flex justify-between"><span>Encrypted at rest</span><span className="text-emerald-400">AES-GCM</span></li>
              <li className="flex justify-between"><span>RAG indices</span><span className="text-white">12</span></li>
              <li className="flex justify-between"><span>Last sync</span><span className="text-white/60">2m ago</span></li>
            </ul>
          </Panel>

          {/* Workflows */}
          <div className="lg:col-span-2">
            <Panel
              title="Workflows running"
              action={
                <Link to="/workflows" className="text-xs font-semibold text-primary hover:text-white transition inline-flex items-center gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-[10px] uppercase tracking-widest text-white/55">
                    <tr>
                      <th className="text-left px-4 py-3">Workflow</th>
                      <th className="text-left px-4 py-3">Runs (24h)</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((w) => (
                      <tr key={w.name} className="border-t border-white/10">
                        <td className="px-4 py-3 text-white font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-white/75">{w.runs}</td>
                        <td className="px-4 py-3">
                          <span className={
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ' +
                            (w.status === 'Healthy'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30')
                          }>
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* Agent performance */}
          <Panel title="Agent performance">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-[0_0_24px_rgba(112,128,255,0.4)]">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">96.4%</div>
                <div className="text-xs uppercase tracking-widest text-white/55">Avg success rate</div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['Atlas',   94],
                ['Helios',  88],
                ['Sentinel',99],
                ['Forge',   91],
              ].map(([name, pct]) => (
                <div key={name as string}>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>{name}</span><span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(112,128,255,0.8)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </motion.div>
  );
};

export default LaunchApp;

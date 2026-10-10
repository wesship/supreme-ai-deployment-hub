import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Brain, Database, Shield, Cpu, Zap, CheckCircle, Clock } from 'lucide-react';

const agents = [
  { name: 'Hermes', role: 'Orchestrator', status: 'active', color: '#00FF41', icon: Brain },
  { name: 'TARS', role: 'Execution Engine', status: 'active', color: '#00BFFF', icon: Cpu },
  { name: 'ION', role: 'Analytics', status: 'active', color: '#FF6B35', icon: Activity },
  { name: 'SAPPHIRE', role: 'Memory Layer', status: 'active', color: '#9B59B6', icon: Database },
  { name: 'GUARDIAN', role: 'Safety & Policy', status: 'active', color: '#E74C3C', icon: Shield },
];

const metrics = [
  { label: 'Tasks Processed', value: '12,847', delta: '+234 today' },
  { label: 'Agent Uptime', value: '99.97%', delta: '30-day avg' },
  { label: 'Avg Latency', value: '142ms', delta: '-18ms vs last week' },
  { label: 'Active Agents', value: '5 / 5', delta: 'All operational' },
];

const HermesStatusSection: React.FC = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-20 bg-black/95 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(#00FF41 1px, transparent 1px), linear-gradient(90deg, #00FF41 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="container max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00FF41]/30 bg-[#00FF41]/5 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" />
            <span className="text-[#00FF41] text-sm font-mono">LIVE SYSTEM STATUS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Hermes Intelligence Fabric
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            A multi-agent orchestration platform where every agent has a role, every task has a state,
            and every decision is observable in real time.
          </p>
        </motion.div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <div className="text-2xl font-bold text-white font-mono mb-1">{metric.value}</div>
              <div className="text-sm text-gray-400 mb-1">{metric.label}</div>
              <div className="text-xs text-[#00FF41]">{metric.delta}</div>
            </motion.div>
          ))}
        </div>

        {/* Agent mesh visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left: Agent cards */}
          <div className="space-y-3">
            {agents.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-white/5 hover:bg-white/8 transition-colors"
                  style={{ borderColor: `${agent.color}30` }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}40` }}>
                    <Icon className="w-5 h-5" style={{ color: agent.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{agent.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ backgroundColor: `${agent.color}15`, color: agent.color }}>
                        {agent.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: agent.color }} />
                    <span className="text-xs font-mono" style={{ color: agent.color }}>ACTIVE</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right: Task state machine diagram */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="text-sm font-mono text-gray-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00FF41]" />
              TASK STATE MACHINE
            </div>
            <div className="space-y-2 font-mono text-sm">
              {[
                { state: 'PENDING', color: '#6B7280', desc: 'Awaiting dispatch' },
                { state: 'LOCKED', color: '#F59E0B', desc: 'Agent claimed' },
                { state: 'RUNNING', color: '#00BFFF', desc: 'Executing' },
                { state: 'COMPLETED', color: '#00FF41', desc: 'Success' },
                { state: 'FAILED', color: '#EF4444', desc: 'Error logged to OCC' },
                { state: 'RETRY', color: '#F97316', desc: 'Auto-retry queued' },
                { state: 'MANUAL_REVIEW', color: '#8B5CF6', desc: 'Escalated to operator' },
                { state: 'ESCALATED', color: '#EC4899', desc: 'Human intervention' },
                { state: 'PAUSED', color: '#6B7280', desc: 'Checkpoint reached' },
              ].map((item, i) => (
                <div key={item.state} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="w-32 flex-shrink-0" style={{ color: item.color }}>{item.state}</span>
                  <span className="text-gray-500 text-xs">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00FF41]" />
              <span className="text-xs text-gray-400">All state transitions logged to OCC dashboard</span>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <a
            href="/occ"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all hover:scale-105"
            style={{ backgroundColor: '#00FF41' }}
          >
            <Activity className="w-4 h-4" />
            Open Operator Command Center
          </a>
          <p className="mt-3 text-xs text-gray-500">Admin access required · Protected by Supabase Auth</p>
        </motion.div>
      </div>
    </section>
  );
};

export default HermesStatusSection;

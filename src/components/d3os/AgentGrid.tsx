import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

type AgentStatus = 'running' | 'idle' | 'queued';

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'var(--os-lime-deep)',
  idle: 'var(--os-chrome-3)',
  queued: 'var(--os-orange)',
};

const AGENTS: Array<{
  name: string;
  role: string;
  status: AgentStatus;
  tasks: number;
  latency: string;
  to: string;
}> = [
  { name: 'Atlas', role: 'Operations analyst', status: 'running', tasks: 1284, latency: '420ms', to: '/agents' },
  { name: 'Vesta', role: 'Revenue & finance', status: 'running', tasks: 902, latency: '515ms', to: '/agents' },
  { name: 'Orion', role: 'Research & briefing', status: 'queued', tasks: 461, latency: '1.2s', to: '/agents' },
  { name: 'Juno', role: 'Customer operations', status: 'running', tasks: 2317, latency: '380ms', to: '/agents' },
  { name: 'Argus', role: 'Security & compliance', status: 'idle', tasks: 188, latency: '610ms', to: '/security' },
  { name: 'Echo', role: 'Voice & vision', status: 'running', tasks: 733, latency: '290ms', to: '/voice-studio' },
];

/** AI workforce cards: status pulse, telemetry, task counters — no shadow on hover. */
const AgentGrid: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {AGENTS.map((agent) => (
      <Link
        key={agent.name}
        to={agent.to}
        className="os-card os-magnetic group cursor-pointer p-4 hover:-translate-y-0.5 md:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="os-chrome flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
              {agent.name.slice(0, 2)}
            </span>
            <div>
              <div className="text-base font-semibold">{agent.name}</div>
              <div className="text-xs text-[color:var(--os-ink-60)]">{agent.role}</div>
            </div>
          </div>
          <ArrowUpRight
            className="h-4 w-4 text-[color:var(--os-ink-40)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {agent.status === 'running' && (
              <span
                className="os-pulse-ring absolute inline-flex h-full w-full rounded-full"
                style={{ background: STATUS_COLOR[agent.status] }}
                aria-hidden="true"
              />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[agent.status] }} />
          </span>
          <span className="os-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--os-ink-60)]">{agent.status}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--os-line-soft)] pt-4">
          <div>
            <dt className="os-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--os-ink-40)]">Tasks</dt>
            <dd className="text-lg font-semibold">{agent.tasks.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="os-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--os-ink-40)]">Avg latency</dt>
            <dd className="text-lg font-semibold">{agent.latency}</dd>
          </div>
        </dl>
      </Link>
    ))}
  </div>
);

export default AgentGrid;

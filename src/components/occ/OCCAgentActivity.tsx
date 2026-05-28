import type { AgentActivityLog } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function EventTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    started: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
    paused: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    resumed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  const cls = map[type?.toLowerCase()] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type}
    </span>
  );
}

interface Props {
  logs: AgentActivityLog[];
}

export default function OCCAgentActivity({ logs }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Agent Activity Logs</h3>
        <p className="text-xs text-gray-400 mt-0.5">Lifecycle events for every agent — started, completed, failed, paused, resumed.</p>
      </div>
      <OCCTable
        rows={logs}
        emptyMessage="No agent activity logged yet."
        columns={[
          {
            key: 'created_at',
            label: 'Time',
            sortable: true,
            width: 'w-40',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'agent_name',
            label: 'Agent',
            sortable: true,
            render: r => (
              <div>
                <span className="text-white">{r.agent_name ?? r.agent_id}</span>
                {r.agent_name && (
                  <span className="text-gray-500 ml-1 text-[10px]">{r.agent_id.slice(0, 8)}</span>
                )}
              </div>
            ),
          },
          {
            key: 'event_type',
            label: 'Event',
            sortable: true,
            render: r => <EventTypeBadge type={r.event_type} />,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: r => <StatusBadge status={r.status} />,
          },
          {
            key: 'tokens_used',
            label: 'Tokens',
            sortable: true,
            render: r => r.tokens_used != null && r.tokens_used > 0
              ? r.tokens_used.toLocaleString()
              : '—',
          },
          {
            key: 'cost_usd',
            label: 'Cost',
            sortable: true,
            render: r => r.cost_usd != null && r.cost_usd > 0
              ? <span className="text-green-300">${Number(r.cost_usd).toFixed(4)}</span>
              : '—',
          },
          {
            key: 'duration_ms',
            label: 'Duration',
            sortable: true,
            render: r => r.duration_ms != null
              ? r.duration_ms >= 60_000
                ? `${(r.duration_ms / 60_000).toFixed(1)}m`
                : `${r.duration_ms}ms`
              : '—',
          },
        ]}
      />
    </div>
  );
}

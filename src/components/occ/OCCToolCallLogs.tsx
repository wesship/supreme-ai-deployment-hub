import type { ToolCallLog } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

interface Props {
  logs: ToolCallLog[];
}

export default function OCCToolCallLogs({ logs }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Tool Call Logs</h3>
        <p className="text-xs text-gray-400 mt-0.5">All agent tool invocations — GitHub, Railway, Supabase, RAG, browser actions, and more.</p>
      </div>
      <OCCTable
        rows={logs}
        emptyMessage="No tool calls logged yet."
        columns={[
          {
            key: 'created_at',
            label: 'Time',
            sortable: true,
            width: 'w-40',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'agent_id',
            label: 'Agent',
            sortable: true,
            render: r => <span className="text-blue-300">{r.agent_id}</span>,
          },
          {
            key: 'tool_name',
            label: 'Tool',
            sortable: true,
            render: r => <span className="text-yellow-300 font-semibold">{r.tool_name}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: r => <StatusBadge status={r.status} />,
          },
          {
            key: 'duration_ms',
            label: 'Duration',
            sortable: true,
            render: r => r.duration_ms != null ? `${r.duration_ms}ms` : '—',
          },
          {
            key: 'session_id',
            label: 'Session',
            render: r => r.session_id
              ? <span className="text-gray-400 truncate max-w-[120px] block" title={r.session_id}>{r.session_id.slice(0, 12)}…</span>
              : <span className="text-gray-600">—</span>,
          },
          {
            key: 'error_message',
            label: 'Error',
            render: r => r.error_message
              ? <span className="text-red-400 truncate max-w-[200px] block" title={r.error_message}>{r.error_message}</span>
              : <span className="text-gray-600">—</span>,
          },
        ]}
      />
    </div>
  );
}

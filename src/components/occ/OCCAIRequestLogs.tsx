import type { AIRequestLog } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtCost(usd: number | null) {
  if (usd == null) return '—';
  return usd < 0.001 ? `<$0.001` : `$${usd.toFixed(4)}`;
}

interface Props {
  logs: AIRequestLog[];
}

export default function OCCAIRequestLogs({ logs }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">AI Request Logs</h3>
        <p className="text-xs text-gray-400 mt-0.5">Every AI model call made through the backend, with token usage and cost.</p>
      </div>
      <OCCTable
        rows={logs}
        emptyMessage="No AI requests logged yet."
        columns={[
          {
            key: 'created_at',
            label: 'Time',
            sortable: true,
            width: 'w-40',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'model',
            label: 'Model',
            sortable: true,
            render: r => <span className="text-purple-300">{r.model}</span>,
          },
          {
            key: 'endpoint',
            label: 'Endpoint',
            render: r => <span className="text-blue-300">{r.endpoint ?? '—'}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: r => <StatusBadge status={r.status} />,
          },
          {
            key: 'total_tokens',
            label: 'Tokens',
            sortable: true,
            render: r => r.total_tokens != null ? (
              <span>
                <span className="text-white">{r.total_tokens.toLocaleString()}</span>
                <span className="text-gray-500 ml-1 text-[10px]">
                  ({r.prompt_tokens ?? 0}p+{r.completion_tokens ?? 0}c)
                </span>
              </span>
            ) : '—',
          },
          {
            key: 'cost_usd',
            label: 'Cost',
            sortable: true,
            render: r => <span className="text-green-300">{fmtCost(r.cost_usd)}</span>,
          },
          {
            key: 'duration_ms',
            label: 'Latency',
            sortable: true,
            render: r => r.duration_ms != null ? `${r.duration_ms}ms` : '—',
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

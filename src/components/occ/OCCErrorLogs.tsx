import { useState } from 'react';
import type { ErrorLog } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-600/30 text-red-300 border-red-500/50 font-bold',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const cls = map[severity?.toLowerCase()] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {severity}
    </span>
  );
}

interface Props {
  logs: ErrorLog[];
}

export default function OCCErrorLogs({ logs }: Props) {
  const [showResolved, setShowResolved] = useState(false);
  const filtered = showResolved ? logs : logs.filter(e => !e.resolved);
  const unresolvedCount = logs.filter(e => !e.resolved).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Error Logs</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Production failures across backend, frontend, agents, and workers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unresolvedCount > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              {unresolvedCount} unresolved
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
        </div>
      </div>
      <OCCTable
        rows={filtered}
        emptyMessage={showResolved ? 'No errors logged yet.' : 'No unresolved errors — system is healthy.'}
        columns={[
          {
            key: 'created_at',
            label: 'Time',
            sortable: true,
            width: 'w-40',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'severity',
            label: 'Severity',
            sortable: true,
            render: r => <SeverityBadge severity={r.severity} />,
          },
          {
            key: 'error_type',
            label: 'Type',
            sortable: true,
            render: r => <span className="text-orange-300">{r.error_type}</span>,
          },
          {
            key: 'service',
            label: 'Service',
            sortable: true,
            render: r => r.service
              ? <span className="text-blue-300">{r.service}</span>
              : <span className="text-gray-600">—</span>,
          },
          {
            key: 'message',
            label: 'Message',
            render: r => (
              <span className="text-gray-200 truncate max-w-[300px] block" title={r.message}>
                {r.message}
              </span>
            ),
          },
          {
            key: 'occurrence_count',
            label: 'Count',
            sortable: true,
            render: r => (
              <span className={r.occurrence_count > 5 ? 'text-red-400 font-bold' : 'text-gray-300'}>
                {r.occurrence_count}
              </span>
            ),
          },
          {
            key: 'resolved',
            label: 'Resolved',
            sortable: true,
            render: r => <StatusBadge status={r.resolved ? 'resolved' : 'open'} />,
          },
        ]}
      />
    </div>
  );
}

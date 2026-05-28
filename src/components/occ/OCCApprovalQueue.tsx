import type { ApprovalQueueItem } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-600/30 text-red-300 border-red-500/50 font-bold',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const cls = map[priority?.toLowerCase()] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {priority}
    </span>
  );
}

interface Props {
  items: ApprovalQueueItem[];
}

export default function OCCApprovalQueue({ items }: Props) {
  const pending = items.filter(i => i.status === 'pending');
  const others = items.filter(i => i.status !== 'pending');
  const sorted = [...pending, ...others];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Approval Queue</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Human-in-the-loop actions requiring manual review before execution.
          </p>
        </div>
        {pending.length > 0 && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full animate-pulse">
            {pending.length} pending
          </span>
        )}
      </div>
      <OCCTable
        rows={sorted}
        emptyMessage="No items in the approval queue."
        columns={[
          {
            key: 'created_at',
            label: 'Requested',
            sortable: true,
            width: 'w-40',
            render: r => <span className="text-gray-400">{fmt(r.created_at)}</span>,
          },
          {
            key: 'action_type',
            label: 'Action',
            sortable: true,
            render: r => <span className="text-blue-300 font-semibold">{r.action_type}</span>,
          },
          {
            key: 'description',
            label: 'Description',
            render: r => (
              <span className="text-gray-200 truncate max-w-[280px] block" title={r.description}>
                {r.description}
              </span>
            ),
          },
          {
            key: 'priority',
            label: 'Priority',
            sortable: true,
            render: r => <PriorityBadge priority={r.priority} />,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: r => <StatusBadge status={r.status} />,
          },
          {
            key: 'expires_at',
            label: 'Expires',
            render: r => r.expires_at
              ? <span className="text-orange-300">{fmt(r.expires_at)}</span>
              : <span className="text-gray-600">—</span>,
          },
          {
            key: 'review_note',
            label: 'Review Note',
            render: r => r.review_note
              ? <span className="text-gray-300 truncate max-w-[200px] block">{r.review_note}</span>
              : <span className="text-gray-600">—</span>,
          },
        ]}
      />
    </div>
  );
}

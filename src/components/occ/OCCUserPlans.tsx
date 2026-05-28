import type { UserPlan } from '@/hooks/useOCCData';
import OCCTable, { StatusBadge } from './OCCTable';

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 whitespace-nowrap">
        {used.toLocaleString()} / {limit.toLocaleString()}
      </span>
    </div>
  );
}

const TIER_LABELS: Record<number, string> = {
  0: 'Free',
  1: 'Starter',
  2: 'Pro',
  3: 'Enterprise',
};

interface Props {
  plans: UserPlan[];
}

export default function OCCUserPlans({ plans }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">User Plans</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Account tiers, token quotas, and request usage for all users.
        </p>
      </div>
      <OCCTable
        rows={plans}
        emptyMessage="No user plans found."
        columns={[
          {
            key: 'user_id',
            label: 'User ID',
            render: r => (
              <span className="text-gray-400 truncate max-w-[100px] block font-mono" title={r.user_id}>
                {r.user_id.slice(0, 8)}…
              </span>
            ),
          },
          {
            key: 'plan_name',
            label: 'Plan',
            sortable: true,
            render: r => <span className="text-white font-semibold">{r.plan_name}</span>,
          },
          {
            key: 'plan_tier',
            label: 'Tier',
            sortable: true,
            render: r => (
              <span className="text-purple-300">
                {TIER_LABELS[r.plan_tier] ?? `Tier ${r.plan_tier}`}
              </span>
            ),
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
            render: r => <UsageBar used={r.tokens_used} limit={r.tokens_limit} />,
          },
          {
            key: 'requests_used',
            label: 'Requests',
            render: r => <UsageBar used={r.requests_used} limit={r.requests_limit} />,
          },
          {
            key: 'reset_at',
            label: 'Resets',
            render: r => r.reset_at
              ? <span className="text-gray-400">{fmt(r.reset_at)}</span>
              : <span className="text-gray-600">—</span>,
          },
        ]}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 bg-white/5'}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent ? 'text-green-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {count !== undefined && (
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────
function DataTable({ cols, rows }: { cols: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {cols.map(c => (
              <th key={c} className="text-left text-xs text-gray-400 uppercase tracking-wider py-2 px-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-gray-300 font-mono text-xs">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="py-8 text-center text-gray-500">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'text-green-400 bg-green-500/10 border-green-500/30',
    error: 'text-red-400 bg-red-500/10 border-red-500/30',
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    approved: 'text-green-400 bg-green-500/10 border-green-500/30',
    rejected: 'text-red-400 bg-red-500/10 border-red-500/30',
    indexed: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    completed: 'text-green-400 bg-green-500/10 border-green-500/30',
    free: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    pro: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    business: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    enterprise: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  };
  const cls = colors[status] || 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{status}</span>
  );
}

// ─── Tabs ────────────────────────────────────────────────────
const TABS = ['Overview', 'AI Costs', 'Tools', 'Agents', 'RAG Docs', 'Approvals', 'Errors', 'Plans'];

// ─── Main Admin Page ─────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const [activeTab, setActiveTab] = useState('Overview');
  const {
    overview, aiLogs, toolLogs, agentLogs, ragDocs, approvals, errors, plans,
    loading, error, refresh,
    approveAction, resolveError, deleteRagDoc, updatePlan,
  } = useAdminData();

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><span className="text-green-400 font-mono animate-pulse">Authenticating…</span></div>;
  if (!user) return <Navigate to="/login" replace />;

  const fmt = (n: number) => n.toLocaleString();
  const fmtCost = (n: number) => `$${n.toFixed(4)}`;
  const fmtDate = (s: string) => new Date(s).toLocaleString();
  const shortId = (s: string | null) => s ? s.slice(0, 8) + '…' : '—';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 font-mono text-sm font-semibold">D3VONN.IO OPERATOR COMMAND CENTER</span>
          </div>
          <button
            onClick={refresh}
            className="text-xs text-gray-400 hover:text-green-400 border border-white/10 hover:border-green-500/50 px-3 py-1.5 rounded transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            ⚠ {error} — Make sure the backend is running and you have admin access.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab}
              {tab === 'Approvals' && approvals.length > 0 && (
                <span className="ml-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {approvals.length}
                </span>
              )}
              {tab === 'Errors' && errors.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {errors.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-green-400 font-mono text-sm animate-pulse">Loading OCC data…</div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'Overview' && overview && (
              <div>
                <SectionHeader title="Platform Overview" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard label="AI Requests" value={fmt(overview.ai_requests_total)} accent />
                  <StatCard label="Total Cost" value={fmtCost(overview.ai_cost_usd_total)} sub="all time" />
                  <StatCard label="Tokens Used" value={fmt(overview.ai_tokens_total)} />
                  <StatCard label="AI Errors" value={overview.ai_error_count} sub={`${overview.ai_requests_total > 0 ? ((overview.ai_error_count / overview.ai_requests_total) * 100).toFixed(1) : 0}% error rate`} />
                  <StatCard label="Tool Calls" value={fmt(overview.tool_calls_total)} accent />
                  <StatCard label="Tool Errors" value={overview.tool_error_count} />
                  <StatCard label="Agent Tasks" value={fmt(overview.agent_tasks_total)} />
                  <StatCard label="Open Errors" value={overview.open_errors} sub="unresolved" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-white/10 rounded-lg p-5 bg-white/5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Plan Distribution</h3>
                    {Object.entries(overview.plan_distribution).map(([plan, count]) => (
                      <div key={plan} className="flex items-center justify-between mb-2">
                        <Badge status={plan} />
                        <span className="text-white font-mono text-sm">{count} users</span>
                      </div>
                    ))}
                    {Object.keys(overview.plan_distribution).length === 0 && (
                      <p className="text-gray-500 text-sm">No users yet</p>
                    )}
                  </div>
                  <div className="border border-white/10 rounded-lg p-5 bg-white/5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Action Queue</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Pending approvals</span>
                        <span className={`font-mono text-sm ${overview.pending_approvals > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {overview.pending_approvals}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Unresolved errors</span>
                        <span className={`font-mono text-sm ${overview.open_errors > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {overview.open_errors}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── AI COSTS ── */}
            {activeTab === 'AI Costs' && (
              <div>
                <SectionHeader title="AI Request Logs" count={aiLogs.length} />
                <DataTable
                  cols={['Time', 'Model', 'Tokens', 'Cost', 'Latency', 'Status', 'User']}
                  rows={aiLogs.map(r => [
                    fmtDate(r.created_at),
                    r.model,
                    fmt(r.total_tokens),
                    fmtCost(Number(r.cost_usd)),
                    r.latency_ms ? `${r.latency_ms}ms` : '—',
                    <Badge key={r.id} status={r.status} />,
                    shortId(r.user_id),
                  ])}
                />
              </div>
            )}

            {/* ── TOOLS ── */}
            {activeTab === 'Tools' && (
              <div>
                <SectionHeader title="Tool Call Logs" count={toolLogs.length} />
                <DataTable
                  cols={['Time', 'Tool', 'Status', 'Latency', 'User', 'Error']}
                  rows={toolLogs.map(r => [
                    fmtDate(r.created_at),
                    r.tool_name,
                    <Badge key={r.id} status={r.status} />,
                    r.latency_ms ? `${r.latency_ms}ms` : '—',
                    shortId(r.user_id),
                    r.error_message ? <span className="text-red-400">{r.error_message.slice(0, 40)}</span> : '—',
                  ])}
                />
              </div>
            )}

            {/* ── AGENTS ── */}
            {activeTab === 'Agents' && (
              <div>
                <SectionHeader title="Agent Activity Logs" count={agentLogs.length} />
                <DataTable
                  cols={['Time', 'Agent', 'Task', 'Status', 'Duration', 'User']}
                  rows={agentLogs.map(r => [
                    fmtDate(r.created_at),
                    r.agent_type,
                    r.task_summary ? r.task_summary.slice(0, 50) + '…' : '—',
                    <Badge key={r.id} status={r.status} />,
                    r.duration_ms ? `${r.duration_ms}ms` : '—',
                    shortId(r.user_id),
                  ])}
                />
              </div>
            )}

            {/* ── RAG DOCS ── */}
            {activeTab === 'RAG Docs' && (
              <div>
                <SectionHeader title="RAG Document Manager" count={ragDocs.length} />
                <DataTable
                  cols={['Filename', 'Chunks', 'Hits', 'Status', 'Uploaded', 'User', 'Action']}
                  rows={ragDocs.map(r => [
                    r.filename,
                    r.chunk_count,
                    r.retrieval_hits,
                    <Badge key={r.id} status={r.status} />,
                    fmtDate(r.created_at),
                    shortId(r.user_id),
                    r.status !== 'deleted' ? (
                      <button
                        key={r.id}
                        onClick={() => deleteRagDoc(r.id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-0.5 rounded"
                      >
                        Delete
                      </button>
                    ) : <span className="text-gray-600">—</span>,
                  ])}
                />
              </div>
            )}

            {/* ── APPROVALS ── */}
            {activeTab === 'Approvals' && (
              <div>
                <SectionHeader title="Approval Queue" count={approvals.length} />
                {approvals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No pending approvals</div>
                ) : (
                  <div className="space-y-4">
                    {approvals.map(a => (
                      <div key={a.id} className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-yellow-400 font-semibold text-sm">{a.action_type}</span>
                            <span className="text-gray-500 text-xs ml-3">{fmtDate(a.requested_at)}</span>
                          </div>
                          <span className="text-xs text-gray-400">User: {shortId(a.user_id)}</span>
                        </div>
                        <pre className="text-xs text-gray-400 bg-black/40 rounded p-3 mb-4 overflow-x-auto">
                          {JSON.stringify(a.action_data, null, 2)}
                        </pre>
                        <div className="flex gap-3">
                          <button
                            onClick={() => approveAction(a.id, 'approved')}
                            className="text-sm bg-green-500/20 text-green-400 border border-green-500/40 px-4 py-1.5 rounded hover:bg-green-500/30 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => approveAction(a.id, 'rejected')}
                            className="text-sm bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-1.5 rounded hover:bg-red-500/20 transition-colors"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ERRORS ── */}
            {activeTab === 'Errors' && (
              <div>
                <SectionHeader title="Error Logs" count={errors.length} />
                <div className="space-y-3">
                  {errors.map(e => (
                    <div key={e.id} className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-xs font-mono">[{e.source}]</span>
                          <span className="text-white text-sm">{e.error_type}</span>
                        </div>
                        <button
                          onClick={() => resolveError(e.id)}
                          className="text-xs text-green-400 border border-green-500/30 px-2 py-0.5 rounded hover:bg-green-500/10"
                        >
                          Resolve
                        </button>
                      </div>
                      <p className="text-gray-300 text-sm mb-1">{e.message}</p>
                      <p className="text-gray-500 text-xs">{fmtDate(e.created_at)} · User: {shortId(e.user_id)}</p>
                    </div>
                  ))}
                  {errors.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No unresolved errors 🎉</div>
                  )}
                </div>
              </div>
            )}

            {/* ── PLANS ── */}
            {activeTab === 'Plans' && (
              <div>
                <SectionHeader title="User Plans" count={plans.length} />
                <DataTable
                  cols={['User', 'Plan', 'Messages', 'Tokens', 'Uploads', 'Period', 'Action']}
                  rows={plans.map(p => [
                    shortId(p.user_id),
                    <Badge key={p.id} status={p.plan} />,
                    `${p.messages_used}/${p.messages_limit}`,
                    `${fmt(p.tokens_used)}/${fmt(p.tokens_limit)}`,
                    `${p.uploads_used}/${p.uploads_limit}`,
                    new Date(p.period_end).toLocaleDateString(),
                    <select
                      key={p.id}
                      defaultValue={p.plan}
                      onChange={e => updatePlan(p.user_id, e.target.value)}
                      className="text-xs bg-black border border-white/20 text-white rounded px-2 py-1"
                    >
                      {['free', 'pro', 'business', 'enterprise'].map(pl => (
                        <option key={pl} value={pl}>{pl}</option>
                      ))}
                    </select>,
                  ])}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

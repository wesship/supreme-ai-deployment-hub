import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import AppShell from '@/components/app/AppShell';
import { supabase } from '@/integrations/supabase/client';

type Approval = {
  id: string;
  action_type: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  requested_at?: string | null;
  created_at?: string | null;
  requested_by?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_URL?.trim() || 'https://api.d3vonn.io').replace(/\/$/, '');

export default function ApprovalCenter() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sign in required.');
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/api/admin/approvals?status=pending`, {
        headers,
        cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || `Approval Center returned HTTP ${response.status}`);
      }
      setItems(await response.json() as Approval[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load approvals.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = async (item: Approval, decision: 'approved' | 'rejected') => {
    setWorkingId(item.id);
    setError(null);
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${API_BASE}/api/admin/approvals/${encodeURIComponent(item.id)}?decision=${decision}`,
        { method: 'PATCH', headers },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || `Approval update returned HTTP ${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update approval.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(245,158,11,0.08),transparent_34%),linear-gradient(180deg,#050504_0%,#0a0a08_100%)] text-white">
        <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Governance</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Approval Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Review human-in-the-loop actions before execution. This surface uses the existing governed approval queue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {error && (
            <div className="mt-6 border border-red-400/25 bg-red-500/5 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4">
            {!loading && items.length === 0 && !error && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <ShieldCheck className="mx-auto h-7 w-7 text-emerald-300" />
                <h2 className="mt-3 text-lg font-bold">No pending approvals</h2>
                <p className="mt-1 text-sm text-white/45">Hermes and governed workflows have nothing waiting for operator review.</p>
              </div>
            )}

            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-amber-300/20 bg-amber-200/[0.035] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-amber-100">{item.action_type}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                        {item.priority || 'normal'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/65">{item.description || 'No additional description provided.'}</p>
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-white/35">
                      {item.requested_at || item.created_at ? new Date(item.requested_at || item.created_at || '').toLocaleString() : 'Request time not reported'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={workingId === item.id}
                      onClick={() => void decide(item, 'approved')}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={workingId === item.id}
                      onClick={() => void decide(item, 'rejected')}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-400/5 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
